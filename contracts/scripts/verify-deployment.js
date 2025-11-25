const fs = require('fs');
const path = require('path');

/**
 * Verify PolyMesh deployment on PolygonScan
 * 
 * Usage:
 *   node scripts/verify-deployment.js amoy
 *   node scripts/verify-deployment.js polygon
 */

async function main() {
  const network = process.argv[2] || 'amoy';
  const deploymentFile = path.join(__dirname, '..', `deployment-${network}.json`);

  console.log('\n🔍 PolyMesh Contract Verification\n');
  console.log(`Network: ${network}`);

  // Check if deployment file exists
  if (!fs.existsSync(deploymentFile)) {
    console.error(`❌ Deployment file not found: ${deploymentFile}`);
    console.log('\n💡 Deploy first using:');
    console.log(`   npx hardhat run scripts/deploy-testnet.js --network ${network}\n`);
    process.exit(1);
  }

  // Load deployment info
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const contracts = deployment.contracts;

  console.log(`\nDeployment from: ${deployment.timestamp}`);
  console.log(`Deployer: ${deployment.deployer}\n`);

  // Check environment
  if (!process.env.POLYGONSCAN_API_KEY) {
    console.warn('⚠️  Warning: POLYGONSCAN_API_KEY not set in .env');
    console.log('💡 Get API key from: https://polygonscan.com/apis\n');
  }

  console.log('📋 Contracts to Verify:\n');

  const verifyCommands = [];

  // AgentExecutor (no constructor args)
  if (contracts.AgentExecutor) {
    console.log(`1. AgentExecutor: ${contracts.AgentExecutor}`);
    verifyCommands.push(`npx hardhat verify --network ${network} ${contracts.AgentExecutor}`);
  }

  // BridgeExtension (constructor: bridge address)
  if (contracts.BridgeExtension) {
    const bridgeAddr = contracts.MockBridge || contracts.AggLayerBridge;
    console.log(`2. BridgeExtension: ${contracts.BridgeExtension}`);
    verifyCommands.push(`npx hardhat verify --network ${network} ${contracts.BridgeExtension} ${bridgeAddr}`);
  }

  // MockBridge (only on testnet, no constructor args)
  if (contracts.MockBridge) {
    console.log(`3. MockBridge: ${contracts.MockBridge}`);
    verifyCommands.push(`npx hardhat verify --network ${network} ${contracts.MockBridge}`);
  }

  console.log('\n📝 Verification Commands:\n');
  verifyCommands.forEach((cmd, i) => {
    console.log(`${i + 1}. ${cmd}`);
  });

  console.log('\n💡 Run these commands one by one to verify contracts\n');

  // Generate verification script
  const verifyScript = verifyCommands.join('\n\n');
  const scriptPath = path.join(__dirname, `verify-${network}.ps1`);
  
  const psScript = `# Auto-generated verification script for ${network}
# Generated: ${new Date().toISOString()}

Write-Host "\\n🔍 Verifying PolyMesh contracts on ${network}...\\n" -ForegroundColor Cyan

${verifyCommands.map((cmd, i) => `
Write-Host "${i + 1}. Verifying ${['AgentExecutor', 'BridgeExtension', 'MockBridge'][i]}..." -ForegroundColor Yellow
${cmd}
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Verified successfully\\n" -ForegroundColor Green
} else {
    Write-Host "⚠️  Verification may have failed (check output)\\n" -ForegroundColor Yellow
}
`).join('\n')}

Write-Host "\\n✅ Verification process complete!\\n" -ForegroundColor Green
Write-Host "🔍 Check contracts on PolygonScan:" -ForegroundColor Cyan
${contracts.AgentExecutor ? `Write-Host "   AgentExecutor: https://${network === 'polygon' ? '' : 'amoy.'}polygonscan.com/address/${contracts.AgentExecutor}#code" -ForegroundColor White` : ''}
${contracts.BridgeExtension ? `Write-Host "   BridgeExtension: https://${network === 'polygon' ? '' : 'amoy.'}polygonscan.com/address/${contracts.BridgeExtension}#code" -ForegroundColor White` : ''}
Write-Host ""
`;

  fs.writeFileSync(scriptPath, psScript);
  console.log(`✅ Verification script saved to: verify-${network}.ps1`);
  console.log(`\n🚀 Quick run: .\\scripts\\verify-${network}.ps1\n`);

  // Explorer links
  const explorerBase = network === 'polygon' 
    ? 'https://polygonscan.com' 
    : 'https://amoy.polygonscan.com';

  console.log('🔗 View on Explorer:\n');
  if (contracts.AgentExecutor) {
    console.log(`   AgentExecutor:    ${explorerBase}/address/${contracts.AgentExecutor}`);
  }
  if (contracts.BridgeExtension) {
    console.log(`   BridgeExtension:  ${explorerBase}/address/${contracts.BridgeExtension}`);
  }
  if (contracts.MockBridge) {
    console.log(`   MockBridge:       ${explorerBase}/address/${contracts.MockBridge}`);
  }

  console.log('\n💡 Tips:');
  console.log('   - Verification may take 1-2 minutes per contract');
  console.log('   - If verification fails, contract may already be verified');
  console.log('   - Check PolygonScan for verification status (green checkmark ✅)');
  console.log('   - Make sure POLYGONSCAN_API_KEY is set in .env\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
