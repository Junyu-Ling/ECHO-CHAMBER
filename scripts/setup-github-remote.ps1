param(
  [Parameter(Mandatory = $true)]
  [string]$RepoUrl
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not (Test-Path .git)) {
  git init
  git lfs install
  git lfs track "*.mp4"
  git add .gitattributes
}

$branch = "ECHO-CHAMBER"
git checkout -B $branch 2>&1 | Out-Null

if (git remote get-url origin 2>$null) {
  git remote set-url origin $RepoUrl
} else {
  git remote add origin $RepoUrl
}

Write-Host "Origin set to: $RepoUrl"
Write-Host "Branch: $branch"
Write-Host ""
Write-Host "Next: node scripts/git-sync.mjs"
