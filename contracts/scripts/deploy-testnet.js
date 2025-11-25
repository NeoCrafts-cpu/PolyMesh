const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Deploy PolyMesh contracts to Polygon Amoy Testnet
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-testnet.js --network amoy
 *   npx hardhat run scripts/deploy-testnet.js --network polygon
 */

async function main() {
  console.log('\n🚀 Starting PolyMesh Testnet Deployment...\n');

  const [deployer] = await hre.ethers.getSigners();
  
  console.log(`👤 Deployer: ${deployer.address}`);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} ${hre.network.name === 'amoy' ? 'POL' : 'MATIC'}`);
  
  if (balance === 0n) {
    console.error('\n❌ Error: Deployer has no funds!');
    console.log('\n💡 Get testnet tokens:');
    console.log('   Polygon Amoy Faucet: https://faucet.polygon.technology/');
    console.log('   OR: https://www.alchemy.com/faucets/polygon-amoy');
    process.exit(1);
  }

  console.log(`\n🌐 Network: ${hre.network.name}`);
  console.log(`🔗 Chain ID: ${(await hre.ethers.provider.getNetwork()).chainId}`);
  console.log('');

  // For testnet, we need a real bridge address or deploy a mock
  // On Polygon, the AggLayer bridge will be at a known address
  let bridgeAddress;
  
  if (hre.network.name === 'polygon') {
    // Polygon Mainnet - use real AggLayer bridge
    bridgeAddress = process.env.AGGLAYER_BRIDGE_ADDRESS || '0x2a3DD3EB832aF982ec71669E178424b10Dca2EDe'; // Placeholder
    console.log(`🌉 Using AggLayer Bridge: ${bridgeAddress}`);
  } else {
    // Testnet - deploy mock bridge
    console.log('📝 Deploying MockBridge for testing...');
    const MockBridge = await hre.ethers.getContractFactory("MockBridge");
    const mockBridge = await MockBridge.deploy();
    await mockBridge.waitForDeployment();
    bridgeAddress = await mockBridge.getAddress();
    console.log(`✅ MockBridge: ${bridgeAddress}\n`);
  }

  // Deploy AgentExecutor
  console.log('📝 Deploying AgentExecutor...');
  const AgentExecutor = await hre.ethers.getContractFactory("AgentExecutor");
  const agentExecutor = await AgentExecutor.deploy(bridgeAddress, deployer.address);
  await agentExecutor.waitForDeployment();
  const agentExecutorAddress = await agentExecutor.getAddress();
  console.log(`✅ AgentExecutor: ${agentExecutorAddress}\n`);

  // Deploy BridgeExtension
  console.log('📝 Deploying BridgeExtension...');
  const BridgeExtension = await hre.ethers.getContractFactory("BridgeExtension");
  const bridgeExtension = await BridgeExtension.deploy(bridgeAddress, deployer.address);
  await bridgeExtension.waitForDeployment();
  const bridgeExtensionAddress = await bridgeExtension.getAddress();
  console.log(`✅ BridgeExtension: ${bridgeExtensionAddress}\n`);

  // Setup: Authorize deployer as agent for testing
  console.log('👤 Authorizing deployer as agent...');
  const tx = await agentExecutor.authorizeAgent(deployer.address);
  await tx.wait();
  console.log('✅ Agent authorized\n');

  // Save deployment info
  const deployment = {
    network: hre.network.name,
    chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      MockBridge: hre.network.name !== 'polygon' ? bridgeAddress : null,
      AggLayerBridge: hre.network.name === 'polygon' ? bridgeAddress : null,
      AgentExecutor: agentExecutorAddress,
      BridgeExtension: bridgeExtensionAddress,
    },
  };

  const deploymentPath = path.join(__dirname, '..', `deployment-${hre.network.name}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

  console.log('========================================');
  console.log('   ✅ Deployment Complete!');
  console.log('========================================\n');
  
  console.log(`📄 Deployment saved to: deployment-${hre.network.name}.json\n`);
  
  console.log('🔑 Contract Addresses:');
  if (hre.network.name !== 'polygon') {
    console.log(`   MockBridge:       ${bridgeAddress}`);
  } else {
    console.log(`   AggLayer Bridge:  ${bridgeAddress}`);
  }
  console.log(`   AgentExecutor:    ${agentExecutorAddress}`);
  console.log(`   BridgeExtension:  ${bridgeExtensionAddress}\n`);

  console.log('💡 Next Steps:\n');
  console.log('1. Update agent .env file:');
  console.log(`   POLYMESH_RPC_URL=https://rpc-amoy.polygon.technology`);
  console.log(`   AGENT_EXECUTOR_ADDRESS=${agentExecutorAddress}`);
  console.log(`   BRIDGE_EXTENSION_ADDRESS=${bridgeExtensionAddress}\n`);

  console.log('2. Verify contracts on PolygonScan:');
  console.log(`   npx hardhat verify --network ${hre.network.name} ${agentExecutorAddress}`);
  console.log(`   npx hardhat verify --network ${hre.network.name} ${bridgeExtensionAddress} ${bridgeAddress}\n`);

  console.log('3. Fund your agent wallet with testnet POL:');
  console.log(`   https://faucet.polygon.technology/\n`);

  console.log('4. Start the agent:');
  console.log(`   cd ../agents/eliza`);
  console.log(`   node --loader ts-node/esm src/index.ts\n`);

  // Display block explorer links
  const explorerUrl = hre.network.name === 'amoy' 
    ? 'https://amoy.polygonscan.com'
    : 'https://polygonscan.com';
  
  console.log('🔍 View on Explorer:');
  console.log(`   AgentExecutor:    ${explorerUrl}/address/${agentExecutorAddress}`);
  console.log(`   BridgeExtension:  ${explorerUrl}/address/${bridgeExtensionAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  });
