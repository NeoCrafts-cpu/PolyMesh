import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ExternalLink, CheckCircle, XCircle, Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface TradeRecord {
  timestamp: number;
  token: string;
  type?: string;
  profit: number;
  profitPercent: number;
  gasUsed?: number;
  fees?: number;
  success: boolean;
  txHash?: string;
}

interface TransactionListProps {
  trades: TradeRecord[];
  isConnected: boolean;
}

export default function TransactionList({ trades, isConnected }: TransactionListProps) {
  const getTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'cross-chain':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'triangular':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'cross-dex':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      default:
        return 'bg-green-500/20 text-green-400 border-green-500/30';
    }
  };

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="w-4 h-4 text-green-400" />
    ) : (
      <XCircle className="w-4 h-4 text-red-400" />
    );
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getExplorerUrl = (txHash?: string) => {
    if (!txHash) return '#';
    // Use Polygon Amoy explorer for testnet
    return `https://amoy.polygonscan.com/tx/${txHash}`;
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 text-xs text-gray-500 uppercase tracking-wide">
        <span>Trade</span>
        <span>Token</span>
        <span>Profit</span>
        <span>Time</span>
        <span>Status</span>
      </div>

      {trades.length === 0 ? (
        <div className="text-center py-16">
          <Clock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">
            {isConnected ? 'Waiting for trades...' : 'Connect to agent to see trades'}
          </p>
          <p className="text-gray-600 text-sm mt-2">
            Trades will appear here in real-time
          </p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {trades.map((trade, index) => (
            <motion.div
              key={`${trade.timestamp}-${index}`}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              layout
              className="flex items-center gap-4 p-4 rounded-lg bg-gray-800/30 border border-gray-700/50 hover:border-purple-500/50 hover:bg-gray-800/50 transition-all duration-200 cursor-pointer group"
            >
              {/* Type Badge */}
              <div className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase border ${getTypeColor(trade.type || 'arbitrage')}`}>
                {trade.type || 'Arbitrage'}
              </div>

              {/* Token */}
              <div className="flex items-center gap-2 min-w-[80px]">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold">
                  {trade.token.charAt(0)}
                </div>
                <span className="text-sm font-medium text-gray-200">{trade.token}</span>
              </div>

              {/* Profit */}
              <div className="flex items-center gap-2 min-w-[120px]">
                {trade.profit >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                )}
                <div className="text-right">
                  <div className={`font-semibold ${trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)} USD
                  </div>
                  <div className={`text-xs ${trade.profitPercent >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                    {trade.profitPercent >= 0 ? '+' : ''}{trade.profitPercent.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Gas/Fees Info */}
              {trade.gasUsed !== undefined && (
                <div className="hidden lg:block text-xs text-gray-500 min-w-[80px]">
                  <div>Gas: {trade.gasUsed.toFixed(4)}</div>
                  {trade.fees !== undefined && <div>Fees: ${trade.fees.toFixed(2)}</div>}
                </div>
              )}

              {/* Time */}
              <div className="text-right min-w-[80px]">
                <div className="text-sm text-gray-300">{formatTime(trade.timestamp)}</div>
                <div className="text-xs text-gray-500">{formatDate(trade.timestamp)}</div>
              </div>

              {/* Status */}
              <div className="flex-shrink-0">
                {getStatusIcon(trade.success)}
              </div>

              {/* Explorer Link */}
              {trade.txHash && (
                <a
                  href={getExplorerUrl(trade.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 p-2 rounded-lg hover:bg-purple-500/20 transition-colors opacity-0 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-4 h-4 text-purple-400" />
                </a>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      {/* Summary Footer */}
      {trades.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 mt-4 rounded-lg bg-gray-800/20 border border-gray-700/30">
          <span className="text-sm text-gray-400">
            Showing {trades.length} recent trades
          </span>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-green-400">
              {trades.filter(t => t.success).length} successful
            </span>
            <span className="text-red-400">
              {trades.filter(t => !t.success).length} failed
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

