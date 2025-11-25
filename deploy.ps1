# Quick Deployment Script for PolyMesh

Write-Host "`n🚀 PolyMesh Deployment Helper`n" -ForegroundColor Cyan

Write-Host "📋 Pre-Deployment Checklist:" -ForegroundColor Yellow
Write-Host "   [ ] Code tested locally" -ForegroundColor White
Write-Host "   [ ] Environment variables ready" -ForegroundColor White
Write-Host "   [ ] Vercel account created" -ForegroundColor White
Write-Host "   [ ] Render account created" -ForegroundColor White
Write-Host ""

Write-Host "🔧 Preparing deployment files..." -ForegroundColor Cyan

# Check if files exist
$files = @(
    "vercel.json",
    "render.yaml",
    "DEPLOYMENT_GUIDE.md"
)

$allExist = $true
foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "   ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file missing" -ForegroundColor Red
        $allExist = $false
    }
}

if (-not $allExist) {
    Write-Host "`n❌ Missing deployment files!`n" -ForegroundColor Red
    exit 1
}

Write-Host "`n📦 Committing deployment configurations..." -ForegroundColor Cyan

git add vercel.json render.yaml DEPLOYMENT_GUIDE.md
git add frontend/neuromesh-ui/src/App.tsx
git add frontend/neuromesh-ui/.env.example
git add agents/eliza/src/index.ts agents/eliza/package.json
git add .

git commit -m "🚀 Add Vercel & Render deployment configs

- Add vercel.json for frontend deployment
- Add render.yaml for AI agent deployment  
- Update WebSocket to use environment variables
- Add health check endpoint
- Add comprehensive deployment guide"

Write-Host "✅ Changes committed" -ForegroundColor Green

Write-Host "`n📤 Pushing to GitHub..." -ForegroundColor Cyan
git push

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n🎉 SUCCESS! Code pushed to GitHub`n" -ForegroundColor Green
    
    Write-Host "📝 Next Steps:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1️⃣  Deploy Frontend to Vercel:" -ForegroundColor Yellow
    Write-Host "   → Visit: https://vercel.com/new" -ForegroundColor White
    Write-Host "   → Import: NeoCrafts-cpu/PolyMesh" -ForegroundColor White
    Write-Host "   → Configure as shown in DEPLOYMENT_GUIDE.md" -ForegroundColor White
    Write-Host ""
    Write-Host "2️⃣  Deploy Backend to Render:" -ForegroundColor Yellow
    Write-Host "   → Visit: https://dashboard.render.com/" -ForegroundColor White
    Write-Host "   → New Web Service" -ForegroundColor White
    Write-Host "   → Select: NeoCrafts-cpu/PolyMesh" -ForegroundColor White
    Write-Host "   → Add environment variables (see guide)" -ForegroundColor White
    Write-Host ""
    Write-Host "3️⃣  Update Frontend with Backend URL:" -ForegroundColor Yellow
    Write-Host "   → Get Render URL after deployment" -ForegroundColor White
    Write-Host "   → Update VITE_WS_URL in Vercel settings" -ForegroundColor White
    Write-Host "   → Redeploy frontend" -ForegroundColor White
    Write-Host ""
    Write-Host "📚 Full Guide: DEPLOYMENT_GUIDE.md" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🔗 Repository: https://github.com/NeoCrafts-cpu/PolyMesh" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "`n❌ Push failed!`n" -ForegroundColor Red
    Write-Host "Run manually: git push" -ForegroundColor Yellow
    Write-Host ""
}
