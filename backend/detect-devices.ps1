
$ErrorActionPreference = "Stop"

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime

    [Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType=WindowsRuntime] | Out-Null
    [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager, Windows.Networking.NetworkOperators, ContentType=WindowsRuntime] | Out-Null

    $profile = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()

    if ($null -eq $profile) {
        throw "No active internet connection profile was found."
    }

    $manager = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($profile)
    $clients = @($manager.GetTetheringClients())

    $result = [PSCustomObject]@{
        clientCount = [int]$manager.ClientCount
        clients = @(
            foreach ($client in $clients) {
                [PSCustomObject]@{
                    macAddress = [string]$client.MacAddress
                    hostNames = @(
                        $client.HostNames | ForEach-Object {
                            $_.RawName
                        }
                    )
                }
            }
        )
    }

    ConvertTo-Json -InputObject $result -Depth 5 -Compress
}
catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
