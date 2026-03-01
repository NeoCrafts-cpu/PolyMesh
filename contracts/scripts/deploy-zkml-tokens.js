/**
 * Deploy script for ZKML Verifier and Token Wrapper contracts
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-zkml-tokens.js --network <network>
 * 
 * Networks:
 *   - localhost (Hardhat local)
 *   - polymesh (CDK local)
 *   - amoy (Polygon Amoy testnet)
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n🚀 Deploying ZKML Verifier and Token Wrapper...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Load existing deployment to get AgentExecutor address
  const networkName = hre.network.name;
  const deploymentPath = path.join(__dirname, `../deployment-${networkName}.json`);
  
  let existingDeployment = {};
  if (fs.existsSync(deploymentPath)) {
    existingDeployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    console.log("📄 Loaded existing deployment from:", deploymentPath);
  }

  // ==================== Deploy ZKMLVerifier ====================
  console.log("\n📦 Deploying ZKMLVerifier...");
  
  const ZKMLVerifier = await hre.ethers.getContractFactory("ZKMLVerifier");
  const zkmlVerifier = await ZKMLVerifier.deploy(deployer.address);
  await zkmlVerifier.waitForDeployment();
  
  const zkmlVerifierAddress = await zkmlVerifier.getAddress();
  console.log("✅ ZKMLVerifier deployed to:", zkmlVerifierAddress);

  // Enable mock mode for testing
  if (networkName === "localhost" || networkName === "hardhat") {
    console.log("   Enabling mock mode for local testing...");
    await zkmlVerifier.setMockMode(true);
    console.log("   ✅ Mock mode enabled");
  }

  // Register a test model
  const testModelHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("polymesh-arbitrage-model-v1"));
  console.log("   Registering test AI model...");
  await zkmlVerifier.registerModel(testModelHash, "ipfs://QmTestModelHash");
  console.log("   ✅ Model registered:", testModelHash);

  // ==================== Deploy TokenWrapper ====================
  console.log("\n📦 Deploying TokenWrapper...");
  
  const TokenWrapper = await hre.ethers.getContractFactory("TokenWrapper");
  const tokenWrapper = await TokenWrapper.deploy(deployer.address, deployer.address);
  await tokenWrapper.waitForDeployment();
  
  const tokenWrapperAddress = await tokenWrapper.getAddress();
  console.log("✅ TokenWrapper deployed to:", tokenWrapperAddress);

  // ==================== Configure AgentExecutor ====================
  if (existingDeployment.agentExecutor) {
    console.log("\n⚙️  Configuring AgentExecutor...");
    
    const agentExecutor = await hre.ethers.getContractAt("AgentExecutor", existingDeployment.agentExecutor);
    
    // Set ZKML Verifier
    console.log("   Setting ZKML Verifier...");
    await agentExecutor.setZKMLVerifier(zkmlVerifierAddress);
    console.log("   ✅ ZKML Verifier set");
    
    // Set Token Wrapper
    console.log("   Setting Token Wrapper...");
    await agentExecutor.setTokenWrapper(tokenWrapperAddress);
    console.log("   ✅ Token Wrapper set");
    
    // Set AgentExecutor in TokenWrapper
    console.log("   Configuring TokenWrapper with AgentExecutor...");
    await tokenWrapper.setAgentExecutor(existingDeployment.agentExecutor);
    console.log("   ✅ AgentExecutor set in TokenWrapper");
  } else {
    console.log("\n⚠️  No existing AgentExecutor found. Please configure manually.");
  }

  // ==================== Configure Test Tokens (Testnet) ====================
  if (networkName === "amoy" || networkName === "localhost" || networkName === "hardhat") {
    console.log("\n🪙 Configuring supported tokens...");
    
    // Example token configurations (use actual addresses for testnet)
    const tokens = [
      {
        address: process.env.USDC_ADDRESS || hre.ethers.ZeroAddress,
        symbol: "USDC",
        decimals: 6,
        minDeposit: hre.ethers.parseUnits("1", 6), // 1 USDC
        maxDeposit: hre.ethers.parseUnits("10000", 6), // 10,000 USDC
        dailyLimit: hre.ethers.parseUnits("100000", 6), // 100,000 USDC/day
        depositFee: 10, // 0.1%
        withdrawFee: 10, // 0.1%
      },
      {
        address: process.env.WETH_ADDRESS || hre.ethers.ZeroAddress,
        symbol: "WETH",
        decimals: 18,
        minDeposit: hre.ethers.parseUnits("0.001", 18),
        maxDeposit: hre.ethers.parseUnits("10", 18),
        dailyLimit: hre.ethers.parseUnits("100", 18),
        depositFee: 10,
        withdrawFee: 10,
      },
    ];

    for (const token of tokens) {
      if (token.address !== hre.ethers.ZeroAddress) {
        console.log(`   Adding ${token.symbol}...`);
        await tokenWrapper.addSupportedToken(
          token.address,
          token.symbol,
          token.decimals,
          token.minDeposit,
          token.maxDeposit,
          token.dailyLimit,
          token.depositFee,
          token.withdrawFee
        );
        console.log(`   ✅ ${token.symbol} added`);
      } else {
        console.log(`   ⚠️  Skipping ${token.symbol} (no address configured)`);
      }
    }
  }

  // ==================== Save Deployment ====================
  const deployment = {
    ...existingDeployment,
    zkmlVerifier: zkmlVerifierAddress,
    tokenWrapper: tokenWrapperAddress,
    testModelHash: testModelHash,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    network: networkName,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
  };

  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log("\n📝 Deployment saved to:", deploymentPath);

  // ==================== Summary ====================
  console.log("\n" + "=".repeat(60));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log(`Network:        ${networkName}`);
  console.log(`Chain ID:       ${deployment.chainId}`);
  console.log(`Deployer:       ${deployer.address}`);
  console.log("");
  console.log("Contracts:");
  console.log(`  ZKMLVerifier:   ${zkmlVerifierAddress}`);
  console.log(`  TokenWrapper:   ${tokenWrapperAddress}`);
  if (existingDeployment.agentExecutor) {
    console.log(`  AgentExecutor:  ${existingDeployment.agentExecutor}`);
  }
  console.log("");
  console.log("Test Model Hash:");
  console.log(`  ${testModelHash}`);
  console.log("=".repeat(60));

  // Verification instructions
  if (networkName !== "localhost" && networkName !== "hardhat") {
    console.log("\n📋 To verify contracts on Polygonscan:");
    console.log(`npx hardhat verify --network ${networkName} ${zkmlVerifierAddress} "${deployer.address}"`);
    console.log(`npx hardhat verify --network ${networkName} ${tokenWrapperAddress} "${deployer.address}" "${deployer.address}"`);
  }

  console.log("\n✅ ZKML and Token wrapper deployment complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
