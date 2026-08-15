<#
.SYNOPSIS
    Builds Noto's desktop installer and collects every release artifact into build\.

.DESCRIPTION
    One command from a clean checkout to a signed-shaped release folder:

        Node 22  ->  verify  ->  web bundles  ->  electron-forge make  ->  build\

    Run it from an elevated PowerShell for the smoothest result. Administrator is
    not required, but it lets the script add a Microsoft Defender exclusion for
    the output folder, which is what stops Squirrel's rcedit step failing with
    "Unable to commit changes" while Defender is still scanning the freshly
    written 200 MB binaries.

.PARAMETER Version
    Version to stamp into the build. Defaults to the workspace version in
    package.json. Passing a value rewrites every manifest via scripts/version.mjs.

.PARAMETER Arch
    x64 (default) or arm64.

.PARAMETER SkipVerify
    Skip lint, typecheck and unit tests. Faster, and appropriate only when you
    have just run them.

.PARAMETER SkipWeb
    Skip building the web application and website bundles.

.PARAMETER KeepProcesses
    Do not stop running Noto instances. The build will fail if any are running
    from the output directory.

.EXAMPLE
    .\noto-release.ps1
    Builds the current workspace version for x64.

.EXAMPLE
    .\noto-release.ps1 -Version 1.0.0
    Stamps 1.0.0 across every manifest, then builds.

.EXAMPLE
    .\noto-release.ps1 -Arch arm64 -SkipVerify
#>

[CmdletBinding()]
param(
    [string]$Version,
    [ValidateSet('x64', 'arm64')]
    [string]$Arch = 'x64',
    [switch]$SkipVerify,
    [switch]$SkipWeb,
    [switch]$KeepProcesses
)

$ErrorActionPreference = 'Stop'

# Windows PowerShell 5.1 has no pipeline chain operators, so every external
# command is checked explicitly against $LASTEXITCODE.
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

$BuildDir = Join-Path $repoRoot 'build'
$ForgeOut = Join-Path $repoRoot 'apps\desktop\out'

# Electron Forge 7.11 pins @electron/packager 18.4.4, which exits silently with
# status 0 on Node 24 while extracting the Electron archive - no out/ directory
# and no error. Node 22 is the version that works. Remove this once Forge bumps
# its packager dependency.
$RequiredNodeMajor = 22

function Write-Step($message) { Write-Host "`n=== $message ===" -ForegroundColor Cyan }
function Write-Ok($message) { Write-Host "  [OK] $message" -ForegroundColor Green }
function Write-Info($message) { Write-Host "  $message" -ForegroundColor Yellow }
function Write-Warn($message) { Write-Host "  [WARN] $message" -ForegroundColor DarkYellow }

# Runs an external tool and judges it by its exit code.
#
# Build tools write progress and warnings to stderr as a matter of course. In
# Windows PowerShell every stderr line from a native command becomes a
# NativeCommandError, which under ErrorActionPreference = 'Stop' would abort the
# release over a deprecation notice. For an external process the exit code is
# the only trustworthy verdict, so that is what is checked here.
function Invoke-Native {
    param(
        [Parameter(Mandatory)][string]$What,
        [Parameter(Mandatory)][scriptblock]$Command
    )

    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $Command
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previous
    }

    if ($code -ne 0) {
        Write-Error "$What failed (exit code $code) - aborting before anything is collected."
        exit 1
    }
}

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

Write-Host "=== Noto Release Build ===" -ForegroundColor Cyan
Write-Host "  Repository:    $repoRoot"
Write-Host "  Architecture:  $Arch"
Write-Host "  Elevated:      $isAdmin"

# ---------------------------------------------------------------------------
# Step 1: Node 22
# ---------------------------------------------------------------------------
Write-Step 'Node runtime'

$currentNode = (& node -v) -replace '^v', ''
$currentMajor = [int]($currentNode -split '\.')[0]

if ($currentMajor -ne $RequiredNodeMajor) {
    Write-Info "Node $currentNode is on PATH, but packaging needs Node $RequiredNodeMajor.x."

    $fnmRoot = Join-Path $env:APPDATA 'fnm\node-versions'
    $candidate = $null
    if (Test-Path $fnmRoot) {
        $candidate = Get-ChildItem $fnmRoot -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match "^v$RequiredNodeMajor\." } |
            Sort-Object Name -Descending |
            Select-Object -First 1
    }

    if (-not $candidate) {
        Write-Error @"
Node $RequiredNodeMajor.x is not installed.

Install it without disturbing your current Node:

    winget install --id Schniz.fnm -e
    fnm install $RequiredNodeMajor

Then run this script again.
"@
        exit 1
    }

    $nodeDir = Join-Path $candidate.FullName 'installation'
    $env:PATH = "$nodeDir;$env:PATH"
    $currentNode = (& node -v) -replace '^v', ''
    Write-Ok "Switched to Node $currentNode for this build"
} else {
    Write-Ok "Node $currentNode"
}

# ---------------------------------------------------------------------------
# Step 2: Version
# ---------------------------------------------------------------------------
Write-Step 'Version'

if ($Version) {
    Invoke-Native 'version.mjs set' { & node scripts/version.mjs set $Version | Out-Null }
    Write-Ok "Stamped $Version across every manifest"
} else {
    $Version = (& node -p "require('./package.json').version").Trim()
    Write-Ok "Using the workspace version $Version"
}

# ---------------------------------------------------------------------------
# Step 3: Clear the way
# ---------------------------------------------------------------------------
Write-Step 'Preparing'

# Squirrel launches the packaged application during releasify to read its
# metadata, and Noto stays open. Those instances then hold out\ and the next
# build fails with EBUSY while Forge tries to clear it.
if (-not $KeepProcesses) {
    $running = @(Get-Process noto -ErrorAction SilentlyContinue)
    if ($running.Count -gt 0) {
        $running | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Info "Stopped $($running.Count) running Noto process(es)"
    }
}

# Defender holding a handle on a newly written executable is what makes
# rcedit fail intermittently. An exclusion on the build directories removes the
# race rather than retrying around it.
if ($isAdmin) {
    try {
        Add-MpPreference -ExclusionPath $BuildDir, $ForgeOut -ErrorAction Stop
        Write-Ok 'Added a Defender exclusion for the build directories'
    } catch {
        Write-Warn "Could not add a Defender exclusion: $($_.Exception.Message)"
    }
} else {
    Write-Warn 'Not elevated - if the build fails in rcedit with "Unable to commit changes", rerun as Administrator.'
}

# A stale artifact that survives into the collect step would be published as if
# it were this build's, so both directories are purged first.
function Clear-BuildDirectory {
    param([string]$Path, [int]$TimeoutSeconds = 60)

    if (-not (Test-Path $Path)) { return $true }

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Test-Path $Path) -and (Get-Date) -lt $deadline) {
        Remove-Item $Path -Recurse -Force -ErrorAction SilentlyContinue
        if (Test-Path $Path) { Start-Sleep -Seconds 3 }
    }

    return -not (Test-Path $Path)
}

# build\ holds only files this script wrote, so it always clears.
if (-not (Clear-BuildDirectory -Path $BuildDir)) {
    Write-Error "Could not clear $BuildDir - close anything reading from it and retry."
    exit 1
}

# Forge's output is the awkward one. Windows keeps a handle on a freshly
# packaged binary for a while after the process that made it has exited —
# Defender scanning a 200 MB executable is the usual reason — and Forge refuses
# to start until it can delete its output directory. Rather than block on a
# handle that no process appears to own, redirect this build to a fresh
# directory and let the stale one be cleaned up later.
if (-not (Clear-BuildDirectory -Path $ForgeOut)) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $fallback = "out-$stamp"
    $env:NOTO_FORGE_OUT = $fallback
    $ForgeOut = Join-Path $repoRoot "apps\desktop\$fallback"

    Write-Warn "apps\desktop\out is locked by another process; building into apps\desktop\$fallback instead."
    Write-Warn 'Delete the stale directory once Windows releases it. Running elevated avoids this entirely.'
} else {
    # Clear any fallback directory a previous locked run left behind.
    Get-ChildItem (Join-Path $repoRoot 'apps\desktop') -Directory -Filter 'out-*' -ErrorAction SilentlyContinue |
        ForEach-Object { Clear-BuildDirectory -Path $_.FullName -TimeoutSeconds 5 | Out-Null }
}

Write-Ok 'Cleared previous build output'

# Anything collected below must be newer than this mark.
$buildStart = Get-Date

# ---------------------------------------------------------------------------
# Step 4: Verify
# ---------------------------------------------------------------------------
if (-not $SkipVerify) {
    Write-Step 'Verifying'

    Invoke-Native 'pnpm format:check' { & pnpm format:check }
    Write-Ok 'Formatting'
    Invoke-Native 'pnpm lint' { & pnpm lint }
    Write-Ok 'Lint'
    Invoke-Native 'pnpm typecheck' { & pnpm typecheck }
    Write-Ok 'Typecheck'
    Invoke-Native 'pnpm test' { & pnpm test }
    Write-Ok 'Unit tests'
} else {
    Write-Step 'Verifying (skipped)'
}

# ---------------------------------------------------------------------------
# Step 5: Web bundles
# ---------------------------------------------------------------------------
if (-not $SkipWeb) {
    Write-Step 'Building the web application and website'

    $env:VITE_NOTO_VERSION = $Version
    $env:VITE_NOTO_ENV = 'production'
    Invoke-Native 'pnpm build' { & pnpm build }

    Write-Ok "apps\web\dist"
    Write-Ok "apps\website\dist"
} else {
    Write-Step 'Web bundles (skipped)'
}

# ---------------------------------------------------------------------------
# Step 6: Package the desktop application
# ---------------------------------------------------------------------------
Write-Step "Packaging the desktop application ($Arch)"
Write-Info 'This downloads the Electron binaries on a first run and takes several minutes.'

Invoke-Native 'electron-forge make' {
    & pnpm --filter '@noto/desktop' exec electron-forge make --arch=$Arch
}

# ---------------------------------------------------------------------------
# Step 7: Collect into build\
# ---------------------------------------------------------------------------
Write-Step 'Collecting release artifacts'

Invoke-Native 'collect-desktop-artifacts.mjs' {
    & node scripts/collect-desktop-artifacts.mjs --platform win32 --arch $Arch --version $Version --out build
}

# The installer is named by scripts/collect-desktop-artifacts.mjs, so this run's
# artifact is always named after $Version - anything else in the folder is not
# ours. Looked up by exact name rather than "the first .exe", which would pick
# alphabetically and could return an older version.
$expectedExe = "Noto-$Version-win-$Arch.exe"
$exeFile = Get-ChildItem $BuildDir -Filter $expectedExe -File -ErrorAction SilentlyContinue |
    Select-Object -First 1

if (-not $exeFile) {
    $found = @(Get-ChildItem $BuildDir -Filter '*.exe' -File -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty Name)
    if ($found.Count -gt 0) {
        Write-Error "Expected '$expectedExe' in build\ but the build produced: $($found -join ', '). Version mismatch - aborting."
    } else {
        Write-Error "No installer produced in build\ - aborting."
    }
    exit 1
}

# Freshness guard: a file that predates this run is a leftover, not our output.
if ($exeFile.LastWriteTime -lt $buildStart) {
    Write-Error "$($exeFile.Name) predates this build (written $($exeFile.LastWriteTime)) - stale artifact, aborting."
    exit 1
}

# ---------------------------------------------------------------------------
# Step 8: Checksums
# ---------------------------------------------------------------------------
Write-Step 'Generating checksums'

$sumsPath = Join-Path $BuildDir 'SHA256SUMS.txt'
$lines = Get-ChildItem $BuildDir -File |
    Where-Object { $_.Name -ne 'SHA256SUMS.txt' } |
    Sort-Object Name |
    ForEach-Object { "$((Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower())  $($_.Name)" }

# Written without a byte-order mark and with LF endings. Windows PowerShell's
# `-Encoding utf8` emits a BOM, which `sha256sum --check` would read as part of
# the first hash, failing verification of a file that is perfectly good.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($sumsPath, (($lines -join "`n") + "`n"), $utf8NoBom)
Write-Ok "SHA256SUMS.txt ($($lines.Count) entries)"

# ---------------------------------------------------------------------------
# Step 9: Report
# ---------------------------------------------------------------------------
Write-Step 'Release contents'

# The x64 build carries Squirrel's update feed; arm64 is installer-only,
# because two architectures cannot both own the RELEASES manifest.
$required = @($expectedExe, 'SHA256SUMS.txt')
if ($Arch -eq 'x64') { $required += @('RELEASES', "noto-$Version-full.nupkg") }

$allPresent = $true
foreach ($name in $required) {
    $path = Join-Path $BuildDir $name
    if (Test-Path $path) {
        $mb = [math]::Round((Get-Item $path).Length / 1MB, 1)
        Write-Host "  [OK]      $name ($mb MB)" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $name" -ForegroundColor Red
        $allPresent = $false
    }
}

if (-not $allPresent) {
    if ($Arch -eq 'x64') {
        Write-Warning 'Squirrel update-feed files are missing - auto-update will not work from this build.'
    } else {
        Write-Warning 'Some expected files are missing.'
    }
}

Write-Host ''
Write-Host "Installer:      $($exeFile.FullName)" -ForegroundColor Yellow
Write-Host "Release folder: $BuildDir" -ForegroundColor Yellow
Write-Host "Unpacked app:   $ForgeOut\Noto-win32-$Arch\noto.exe" -ForegroundColor DarkYellow
Write-Host ''
Write-Host 'To publish this version, push the tag and let the pipeline build every platform:' -ForegroundColor DarkGray
Write-Host "    git tag v$Version && git push origin v$Version" -ForegroundColor DarkGray
Write-Host ''
Write-Host '=== Build Completed Successfully ===' -ForegroundColor Cyan
