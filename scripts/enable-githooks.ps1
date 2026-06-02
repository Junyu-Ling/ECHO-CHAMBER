# Run once in repo root: enables auto-push after every git commit
Set-Location $PSScriptRoot\..
git config core.hooksPath .githooks
Write-Host "Git hooks path set to .githooks (post-commit will push to origin/ECHO-CHAMBER)"
