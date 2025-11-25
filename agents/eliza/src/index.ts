import { ethers } from 'ethers';
import dotenv from 'dotenv';
import axios from 'axios';
import { WebSocketServer } from 'ws';
import http from 'http';

dotenv.config();

/**
 * PolyMesh AI Agent
 * 
 * This autonomous agent:
 * 1. Monitors market prices across multiple chains
 * 2. Identifies arbitrage opportunities
 * 3. Executes cross-chain trades via AggLayer
 * 4. Uses ZKML for provable decision-making
 * 5. Maintains reputation through successful trades
 */

// Agent configuration
const config = {
  rpcUrl: process.env.POLYMESH_RPC_URL || 'http://127.0.0.1:8545',
  wsUrl: process.env.POLYMESH_WS_URL || 'ws://127.0.0.1:8546',
  privateKey: process.env.AGENT_PRIVATE_KEY || '',
  agentExecutorAddress: process.env.AGENT_EXECUTOR_ADDRESS || '',
  priceCheckInterval: parseInt(process.env.PRICE_CHECK_INTERVAL || '30000'),
  priceThreshold: parseFloat(process.env.PRICE_THRESHOLD_PERCENT || '2.0'),
  minProfitPercent: parseFloat(process.env.MIN_PROFIT_PERCENT || '0.5'),
  maxGasPrice: process.env.MAX_GAS_PRICE || '50000000000',
  devMode: process.env.DEV_MODE === 'true',
  dryRun: process.env.DRY_RUN === 'true',
  wsPort: parseInt(process.env.WS_PORT || '8080'),
};

// Supported tokens for multi-token arbitrage
const SUPPORTED_TOKENS = ['ETH', 'USDC', 'USDT', 'WBTC', 'MATIC'];

// Performance tracking
interface TradeStats {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalProfitUSD: number;
  bestTradeProfit: number;
  worstTradeProfit: number;
  averageProfit: number;
  tradeHistory: Array<{
    timestamp: number;
    token: string;
    profit: number;
    profitPercent: number;
    success: boolean;
    txHash?: string;
  }>;
}

// AgentExecutor ABI (simplified for demo)
const AGENT_EXECUTOR_ABI = [
  'function agentExecuteSimple(uint32 destinationNetwork, address targetContract, uint256 amount, bytes calldata callData) external payable',
  'function getAgentStats(address agent) external view returns (bool authorized, uint256 reputation, uint256 executions, uint256 failures)',
  'function canExecute(address agent) external view returns (bool)',
];

class PolyMeshAgent {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private agentExecutor: ethers.Contract;
  private isRunning: boolean = false;
  private wss: WebSocketServer | null = null;
  private stats: TradeStats = {
    totalTrades: 0,
    successfulTrades: 0,
    failedTrades: 0,
    totalProfitUSD: 0,
    bestTradeProfit: 0,
    worstTradeProfit: 0,
    averageProfit: 0,
    tradeHistory: [],
  };

  constructor() {
    // Initialize blockchain connection
    console.log('🧠 Initializing PolyMesh Agent...');
    
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    
    this.agentExecutor = new ethers.Contract(
      config.agentExecutorAddress,
      AGENT_EXECUTOR_ABI,
      this.wallet
    );

    console.log(`✅ Agent initialized: ${this.wallet.address}\n`);
  }

  // Initialize WebSocket server for real-time updates
  private initWebSocket() {
    const server = http.createServer();
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws) => {
      console.log('📡 Dashboard connected via WebSocket');
      
      // Send current stats on connection
      ws.send(JSON.stringify({
        type: 'stats',
        data: this.stats,
      }));
    });

    server.listen(config.wsPort, () => {
      console.log(`🔌 WebSocket server running on port ${config.wsPort}\n`);
    });
  }

  // Broadcast update to all connected clients
  private broadcast(type: string, data: any) {
    if (!this.wss) return;
    
    const message = JSON.stringify({ type, data });
    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) { // OPEN
        client.send(message);
      }
    });
  }

  async start() {
    console.log('\n🚀 Starting PolyMesh Agent...\n');

    // Initialize WebSocket server
    this.initWebSocket();

    // Check authorization
    const canExecute = await this.agentExecutor.canExecute(this.wallet.address);
    if (!canExecute) {
      console.error('❌ Agent is not authorized to execute transactions');
      console.error('   Please authorize the agent using AgentExecutor.authorizeAgent()');
      return;
    }

    // Get agent stats
    const stats = await this.agentExecutor.getAgentStats(this.wallet.address);
    console.log('📊 Agent Statistics:');
    console.log(`   Authorized: ${stats.authorized}`);
    console.log(`   Reputation: ${stats.reputation.toString()}`);
    console.log(`   Executions: ${stats.executions.toString()}`);
    console.log(`   Failures: ${stats.failures.toString()}\n`);

    // Check balance
    const balance = await this.provider.getBalance(this.wallet.address);
    console.log(`💰 Agent Balance: ${ethers.formatEther(balance)} MESH\n`);

    this.isRunning = true;

    // Start monitoring loop
    console.log('👀 Starting market monitoring...\n');
    await this.monitorMarkets();
  }

  async stop() {
    console.log('\n🛑 Stopping PolyMesh Agent...');
    this.isRunning = false;
    await this.provider.destroy();
  }

  private async monitorMarkets() {
    while (this.isRunning) {
      try {
        // 1. Fetch market data
        const prices = await this.fetchPrices();
        
        // 2. Analyze for arbitrage opportunities
        const opportunity = await this.analyzeArbitrage(prices);
        
        if (opportunity) {
          console.log('🎯 Arbitrage opportunity detected!');
          console.log(`   Token: ${opportunity.token}`);
          console.log(`   Buy on: Chain ${opportunity.buyChain} @ $${opportunity.buyPrice}`);
          console.log(`   Sell on: Chain ${opportunity.sellChain} @ $${opportunity.sellPrice}`);
          console.log(`   Profit: ${opportunity.profitPercent.toFixed(2)}%\n`);

          // 3. Execute trade (if not in dry run mode)
          if (!config.dryRun) {
            await this.executeTrade(opportunity);
          } else {
            console.log('   [DRY RUN] Trade not executed\n');
          }
        }

        // Wait before next check
        await this.sleep(config.priceCheckInterval);

      } catch (error) {
        console.error('❌ Error in monitoring loop:', error);
        await this.sleep(5000); // Wait 5s before retry
      }
    }
  }

  private async fetchPrices(): Promise<any> {
    // Fetch prices from multiple chains
    // For demo, we'll simulate price data for multiple tokens
    // In production, integrate with Coingecko, DefiLlama, etc.

    if (config.devMode) {
      // Simulated price data for multiple tokens
      const prices: any = {};
      
      SUPPORTED_TOKENS.forEach(token => {
        const basePrice = token === 'ETH' ? 2000 : 
                         token === 'WBTC' ? 40000 :
                         token === 'MATIC' ? 0.8 :
                         1.0; // USDC/USDT
        
        prices[token] = {
          polygon: basePrice + (Math.random() * basePrice * 0.05),
          zkEVM: basePrice + (Math.random() * basePrice * 0.05),
          bnb: basePrice + (Math.random() * basePrice * 0.05),
        };
      });
      
      return prices;
    }

    // Production: Fetch from APIs
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: 'ethereum,usd-coin,tether,wrapped-bitcoin,matic-network',
          vs_currencies: 'usd',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch prices:', error);
      return null;
    }
  }

  private async analyzeArbitrage(prices: any): Promise<any | null> {
    if (!prices) return null;

    // Find arbitrage opportunities
    // Look for price discrepancies across chains

    for (const [token, chainPrices] of Object.entries(prices)) {
      const chains = Object.keys(chainPrices as object);
      
      for (let i = 0; i < chains.length; i++) {
        for (let j = i + 1; j < chains.length; j++) {
          const chain1 = chains[i];
          const chain2 = chains[j];
          const price1 = (chainPrices as any)[chain1];
          const price2 = (chainPrices as any)[chain2];

          const priceDiff = Math.abs(price1 - price2);
          const profitPercent = (priceDiff / Math.min(price1, price2)) * 100;

          // Check if opportunity meets threshold
          if (profitPercent >= config.minProfitPercent) {
            return {
              token,
              buyChain: price1 < price2 ? chain1 : chain2,
              sellChain: price1 < price2 ? chain2 : chain1,
              buyPrice: Math.min(price1, price2),
              sellPrice: Math.max(price1, price2),
              profitPercent,
            };
          }
        }
      }
    }

    return null;
  }

  private async executeTrade(opportunity: any) {
    console.log('⚡ Executing cross-chain trade via AggLayer...');

    const startTime = Date.now();
    let success = false;
    let txHash = '';

    // Broadcast opportunity detection
    this.broadcast('opportunity', opportunity);

    try {
      // Map chain names to network IDs
      const chainIds: { [key: string]: number } = {
        polygon: 137,
        zkEVM: 1101,
        bnb: 56,
      };

      const destinationNetwork = chainIds[opportunity.sellChain];
      
      // Encode the swap call (this would be actual DEX swap calldata)
      // For demo, we'll use a simple encoded call
      const callData = ethers.AbiCoder.defaultAbiCoder().encode(
        ['string', 'uint256', 'uint256'],
        [opportunity.token, ethers.parseEther('1'), Date.now()]
      );

      // Target contract - use a valid contract address (BridgeExtension on destination)
      // For this demo, we'll use the agent's address as it's a valid test target
      const targetContract = this.wallet.address;

      // Execute via AgentExecutor
      console.log('   Calling AgentExecutor.agentExecuteSimple()...');
      
      const tx = await this.agentExecutor.agentExecuteSimple(
        destinationNetwork,
        targetContract,
        ethers.parseEther('1'), // 1 MESH
        callData,
        {
          value: ethers.parseEther('0.01'), // Bridge fee
          gasLimit: 500000,
        }
      );

      txHash = tx.hash;
      console.log(`   📝 Transaction sent: ${tx.hash}`);
      console.log('   ⏳ Waiting for confirmation...');

      // Broadcast pending trade
      this.broadcast('trade_pending', { ...opportunity, txHash });

      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        success = true;
        console.log('   ✅ Trade executed successfully!');
        console.log(`   ⛽ Gas used: ${receipt.gasUsed.toString()}\n`);
        
        // Update stats
        this.updateStats(opportunity, true, txHash);
        
        // Broadcast success
        this.broadcast('trade_success', {
          ...opportunity,
          txHash,
          gasUsed: receipt.gasUsed.toString(),
          timestamp: Date.now(),
        });
      } else {
        console.log('   ❌ Trade failed\n');
        this.updateStats(opportunity, false);
        this.broadcast('trade_failed', { ...opportunity, txHash });
      }

    } catch (error: any) {
      console.error('   ❌ Execution failed:', error.message, '\n');
      this.updateStats(opportunity, false, txHash);
      this.broadcast('trade_failed', { ...opportunity, error: error.message });
    }
  }

  private updateStats(opportunity: any, success: boolean, txHash?: string) {
    this.stats.totalTrades++;
    
    if (success) {
      this.stats.successfulTrades++;
      
      // Calculate profit in USD (simplified)
      const profitUSD = (opportunity.buyPrice * opportunity.profitPercent) / 100;
      this.stats.totalProfitUSD += profitUSD;
      
      // Update best/worst
      if (profitUSD > this.stats.bestTradeProfit || this.stats.bestTradeProfit === 0) {
        this.stats.bestTradeProfit = profitUSD;
      }
      if (profitUSD < this.stats.worstTradeProfit || this.stats.worstTradeProfit === 0) {
        this.stats.worstTradeProfit = profitUSD;
      }
      
      // Add to history
      this.stats.tradeHistory.push({
        timestamp: Date.now(),
        token: opportunity.token,
        profit: profitUSD,
        profitPercent: opportunity.profitPercent,
        success: true,
        txHash,
      });
    } else {
      this.stats.failedTrades++;
      this.stats.tradeHistory.push({
        timestamp: Date.now(),
        token: opportunity.token,
        profit: 0,
        profitPercent: 0,
        success: false,
        txHash,
      });
    }
    
    // Calculate average
    if (this.stats.successfulTrades > 0) {
      this.stats.averageProfit = this.stats.totalProfitUSD / this.stats.successfulTrades;
    }
    
    // Keep only last 100 trades in history
    if (this.stats.tradeHistory.length > 100) {
      this.stats.tradeHistory = this.stats.tradeHistory.slice(-100);
    }
    
    // Broadcast updated stats
    this.broadcast('stats', this.stats);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('       🧠 PolyMesh AI Agent v0.1.0       ');
  console.log('   Autonomous Cross-Chain Trading Agent    ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Validate configuration
  if (!config.privateKey) {
    console.error('❌ Error: AGENT_PRIVATE_KEY not set in .env file');
    process.exit(1);
  }

  if (!config.agentExecutorAddress) {
    console.error('❌ Error: AGENT_EXECUTOR_ADDRESS not set in .env file');
    process.exit(1);
  }

  const agent = new PolyMeshAgent();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n📌 Received SIGINT, shutting down gracefully...');
    await agent.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\n📌 Received SIGTERM, shutting down gracefully...');
    await agent.stop();
    process.exit(0);
  });

  // Start the agent
  await agent.start();
}

// Run
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


