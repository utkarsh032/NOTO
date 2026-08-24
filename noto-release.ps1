<#
.SYNOPSIS
    Builds a Noto desktop release for one environment and channel, validates it,
    and stages it for the GitHub Release pipeline.

.DESCRIPTION
    One command from a clean checkout to a verified release folder:

        Node 22 -> environment -> version -> build -> validate -> stage

    The environment menu is built by globbing apps\desktop\environments, so it
    can never drift from the overlays that actually exist. Each option is shown
    with its update feed URL, because that - not the label - is what really
    differs between two packages of the same version.

    Run it from an elevated PowerShell for the smoothest result. Administrator
    is not required, but it lets the script add a Microsoft Defender exclusion
    for the output folder, which is what stops Squirrel's rcedit step failing
    with "Unable to commit changes" while Defender is still scanning the freshly
    written 200 MB binaries.

.PARAMETER Version
    Version to stamp into the build. Defaults to the workspace version in
    package.json. Passing a value rewrites every manifest via scripts/version.mjs.

.PARAMETER Configuration
    Release (default) or Debug. Debug may not be used to build Production.

.PARAMETER Environment
    Which overlay in apps\desktop\environments to build against. Omitted in an
    interactive session, a numbered menu is shown. Omitted in a non-interactive
    session, the script fails rather than guessing.

.PARAMETER Channel
    stable, beta or nightly. Defaults to the chosen environment's defaultChannel.

.PARAMETER Arch
    x64 (default) or arm64.

.PARAMETER AssumeYes
    Supplies the Production confirmation for a non-interactive run. Has no
    effect on any other environment.

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
    Prompts for an environment, then builds the current workspace version.

.EXAMPLE
    .\noto-release.ps1 -Environment Production -Channel stable -Version 1.0.0

.EXAMPLE
    .\noto-release.ps1 -Environment Staging -SkipVerify -SkipWeb
#>

[CmdletBinding()]
param(
    [string]$Version,
    [ValidateSet('Release', 'Debug')]
    [string]$Configuration = 'Release',
    [string]$Environment,
    [ValidateSet('stable', 'beta', 'nightly')]
    [string]$Channel,
    [ValidateSet('x64', 'arm64')]
    [string]$Arch = 'x64',
    [switch]$AssumeYes,
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

$EnvironmentDir = Join-Path $repoRoot 'apps\desktop\environments'
$GeneratedFile = Join-Path $repoRoot 'apps\desktop\src\generated\environment.ts'
$TemplateFile = Join-Path $repoRoot 'scripts\templates\download.html'
$HeadersFile = Join-Path $repoRoot 'apps\website\public\_headers'
$ArchiveRoot = Join-Path $repoRoot 'build'
$ForgeOut = Join-Path $repoRoot 'apps\desktop\out'

# Electron Forge 7.11 pins @electron/packager 18.4.4, which exits silently with
# status 0 on Node 24 while extracting the Electron archive - no out/ directory
# and no error. Node 22 is the version that works. Remove this once Forge bumps
# its packager dependency.
$RequiredNodeMajor = 22

# With stdin redirected, Read-Host returns an empty string immediately and does
# so forever. An uncapped prompt loop would spin at full speed rather than fail,
# so every interactive prompt gets a hard ceiling.
$MaxPromptAttempts = 3

function Write-Step($message) { Write-Host "`n=== $message ===" -ForegroundColor Cyan }
function Write-Ok($message) { Write-Host "  [OK] $message" -ForegroundColor Green }
function Write-Info($message) { Write-Host "  $message" -ForegroundColor Yellow }
function Write-Warn($message) { Write-Host "  [WARN] $message" -ForegroundColor DarkYellow }

# The generated environment module is a working-tree file that this script
# rewrites. Whatever happens afterwards, it has to go back, or the next
# `git status` shows a modified file nobody edited.
$script:GeneratedBackup = $null

function Restore-Generated {
    if ($null -ne $script:GeneratedBackup) {
        [System.IO.File]::WriteAllText($GeneratedFile, $script:GeneratedBackup)
        $script:GeneratedBackup = $null
    }
}

# Every abort goes through here, so every abort says the same three things:
# what was expected, what was actually there, and what to do about it.
function Stop-Release {
    param(
        [Parameter(Mandatory)][string]$What,
        [string]$Found,
        [string]$Fix
    )

    Restore-Generated

    Write-Host ''
    Write-Host "  [FAIL] $What" -ForegroundColor Red
    if ($Found) { Write-Host "         Found: $Found" -ForegroundColor Red }
    if ($Fix) { Write-Host "         Fix:   $Fix" -ForegroundColor Yellow }
    Write-Host ''
    Write-Host '=== Release aborted - nothing was published ===' -ForegroundColor Red
    exit 1
}

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
        Stop-Release -What "$What failed (exit code $code)." `
            -Fix 'Read the output above; nothing has been collected.'
    }
}

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

# UserInteractive alone is not enough: a session can be "interactive" and still
# have had its stdin redirected from a file or from NUL, which is exactly the
# case where Read-Host stops being usable.
$isInteractive = [Environment]::UserInteractive -and -not [Console]::IsInputRedirected

Write-Host '=== Noto Release Build ===' -ForegroundColor Cyan
Write-Host "  Repository:    $repoRoot"
Write-Host "  Architecture:  $Arch"
Write-Host "  Configuration: $Configuration"
Write-Host "  Elevated:      $isAdmin"
Write-Host "  Interactive:   $isInteractive"

# ---------------------------------------------------------------------------
# Step 1: Environment
# ---------------------------------------------------------------------------
Write-Step 'Environment'

# Read from disk rather than from a list in this script. A hardcoded set drifts
# the moment somebody adds an overlay, and the drift is silent: the new
# environment simply never appears as an option.
function Get-Overlays {
    if (-not (Test-Path $EnvironmentDir)) {
        Stop-Release -What "No environment directory at $EnvironmentDir." `
            -Fix 'Create apps\desktop\environments\noto.<Environment>.json - see README.md.'
    }

    $files = @(Get-ChildItem -Path $EnvironmentDir -Filter 'noto.*.json' -File | Sort-Object Name)
    if ($files.Count -eq 0) {
        Stop-Release -What "No overlays matching noto.*.json in $EnvironmentDir." `
            -Fix 'Add at least one overlay file - see README.md.'
    }

    $required = @('environment', 'description', 'buildEnv', 'defaultChannel', 'updateFeedUrl', 'webAppUrl')
    $result = @()

    foreach ($file in $files) {
        try {
            $json = Get-Content $file.FullName -Raw | ConvertFrom-Json
        } catch {
            Stop-Release -What "$($file.Name) is not valid JSON." -Found $_.Exception.Message `
                -Fix "Fix the syntax in $($file.FullName)."
        }

        foreach ($field in $required) {
            if ($json.PSObject.Properties.Name -notcontains $field) {
                Stop-Release -What "$($file.Name) is missing the required field '$field'." `
                    -Found ($json.PSObject.Properties.Name -join ', ') `
                    -Fix "Add that field to $($file.FullName)."
            }
        }

        $result += [pscustomobject]@{
            Name           = $json.environment
            Description    = $json.description
            BuildEnv       = $json.buildEnv
            DefaultChannel = $json.defaultChannel
            UpdateFeedUrl  = $json.updateFeedUrl
            WebAppUrl      = $json.webAppUrl
            File           = $file.Name
        }
    }

    return , $result
}

function Format-Feed($url) {
    if ([string]::IsNullOrWhiteSpace($url)) { return '(no update feed - this build will not self-update)' }
    return $url
}

function Select-EnvironmentInteractively {
    param([Parameter(Mandatory)][object[]]$Overlays)

    for ($attempt = 1; $attempt -le $MaxPromptAttempts; $attempt++) {
        Write-Host ''
        Write-Host '  Which environment should this package be built for?' -ForegroundColor Cyan
        Write-Host ''

        for ($i = 0; $i -lt $Overlays.Count; $i++) {
            $overlay = $Overlays[$i]
            Write-Host ("    {0}) {1}" -f ($i + 1), $overlay.Name) -ForegroundColor White
            Write-Host ("       {0}" -f $overlay.Description) -ForegroundColor Gray
            # The URL is printed because it is the value that actually ends up
            # baked into the package. Two overlays can be labelled anything at
            # all; what distinguishes the artifacts is where they phone home.
            Write-Host ("       {0}" -f (Format-Feed $overlay.UpdateFeedUrl)) -ForegroundColor Yellow
            Write-Host ''
        }

        $answer = Read-Host "  Environment [1-$($Overlays.Count)]"

        if ($answer -match '^\s*(\d+)\s*$') {
            $index = [int]$Matches[1]
            if ($index -ge 1 -and $index -le $Overlays.Count) { return $Overlays[$index - 1] }
        }

        Write-Warn "'$answer' is not a choice between 1 and $($Overlays.Count) (attempt $attempt of $MaxPromptAttempts)."
    }

    Stop-Release -What "No valid environment chosen after $MaxPromptAttempts attempts." `
        -Fix 'Pass -Environment <name> explicitly.'
}

$overlays = Get-Overlays
$names = ($overlays | ForEach-Object { $_.Name }) -join ', '

if ($Environment) {
    $matched = @($overlays | Where-Object { $_.Name -eq $Environment })
    if ($matched.Count -eq 0) {
        Stop-Release -What "'$Environment' is not a known environment." -Found $names `
            -Fix "Add apps\desktop\environments\noto.$Environment.json, or pass one of the names above."
    }
    if ($matched.Count -gt 1) {
        Stop-Release -What "'$Environment' is declared by more than one overlay." -Found $names `
            -Fix 'Two overlay files carry the same "environment" value - remove one.'
    }
    $selected = $matched[0]
} elseif ($isInteractive) {
    $selected = Select-EnvironmentInteractively -Overlays $overlays
} else {
    # Defaulting here would silently ship a package pointed at the wrong update
    # feed, and nothing about the artifact's name would reveal it.
    Stop-Release -What '-Environment is required in a non-interactive session.' -Found $names `
        -Fix 'Pass -Environment <name>. The menu is only offered when stdin is a real console.'
}

if (-not $Channel) { $Channel = $selected.DefaultChannel }
if (@('stable', 'beta', 'nightly') -notcontains $Channel) {
    Stop-Release -What "'$Channel' is not a valid update channel." -Found 'stable, beta, nightly' `
        -Fix "Fix defaultChannel in $($selected.File), or pass -Channel."
}

$feedUrl = $selected.UpdateFeedUrl

Write-Ok "$($selected.Name) (from $($selected.File))"
Write-Info "Channel:     $Channel"
Write-Info "Update feed: $(Format-Feed $feedUrl)"
Write-Info "Web app:     $($selected.WebAppUrl)"

if ($Configuration -eq 'Debug' -and $selected.Name -eq 'Production') {
    Stop-Release -What 'Production cannot be built in the Debug configuration.' `
        -Fix 'Drop -Configuration Debug, or choose a different environment.'
}

# stable resolves through update.electronjs.org and needs no feed of its own.
# Every other channel does, and without one the packaged application silently
# never updates - a failure that only shows up weeks later as "nobody upgraded".
if ($Channel -ne 'stable' -and [string]::IsNullOrWhiteSpace($feedUrl)) {
    Write-Warn "The $Channel channel has no updateFeedUrl in $($selected.File); this build will not self-update."
}

if ($selected.Name -eq 'Production' -and $Channel -ne 'stable') {
    Write-Warn "Production is being built on the $Channel channel rather than stable."
}

# ---------------------------------------------------------------------------
# Step 2: Node runtime
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
        Stop-Release -What "Node $RequiredNodeMajor.x is not installed." -Found "Node $currentNode" `
            -Fix "winget install --id Schniz.fnm -e   then   fnm install $RequiredNodeMajor"
    }

    $nodeDir = Join-Path $candidate.FullName 'installation'
    $env:PATH = "$nodeDir;$env:PATH"
    $currentNode = (& node -v) -replace '^v', ''
    Write-Ok "Switched to Node $currentNode for this build"
} else {
    Write-Ok "Node $currentNode"
}

# ---------------------------------------------------------------------------
# Step 3: Version
# ---------------------------------------------------------------------------
Write-Step 'Version'

if ($Version) {
    Invoke-Native 'version.mjs set' { & node scripts/version.mjs set $Version | Out-Null }
    Write-Ok "Stamped $Version across every manifest"
} else {
    $Version = (& node -p "require('./package.json').version").Trim()
    if ([string]::IsNullOrWhiteSpace($Version)) {
        Stop-Release -What 'No version found in package.json.' `
            -Fix 'Set "version" in the workspace manifest, or pass -Version.'
    }
    Write-Ok "Using the workspace version $Version"
}

# ---------------------------------------------------------------------------
# Step 4: Production confirmation
# ---------------------------------------------------------------------------
if ($selected.Name -eq 'Production') {
    Write-Step 'Production release'

    # Printed in full before the prompt: the point of the gate is to confirm the
    # values about to be baked in, not the name of the environment.
    Write-Host ''
    Write-Host '  About to build a PRODUCTION package with:' -ForegroundColor Red
    Write-Host ''
    Write-Host "    Version:       $Version"
    Write-Host "    Channel:       $Channel"
    Write-Host "    Update feed:   $(Format-Feed $feedUrl)"
    Write-Host "    Web app URL:   $($selected.WebAppUrl)"
    Write-Host "    Build env:     $($selected.BuildEnv)"
    Write-Host "    Architecture:  $Arch"
    Write-Host ''

    if ($isInteractive) {
        $confirmation = Read-Host "  Type 'yes' to continue"
        if ($confirmation -ne 'yes') {
            Stop-Release -What 'Production build not confirmed.' -Found "'$confirmation'" `
                -Fix "Type exactly 'yes' at the prompt."
        }
    } elseif (-not $AssumeYes) {
        Stop-Release -What 'A Production build must be confirmed, and this session cannot prompt.' `
            -Fix 'Re-run in a console, or pass -AssumeYes to accept the configuration printed above.'
    } else {
        Write-Info 'Confirmed by -AssumeYes'
    }

    Write-Ok 'Production build confirmed'
}

# ---------------------------------------------------------------------------
# Step 5: Bake the environment into the packaged sources
# ---------------------------------------------------------------------------
Write-Step 'Baking configuration'

if (-not (Test-Path $GeneratedFile)) {
    Stop-Release -What "The generated environment module is missing: $GeneratedFile." `
        -Fix 'Restore it from git - it is committed so that a fresh clone can typecheck.'
}

$script:GeneratedBackup = [System.IO.File]::ReadAllText($GeneratedFile)

# Delegated to a Node script rather than written here, because CI has to bake
# exactly the same way. While this lived only in PowerShell, every package the
# desktop workflow produced silently carried the committed Development defaults
# - the wrong update feed, with nothing in the artifact's name to reveal it.
#
# Regenerating the whole module, rather than rewriting values inside it, is what
# keeps the packaged value equal to the value chosen above: these are TypeScript
# constants read at bundle time, and a regex over them would have to be narrow
# enough to survive a reformat and broad enough to catch every one.
$environmentName = $selected.Name
Invoke-Native 'bake-environment.mjs' {
    & node scripts/bake-environment.mjs --environment $environmentName --channel $Channel | Out-Null
}
Write-Ok "environment.ts -> $($selected.Name) / $Channel"

# The renderer and both web bundles read these through Vite, so they have to be
# in the environment before any build command runs.
$env:VITE_NOTO_VERSION = $Version
$env:VITE_NOTO_ENV = $selected.BuildEnv
$env:VITE_NOTO_WEB_APP_URL = $selected.WebAppUrl
$env:NOTO_UPDATE_CHANNEL = $Channel
$env:NOTO_UPDATE_FEED_URL = $feedUrl
Write-Ok "VITE_NOTO_ENV=$($selected.BuildEnv), NOTO_UPDATE_CHANNEL=$Channel"

# ---------------------------------------------------------------------------
# Step 6: Clear the way
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

# Keyed by environment and channel as well as version: the same version built
# for two environments is two different packages, and letting one overwrite the
# other would make the release folder a liar about what it holds.
$ReleaseDir = Join-Path $ArchiveRoot (Join-Path $selected.Name (Join-Path $Channel $Version))
$LatestDir = Join-Path $ArchiveRoot (Join-Path $selected.Name (Join-Path $Channel 'Latest'))

if (Test-Path $ReleaseDir) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $ReleaseDir = "$ReleaseDir-$stamp"
    Write-Warn "That version already has a release folder; using $(Split-Path $ReleaseDir -Leaf) instead."
}

if ($isAdmin) {
    try {
        Add-MpPreference -ExclusionPath $ArchiveRoot, $ForgeOut -ErrorAction Stop
        Write-Ok 'Added a Defender exclusion for the build directories'
    } catch {
        Write-Warn "Could not add a Defender exclusion: $($_.Exception.Message)"
    }
} else {
    Write-Warn 'Not elevated - if the build fails in rcedit with "Unable to commit changes", rerun as Administrator.'
}

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

# Forge's output is the awkward one. Windows keeps a handle on a freshly
# packaged binary for a while after the process that made it has exited -
# Defender scanning a 200 MB executable is the usual reason - and Forge refuses
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
    Get-ChildItem (Join-Path $repoRoot 'apps\desktop') -Directory -Filter 'out-*' -ErrorAction SilentlyContinue |
        ForEach-Object { Clear-BuildDirectory -Path $_.FullName -TimeoutSeconds 5 | Out-Null }
}

Write-Ok 'Cleared previous build output'

# Anything collected below must be newer than this mark.
$buildStart = Get-Date

# ---------------------------------------------------------------------------
# Step 7: Verify
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
# Step 8: Web bundles
# ---------------------------------------------------------------------------
if (-not $SkipWeb) {
    Write-Step 'Building the web application and website'
    Invoke-Native 'pnpm build' { & pnpm build }
    Write-Ok 'apps\web\dist'
    Write-Ok 'apps\website\dist'
} else {
    Write-Step 'Web bundles (skipped)'
}

# ---------------------------------------------------------------------------
# Step 9: Package the desktop application
# ---------------------------------------------------------------------------
Write-Step "Packaging the desktop application ($Arch)"
Write-Info 'This downloads the Electron binaries on a first run and takes several minutes.'

Invoke-Native 'electron-forge make' {
    & pnpm --filter '@noto/desktop' exec electron-forge make --arch=$Arch
}

# @electron/packager can exit 0 having produced nothing at all - that is the
# Node 24 failure this script pins Node 22 to avoid. A zero exit code is
# therefore not evidence that a package exists, so look for the binary itself.
# Without this guard the run continues and builds an installer around an empty
# application directory, which installs cleanly and then never launches.
$unpackedExe = Join-Path $ForgeOut "Noto-win32-$Arch\noto.exe"
if (-not (Test-Path $unpackedExe)) {
    $produced = @(Get-ChildItem $ForgeOut -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
    $foundText = '(nothing in the output directory)'
    if ($produced.Count -gt 0) { $foundText = $produced -join ', ' }
    Stop-Release -What "electron-forge reported success but produced no application binary at $unpackedExe." `
        -Found $foundText `
        -Fix "Confirm the build ran on Node $RequiredNodeMajor.x - @electron/packager exits 0 without packaging on Node 24."
}
Write-Ok "Packaged a $([math]::Round((Get-Item $unpackedExe).Length / 1MB, 1)) MB application binary"

# ---------------------------------------------------------------------------
# Step 10: Collect
# ---------------------------------------------------------------------------
Write-Step 'Collecting release artifacts'

New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null
$relativeOut = $ReleaseDir.Substring($repoRoot.Length).TrimStart('\')

Invoke-Native 'collect-desktop-artifacts.mjs' {
    & node scripts/collect-desktop-artifacts.mjs --platform win32 --arch $Arch --version $Version --out $relativeOut
}

# ---------------------------------------------------------------------------
# Step 11: Validate
# ---------------------------------------------------------------------------
Write-Step 'Validating the release'

$installerName = "Noto-$Version-win-$Arch.exe"
$installerPath = Join-Path $ReleaseDir $installerName

# Looked up by the exact name this version must have, never by "the first
# *.exe". A wildcard returns entries in directory order, so a leftover from an
# earlier version would be picked up and published under this version's notes.
if (-not (Test-Path $installerPath)) {
    $produced = @(Get-ChildItem $ReleaseDir -File -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
    $foundText = '(nothing was collected)'
    if ($produced.Count -gt 0) { $foundText = $produced -join ', ' }
    Stop-Release -What "Expected installer '$installerName' was not produced." -Found $foundText `
        -Fix 'Check that -Version matches the workspace version and that the Squirrel maker ran.'
}

# Squirrel's own manifest, checked with Squirrel's own hash algorithm. Nothing
# else in the pipeline ever reads this file, so a disagreement between it and
# the package it names would otherwise surface months later as "nobody is
# upgrading", with no error anywhere to explain why.
if ($Arch -eq 'x64') {
    Invoke-Native 'verify-squirrel-release.mjs' {
        & node scripts/verify-squirrel-release.mjs --dir $relativeOut --version $Version --arch $Arch
    }
} else {
    # Two architectures cannot both own RELEASES, so the collector deliberately
    # omits it for arm64; there is nothing here to verify against.
    Write-Info 'arm64 ships as an installer only - no RELEASES manifest to verify.'
}

# A file that predates this run is a leftover, not this build's output. Checked
# across every artifact rather than just the installer, because a stale RELEASES
# sitting beside a fresh installer is the more dangerous of the two: the
# installer would look right and every updater would be pointed at the wrong
# package.
$stale = @(Get-ChildItem $ReleaseDir -File | Where-Object { $_.LastWriteTime -lt $buildStart })
if ($stale.Count -gt 0) {
    Stop-Release -What 'The release folder contains artifacts older than this build.' `
        -Found (($stale | ForEach-Object { "$($_.Name) written $($_.LastWriteTime)" }) -join '; ') `
        -Fix 'Delete the release folder and build again - these are leftovers from an earlier run.'
}

Write-Ok 'Manifest, hashes and freshness all check out'

# ---------------------------------------------------------------------------
# Step 12: Assemble the release folder
# ---------------------------------------------------------------------------
Write-Step 'Assembling the release folder'

$zipName = "Noto-$Version-win-$Arch.zip"
$zipPath = Join-Path $ReleaseDir $zipName
Compress-Archive -Path $installerPath -DestinationPath $zipPath -Force
Write-Ok $zipName

if (Test-Path $HeadersFile) {
    Copy-Item $HeadersFile (Join-Path $ReleaseDir '_headers') -Force
    Write-Ok '_headers'
} else {
    Write-Warn "No static headers file at $HeadersFile; skipping."
}

$installerSha256 = (Get-FileHash $installerPath -Algorithm SHA256).Hash.ToLower()

# The SHA1 on the download page is read back out of the manifest rather than
# recomputed, so that the page and the updater cannot end up disagreeing about
# what was shipped. verify-squirrel-release.mjs has already proved that this
# value describes the package on disk.
$packageSha1 = 'n/a (arm64 ships without an update manifest)'
$releasesPath = Join-Path $ReleaseDir 'RELEASES'
if (Test-Path $releasesPath) {
    # electron-winstaller writes RELEASES with a UTF-8 BOM; left in place it
    # becomes part of the first field.
    $manifestText = (Get-Content $releasesPath -Raw).TrimStart([char]0xFEFF)
    $packageSha1 = ($manifestText -split '\s+')[0].Trim()
}

if (Test-Path $TemplateFile) {
    $sizeMb = '{0:N1} MB' -f ((Get-Item $installerPath).Length / 1MB)
    $page = [System.IO.File]::ReadAllText($TemplateFile)
    $page = $page.Replace('{{VERSION}}', $Version)
    $page = $page.Replace('{{ENVIRONMENT}}', $selected.Name)
    $page = $page.Replace('{{CHANNEL}}', $Channel)
    $page = $page.Replace('{{INSTALLER}}', $installerName)
    $page = $page.Replace('{{SIZE}}', $sizeMb)
    $page = $page.Replace('{{SHA1}}', $packageSha1)
    $page = $page.Replace('{{SHA256}}', $installerSha256)
    $page = $page.Replace('{{BUILT}}', (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
    [System.IO.File]::WriteAllText((Join-Path $ReleaseDir 'download.html'), $page)
    Write-Ok 'download.html'
} else {
    Write-Warn "No download page template at $TemplateFile; skipping."
}

# ---------------------------------------------------------------------------
# Step 13: Checksums
# ---------------------------------------------------------------------------
Write-Step 'Generating checksums'

$sumsPath = Join-Path $ReleaseDir 'SHA256SUMS.txt'
$lines = Get-ChildItem $ReleaseDir -File |
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
# Step 14: Contents
# ---------------------------------------------------------------------------
Write-Step 'Release contents'

$required = @($installerName, $zipName, 'SHA256SUMS.txt', 'download.html')

# The x64 build carries Squirrel's update feed; arm64 is installer-only,
# because two architectures cannot both own the RELEASES manifest.
if ($Arch -eq 'x64') { $required += @('RELEASES', "noto-$Version-full.nupkg") }

$allPresent = $true
foreach ($name in $required) {
    $path = Join-Path $ReleaseDir $name
    if (Test-Path $path) {
        $mb = [math]::Round((Get-Item $path).Length / 1MB, 1)
        Write-Host "  [OK]      $name ($mb MB)" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $name" -ForegroundColor Red
        $allPresent = $false
    }
}

if (-not $allPresent) {
    Stop-Release -What 'The release folder is incomplete.' `
        -Found "see the [MISSING] entries above, in $ReleaseDir" `
        -Fix 'A partially-valid release is never published. Build again.'
}

# ---------------------------------------------------------------------------
# Step 15: Hand-off
# ---------------------------------------------------------------------------
Write-Step 'Staging for release'

# Mirrored to a stable path so that an upload step never has to know the version
# number. Wiped first: a leftover from an older version sitting beside this one
# would be uploaded as though it belonged to this release.
if (-not (Clear-BuildDirectory -Path $LatestDir)) {
    Stop-Release -What "Could not clear $LatestDir." -Fix 'Close anything reading from it and retry.'
}

New-Item -ItemType Directory -Force -Path $LatestDir | Out-Null
Copy-Item (Join-Path $ReleaseDir '*') $LatestDir -Recurse -Force
Write-Ok "Mirrored to $($LatestDir.Substring($repoRoot.Length).TrimStart('\'))"

Restore-Generated
Write-Ok 'Restored the generated environment module'

Write-Host ''
Write-Host "Installer:      $installerPath" -ForegroundColor Yellow
Write-Host "Release folder: $ReleaseDir" -ForegroundColor Yellow
Write-Host "Latest mirror:  $LatestDir" -ForegroundColor Yellow
Write-Host "Unpacked app:   $unpackedExe" -ForegroundColor DarkYellow
Write-Host ''
Write-Host '  Test the unpacked build before publishing - it bypasses the installer:' -ForegroundColor Gray
Write-Host "      $unpackedExe" -ForegroundColor DarkGray
Write-Host ''

if ($selected.Name -eq 'Production') {
    Write-Host '  Publish this release - pushing the tag is what starts the pipeline:' -ForegroundColor Gray
    Write-Host "      git tag v$Version" -ForegroundColor DarkGray
    Write-Host "      git push origin v$Version" -ForegroundColor DarkGray
    Write-Host ''
    Write-Host '  release.yml then builds macOS and Linux on their own runners and' -ForegroundColor Gray
    Write-Host '  publishes every platform to the GitHub Release for that tag.' -ForegroundColor Gray
} else {
    Write-Host "  $($selected.Name) builds are not published by tag." -ForegroundColor Gray
    Write-Host '  Run the Desktop workflow with' -ForegroundColor Gray
    Write-Host "      environment=$($selected.Name)  channel=$Channel" -ForegroundColor DarkGray
    Write-Host '  or upload this folder by hand.' -ForegroundColor Gray
}

Write-Host ''
Write-Host '=== Build Completed Successfully ===' -ForegroundColor Cyan
