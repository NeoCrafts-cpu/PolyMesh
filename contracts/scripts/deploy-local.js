const hre = require("hardhat");

/**
 * Quick deployment for local testing without CDK chain
 * Deploys mock bridge and contracts
 */

async function main() {
  console.log("\n🚀 Starting Local PolyMesh Deployment...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("👤 Deployer:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Deploy MockBridge
  console.log("📝 Deploying MockBridge...");
  const MockBridge = await hre.ethers.getContractFactory("MockBridge");
  const mockBridge = await MockBridge.deploy();
  await mockBridge.waitForDeployment();
  const bridgeAddress = await mockBridge.getAddress();
  console.log("✅ MockBridge:", bridgeAddress, "\n");

  // Deploy AgentExecutor
  console.log("📝 Deploying AgentExecutor...");
  const AgentExecutor = await hre.ethers.getContractFactory("AgentExecutor");
  const agentExecutor = await AgentExecutor.deploy(bridgeAddress, deployer.address);
  await agentExecutor.waitForDeployment();
  const executorAddress = await agentExecutor.getAddress();
  console.log("✅ AgentExecutor:", executorAddress, "\n");

  // Deploy BridgeExtension
  console.log("📝 Deploying BridgeExtension...");
  const BridgeExtension = await hre.ethers.getContractFactory("BridgeExtension");
  const bridgeExtension = await BridgeExtension.deploy(bridgeAddress, deployer.address);
  await bridgeExtension.waitForDeployment();
  const extensionAddress = await bridgeExtension.getAddress();
  console.log("✅ BridgeExtension:", extensionAddress, "\n");

  // Authorize the bridge extension in executor
  console.log("🔗 Linking contracts...");
  await agentExecutor.setBridgeExtension(extensionAddress);
  console.log("✅ BridgeExtension authorized\n");

  // Authorize deployer as agent for testing
  console.log("👤 Authorizing deployer as agent...");
  await agentExecutor.authorizeAgent(deployer.address);
  console.log("✅ Agent authorized\n");

  // Save deployment info
  const deploymentInfo = {
    network: "localhost",
    chainId: 31337,
    deployer: deployer.address,
    contracts: {
      MockBridge: bridgeAddress,
      AgentExecutor: executorAddress,
      BridgeExtension: extensionAddress
    },
    timestamp: new Date().toISOString()
  };

  const fs = require("fs");
  fs.writeFileSync(
    "deployment-local.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("========================================");
  console.log("   ✅ Deployment Complete!             ");
  console.log("========================================\n");
  console.log("📄 Deployment saved to: deployment-local.json\n");
  console.log("🔑 Contract Addresses:");
  console.log("   MockBridge:      ", bridgeAddress);
  console.log("   AgentExecutor:   ", executorAddress);
  console.log("   BridgeExtension: ", extensionAddress);
  console.log("\n💡 Update .env files with these addresses:");
  console.log("   AGENT_EXECUTOR_ADDRESS=" + executorAddress);
  console.log("   BRIDGE_EXTENSION_ADDRESS=" + extensionAddress);
  console.log("\n🚀 Next: Start the agent!");
  console.log("   cd ../agents/eliza");
  console.log("   npm run dev\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


