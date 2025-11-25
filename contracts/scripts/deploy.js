const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deployment script for PolyMesh smart contracts
 * 
 * Deploys:
 * 1. AgentExecutor - Main contract for AI agent operations
 * 2. BridgeExtension - Handler for incoming AggLayer messages
 * 
 * Prerequisites:
 * - PolyMesh CDK chain running (via Kurtosis)
 * - Wallet funded with $MESH tokens
 * - Bridge V2 address from CDK deployment
 */

async function main() {
  console.log("🚀 Starting PolyMesh deployment...\n");

  // Get network info
  const network = await hre.ethers.provider.getNetwork();
  console.log(`📡 Deploying to network: ${network.name} (Chain ID: ${network.chainId})`);

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log(`👤 Deployer address: ${deployer.address}`);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💰 Deployer balance: ${hre.ethers.formatEther(balance)} MESH\n`);

  // ==================== Step 1: Get Bridge Address ====================
  
  console.log("🔍 Step 1: Locating Polygon zkEVM Bridge V2...");
  
  // The bridge address should be available from Kurtosis deployment
  // For now, we'll use a placeholder - in production, get this from deployment output
  const BRIDGE_ADDRESS = process.env.BRIDGE_V2_ADDRESS || "0x0000000000000000000000000000000000000000";
  
  if (BRIDGE_ADDRESS === "0x0000000000000000000000000000000000000000") {
    console.warn("⚠️  Warning: Using placeholder bridge address");
    console.warn("   Set BRIDGE_V2_ADDRESS environment variable to actual bridge address");
    console.warn("   Get this from Kurtosis deployment output\n");
  } else {
    console.log(`✅ Bridge V2 found at: ${BRIDGE_ADDRESS}\n`);
  }

  // ==================== Step 2: Deploy AgentExecutor ====================
  
  console.log("📝 Step 2: Deploying AgentExecutor contract...");
  
  const AgentExecutor = await hre.ethers.getContractFactory("AgentExecutor");
  const agentExecutor = await AgentExecutor.deploy(
    BRIDGE_ADDRESS,
    deployer.address
  );
  
  await agentExecutor.waitForDeployment();
  const agentExecutorAddress = await agentExecutor.getAddress();
  
  console.log(`✅ AgentExecutor deployed to: ${agentExecutorAddress}`);
  console.log(`   Transaction: ${agentExecutor.deploymentTransaction().hash}\n`);

  // ==================== Step 3: Deploy BridgeExtension ====================
  
  console.log("📝 Step 3: Deploying BridgeExtension contract...");
  
  const BridgeExtension = await hre.ethers.getContractFactory("BridgeExtension");
  const bridgeExtension = await BridgeExtension.deploy(
    BRIDGE_ADDRESS,
    deployer.address
  );
  
  await bridgeExtension.waitForDeployment();
  const bridgeExtensionAddress = await bridgeExtension.getAddress();
  
  console.log(`✅ BridgeExtension deployed to: ${bridgeExtensionAddress}`);
  console.log(`   Transaction: ${bridgeExtension.deploymentTransaction().hash}\n`);

  // ==================== Step 4: Configure Contracts ====================
  
  console.log("⚙️  Step 4: Configuring contracts...");
  
  // Set BridgeExtension in AgentExecutor
  console.log("   Setting BridgeExtension in AgentExecutor...");
  const setBridgeTx = await agentExecutor.setBridgeExtension(bridgeExtensionAddress);
  await setBridgeTx.wait();
  console.log(`   ✅ BridgeExtension configured`);
  
  // Authorize PolyMesh network in BridgeExtension (Chain ID: 10101)
  console.log("   Authorizing PolyMesh network (10101)...");
  const authNetworkTx = await bridgeExtension.authorizeNetwork(10101);
  await authNetworkTx.wait();
  console.log(`   ✅ PolyMesh network authorized`);
  
  // Authorize AgentExecutor as an origin
  console.log("   Authorizing AgentExecutor as origin...");
  const authOriginTx = await bridgeExtension.authorizeOrigin(10101, agentExecutorAddress);
  await authOriginTx.wait();
  console.log(`   ✅ AgentExecutor authorized as origin`);
  
  // Authorize deployer as an agent for testing
  console.log("   Authorizing deployer as test agent...");
  const authAgentTx = await agentExecutor.authorizeAgent(deployer.address);
  await authAgentTx.wait();
  console.log(`   ✅ Deployer authorized as agent\n`);

  // ==================== Step 5: Save Deployment Info ====================
  
  console.log("💾 Step 5: Saving deployment info...");
  
  const deploymentInfo = {
    network: {
      name: network.name,
      chainId: Number(network.chainId),
    },
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      bridge: BRIDGE_ADDRESS,
      agentExecutor: agentExecutorAddress,
      bridgeExtension: bridgeExtensionAddress,
    },
    transactions: {
      agentExecutor: agentExecutor.deploymentTransaction().hash,
      bridgeExtension: bridgeExtension.deploymentTransaction().hash,
    },
  };
  
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  const deploymentFile = path.join(
    deploymentsDir,
    `deployment-${network.chainId}-${Date.now()}.json`
  );
  
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`✅ Deployment info saved to: ${deploymentFile}\n`);

  // ==================== Summary ====================
  
  console.log("🎉 Deployment completed successfully!\n");
  console.log("📋 Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Network:          ${network.name} (${network.chainId})`);
  console.log(`Deployer:         ${deployer.address}`);
  console.log(`Bridge V2:        ${BRIDGE_ADDRESS}`);
  console.log(`AgentExecutor:    ${agentExecutorAddress}`);
  console.log(`BridgeExtension:  ${bridgeExtensionAddress}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("📝 Next steps:");
  console.log("1. Update .env with contract addresses:");
  console.log(`   AGENT_EXECUTOR_ADDRESS=${agentExecutorAddress}`);
  console.log(`   BRIDGE_EXTENSION_ADDRESS=${bridgeExtensionAddress}`);
  console.log("2. Configure AI agent with AgentExecutor address");
  console.log("3. Test agent execution with agentExecute()");
  console.log("4. Deploy to other chains for cross-chain testing\n");

  // ==================== Verification Info ====================
  
  if (network.chainId !== 31337n && network.chainId !== 1337n) {
    console.log("🔍 To verify contracts on block explorer:");
    console.log(`npx hardhat verify --network ${network.name} ${agentExecutorAddress} "${BRIDGE_ADDRESS}" "${deployer.address}"`);
    console.log(`npx hardhat verify --network ${network.name} ${bridgeExtensionAddress} "${BRIDGE_ADDRESS}" "${deployer.address}"`);
  }
}

// Error handling
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });


