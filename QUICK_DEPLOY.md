# 🎯 Quick Deployment Reference

## TL;DR - Deploy in 5 Minutes

### 1. Get Private Key (30 seconds)
```
MetaMask → Account Details → Show Private Key → Copy
```

### 2. Add to .env (30 seconds)
```bash
cd contracts
notepad .env
# Add: PRIVATE_KEY=your_64_character_key_no_0x
```

### 3. Get Testnet POL (2 minutes)
```
Visit: https://faucet.polygon.technology/
Select: Polygon Amoy
Request: 0.5 POL
```

### 4. Deploy (1 minute)
```powershell
cd contracts
npx hardhat run scripts/deploy-testnet.js --network amoy
```

### 5. Update Agent Config (30 seconds)
```bash
cd ../agents/eliza
notepad .env
# Copy contract addresses from deployment-amoy.json
```

---

## 📍 Important URLs

| Resource | URL |
|----------|-----|
| **Amoy Faucet** | https://faucet.polygon.technology/ |
| **Amoy Explorer** | https://amoy.polygonscan.com |
| **Amoy RPC** | https://rpc-amoy.polygon.technology |
| **Chain ID** | 80002 |
| **Polygon Status** | https://status.polygon.technology/ |

---

## 🔑 Environment Variables Cheat Sheet

### contracts/.env
```env
PRIVATE_KEY=64_hex_characters_no_0x_prefix
POLYGONSCAN_API_KEY=get_from_polygonscan_com
POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology
```

### agents/eliza/.env
```env
POLYMESH_RPC_URL=https://rpc-amoy.polygon.technology
CHAIN_ID=80002
AGENT_EXECUTOR_ADDRESS=0x...from_deployment
BRIDGE_EXTENSION_ADDRESS=0x...from_deployment
AGENT_PRIVATE_KEY=same_as_deployer_or_different
WS_PORT=8080
```

---

## 📋 Pre-Deployment Checklist

- [ ] Private key added to `contracts/.env`
- [ ] At least 0.1 POL in deployer wallet
- [ ] MetaMask connected to Amoy network
- [ ] Node.js v18+ installed
- [ ] All dependencies installed (`npm install` in contracts/)

---

## 🚀 Deployment Commands

### Deploy to Amoy Testnet
```powershell
cd c:\Users\MSI\Desktop\NeuroMesh\contracts
npx hardhat run scripts/deploy-testnet.js --network amoy
```

### Verify Contracts
```powershell
# Get contract addresses from deployment-amoy.json
npx hardhat verify --network amoy YOUR_AGENT_EXECUTOR_ADDRESS
npx hardhat verify --network amoy YOUR_BRIDGE_EXTENSION_ADDRESS YOUR_BRIDGE_ADDRESS
```

### Start Agent
```powershell
cd ..\agents\eliza
node --loader ts-node/esm src/index.ts
```

### Start Dashboard
```powershell
cd ..\..\frontend\neuromesh-ui
npm run dev
```

---

## ⚡ Quick Troubleshooting

### "insufficient funds"
→ Get more POL from faucet

### "invalid private key"
→ Check `.env`: 64 hex chars, no `0x`, no spaces

### "cannot connect to network"
→ Try alternative RPC: `https://polygon-amoy.g.alchemy.com/v2/demo`

### "nonce has already been used"
→ Reset MetaMask: Settings → Advanced → Clear Activity Tab

### Deployment succeeds but agent can't connect
→ Update `agents/eliza/.env` with correct contract addresses

---

## 📊 Expected Gas Costs (Amoy Testnet)

| Operation | Gas Used | Cost (POL) |
|-----------|----------|------------|
| Deploy MockBridge | ~500K | ~0.02 |
| Deploy AgentExecutor | ~2.5M | ~0.09 |
| Deploy BridgeExtension | ~1.5M | ~0.05 |
| Setup/Authorization | ~150K | ~0.01 |
| **Total Deployment** | **~4.65M** | **~0.17 POL** |
| First Trade | ~80K | ~0.003 |
| Subsequent Trades | ~64K | ~0.002 |

*Assumes gas price of 35 gwei*

---

## 🎯 Success Indicators

After deployment, you should see:

✅ 3 contract addresses in `deployment-amoy.json`  
✅ Green checkmarks on PolygonScan (after verification)  
✅ Agent starts with "Connected to Polygon Amoy (Chain ID: 80002)"  
✅ Dashboard shows "Connected" status  
✅ First trade executed within 5 minutes  

---

## 📞 Get Help

1. **Check deployment logs** - Look for specific error messages
2. **View on PolygonScan** - Check transaction status
3. **Read full guide** - See `TESTNET_DEPLOYMENT.md`
4. **Polygon Discord** - https://discord.gg/polygon
5. **Check status page** - https://status.polygon.technology/

---

## 🏆 Post-Deployment Testing

### Test Checklist:
- [ ] Agent connects to contracts
- [ ] First trade executes successfully
- [ ] Dashboard receives WebSocket updates
- [ ] All 5 tokens are monitored
- [ ] Profit calculations are accurate
- [ ] Gas costs are reasonable (~64K per trade)
- [ ] Agent handles errors gracefully
- [ ] Trade history updates correctly

### Minimum Tests Before Buildathon Submission:
- Execute **10+ successful trades**
- Test all **5 token pairs**
- Verify **profit > gas costs**
- Record **demo video** showing live trades
- Document all **contract addresses**

---

## 🌟 Mainnet Differences

When deploying to Polygon mainnet:

⚠️ **Use real POL tokens** (costs real money)  
⚠️ **Use hardware wallet** for security  
⚠️ **Start with small trades** ($10-50)  
⚠️ **Monitor 24/7** initially  
⚠️ **Have pause mechanism** ready  
⚠️ **Get proper audit** before large amounts  

Mainnet deployment command:
```powershell
npx hardhat run scripts/deploy-testnet.js --network polygon
```

---

**Need the detailed guide?** See `TESTNET_DEPLOYMENT.md`

**Ready to deploy?** Run:
```powershell
.\deploy-amoy.ps1
```
