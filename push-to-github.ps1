# PolyMesh - Push to GitHub Script
# Run this after getting your Personal Access Token

Write-Host "`n🚀 PolyMesh GitHub Push Helper`n" -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path ".git")) {
    Write-Host "❌ Error: Not in a Git repository!" -ForegroundColor Red
    Write-Host "   Run this script from c:\Users\MSI\Desktop\NeuroMesh`n" -ForegroundColor Yellow
    exit 1
}

Write-Host "📋 Pre-Push Checklist:" -ForegroundColor Cyan
Write-Host "   [ ] Created Personal Access Token at https://github.com/settings/tokens" -ForegroundColor White
Write-Host "   [ ] Selected 'repo' scope when creating token" -ForegroundColor White
Write-Host "   [ ] Copied the token (you won't see it again!)" -ForegroundColor White
Write-Host ""

$continue = Read-Host "Ready to push? (y/n)"

if ($continue -ne "y") {
    Write-Host "`n❌ Cancelled. Get your token first!`n" -ForegroundColor Yellow
    exit 0
}

Write-Host "`n📤 Pushing to GitHub...`n" -ForegroundColor Cyan
Write-Host "When prompted:" -ForegroundColor Yellow
Write-Host "   Username: NeoCrafts-cpu" -ForegroundColor White
Write-Host "   Password: [paste your Personal Access Token]`n" -ForegroundColor White

# Push to GitHub
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ SUCCESS! Code pushed to GitHub!`n" -ForegroundColor Green
    Write-Host "🔗 View your repository:" -ForegroundColor Cyan
    Write-Host "   https://github.com/NeoCrafts-cpu/PolyMesh`n" -ForegroundColor White
    
    Write-Host "📝 Next Steps:" -ForegroundColor Cyan
    Write-Host "   1. Add a nice README badge" -ForegroundColor White
    Write-Host "   2. Create a release/tag for buildathon" -ForegroundColor White
    Write-Host "   3. Add topics: polygon, ai, arbitrage, blockchain" -ForegroundColor White
    Write-Host "   4. Add repository description`n" -ForegroundColor White
} else {
    Write-Host "`n❌ Push failed!`n" -ForegroundColor Red
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "   - Invalid or expired token" -ForegroundColor White
    Write-Host "   - Wrong username (must be NeoCrafts-cpu)" -ForegroundColor White
    Write-Host "   - Token doesn't have 'repo' scope`n" -ForegroundColor White
    
    Write-Host "💡 Get a new token:" -ForegroundColor Cyan
    Write-Host "   https://github.com/settings/tokens/new`n" -ForegroundColor White
}
