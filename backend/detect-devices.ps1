$ErrorActionPreference = "Stop"

$detectedClients = @{}
$warnings = New-Object System.Collections.Generic.List[string]

function Add-DetectedClient {
    param(
        [string]$MacAddress,
        [string[]]$HostNames = @()
    )

    if ([string]::IsNullOrWhiteSpace($MacAddress)) {
        return
    }

    $normalizedMac = $MacAddress.Trim().Replace(":", "-").ToLowerInvariant()
    if (
        $normalizedMac -notmatch "^(?:[0-9a-f]{2}-){5}[0-9a-f]{2}$" -or
        $normalizedMac -eq "ff-ff-ff-ff-ff-ff"
    ) {
        return
    }

    if (-not $detectedClients.ContainsKey($normalizedMac)) {
        $detectedClients[$normalizedMac] = @{
            macAddress = $normalizedMac
            hostNames = @()
        }
    }

    $existingNames = @($detectedClients[$normalizedMac].hostNames)
    $detectedClients[$normalizedMac].hostNames = @(
        $existingNames + @($HostNames | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) |
            Select-Object -Unique
    )
}

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction Stop
    [Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType=WindowsRuntime] | Out-Null
    [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager, Windows.Networking.NetworkOperators, ContentType=WindowsRuntime] | Out-Null

    $profile = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
    if ($null -ne $profile) {
        $manager = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($profile)
        foreach ($client in @($manager.GetTetheringClients())) {
            $hostNames = @($client.HostNames | ForEach-Object { $_.RawName })
            Add-DetectedClient -MacAddress ([string]$client.MacAddress) -HostNames $hostNames
        }
    }
    else {
        $warnings.Add("Windows did not report an active internet connection profile for hotspot detection.")
    }
}
catch {
    $warnings.Add("Windows hotspot client API unavailable: $($_.Exception.Message)")
}

try {
    $wifiDirectAdapters = @(
        Get-NetAdapter -IncludeHidden -ErrorAction Stop |
            Where-Object { $_.InterfaceDescription -match "Wi-Fi Direct Virtual Adapter" }
    )
    $adapterIndexes = @($wifiDirectAdapters | ForEach-Object { $_.ifIndex })

    $hotspotAddresses = @(
        Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
            Where-Object {
                $adapterIndexes -contains $_.InterfaceIndex -and
                $_.IPAddress -notlike "169.254.*"
            }
    )

    if ($hotspotAddresses.Count -eq 0) {
        $warnings.Add("No active Windows Wi-Fi Direct hotspot adapter was found. Turn on Mobile hotspot and reconnect the phone.")
    }

    foreach ($address in $hotspotAddresses) {
        $ipParts = $address.IPAddress.Split(".")
        if ($ipParts.Count -ne 4) {
            continue
        }

        $subnetPrefix = "$($ipParts[0]).$($ipParts[1]).$($ipParts[2])."
        $neighbors = @(
            Get-NetNeighbor -AddressFamily IPv4 -InterfaceIndex $address.InterfaceIndex -ErrorAction Stop |
                Where-Object {
                    $_.IPAddress.StartsWith($subnetPrefix) -and
                    $_.IPAddress -ne $address.IPAddress -and
                    $_.State -notin @("Unreachable", "Incomplete") -and
                    $_.LinkLayerAddress -ne "00-00-00-00-00-00"
                }
        )

        foreach ($neighbor in $neighbors) {
            Add-DetectedClient -MacAddress ([string]$neighbor.LinkLayerAddress)
        }
    }
}
catch {
    $warnings.Add("Could not read Windows hotspot network neighbors: $($_.Exception.Message)")
}

$result = [PSCustomObject]@{
    clientCount = $detectedClients.Count
    clients = @($detectedClients.Values | Sort-Object macAddress)
    warnings = @($warnings)
}

ConvertTo-Json -InputObject $result -Depth 5 -Compress
