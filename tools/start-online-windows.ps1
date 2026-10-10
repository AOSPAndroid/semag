# semaG Internet host. Requires Windows PowerShell 5.1+ and an installed cloudflared.
# No router changes, automatic tunnel-client installs, or process-name termination.
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$localOrigin = 'http://127.0.0.1:3000'
$ownedHost = $null
$ownedTunnel = $null
$temporaryDirectory = $null
$interactiveKeys = $false
$previousControlC = $false
$previousTls = [Net.ServicePointManager]::SecurityProtocol
$exitCode = 0

function Write-Stage([string] $Label, [string] $Message) {
    Write-Host ('  [{0}] ' -f $Label) -NoNewline -ForegroundColor Cyan
    Write-Host $Message
}

function Test-SemagHost([string] $Origin, [bool] $FullIdentity = $false) {
    try {
        $health = Invoke-RestMethod -Uri "$Origin/health" -TimeoutSec 2 -MaximumRedirection 0
        if ($health.ok -ne $true -or $health.tickRate -lt 1 -or
            $health.games -notcontains 'voxel-breach' -or
            $health.games -notcontains 'voxel-royale' -or
            $health.games -notcontains 'voxel-horde') { return $false }
        if ($FullIdentity) {
            $info = Invoke-RestMethod -Uri "$Origin/api/host-info" -TimeoutSec 2 -MaximumRedirection 0
            if ($info.port -ne 3000 -or [string]::IsNullOrWhiteSpace($info.hostname)) { return $false }
            $index = Invoke-WebRequest -Uri "$Origin/" -UseBasicParsing -TimeoutSec 2 -MaximumRedirection 0
            if (-not $index.Content.Contains('<meta name="semag-hosting" content="pc">')) { return $false }
        }
        return $true
    } catch { return $false }
}

function Test-LocalPort {
    $client = New-Object Net.Sockets.TcpClient
    try {
        $connection = $client.BeginConnect('127.0.0.1', 3000, $null, $null)
        if (-not $connection.AsyncWaitHandle.WaitOne(500)) { return $false }
        $client.EndConnect($connection)
        return $true
    } catch { return $false }
    finally { $client.Dispose() }
}

function Start-OwnedProcess([string] $File, [string] $Arguments, [bool] $IsGameHost = $false) {
    $settings = New-Object Diagnostics.ProcessStartInfo
    $settings.FileName = $File
    $settings.Arguments = $Arguments
    $settings.WorkingDirectory = $root
    $settings.UseShellExecute = $false
    $settings.CreateNoWindow = $true
    $settings.RedirectStandardOutput = $true
    $settings.RedirectStandardError = $true
    if ($IsGameHost) {
        $settings.EnvironmentVariables['PORT'] = '3000'
        $settings.EnvironmentVariables['SEMAG_NO_ANIMATION'] = '1'
    }
    $process = New-Object Diagnostics.Process
    $process.StartInfo = $settings
    try {
        if (-not $process.Start()) { throw "Could not start $File." }
        return [pscustomobject]@{
            Process = $process
            OutputRead = $process.StandardOutput.ReadLineAsync()
            ErrorRead = $process.StandardError.ReadLineAsync()
            RecentLines = New-Object 'System.Collections.Generic.List[string]'
        }
    } catch {
        # This object owns only the process started here, even if stream setup fails.
        try { if (-not $process.HasExited) { $process.Kill() } } catch {}
        $process.Dispose()
        throw
    }
}

function Receive-ProcessLines($Child) {
    foreach ($pair in @(@('OutputRead', 'StandardOutput'), @('ErrorRead', 'StandardError'))) {
        $taskName = $pair[0]
        $streamName = $pair[1]
        $count = 0
        while ($null -ne $Child.$taskName -and $Child.$taskName.IsCompleted -and $count -lt 100) {
            $line = $Child.$taskName.GetAwaiter().GetResult()
            if ($null -eq $line) { $Child.$taskName = $null; break }
            # Drain both pipes continuously, with bounded in-memory diagnostics.
            $Child.RecentLines.Add($line.Substring(0, [Math]::Min(1200, $line.Length)))
            if ($Child.RecentLines.Count -gt 30) { $Child.RecentLines.RemoveAt(0) }
            $Child.$taskName = $Child.Process.$streamName.ReadLineAsync()
            $count++
            $line
        }
    }
}

function Stop-OwnedProcess($Child, [string] $Label) {
    if ($null -eq $Child) { return }
    try {
        if (-not $Child.Process.HasExited) {
            $Child.Process.Kill()
            if (-not $Child.Process.WaitForExit(3000)) { throw 'Process did not exit in time.' }
        }
    } catch {
        Write-Warning ("Could not stop our {0} process (PID {1}): {2}" -f $Label, $Child.Process.Id, $_.Exception.Message)
    } finally { $Child.Process.Dispose() }
}

function Stop-KeyPressed {
    if (-not $interactiveKeys) { return $false }
    if ([Console]::KeyAvailable) {
        $key = [Console]::ReadKey($true)
        return $key.Key -eq [ConsoleKey]::Enter -or [int]$key.KeyChar -eq 3
    }
    return $false
}

try {
    if ($env:OS -ne 'Windows_NT') { throw 'Run this launcher on your Windows game-host PC.' }
    if (-not (Test-Path -LiteralPath (Join-Path $root 'server.js'))) { throw 'Extract the complete semaG PC download first.' }
    [Net.ServicePointManager]::SecurityProtocol = $previousTls -bor [Net.SecurityProtocolType]::Tls12
    try {
        if (-not [Console]::IsInputRedirected) {
            $previousControlC = [Console]::TreatControlCAsInput
            [Console]::TreatControlCAsInput = $true
            $interactiveKeys = $true
        }
    } catch { $interactiveKeys = $false }

    Write-Host ''
    Write-Host '   ####  #### #   #  ###   ####' -ForegroundColor Cyan
    Write-Host '   #     #    ## ## #   #  #' -ForegroundColor Cyan
    Write-Host '   ####  ###  # # # #####  # ##' -ForegroundColor Cyan
    Write-Host '      #  #    #   # #   #  #  #' -ForegroundColor Cyan
    Write-Host '   ####  #### #   # #   #  ####' -ForegroundColor Cyan
    Write-Host ''
    Write-Host ('  semaG / INTERNET HOST / {0}' -f $env:COMPUTERNAME) -ForegroundColor White
    Write-Host '  Keep this window and this PC running while you play.'
    Write-Host '  Ctrl+C or Enter stops this launcher and its own processes.'
    Write-Host ''

    $cloudflared = Get-Command cloudflared.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    $cloudflaredPath = if ($null -ne $cloudflared) { $cloudflared.Source } else { Join-Path $root 'cloudflared.exe' }
    if (-not (Test-Path -LiteralPath $cloudflaredPath -PathType Leaf)) {
        Write-Host '  Install the official Cloudflare tunnel client once:' -ForegroundColor Yellow
        Write-Host '    winget install --id Cloudflare.cloudflared --exact'
        Write-Host '  Then close this window and run start-online-windows.bat again.'
        Write-Host '  Official manual installation: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/'
        throw 'cloudflared is not installed. No game host or tunnel was started.'
    }

    if (Test-SemagHost $localOrigin $true) {
        Write-Stage 'HOST' 'Using the semaG host already running on port 3000. It will be left running when you stop.'
    } else {
        if (Test-LocalPort) { throw 'Port 3000 is occupied by another or unhealthy service. Close it yourself or start your semaG host on port 3000; this launcher will not stop it.' }
        $node = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -eq $node) { throw 'Install Node.js 20 or newer from https://nodejs.org, then run this launcher again.' }
        $nodeVersion = & $node.Source --version
        if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 20) {
            throw 'Node.js 20 or newer is required. Update Node.js from https://nodejs.org.'
        }
        if (-not (Test-Path -LiteralPath (Join-Path $root 'node_modules\ws\package.json'))) {
            $npm = Get-Command npm.cmd -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($null -eq $npm) { throw 'npm is missing. Reinstall the current Node.js LTS release.' }
            Write-Stage 'SETUP' 'Installing the game-host dependency from package-lock.json...'
            Push-Location -LiteralPath $root
            try {
                # npm runs in the foreground, so let its console receive Ctrl+C normally.
                if ($interactiveKeys) { [Console]::TreatControlCAsInput = $false }
                & $npm.Source ci --no-audit --no-fund
                if ($LASTEXITCODE -ne 0) { throw 'The game-host dependency could not be installed. Review the npm error above.' }
            } finally {
                if ($interactiveKeys) { [Console]::TreatControlCAsInput = $true }
                Pop-Location
            }
        }
        Write-Stage 'HOST' 'Starting your game server on localhost:3000...'
        $ownedHost = Start-OwnedProcess $node.Source 'server.js' $true
        $deadline = [DateTime]::UtcNow.AddSeconds(15)
        $hostReady = $false
        do {
            Receive-ProcessLines $ownedHost | Out-Null
            if ($ownedHost.Process.HasExited) { throw ("Game host exited: {0}" -f ($ownedHost.RecentLines -join [Environment]::NewLine)) }
            if (Stop-KeyPressed) { throw [OperationCanceledException]::new('Stopped before the game host was ready.') }
            $hostReady = Test-SemagHost $localOrigin $true
            if (-not $hostReady) { Start-Sleep -Milliseconds 250 }
        } while (-not $hostReady -and [DateTime]::UtcNow -lt $deadline)
        if (-not $hostReady) { throw 'The game host did not become ready on port 3000.' }
    }

    $temporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) ('semag-online-' + [Guid]::NewGuid().ToString('N'))
    [IO.Directory]::CreateDirectory($temporaryDirectory) | Out-Null
    $emptyConfig = Join-Path $temporaryDirectory 'quick-tunnel.yml'
    # Use an explicit empty config without changing any existing Cloudflare configuration.
    [IO.File]::WriteAllText($emptyConfig, '{}', (New-Object Text.UTF8Encoding($false)))
    Write-Stage 'TUNNEL' 'Opening an HTTPS link to your PC. No router port forwarding is needed...'
    $tunnelArguments = 'tunnel --config "{0}" --no-autoupdate --url {1} --protocol http2' -f $emptyConfig, $localOrigin
    $ownedTunnel = Start-OwnedProcess $cloudflaredPath $tunnelArguments
    $deadline = [DateTime]::UtcNow.AddSeconds(90)
    $publicOrigin = $null
    $publicReady = $false
    $nextPublicCheck = [DateTime]::MinValue
    while (-not $publicReady -and [DateTime]::UtcNow -lt $deadline) {
        foreach ($line in @(Receive-ProcessLines $ownedTunnel)) {
            if ($line -match 'https://[a-z0-9-]+\.trycloudflare\.com') { $publicOrigin = $Matches[0] }
        }
        if ($null -ne $ownedHost) { Receive-ProcessLines $ownedHost | Out-Null }
        if ($ownedTunnel.Process.HasExited) { throw ("Tunnel exited: {0}" -f ($ownedTunnel.RecentLines -join [Environment]::NewLine)) }
        if ($null -ne $ownedHost -and $ownedHost.Process.HasExited) { throw 'The game host stopped while the tunnel was starting.' }
        if (Stop-KeyPressed) { throw [OperationCanceledException]::new('Stopped before the tunnel was ready.') }
        if ($null -ne $publicOrigin -and [DateTime]::UtcNow -ge $nextPublicCheck) {
            $publicReady = Test-SemagHost $publicOrigin
            $nextPublicCheck = [DateTime]::UtcNow.AddSeconds(2)
        }
        if (-not $publicReady) { Start-Sleep -Milliseconds 250 }
    }
    if (-not $publicReady) {
        if ($ownedTunnel.RecentLines.Count) { Write-Host ($ownedTunnel.RecentLines -join [Environment]::NewLine) -ForegroundColor DarkGray }
        throw 'The public tunnel did not become reachable. Check your connection; the network must allow HTTPS and Cloudflare Tunnel outbound TCP port 7844.'
    }

    Write-Host ''
    Write-Stage 'ONLINE' 'Your public game link is ready:'
    Write-Host ('  ' + $publicOrigin) -ForegroundColor Green
    Write-Host ''
    Write-Host '  1. Open this public link on your PC too, then create a room.'
    Write-Host '  2. Share that link with friends; they can join from other networks.'
    Write-Host '  Or paste it into Play with friends on https://semag.daaalil.chatgpt.site/'
    Write-Host '  This address changes when the tunnel restarts. Anyone with the link can reach your hub.'
    Write-Host '  Ctrl+C or Enter stops the tunnel. An existing game host stays running.'
    Write-Host ''

    $nextHostCheck = [DateTime]::UtcNow.AddSeconds(10)
    $healthFailures = 0
    while (-not (Stop-KeyPressed)) {
        Receive-ProcessLines $ownedTunnel | Out-Null
        if ($ownedTunnel.Process.HasExited) { throw ("The tunnel stopped: {0}" -f ($ownedTunnel.RecentLines -join [Environment]::NewLine)) }
        if ($null -ne $ownedHost) {
            Receive-ProcessLines $ownedHost | Out-Null
            if ($ownedHost.Process.HasExited) { throw 'The game host stopped. Run the launcher again to start a new session.' }
        }
        if ([DateTime]::UtcNow -ge $nextHostCheck) {
            if (Test-SemagHost $localOrigin) { $healthFailures = 0 } else { $healthFailures++ }
            if ($healthFailures -ge 3) { throw 'The local game host is no longer responding. The tunnel will be stopped.' }
            $nextHostCheck = [DateTime]::UtcNow.AddSeconds(10)
        }
        Start-Sleep -Milliseconds 250
    }
} catch [OperationCanceledException] {
    Write-Host '  Stopped.'
} catch {
    $exitCode = 1
    Write-Host ''
    Write-Host ('  ' + $_.Exception.Message) -ForegroundColor Red
} finally {
    # Operate only on retained Process objects created by this invocation, never on names or a port owner.
    Stop-OwnedProcess $ownedTunnel 'tunnel'
    Stop-OwnedProcess $ownedHost 'game host'
    if ($null -ne $temporaryDirectory) {
        try { [IO.Directory]::Delete($temporaryDirectory, $true) } catch {}
    }
    if ($interactiveKeys) { [Console]::TreatControlCAsInput = $previousControlC }
    [Net.ServicePointManager]::SecurityProtocol = $previousTls
    Write-Host '  semaG Internet host closed.' -ForegroundColor DarkGray
}
exit $exitCode
