import { motion } from 'framer-motion';
import { TrendingUp, Award, Target } from 'lucide-react';

export default function StatsPanel() {
  const stats = [
    {
      label: 'Agent Reputation',
      value: 850,
      max: 1000,
      icon: <Award className="w-5 h-5" />,
      color: 'text-yellow-400',
    },
    {
      label: 'Success Rate',
      value: 94.5,
      unit: '%',
      icon: <Target className="w-5 h-5" />,
      color: 'text-green-400',
    },
    {
      label: 'Total Profit',
      value: 12547,
      unit: 'MESH',
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-purple-400',
    },
  ];

  return (
    <div className="bg-black/40 backdrop-blur-xl rounded-xl border border-purple-500/20 p-6 glow-border h-full">
      <h3 className="text-xl font-bold mb-6">Agent Performance</h3>
      
      <div className="space-y-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={stat.color}>{stat.icon}</span>
                <span className="text-sm text-gray-400">{stat.label}</span>
              </div>
              <span className="text-xl font-bold">
                {stat.value}
                {stat.unit && <span className="text-sm text-gray-400 ml-1">{stat.unit}</span>}
                {stat.max && <span className="text-sm text-gray-400">/{stat.max}</span>}
              </span>
            </div>
            
            {stat.max && (
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(stat.value / stat.max) * 100}%` }}
                  transition={{ duration: 1, delay: index * 0.1 }}
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="mt-8 pt-6 border-t border-purple-500/20">
        <h4 className="text-sm font-semibold text-gray-400 mb-4">Recent Activity</h4>
        <div className="space-y-3">
          {[
            { action: 'Arbitrage executed', profit: '+234 MESH', time: '2m ago' },
            { action: 'LP rebalanced', profit: '+156 MESH', time: '15m ago' },
            { action: 'Yield harvested', profit: '+89 MESH', time: '1h ago' },
          ].map((activity, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-gray-300">{activity.action}</span>
              <div className="flex items-center gap-2">
                <span className="text-green-400 font-semibold">{activity.profit}</span>
                <span className="text-gray-500 text-xs">{activity.time}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

