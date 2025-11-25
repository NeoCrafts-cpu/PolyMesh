const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgentExecutor", function () {
  let agentExecutor;
  let bridgeExtension;
  let mockBridge;
  let owner;
  let agent;
  let unauthorized;

  beforeEach(async function () {
    [owner, agent, unauthorized] = await ethers.getSigners();

    // Deploy mock bridge
    const MockBridge = await ethers.getContractFactory("MockBridge");
    mockBridge = await MockBridge.deploy();
    await mockBridge.waitForDeployment();

    // Deploy AgentExecutor
    const AgentExecutor = await ethers.getContractFactory("AgentExecutor");
    agentExecutor = await AgentExecutor.deploy(
      await mockBridge.getAddress(),
      owner.address
    );
    await agentExecutor.waitForDeployment();

    // Deploy BridgeExtension
    const BridgeExtension = await ethers.getContractFactory("BridgeExtension");
    bridgeExtension = await BridgeExtension.deploy(
      await mockBridge.getAddress(),
      owner.address
    );
    await bridgeExtension.waitForDeployment();

    // Configure
    await agentExecutor.setBridgeExtension(await bridgeExtension.getAddress());
    await bridgeExtension.authorizeNetwork(10101);
    await bridgeExtension.authorizeOrigin(10101, await agentExecutor.getAddress());
  });

  describe("Agent Authorization", function () {
    it("Should authorize an agent", async function () {
      await agentExecutor.authorizeAgent(agent.address);
      expect(await agentExecutor.authorizedAgents(agent.address)).to.be.true;
      expect(await agentExecutor.agentReputation(agent.address)).to.equal(100);
    });

    it("Should deauthorize an agent", async function () {
      await agentExecutor.authorizeAgent(agent.address);
      await agentExecutor.deauthorizeAgent(agent.address);
      expect(await agentExecutor.authorizedAgents(agent.address)).to.be.false;
    });

    it("Should revert if unauthorized agent tries to execute", async function () {
      const callData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string"],
        ["test"]
      );

      await expect(
        agentExecutor.connect(unauthorized).agentExecuteSimple(
          137, // Polygon PoS
          ethers.ZeroAddress,
          0,
          callData
        )
      ).to.be.revertedWithCustomError(agentExecutor, "UnauthorizedAgent");
    });
  });

  describe("Reputation System", function () {
    beforeEach(async function () {
      await agentExecutor.authorizeAgent(agent.address);
    });

    it("Should initialize agent with base reputation", async function () {
      expect(await agentExecutor.agentReputation(agent.address)).to.equal(100);
    });

    it("Should check if agent can execute", async function () {
      expect(await agentExecutor.canExecute(agent.address)).to.be.true;
    });

    it("Should prevent execution if reputation is below minimum", async function () {
      await agentExecutor.setMinReputation(200);
      expect(await agentExecutor.canExecute(agent.address)).to.be.false;
    });
  });

  describe("Agent Statistics", function () {
    beforeEach(async function () {
      await agentExecutor.authorizeAgent(agent.address);
    });

    it("Should return correct agent statistics", async function () {
      const stats = await agentExecutor.getAgentStats(agent.address);
      expect(stats.authorized).to.be.true;
      expect(stats.reputation).to.equal(100);
      expect(stats.executions).to.equal(0);
      expect(stats.failures).to.equal(0);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to set ZKML verifier", async function () {
      const verifierAddress = ethers.Wallet.createRandom().address;
      await agentExecutor.setZKMLVerifier(verifierAddress);
      expect(await agentExecutor.zkmlVerifier()).to.equal(verifierAddress);
    });

    it("Should allow owner to set KYA registry", async function () {
      const registryAddress = ethers.Wallet.createRandom().address;
      await agentExecutor.setKYARegistry(registryAddress);
      expect(await agentExecutor.kyaRegistry()).to.equal(registryAddress);
    });

    it("Should allow owner to pause contract", async function () {
      await agentExecutor.pause();
      expect(await agentExecutor.paused()).to.be.true;
    });

    it("Should revert if non-owner tries to authorize agent", async function () {
      await expect(
        agentExecutor.connect(unauthorized).authorizeAgent(agent.address)
      ).to.be.reverted;
    });
  });
});

// Mock Bridge contract for testing
// This would be replaced by actual bridge in production


