# Windows post-commit: push ECHO-CHAMBER to origin
$branch = git branch --show-current 2>$null
if ($branch -ne "ECHO-CHAMBER") { exit 0 }
try { git remote get-url origin 2>$null | Out-Null } catch { exit 0 }
git push origin ECHO-CHAMBER
