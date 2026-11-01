# scripts/audit2/git-stats.ps1
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=== GIT STATS ==="
$totalCommits = (git rev-list --count HEAD).Trim()
Write-Host "Total Commits: $totalCommits"

Write-Host "`n--- Authors ---"
git shortlog -sn --all

Write-Host "`n--- Commits in Last 30 Days ---"
$sinceDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
$recentCommits = (git log --since="$sinceDate" --oneline | Measure-Object -Line).Lines
Write-Host "Commits in last 30 days (since $sinceDate): $recentCommits"

Write-Host "`n--- Top 15 Churn Hotspots (Most Modified Files in Commit History) ---"
git log --pretty=format: --name-only | Where-Object { $_ -ne "" } | Group-Object | Sort-Object Count -Descending | Select-Object -First 15 | Format-Table Count, Name -AutoSize

Write-Host "`n--- First and Last Commit Info ---"
git log -1 --format="Latest Commit: %h - %s (%ad by %an)"
git log --reverse --format="First Commit: %h - %s (%ad by %an)" | Select-Object -First 1
