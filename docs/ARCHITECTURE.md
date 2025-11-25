# PolyMesh Architecture

## System Overview

PolyMesh is a multi-layered system that combines blockchain infrastructure, AI agents, and cross-chain interoperability.

```
┌─────────────────────────────────────────────────────────────┐
│                     PolyMesh Ecosystem                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐│
│  │   AI Agents  │────▶│ AgentExecutor│────▶│   AggLayer   ││
│  │   (Eliza)    │     │  Contract    │     │   Bridge     ││
│  └──────────────┘     └──────────────┘     └──────────────┘│
│         │                     │                     │        │
│         ▼                     ▼                     ▼        │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐│
│  │  ZKML Proof  │     │ PolyMesh    │     │ Destination  ││
│  │  Verifier    │     │  Validium    │     │   Chains     ││
│  └──────────────┘     └──────────────┘     └──────────────┘│
│         │                     │                     │        │
│         └─────────────────────┴─────────────────────┘        │
│                              │                               │
│                      ┌──────────────┐                        │
│                      │  Dashboard   │                        │
│                      │     (UI)     │                        │
│                      └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## Layer Breakdown

### 1. Infrastructure Layer (Polygon CDK)

**PolyMesh Validium Chain**

- **Type**: CDK Validium (not Rollup)
- **DA Mode**: Data Availability Committee
- **Execution Client**: cdk-erigon
- **Gas Token**: $MESH (custom ERC-20)
- **Chain ID**: 10101

**Why Validium?**
- **Lower costs**: DA is offloaded to DAC, not Ethereum L1
- **Higher throughput**: Critical for high-frequency agent transactions
- **Fast finality**: Agents need quick confirmation
- **Scalability**: Can handle millions of agent operations

**Why cdk-erigon?**
- **150x faster sync**: Agents can join network quickly
- **Lower disk usage**: More cost-effective for agent operators
- **Better performance**: Optimized for high-throughput

### 2. Smart Contract Layer

**AgentExecutor.sol**
```
Purpose: Main contract for agent operations
Functions:
  - agentExecute(): Execute cross-chain operations
  - authorizeAgent(): Whitelist agents
  - updateReputation(): Track agent performance
```

**BridgeExtension.sol**
```
Purpose: Handle incoming AggLayer messages
Functions:
  - onBridgeCall(): Receive cross-chain calls
  - authorizeNetwork(): Whitelist origin chains
  - executeCall(): Execute on target contracts
```

**ZKML Verifier (Phase 4)**
```
Purpose: Verify AI decision proofs
Functions:
  - verifyProof(): Validate ZK proof
  - registerModel(): Register AI models
```

**KYA Registry (Phase 4)**
```
Purpose: Agent identity management
Functions:
  - issueCredential(): Issue agent VCs
  - verifyCredential(): Check agent KYA
```

### 3. AggLayer Integration

**Cross-Chain Flow**

```
Agent (PolyMesh)
    ↓
AgentExecutor.agentExecute()
    ↓
PolygonZkEVMBridgeV2.bridgeAndCall()
    ↓
[Locks tokens in Local Exit Tree]
    ↓
AggLayer Aggregator
    ↓
[Generates Pessimistic Proof]
    ↓
Destination Chain Bridge
    ↓
BridgeExtension.onBridgeCall()
    ↓
Target Contract (e.g., DEX)
```

**Security Model: Pessimistic Proofs**

The AggLayer uses "pessimistic proofs" to ensure:
1. **Safety**: Funds can't be stolen
2. **Liveness**: Transactions will eventually execute
3. **Atomicity**: Either all steps succeed or all revert

### 4. AI Agent Layer (Eliza Framework)

**Agent Architecture**

```typescript
class PolyMeshAgent {
  // Decision Loop
  1. monitorMarkets()      // Fetch prices
  2. analyzeOpportunity()  // AI decision
  3. generateZKProof()     // Prove decision (optional)
  4. executeTransaction()  // Via AgentExecutor
  5. updateReputation()    // Track success
}
```

**Decision Making Process**

```
Market Data → AI Model → Decision → ZK Proof → Execution
                ↓
         [Reputation System]
```

### 5. Visualization Layer (React Dashboard)

**Components**

1. **AgentFlow**: Real-time execution visualization
2. **StatsPanel**: Agent performance metrics
3. **TransactionList**: Live transaction feed
4. **NetworkMap**: Cross-chain topology

**Real-time Updates**

```
Blockchain Events → WebSocket → Dashboard → User
```

## Data Flow Example: Cross-Chain Arbitrage

### Step 1: Opportunity Detection

```
Agent detects: 
  ETH on PolyMesh: $2000
  ETH on Polygon PoS: $2050
  Profit: $50 (2.5%)
```

### Step 2: Decision & Proof

```typescript
// Agent generates decision
const decision = await ai.analyze(marketData);

// Generate ZK proof (optional)
const proof = await zkml.prove(decision);
```

### Step 3: Execute Trade

```typescript
// Call AgentExecutor
await agentExecutor.agentExecute(
  137,              // Polygon PoS
  uniswapRouter,    // Target DEX
  ethers.parseEther("1"),
  swapCallData,
  proof
);
```

### Step 4: Bridge & Execute

```
1. Tokens locked in PolyMesh bridge
2. AggLayer generates pessimistic proof
3. Message sent to Polygon PoS
4. BridgeExtension receives call
5. Executes swap on Uniswap
6. Returns result to AggLayer
```

### Step 5: Settlement

```
1. Trade settles on Polygon PoS
2. Profit bridged back to PolyMesh
3. Agent reputation updated
4. Dashboard shows completed trade
```

## Security Considerations

### 1. Agent Authorization

```solidity
// Only authorized agents can execute
require(authorizedAgents[msg.sender], "Unauthorized");
```

### 2. Reputation System

```
Good trades: reputation +10
Failed trades: reputation -20
Minimum reputation required: 100
```

### 3. ZKML Verification

```
Purpose: Prove decisions came from verified AI model
Prevents: Malicious or manipulated agent behavior
```

### 4. KYA (Know Your Agent)

```
Purpose: Agent identity without revealing owner
Uses: Privado ID (Verifiable Credentials)
Enables: Compliance without compromising privacy
```

### 5. Circuit Breakers

```solidity
// Owner can pause in emergency
function pause() external onlyOwner {
    _pause();
}
```

## Performance Optimizations

### 1. Validium Mode
- Offload DA to DAC
- Keep L1 costs minimal
- Enable high-frequency trading

### 2. cdk-erigon
- Fast sync for new agents
- Lower storage requirements
- Better performance

### 3. Gas Token ($MESH)
- Agents pay in native token
- No need for ETH
- Simplified UX

### 4. Batch Operations
- Execute multiple trades in one tx
- Amortize gas costs
- Increase throughput

## Scalability

**Current Capacity**
- Blocks: 2 seconds
- TPS: ~1000 transactions/second
- Agents: Unlimited (reputation-gated)

**Scaling Strategy**
1. Multiple agent tiers (by reputation)
2. Parallel execution channels
3. Cross-chain load balancing
4. L3 app-chains for specific use cases

## Future Enhancements

### Phase 4+
- [ ] Full ZKML integration
- [ ] Privado ID for all agents
- [ ] Multi-agent coordination
- [ ] MEV protection
- [ ] Advanced trading strategies

### Long-term Vision
- [ ] Agent-to-agent marketplace
- [ ] Reputation NFTs
- [ ] Agent DAOs
- [ ] Cross-ecosystem bridging
- [ ] Intent-based routing

## Technical Stack Summary

| Component | Technology | Purpose |
|-----------|-----------|---------|
| L2 Chain | Polygon CDK Validium | Base layer |
| Execution | cdk-erigon | Fast sync & performance |
| Bridge | AggLayer | Cross-chain interop |
| Contracts | Solidity 0.8.20 | Smart contract logic |
| AI Framework | Eliza (a16z) | Agent development |
| ZKML | HyperOracle | Provable AI |
| Identity | Privado ID | KYA system |
| Frontend | React + Vite | Dashboard |
| Deployment | Kurtosis | Orchestration |
| Monitoring | Grafana + Prometheus | Observability |

---

For more details on specific components, see:
- [Chain Configuration](../chain/README.md)
- [Smart Contracts](../contracts/README.md)
- [AI Agents](../agents/eliza/README.md)
- [Dashboard](../frontend/PolyMesh-ui/README.md)

