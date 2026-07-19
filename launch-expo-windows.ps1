$ErrorActionPreference = 'Stop'
$ruleName = 'JobsMatchNow Expo Preview'
$ports = @(4173, 8081)

function Test-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) {
  Write-Host 'JobsMatchNow needs one Windows permission prompt for private Wi-Fi testing.' -ForegroundColor Cyan
  Start-Process powershell.exe -Verb RunAs -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
  exit
}

$windowsIp = Get-NetIPConfiguration |
  Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } |
  Select-Object -ExpandProperty IPv4Address |
  Select-Object -First 1 -ExpandProperty IPAddress
$wslIp = ((& wsl.exe -d Ubuntu -- hostname -I) -split '\s+')[0]
if (-not $windowsIp -or -not $wslIp) { throw 'Connect to Wi-Fi, then run the launcher again.' }

try {
  Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  foreach ($port in $ports) {
    & netsh.exe interface portproxy delete v4tov4 listenport=$port listenaddress=0.0.0.0 2>$null | Out-Null
    & netsh.exe interface portproxy add v4tov4 listenport=$port listenaddress=0.0.0.0 connectport=$port connectaddress=$wslIp | Out-Null
  }
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $ports -Profile Private | Out-Null
  Write-Host "`nStarting Expo Go QR preview for ${windowsIp}." -ForegroundColor Green
  $launchCommand = "cd /home/dzoan/jobmatch3 && MOBILE_HOST='$windowsIp' npm run expo:mobile"
  & wsl.exe -d Ubuntu -- bash -lc $launchCommand
}
finally {
  foreach ($port in $ports) { & netsh.exe interface portproxy delete v4tov4 listenport=$port listenaddress=0.0.0.0 2>$null | Out-Null }
  Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  Write-Host "`nJobsMatchNow Expo preview route closed." -ForegroundColor DarkGray
}
