# 🚀 PolyMesh Testnet Deployment Guide

Complete guide to deploy PolyMesh AI Agent to Polygon Amoy Testnet.

## 📋 Prerequisites

1. **Node.js** v18+ installed
2. **MetaMask** wallet extension
3. **Private key** from your deployment wallet
4. **Testnet POL tokens** (from faucet)

---

## Step 1: 🔐 Wallet Setup

### Get Your Private Key from MetaMask

1. Open MetaMask extension
2. Click the three dots menu → Account Details
3. Click "Show Private Key"
4. Enter your password
5. Copy the private key ⚠️ **NEVER SHARE THIS**

### Add Private Key to .env

```bash
# Navigate to contracts directory
cd contracts

# Create or edit .env file
notepad .env
```

Add this line to `.env`:

```env
PRIVATE_KEY=your_private_key_here_without_0x_prefix
```

⚠️ **Security Warning:**
- NEVER commit `.env` to git
- `.env` is already in `.gitignore`
- Use a fresh wallet for testnet (not your main wallet)

---

## Step 2: 💰 Get Testnet POL Tokens

You need POL tokens on Polygon Amoy testnet for:
- Contract deployment gas fees
- Agent trading operations

### Faucet Options:

**Option 1: Official Polygon Faucet** (Recommended)
- URL: https://faucet.polygon.technology/
- Select "Polygon Amoy"
- Connect your wallet or paste address
- Request tokens (0.5-1 POL)

**Option 2: Alchemy Faucet**
- URL: https://www.alchemy.com/faucets/polygon-amoy
- Sign in with Alchemy account (free)
- Request 0.5 POL per day

**Option 3: QuickNode Faucet**
- URL: https://faucet.quicknode.com/polygon/amoy
- Connect wallet
- Request tokens

### Verify Balance:

Check your balance on PolygonScan:
```
https://amoy.polygonscan.com/address/YOUR_WALLET_ADDRESS
```

You need at least **0.1 POL** for deployment.

---

## Step 3: 🌐 Add Amoy Network to MetaMask

### Automatic Method:

Visit https://chainlist.org and search "Polygon Amoy"
Click "Add to MetaMask"

### Manual Method:

1. Open MetaMask
2. Click network dropdown → "Add Network"
3. Fill in:

```
Network Name: Polygon Amoy Testnet
RPC URL: https://rpc-amoy.polygon.technology
Chain ID: 80002
Currency Symbol: POL
Block Explorer: https://amoy.polygonscan.com
```

4. Click "Save"

---

## Step 4: 🚀 Deploy Contracts

### Deploy to Polygon Amoy Testnet:

```powershell
# Make sure you're in contracts directory
cd c:\Users\MSI\Desktop\NeuroMesh\contracts

# Deploy contracts
npx hardhat run scripts/deploy-testnet.js --network amoy
```

### Expected Output:

```
🚀 Starting PolyMesh Testnet Deployment...

👤 Deployer: 0xYourAddress...
💰 Balance: 0.5 POL
🌐 Network: amoy
🔗 Chain ID: 80002

📝 Deploying MockBridge for testing...
✅ MockBridge: 0x...

📝 Deploying AgentExecutor...
✅ AgentExecutor: 0x...

📝 Deploying BridgeExtension...
✅ BridgeExtension: 0x...

========================================
   ✅ Deployment Complete!
========================================
```

### Deployment Info Saved:

Check `deployment-amoy.json` for contract addresses:

```json
{
  "network": "amoy",
  "chainId": 80002,
  "contracts": {
    "MockBridge": "0x...",
    "AgentExecutor": "0x...",
    "BridgeExtension": "0x..."
  }
}
```

---

## Step 5: ✅ Verify Contracts on PolygonScan

Contract verification makes your code public and enables interaction through block explorer.

### Get PolygonScan API Key:

1. Visit https://polygonscan.com/
2. Create free account → API Keys
3. Generate new API key
4. Add to `contracts/.env`:

```env
POLYGONSCAN_API_KEY=your_api_key_here
```

### Verify Contracts:

```powershell
# Verify AgentExecutor
npx hardhat verify --network amoy YOUR_AGENT_EXECUTOR_ADDRESS

# Verify BridgeExtension
npx hardhat verify --network amoy YOUR_BRIDGE_EXTENSION_ADDRESS YOUR_BRIDGE_ADDRESS
```

### Verification Success:

Visit PolygonScan to see verified contract:
```
https://amoy.polygonscan.com/address/YOUR_CONTRACT_ADDRESS#code
```

You'll see green checkmark ✅ next to contract address.

---

## Step 6: 🤖 Configure Agent for Testnet

### Update Agent .env File:

```bash
cd ..\agents\eliza
notepad .env
```

Update these values:

```env
# Network Configuration
POLYMESH_RPC_URL=https://rpc-amoy.polygon.technology
CHAIN_ID=80002

# Contract Addresses (from deployment-amoy.json)
AGENT_EXECUTOR_ADDRESS=0xYourAgentExecutorAddress
BRIDGE_EXTENSION_ADDRESS=0xYourBridgeExtensionAddress

# Agent Wallet (same as deployer or different)
AGENT_PRIVATE_KEY=your_agent_private_key

# WebSocket
WS_PORT=8080

# AI Configuration (optional)
OPENROUTER_API_KEY=your_openrouter_key_optional
```

### Fund Agent Wallet:

If using different wallet for agent:
1. Send 0.1 POL from faucet to agent wallet
2. Agent needs gas for trade execution

---

## Step 7: 🎯 Test Deployment

### Start the Agent:

```powershell
cd c:\Users\MSI\Desktop\NeuroMesh\agents\eliza

# Run agent
node --loader ts-node/esm src/index.ts
```

### Expected Output:

```
🤖 PolyMesh AI Agent Starting...
🔌 WebSocket server running on port 8080
✅ Connected to Polygon Amoy (Chain ID: 80002)
📡 Monitoring prices for 5 tokens...
```

### Start Dashboard:

```powershell
cd ..\..\frontend\neuromesh-ui

# Start frontend
npm run dev
```

Visit http://localhost:3000 to see dashboard.

---

## 🔍 Monitoring & Troubleshooting

### View Transactions on PolygonScan:

```
https://amoy.polygonscan.com/address/YOUR_AGENT_EXECUTOR_ADDRESS
```

### Common Issues:

#### ❌ "insufficient funds for intrinsic transaction cost"
**Solution:** Request more POL from faucet (need at least 0.05 POL)

#### ❌ "nonce has already been used"
**Solution:** Reset MetaMask account:
- Settings → Advanced → Clear Activity Tab Data

#### ❌ "invalid private key"
**Solution:** Check `.env` file:
- No spaces around `=`
- No `0x` prefix on private key
- Private key is 64 hex characters

#### ❌ "cannot connect to network"
**Solution:** Check RPC URL:
- Try alternative RPC: `https://polygon-amoy.g.alchemy.com/v2/demo`
- Check if Polygon Amoy is having issues: https://status.polygon.technology/

#### ❌ Deployment fails with "gas required exceeds allowance"
**Solution:** 
- Increase gas limit in `hardhat.config.js`:
  ```js
  amoy: {
    gas: 6000000,
    gasPrice: 35000000000, // 35 gwei
  }
  ```

---

## 📊 Production Checklist

Before deploying to mainnet:

- [ ] Test all agent features on testnet
- [ ] Execute at least 10 successful trades
- [ ] Verify contracts are working correctly
- [ ] Check gas efficiency (should be ~64K per trade)
- [ ] Monitor WebSocket updates in dashboard
- [ ] Test all 5 token pairs (ETH, USDC, USDT, WBTC, MATIC)
- [ ] Verify profit calculations are accurate
- [ ] Test agent authorization system
- [ ] Audit smart contracts (consider using Slither)
- [ ] Set up monitoring/alerting for mainnet
- [ ] Prepare emergency pause mechanism
- [ ] Document all contract addresses
- [ ] Create deployment video/demo
- [ ] Write deployment post-mortem

---

## 🌟 Deploy to Polygon Mainnet

When ready for mainnet deployment:

```powershell
# Deploy to Polygon mainnet
npx hardhat run scripts/deploy-testnet.js --network polygon
```

⚠️ **Mainnet Considerations:**
- Use hardware wallet or secure key management
- Start with small trade amounts
- Monitor closely for first 24 hours
- Have pause mechanism ready
- Real POL tokens cost real money
- Gas prices fluctuate (use gas price oracle)

---

## 🎓 Resources

### Polygon Amoy Testnet:
- Faucet: https://faucet.polygon.technology/
- Explorer: https://amoy.polygonscan.com
- RPC: https://rpc-amoy.polygon.technology
- Chain ID: 80002

### Polygon Mainnet:
- Explorer: https://polygonscan.com
- RPC: https://polygon-rpc.com
- Chain ID: 137

### Documentation:
- Polygon Docs: https://docs.polygon.technology/
- Hardhat: https://hardhat.org/docs
- Ethers.js: https://docs.ethers.org/v6/

### Support:
- Polygon Discord: https://discord.gg/polygon
- Buildathon Support: Check event Discord

---

## 🏆 Buildathon Submission Tips

1. **Demo Video:**
   - Show live agent executing trades
   - Dashboard with real-time updates
   - Explain the technology
   - Show contract verification on PolygonScan

2. **Documentation:**
   - README with clear setup instructions
   - Architecture diagrams
   - Smart contract documentation
   - API documentation

3. **Code Quality:**
   - Clean, commented code
   - Security best practices
   - Gas optimization
   - Error handling

4. **Innovation:**
   - Multi-token arbitrage (5 tokens)
   - Real-time WebSocket updates
   - AI-powered decision making
   - Cross-chain capabilities (AggLayer ready)

5. **Presentation:**
   - Clear problem statement
   - Technical architecture
   - Live demo on testnet
   - Future roadmap

---

## 📞 Need Help?

If you encounter issues:

1. Check this guide first
2. Review contract deployment logs
3. Check PolygonScan for transaction details
4. Verify `.env` configuration
5. Check Polygon status page
6. Ask in Polygon Discord

**Good luck with your buildathon submission! 🚀**
