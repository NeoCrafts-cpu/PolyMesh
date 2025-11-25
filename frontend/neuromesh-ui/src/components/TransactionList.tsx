import { motion } from 'framer-motion';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Transaction {
  id: string;
  type: 'swap' | 'bridge' | 'arbitrage';
  fromChain: string;
  toChain: string;
  amount: string;
  status: 'pending' | 'success' | 'failed';
  hash: string;
  timestamp: Date;
}

export default function TransactionList() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    // Simulate real-time transactions
    const interval = setInterval(() => {
      const newTx: Transaction = {
        id: Math.random().toString(36).substr(2, 9),
        type: ['swap', 'bridge', 'arbitrage'][Math.floor(Math.random() * 3)] as any,
        fromChain: ['PolyMesh', 'Polygon PoS', 'zkEVM'][Math.floor(Math.random() * 3)],
        toChain: ['PolyMesh', 'Polygon PoS', 'zkEVM'][Math.floor(Math.random() * 3)],
        amount: (Math.random() * 1000).toFixed(2),
        status: 'success',
        hash: '0x' + Math.random().toString(36).substr(2, 64),
        timestamp: new Date(),
      };

      setTransactions((prev) => [newTx, ...prev].slice(0, 10));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'swap':
        return 'text-blue-400';
      case 'bridge':
        return 'text-purple-400';
      case 'arbitrage':
        return 'text-green-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  return (
    <div className="space-y-3">
      {transactions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Waiting for transactions...
        </div>
      ) : (
        transactions.map((tx, index) => (
          <motion.div
            key={tx.id}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-4 p-4 rounded-lg bg-gray-800/30 border border-gray-700 hover:border-purple-500/50 transition-colors"
          >
            {/* Type Badge */}
            <div className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold uppercase ${getTypeColor(tx.type)}`}>
              {tx.type}
            </div>

            {/* Chain Flow */}
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm text-gray-300">{tx.fromChain}</span>
              <ArrowRight className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-gray-300">{tx.toChain}</span>
            </div>

            {/* Amount */}
            <div className="text-right">
              <div className="font-semibold">{tx.amount} MESH</div>
              <div className="text-xs text-gray-500">
                {tx.timestamp.toLocaleTimeString()}
              </div>
            </div>

            {/* Status */}
            <div className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold uppercase border ${getStatusColor(tx.status)}`}>
              {tx.status}
            </div>

            {/* View on Explorer */}
            <a
              href={`http://127.0.0.1:4000/tx/${tx.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 p-2 rounded-lg hover:bg-purple-500/20 transition-colors"
            >
              <ExternalLink className="w-4 h-4 text-purple-400" />
            </a>
          </motion.div>
        ))
      )}
    </div>
  );
}

