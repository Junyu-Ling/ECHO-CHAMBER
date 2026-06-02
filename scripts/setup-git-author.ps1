# Run once per machine (repo-local only): git author for Vercel / GitHub
Set-Location $PSScriptRoot\..
git config user.name "LingJ"
git config user.email "LIngJunYu20081201@gmail.com"
Write-Host "Git author set to: $(git config user.name) <$(git config user.email)>"
