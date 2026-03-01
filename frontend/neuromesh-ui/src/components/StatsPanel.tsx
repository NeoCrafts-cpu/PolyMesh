import { motion } from 'framer-motion';
import { TrendingUp, Award, Target, Activity, Zap, DollarSign } from 'lucide-react';

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

interface StatsPanelProps {
  stats: TradeStats;
  isConnected: boolean;
}

export default function StatsPanel({ stats, isConnected }: StatsPanelProps) {
  const winRate = stats.totalTrades > 0 
    ? (stats.successfulTrades / stats.totalTrades) * 100 
    : 0;
  
  const reputation = Math.min(1000, 100 + (stats.successfulTrades * 10) - (stats.failedTrades * 20));
  
  const statItems = [
    {
      label: 'Agent Reputation',
      value: reputation,
      max: 1000,
      icon: <Award className="w-5 h-5" />,
      color: 'text-yellow-400',
    },
    {
      label: 'Success Rate',
      value: winRate.toFixed(1),
      unit: '%',
      icon: <Target className="w-5 h-5" />,
      color: winRate >= 80 ? 'text-green-400' : winRate >= 50 ? 'text-yellow-400' : 'text-red-400',
    },
    {
      label: 'Total Profit',
      value: stats.totalProfitUSD.toFixed(2),
      unit: 'USD',
      icon: <TrendingUp className="w-5 h-5" />,
      color: stats.totalProfitUSD >= 0 ? 'text-green-400' : 'text-red-400',
    },
    {
      label: 'Total Trades',
      value: stats.totalTrades,
      icon: <Activity className="w-5 h-5" />,
      color: 'text-purple-400',
    },
    {
      label: 'Best Trade',
      value: stats.bestTradeProfit.toFixed(2),
      unit: '%',
      icon: <Zap className="w-5 h-5" />,
      color: 'text-emerald-400',
    },
    {
      label: 'Daily P/L',
      value: stats.dailyProfitLoss >= 0 ? `+${stats.dailyProfitLoss.toFixed(2)}` : stats.dailyProfitLoss.toFixed(2),
      unit: 'USD',
      icon: <DollarSign className="w-5 h-5" />,
      color: stats.dailyProfitLoss >= 0 ? 'text-green-400' : 'text-red-400',
    },
  ];

  // Get recent activity from trade history
  const recentActivity = stats.tradeHistory.slice(0, 5).map(trade => {
    const timeAgo = getTimeAgo(trade.timestamp);
    return {
      action: `${trade.type || 'Arbitrage'} - ${trade.token}`,
      profit: trade.profit >= 0 ? `+$${trade.profit.toFixed(2)}` : `-$${Math.abs(trade.profit).toFixed(2)}`,
      time: timeAgo,
      success: trade.success,
    };
  });

  return (
    <div className="bg-black/40 backdrop-blur-xl rounded-xl border border-purple-500/20 p-6 glow-border h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold">Agent Performance</h3>
        <div className={`px-2 py-1 rounded text-xs ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {isConnected ? 'Live' : 'Offline'}
        </div>
      </div>
      
      <div className="space-y-5">
        {statItems.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={stat.color}>{stat.icon}</span>
                <span className="text-sm text-gray-400">{stat.label}</span>
              </div>
              <span className="text-lg font-bold">
                {stat.value}
                {stat.unit && <span className="text-sm text-gray-400 ml-1">{stat.unit}</span>}
                {stat.max && <span className="text-sm text-gray-400">/{stat.max}</span>}
              </span>
            </div>
            
            {stat.max && (
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(Number(stat.value) / stat.max) * 100}%` }}
                  transition={{ duration: 1, delay: index * 0.05 }}
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="mt-6 pt-5 border-t border-purple-500/20">
        <h4 className="text-sm font-semibold text-gray-400 mb-3">Recent Activity</h4>
        <div className="space-y-2">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.05 }}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${activity.success ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span className="text-gray-300 truncate max-w-[120px]">{activity.action}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={activity.profit.startsWith('+') ? 'text-green-400' : 'text-red-400'} >
                    {activity.profit}
                  </span>
                  <span className="text-gray-500 text-xs">{activity.time}</span>
                </div>
              </motion.div>
            ))
          ) : (
            <p className="text-gray-500 text-sm text-center py-4">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

