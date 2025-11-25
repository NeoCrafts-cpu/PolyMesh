# PolyMesh AI Agent (Eliza Framework)

This directory contains the autonomous AI agent that runs on the PolyMesh network.

## Features

- 🤖 **Autonomous Trading**: Monitors markets and executes trades automatically
- 🌉 **Cross-Chain**: Uses AggLayer to trade across multiple chains
- 🧠 **AI-Powered**: Makes intelligent decisions based on market analysis
- 🔐 **ZKML Ready**: Support for provable AI decisions (Phase 4)
- 📊 **Reputation System**: Builds reputation through successful trades

## Architecture

```
Agent Decision Flow:
1. Monitor market prices across chains
2. Detect arbitrage opportunities
3. Analyze profitability
4. Generate ZK proof of decision (optional)
5. Execute trade via AgentExecutor contract
6. Update reputation based on result
```

## Prerequisites

- Node.js v20+
- PolyMesh CDK chain running
- AgentExecutor contract deployed
- Agent wallet funded with $MESH tokens

## Installation

```powershell
# Install dependencies
cd c:\Users\MSI\Desktop\PolyMesh\agents\eliza
npm install
```

## Configuration

1. Copy the example environment file:
```powershell
cp .env.example .env
```

2. Edit `.env` and configure:

```env
# Blockchain
PolyMesh_RPC_URL=http://127.0.0.1:8545
PolyMesh_WS_URL=ws://127.0.0.1:8546

# Agent Wallet
AGENT_PRIVATE_KEY=your_private_key_here

# Contract Addresses (from deployment)
AGENT_EXECUTOR_ADDRESS=0x...
BRIDGE_EXTENSION_ADDRESS=0x...

# Market Monitoring
PRICE_CHECK_INTERVAL=30000
MIN_PROFIT_PERCENT=0.5
```

## Agent Authorization

Before running the agent, it must be authorized:

```javascript
// Using Hardhat console
const agentExecutor = await ethers.getContractAt(
  "AgentExecutor",
  "AGENT_EXECUTOR_ADDRESS"
);

await agentExecutor.authorizeAgent("AGENT_ADDRESS");
```

Or via deployment script (deployer is auto-authorized).

## Running the Agent

### Development Mode (Dry Run)

```powershell
# Dry run - analyzes but doesn't execute trades
npm run dev
```

### Production Mode

```powershell
# Execute real trades
npm start
```

## Agent Behavior

### Market Monitoring

The agent continuously monitors:
- Token prices across multiple chains
- Gas prices
- Liquidity depth
- Trading volumes

### Decision Making

When an opportunity is detected:
1. Calculate potential profit
2. Estimate gas costs
3. Check if profit > minimum threshold
4. Generate execution plan
5. (Optional) Create ZK proof of decision

### Trade Execution

Trades are executed via `AgentExecutor.agentExecuteSimple()`:

```typescript
await agentExecutor.agentExecuteSimple(
  destinationNetwork,  // e.g., 137 for Polygon PoS
  targetContract,      // DEX router address
  amount,             // Amount of $MESH to bridge
  callData           // Encoded swap call
);
```

### Cross-Chain Flow

```
PolyMesh Agent
    ↓
AgentExecutor.agentExecuteSimple()
    ↓
Bridge.bridgeAndCall()
    ↓
AggLayer (Pessimistic Proof)
    ↓
Destination Chain
    ↓
BridgeExtension.onBridgeCall()
    ↓
Target Contract (DEX)
```

## Agent Personality

The agent can be customized with different personalities:

### High-Frequency Arbitrageur
- Fast execution
- Small profit margins
- High volume

### Conservative Portfolio Manager
- Slow execution
- Large profit margins
- Risk-averse

### Yield Optimizer
- Monitors yield farming opportunities
- Rebalances across chains
- Compound rewards

## Monitoring

### Agent Statistics

Check agent performance:
```typescript
const stats = await agentExecutor.getAgentStats(agentAddress);
console.log({
  reputation: stats.reputation,
  executions: stats.executions,
  failures: stats.failures,
});
```

### Logs

Logs are written to `logs/agent.log`:
```powershell
# Watch logs
Get-Content logs\agent.log -Wait -Tail 50
```

## Testing

```powershell
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Debugging

### Check Authorization

```powershell
# Using Hardhat console
npx hardhat console --network PolyMesh

const executor = await ethers.getContractAt("AgentExecutor", "ADDRESS");
console.log(await executor.authorizedAgents("AGENT_ADDRESS"));
```

### Check Balance

```powershell
# PowerShell
$response = Invoke-WebRequest -Uri "http://127.0.0.1:8545" -Method POST -ContentType "application/json" -Body '{"jsonrpc":"2.0","method":"eth_getBalance","params":["AGENT_ADDRESS","latest"],"id":1}'
$response.Content
```

### Dry Run Mode

Enable dry run to test without executing:
```env
DRY_RUN=true
```

## Integration with Eliza Framework

Full Eliza integration (Phase 3+):

```typescript
import { Agent, Character } from '@ai16z/eliza';

const character: Character = {
  name: "NeuroTrader",
  bio: "High-frequency arbitrage agent on PolyMesh",
  traits: ["analytical", "fast", "risk-aware"],
  // ... more configuration
};

const agent = new Agent(character);
```

## Security Considerations

1. **Private Key**: NEVER commit `.env` file
2. **Gas Limits**: Set reasonable limits to prevent runaway costs
3. **Reputation**: Agent reputation prevents abuse
4. **Authorization**: Only authorized agents can execute
5. **Circuit Breakers**: Owner can pause contract in emergencies

## Roadmap

- [x] Basic arbitrage detection
- [x] Cross-chain execution via AggLayer
- [ ] ZKML integration for provable decisions
- [ ] Privado ID for KYA
- [ ] Advanced trading strategies
- [ ] Multi-agent coordination
- [ ] MEV protection

## Troubleshooting

### "UnauthorizedAgent" Error
- Agent is not authorized
- Solution: Call `agentExecutor.authorizeAgent()`

### "InsufficientReputation" Error
- Agent reputation too low
- Solution: Increase `minReputation` or improve agent performance

### "Execution Failed" Error
- Check gas prices
- Verify target contract is whitelisted
- Check bridge has sufficient liquidity

## Resources

- [Eliza Documentation](https://github.com/ai16z/eliza)
- [AggLayer Spec](https://docs.polygon.technology/agglayer/)
- [PolyMesh Docs](../../../docs/)


