import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Zap, Network, TrendingUp, Activity, Target, Moon, Sun, Play, Pause, Settings, RefreshCcw, DollarSign } from 'lucide-react';
import AgentFlow from './components/AgentFlow';
import StatsPanel from './components/StatsPanel';
import TransactionList from './components/TransactionList';

/**
 * PolyMesh Dashboard v0.2.0
 * 
 * Visualizes the AI agent operations with real-time updates:
 * - Live WebSocket connection to agent with auto-reconnect
 * - Real-time trade notifications
 * - Performance analytics
 * - Multi-token arbitrage monitoring
 * - Dark/Light theme toggle
 * - Agent control panel
 */

interface TradeStats {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalProfitUSD: number;
  bestTradeProfit: number;
  worstTradeProfit: number;
  averageProfit: number;
  dailyProfitLoss: number;
  tradeHistory: Array<{
    timestamp: number;
    token: string;
    type?: string;
    profit: number;
    profitPercent: number;
    gasUsed?: number;
    fees?: number;
    success: boolean;
    txHash?: string;
  }>;
}

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [agentStatus, setAgentStatus] = useState<'idle' | 'thinking' | 'executing'>('idle');
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [stats, setStats] = useState<TradeStats>({
    totalTrades: 0,
    successfulTrades: 0,
    failedTrades: 0,
    totalProfitUSD: 0,
    bestTradeProfit: 0,
    worstTradeProfit: 0,
    averageProfit: 0,
    dailyProfitLoss: 0,
    tradeHistory: [],
  });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 10;

  // WebSocket connection with exponential backoff reconnect
  const connectWebSocket = useCallback(() => {
    const wsUrl = (import.meta as any).env.VITE_WS_URL || 'ws://localhost:8080';
    console.log(`Connecting to WebSocket (attempt ${reconnectAttempt + 1})...`, wsUrl);
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);
      setReconnectAttempt(0);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('📨 Received:', message.type);

      switch (message.type) {
        case 'stats':
          setStats(message.data);
          break;
        
        case 'opportunity':
          setAgentStatus('thinking');
          console.log('Opportunity detected:', message.data);
          break;
        
        case 'trade_pending':
          setAgentStatus('executing');
          console.log('Trade pending:', message.data);
          break;
        
        case 'trade_success':
          setAgentStatus('idle');
          console.log('Trade success:', message.data);
          break;
        
        case 'trade_failed':
          setAgentStatus('idle');
          console.log('Trade failed:', message.data);
          break;
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      setIsConnected(false);
      
      // Exponential backoff reconnect
      if (reconnectAttempt < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000);
        console.log(`Reconnecting in ${delay}ms...`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempt(prev => prev + 1);
          connectWebSocket();
        }, delay);
      }
    };

    wsRef.current = ws;
  }, [reconnectAttempt]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Manual reconnect
  const handleReconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setReconnectAttempt(0);
    connectWebSocket();
  };

  // Toggle theme
  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme);
    document.documentElement.classList.toggle('light-theme');
  };

  // Toggle pause (would send command to agent in production)
  const togglePause = () => {
    setIsPaused(!isPaused);
    // In production: wsRef.current?.send(JSON.stringify({ type: 'toggle_pause' }));
  };

  const winRate = stats.totalTrades > 0 
    ? ((stats.successfulTrades / stats.totalTrades) * 100).toFixed(1)
    : '0.0';

  return (
    <div className={`min-h-screen ${isDarkTheme ? 'bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950' : 'bg-gradient-to-br from-slate-100 via-purple-100 to-slate-100'}`}>
      {/* Header */}
      <header className={`border-b ${isDarkTheme ? 'border-purple-500/20 bg-black/30' : 'border-purple-300/40 bg-white/60'} backdrop-blur-xl`}>
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="w-8 h-8 text-purple-400" />
              <div>
                <h1 className="text-2xl font-bold glow">PolyMesh</h1>
                <p className={`text-sm ${isDarkTheme ? 'text-purple-300' : 'text-purple-600'}`}>AI Agent Infrastructure v0.2.0</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Agent Control Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePause}
                  className={`p-2 rounded-lg transition-colors ${isPaused ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'} hover:opacity-80`}
                  title={isPaused ? 'Resume Agent' : 'Pause Agent'}
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleReconnect}
                  className="p-2 rounded-lg bg-purple-500/20 text-purple-400 hover:opacity-80 transition-colors"
                  title="Reconnect"
                >
                  <RefreshCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-lg bg-purple-500/20 text-purple-400 hover:opacity-80 transition-colors"
                  title="Toggle Theme"
                >
                  {isDarkTheme ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 rounded-lg bg-purple-500/20 text-purple-400 hover:opacity-80 transition-colors"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>

              {/* Connection Status */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${isDarkTheme ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-purple-100 border border-purple-300'}`}>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="text-sm">
                  {isConnected ? 'Agent Connected' : reconnectAttempt > 0 ? `Reconnecting (${reconnectAttempt}/${maxReconnectAttempts})` : 'Disconnected'}
                </span>
              </div>

              {/* Agent Status */}
              <div className={`px-4 py-2 rounded-lg ${isDarkTheme ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-purple-100 border border-purple-300'}`}>
                <div className="flex items-center gap-2">
                  <Activity className={`w-4 h-4 ${agentStatus === 'executing' ? 'text-yellow-400 animate-pulse' : isPaused ? 'text-gray-400' : 'text-purple-400'}`} />
                  <span className="text-sm capitalize">{isPaused ? 'paused' : agentStatus}</span>
                </div>
              </div>

              {/* Chain Info */}
              <div className={`px-4 py-2 rounded-lg ${isDarkTheme ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-purple-100 border border-purple-300'}`}>
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4 text-purple-400" />
                  <span className="text-sm">Polygon Amoy</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Hero Section */}
        <AnimatePresence>
          {isConnected && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8"
            >
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold mb-4 glow">
                  Multi-Token Arbitrage Agent
                </h2>
                <p className="text-lg text-purple-300 max-w-2xl mx-auto">
                  Autonomous AI agent executing profitable trades across ETH, USDC, USDT, WBTC & MATIC
                  using Polygon AggLayer with real-time performance tracking.
                </p>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
                <MetricCard
                  icon={<Target className="w-6 h-6" />}
                  label="Total Trades"
                  value={stats.totalTrades.toString()}
                  subtitle={`${winRate}% success rate`}
                  color="purple"
                  isDark={isDarkTheme}
                />
                <MetricCard
                  icon={<TrendingUp className="w-6 h-6" />}
                  label="Total Profit"
                  value={`$${stats.totalProfitUSD.toFixed(2)}`}
                  subtitle={`Avg: $${stats.averageProfit.toFixed(2)}`}
                  color="green"
                  isDark={isDarkTheme}
                />
                <MetricCard
                  icon={<DollarSign className="w-6 h-6" />}
                  label="Daily P&L"
                  value={`${stats.dailyProfitLoss >= 0 ? '+' : ''}$${stats.dailyProfitLoss.toFixed(2)}`}
                  subtitle={stats.dailyProfitLoss >= 0 ? 'In profit' : 'In loss'}
                  color={stats.dailyProfitLoss >= 0 ? 'green' : 'red'}
                  isDark={isDarkTheme}
                />
                <MetricCard
                  icon={<Zap className="w-6 h-6" />}
                  label="Best Trade"
                  value={`$${stats.bestTradeProfit.toFixed(2)}`}
                  subtitle={stats.tradeHistory.length > 0 ? stats.tradeHistory.find(t => t.profit === stats.bestTradeProfit)?.token || 'N/A' : 'N/A'}
                  color="blue"
                  isDark={isDarkTheme}
                />
                <MetricCard
                  icon={<Activity className="w-6 h-6" />}
                  label="Successful Trades"
                  value={stats.successfulTrades.toString()}
                  subtitle={`Failed: ${stats.failedTrades}`}
                  color="orange"
                  isDark={isDarkTheme}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Agent Flow Visualization */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <div className="bg-black/40 backdrop-blur-xl rounded-xl border border-purple-500/20 p-6 glow-border">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                Live Agent Execution Flow
              </h3>
              <AgentFlow agentStatus={agentStatus} setAgentStatus={setAgentStatus} />
            </div>
          </div>

          <div className="lg:col-span-1">
            <StatsPanel />
          </div>
        </div>

        {/* Transaction Feed */}
        <div className="bg-black/40 backdrop-blur-xl rounded-xl border border-purple-500/20 p-6 glow-border">
          <h3 className="text-xl font-bold mb-4">Recent Transactions</h3>
          <TransactionList />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-purple-500/20 bg-black/30 backdrop-blur-xl mt-16">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center text-purple-300">
            <p className="mb-2">Built for Polygon Buildathon 2025</p>
            <p className="text-sm">
              Powered by Polygon CDK • AggLayer • ZKML • Privado ID
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Metric Card Component
interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  color: 'purple' | 'blue' | 'green' | 'orange' | 'red';
  isDark?: boolean;
}

function MetricCard({ icon, label, value, subtitle, color, isDark = true }: MetricCardProps) {
  const colorClasses = {
    purple: isDark ? 'from-purple-500/20 to-purple-600/20 border-purple-500/30' : 'from-purple-100 to-purple-200 border-purple-300',
    blue: isDark ? 'from-blue-500/20 to-blue-600/20 border-blue-500/30' : 'from-blue-100 to-blue-200 border-blue-300',
    green: isDark ? 'from-green-500/20 to-green-600/20 border-green-500/30' : 'from-green-100 to-green-200 border-green-300',
    orange: isDark ? 'from-orange-500/20 to-orange-600/20 border-orange-500/30' : 'from-orange-100 to-orange-200 border-orange-300',
    red: isDark ? 'from-red-500/20 to-red-600/20 border-red-500/30' : 'from-red-100 to-red-200 border-red-300',
  };

  const iconColorClasses = {
    purple: 'text-purple-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    orange: 'text-orange-400',
    red: 'text-red-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`bg-gradient-to-br ${colorClasses[color]} border rounded-xl p-6 backdrop-blur-xl`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={iconColorClasses[color]}>{icon}</div>
        {subtitle && <span className={`text-xs ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>{subtitle}</span>}
      </div>
      <div className={`text-3xl font-bold mb-1 ${!isDark ? 'text-gray-800' : ''}`}>{value}</div>
      <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{label}</div>
    </motion.div>
  );
}

export default App;

