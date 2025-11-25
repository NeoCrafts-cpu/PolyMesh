const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

/**
 * Check PolyMesh deployment status and health
 * 
 * Usage:
 *   node scripts/check-deployment.js amoy
 *   node scripts/check-deployment.js polygon
 */

async function main() {
  const network = process.argv[2] || 'amoy';
  const deploymentFile = path.join(__dirname, '..', `deployment-${network}.json`);

  console.log('\n🔍 PolyMesh Deployment Status Check\n');
  console.log(`Network: ${network}\n`);

  // Check if deployment exists
  if (!fs.existsSync(deploymentFile)) {
    console.error(`❌ No deployment found for ${network}`);
    console.log(`\n💡 Deploy first: npx hardhat run scripts/deploy-testnet.js --network ${network}\n`);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const contracts = deployment.contracts;

  console.log('📄 Deployment Info:');
  console.log(`   Date: ${deployment.timestamp}`);
  console.log(`   Chain ID: ${deployment.chainId}`);
  console.log(`   Deployer: ${deployment.deployer}\n`);

  // Setup provider
  const rpcUrl = network === 'amoy' 
    ? 'https://rpc-amoy.polygon.technology'
    : 'https://polygon-rpc.com';
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  console.log('🌐 Network Status:');
  try {
    const blockNumber = await provider.getBlockNumber();
    const network = await provider.getNetwork();
    console.log(`   ✅ Connected to ${network.name}`);
    console.log(`   Block: ${blockNumber}`);
    console.log(`   Chain ID: ${network.chainId}\n`);
  } catch (error) {
    console.error('   ❌ Cannot connect to network');
    console.error(`   ${error.message}\n`);
    process.exit(1);
  }

  // Check contracts
  console.log('📝 Contract Status:\n');

  const checks = [];

  // Check AgentExecutor
  if (contracts.AgentExecutor) {
    checks.push(checkContract(provider, 'AgentExecutor', contracts.AgentExecutor, network));
  }

  // Check BridgeExtension
  if (contracts.BridgeExtension) {
    checks.push(checkContract(provider, 'BridgeExtension', contracts.BridgeExtension, network));
  }

  // Check MockBridge or AggLayer Bridge
  if (contracts.MockBridge) {
    checks.push(checkContract(provider, 'MockBridge', contracts.MockBridge, network));
  } else if (contracts.AggLayerBridge) {
    checks.push(checkContract(provider, 'AggLayerBridge', contracts.AggLayerBridge, network));
  }

  await Promise.all(checks);

  // Check deployer balance
  console.log('\n💰 Deployer Balance:');
  try {
    const balance = await provider.getBalance(deployment.deployer);
    const balanceEth = ethers.formatEther(balance);
    const symbol = network === 'amoy' ? 'POL' : 'MATIC';
    
    if (parseFloat(balanceEth) > 0.05) {
      console.log(`   ✅ ${balanceEth} ${symbol} (sufficient)`);
    } else {
      console.log(`   ⚠️  ${balanceEth} ${symbol} (low - get more from faucet)`);
    }
  } catch (error) {
    console.error(`   ❌ Cannot check balance: ${error.message}`);
  }

  // Agent configuration check
  console.log('\n🤖 Agent Configuration:');
  const agentEnvPath = path.join(__dirname, '..', '..', 'agents', 'eliza', '.env');
  
  if (fs.existsSync(agentEnvPath)) {
    const envContent = fs.readFileSync(agentEnvPath, 'utf8');
    
    const checks = [
      { key: 'AGENT_EXECUTOR_ADDRESS', value: contracts.AgentExecutor },
      { key: 'BRIDGE_EXTENSION_ADDRESS', value: contracts.BridgeExtension },
      { key: 'CHAIN_ID', value: deployment.chainId.toString() },
    ];

    let allGood = true;
    checks.forEach(check => {
      const regex = new RegExp(`${check.key}=(.+)`);
      const match = envContent.match(regex);
      
      if (match && match[1].trim() === check.value) {
        console.log(`   ✅ ${check.key} configured correctly`);
      } else {
        console.log(`   ❌ ${check.key} needs update: ${check.value}`);
        allGood = false;
      }
    });

    if (!allGood) {
      console.log('\n💡 Update agents/eliza/.env with correct addresses');
    }
  } else {
    console.log('   ⚠️  Agent .env file not found');
  }

  // Summary
  console.log('\n========================================');
  console.log('   📊 Deployment Health Summary');
  console.log('========================================\n');

  const explorerBase = network === 'polygon' 
    ? 'https://polygonscan.com'
    : 'https://amoy.polygonscan.com';

  console.log('🔗 Contract Links:');
  if (contracts.AgentExecutor) {
    console.log(`   ${explorerBase}/address/${contracts.AgentExecutor}`);
  }
  if (contracts.BridgeExtension) {
    console.log(`   ${explorerBase}/address/${contracts.BridgeExtension}`);
  }

  console.log('\n💡 Next Steps:');
  console.log('   1. Verify contracts on PolygonScan (if not already)');
  console.log('   2. Update agent .env with contract addresses');
  console.log('   3. Fund agent wallet with POL');
  console.log('   4. Start agent: cd agents/eliza && node --loader ts-node/esm src/index.ts');
  console.log('   5. Monitor trades and profits!\n');
}

async function checkContract(provider, name, address, network) {
  try {
    const code = await provider.getCode(address);
    
    if (code === '0x') {
      console.log(`❌ ${name}: ${address}`);
      console.log(`   No contract code found - deployment may have failed\n`);
      return false;
    }

    const balance = await provider.getBalance(address);
    const balanceEth = ethers.formatEther(balance);
    
    console.log(`✅ ${name}: ${address}`);
    console.log(`   Contract deployed successfully`);
    console.log(`   Balance: ${balanceEth} ${network === 'amoy' ? 'POL' : 'MATIC'}\n`);
    return true;
  } catch (error) {
    console.log(`❌ ${name}: ${address}`);
    console.log(`   Error: ${error.message}\n`);
    return false;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
