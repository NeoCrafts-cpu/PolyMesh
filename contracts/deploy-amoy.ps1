# PolyMesh Testnet Deployment Script for PowerShell
# Run this from the contracts directory
# Usage: .\deploy-amoy.ps1

Write-Host "`n🚀 PolyMesh Testnet Deployment Helper`n" -ForegroundColor Cyan

# Check if .env exists
if (-not (Test-Path ".\.env")) {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    Write-Host "💡 Create .env file and add your PRIVATE_KEY" -ForegroundColor Yellow
    Write-Host "`nExample .env content:" -ForegroundColor Yellow
    Write-Host "PRIVATE_KEY=your_private_key_without_0x_prefix`n" -ForegroundColor Gray
    exit 1
}

# Check if private key is set
$envContent = Get-Content ".\.env" -Raw
if ($envContent -notmatch "PRIVATE_KEY=\w{64}") {
    Write-Host "⚠️  Warning: PRIVATE_KEY not properly set in .env" -ForegroundColor Yellow
    Write-Host "Make sure you added your private key (64 hex characters, no 0x prefix)`n" -ForegroundColor Yellow
}

Write-Host "📋 Pre-flight Checklist:" -ForegroundColor Cyan
Write-Host "  ✓ .env file exists" -ForegroundColor Green
Write-Host "  ? Private key configured (check manually)" -ForegroundColor Yellow
Write-Host ""

# Ask for network
Write-Host "Select deployment network:" -ForegroundColor Cyan
Write-Host "  1) Polygon Amoy Testnet (recommended for testing)" -ForegroundColor White
Write-Host "  2) Polygon Mainnet (production - use with caution)" -ForegroundColor White
$choice = Read-Host "`nEnter choice (1 or 2)"

$network = ""
if ($choice -eq "1") {
    $network = "amoy"
    Write-Host "`n🌐 Deploying to Polygon Amoy Testnet..." -ForegroundColor Green
    Write-Host "💡 Make sure you have testnet POL tokens from: https://faucet.polygon.technology/`n" -ForegroundColor Yellow
} elseif ($choice -eq "2") {
    $network = "polygon"
    Write-Host "`n⚠️  MAINNET DEPLOYMENT - This uses real tokens!" -ForegroundColor Red
    $confirm = Read-Host "Are you sure? Type 'YES' to continue"
    if ($confirm -ne "YES") {
        Write-Host "`n❌ Deployment cancelled" -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "`n❌ Invalid choice. Exiting..." -ForegroundColor Red
    exit 1
}

Write-Host "`n🚀 Starting deployment...`n" -ForegroundColor Cyan

# Run deployment
npx hardhat run scripts/deploy-testnet.js --network $network

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "   ✅ Deployment Successful!" -ForegroundColor Green
    Write-Host "========================================`n" -ForegroundColor Green
    
    Write-Host "📄 Deployment info saved to: deployment-$network.json`n" -ForegroundColor Cyan
    
    Write-Host "💡 Next Steps:`n" -ForegroundColor Yellow
    Write-Host "1. Check deployment-$network.json for contract addresses" -ForegroundColor White
    Write-Host "2. Update agents/eliza/.env with contract addresses" -ForegroundColor White
    Write-Host "3. Verify contracts on PolygonScan (see commands in output)" -ForegroundColor White
    Write-Host "4. Fund your agent wallet with POL" -ForegroundColor White
    Write-Host "5. Start the agent and test!`n" -ForegroundColor White
    
    # Open deployment file
    if (Test-Path ".\deployment-$network.json") {
        Write-Host "📂 Opening deployment file..." -ForegroundColor Cyan
        Start-Process ".\deployment-$network.json"
    }
} else {
    Write-Host "`n❌ Deployment failed. Check errors above.`n" -ForegroundColor Red
    Write-Host "💡 Common issues:" -ForegroundColor Yellow
    Write-Host "  - No POL tokens in deployer wallet" -ForegroundColor White
    Write-Host "  - Invalid private key format" -ForegroundColor White
    Write-Host "  - Network connection issues`n" -ForegroundColor White
    exit 1
}
