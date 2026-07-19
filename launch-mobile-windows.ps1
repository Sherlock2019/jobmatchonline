$ErrorActionPreference = 'Stop'
$ruleName = 'JobMatch Mobile Preview'
$webPort = 4173

function Test-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) {
  Write-Host 'JobMatch needs one Windows permission prompt to make the preview reachable on your private Wi-Fi.' -ForegroundColor Cyan
  Start-Process powershell.exe -Verb RunAs -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
  exit
}

$windowsIp = Get-NetIPConfiguration |
  Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } |
  Select-Object -ExpandProperty IPv4Address |
  Select-Object -First 1 -ExpandProperty IPAddress
$wslIp = ((& wsl.exe -d Ubuntu -- hostname -I) -split '\s+')[0]

if (-not $windowsIp -or -not $wslIp) {
  throw 'Could not detect the Windows or WSL network address. Connect to Wi-Fi and try again.'
}

try {
  Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  & netsh.exe interface portproxy delete v4tov4 listenport=$webPort listenaddress=0.0.0.0 2>$null | Out-Null
  & netsh.exe interface portproxy add v4tov4 listenport=$webPort listenaddress=0.0.0.0 connectport=$webPort connectaddress=$wslIp | Out-Null
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $webPort -Profile Private | Out-Null

  Write-Host "`nOpening a temporary private Wi-Fi route at http://${windowsIp}:${webPort}" -ForegroundColor Green
  Write-Host 'The route and firewall rule will be removed automatically when you stop the launcher.' -ForegroundColor DarkGray
  $launchCommand = "cd /home/dzoan/jobmatch3 && MOBILE_HOST='$windowsIp' MOBILE_WEB_PORT=$webPort MOBILE_API_PORT=4174 npm run mobile"
  & wsl.exe -d Ubuntu -- bash -lc $launchCommand
}
finally {
  & netsh.exe interface portproxy delete v4tov4 listenport=$webPort listenaddress=0.0.0.0 2>$null | Out-Null
  Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  Write-Host "`nJobMatch mobile preview route closed." -ForegroundColor DarkGray
}
