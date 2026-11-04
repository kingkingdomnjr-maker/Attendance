$ErrorActionPreference = "Stop"

$taskName = "AttendanceHotspotDeviceAgent"
$backendPath = $PSScriptRoot
$projectPath = Split-Path -Parent $backendPath
$agentPath = Join-Path $backendPath "local-agent.js"

if (-not (Test-Path -LiteralPath $agentPath)) {
    throw "Could not find the local device agent at $agentPath."
}

$nodeCommand = Get-Command "node.exe" -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
    throw "Node.js is required. Install the current Node.js LTS release, then run this setup script again."
}

$npmCommand = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
if (-not $npmCommand) {
    throw "npm was not found. Repair or reinstall Node.js with npm, then run this setup script again."
}

Write-Host "Installing local device-agent dependencies..."
Push-Location $projectPath
try {
    & $npmCommand.Source ci --prefix backend
    if ($LASTEXITCODE -ne 0) {
        throw "Dependency installation failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

$action = New-ScheduledTaskAction `
    -Execute $nodeCommand.Source `
    -Argument "`"$agentPath`"" `
    -WorkingDirectory $backendPath
$trigger = New-ScheduledTaskTrigger -AtLogOn -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)
$principal = New-ScheduledTaskPrincipal `
    -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description "Runs the local Windows hotspot device scanner for Attendance." `
    -Force | Out-Null

$agentHealthUri = "http://127.0.0.1:3002/health"
$agentIsRunning = $false
try {
    $health = Invoke-RestMethod -Uri $agentHealthUri -TimeoutSec 2
    $agentIsRunning = $health.status -eq "ok"
}
catch {
    $agentIsRunning = $false
}

if (-not $agentIsRunning) {
    Start-ScheduledTask -TaskName $taskName

    for ($attempt = 0; $attempt -lt 10; $attempt++) {
        Start-Sleep -Seconds 1
        try {
            $health = Invoke-RestMethod -Uri $agentHealthUri -TimeoutSec 2
            if ($health.status -eq "ok") {
                $agentIsRunning = $true
                break
            }
        }
        catch {
            $agentIsRunning = $false
        }
    }
}

if (-not $agentIsRunning) {
    throw "The startup task was installed, but the scanner did not respond. Check the task '$taskName' in Windows Task Scheduler."
}

Write-Host "Setup complete. The hotspot scanner will start automatically whenever you sign in."
Write-Host "You can now open the admin dashboard and click Start Session; no terminal needs to stay open."
