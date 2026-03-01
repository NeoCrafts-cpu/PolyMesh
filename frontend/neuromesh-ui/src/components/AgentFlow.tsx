import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Send, CheckCircle, Loader, Search, Shield, Zap, AlertTriangle } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';

interface AgentFlowProps {
  agentStatus: 'idle' | 'thinking' | 'executing';
  isConnected: boolean;
  lastOpportunity?: {
    token: string;
    profitPercent: number;
    buyChain: string;
    sellChain: string;
  } | null;
}

type FlowStep = {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'pending' | 'active' | 'complete' | 'error';
};

export default function AgentFlow({ agentStatus, isConnected, lastOpportunity }: AgentFlowProps) {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [errorStep, setErrorStep] = useState<number | null>(null);

  // Determine flow state based on agent status
  useEffect(() => {
    if (!isConnected) {
      setActiveStep(0);
      setCompletedSteps([]);
      setErrorStep(null);
      return;
    }

    switch (agentStatus) {
      case 'thinking':
        setActiveStep(1);
        setCompletedSteps([]);
        break;
      case 'executing':
        setActiveStep(3);
        setCompletedSteps([1, 2]);
        break;
      case 'idle':
        // If we were executing, mark all as complete
        if (activeStep >= 3) {
          setCompletedSteps([1, 2, 3, 4, 5]);
          setActiveStep(5);
          // Reset after a delay
          setTimeout(() => {
            setCompletedSteps([]);
            setActiveStep(0);
          }, 3000);
        }
        break;
    }
  }, [agentStatus, isConnected, activeStep]);

  const steps: FlowStep[] = useMemo(() => [
    {
      id: 1,
      title: 'Market Analysis',
      description: lastOpportunity 
        ? `Analyzing ${lastOpportunity.token} prices...` 
        : 'AI scanning for arbitrage opportunities',
      icon: <Search className="w-5 h-5" />,
      status: getStepStatus(1, activeStep, completedSteps, errorStep),
    },
    {
      id: 2,
      title: 'ZKML Proof Generation',
      description: 'Creating verifiable proof of AI decision',
      icon: <Shield className="w-5 h-5" />,
      status: getStepStatus(2, activeStep, completedSteps, errorStep),
    },
    {
      id: 3,
      title: 'Transaction Preparation',
      description: lastOpportunity
        ? `Preparing trade: ${lastOpportunity.buyChain} → ${lastOpportunity.sellChain}`
        : 'Locking funds in Local Exit Tree',
      icon: <Send className="w-5 h-5" />,
      status: getStepStatus(3, activeStep, completedSteps, errorStep),
    },
    {
      id: 4,
      title: 'AggLayer Verification',
      description: 'Pessimistic proof verification in progress',
      icon: <Zap className="w-5 h-5" />,
      status: getStepStatus(4, activeStep, completedSteps, errorStep),
    },
    {
      id: 5,
      title: 'Execution Complete',
      description: lastOpportunity
        ? `Trade complete! +${lastOpportunity.profitPercent.toFixed(2)}% profit`
        : 'Trade executed successfully',
      icon: <CheckCircle className="w-5 h-5" />,
      status: getStepStatus(5, activeStep, completedSteps, errorStep),
    },
  ], [activeStep, completedSteps, errorStep, lastOpportunity]);

  const getStepStyle = (status: FlowStep['status']) => {
    switch (status) {
      case 'active':
        return 'bg-purple-500/30 border-purple-500 shadow-lg shadow-purple-500/20';
      case 'complete':
        return 'bg-green-500/20 border-green-500/50';
      case 'error':
        return 'bg-red-500/20 border-red-500/50';
      default:
        return 'bg-gray-800/30 border-gray-700';
    }
  };

  const getIconStyle = (status: FlowStep['status']) => {
    switch (status) {
      case 'active':
        return 'text-purple-400';
      case 'complete':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-500';
    }
  };

  const getStepNumberStyle = (status: FlowStep['status']) => {
    switch (status) {
      case 'active':
        return 'bg-purple-500 text-white';
      case 'complete':
        return 'bg-green-500 text-white';
      case 'error':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-700 text-gray-400';
    }
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-300 mb-2">Agent Disconnected</h3>
        <p className="text-gray-500 text-sm">Connect to the agent to see the execution flow</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Current opportunity info */}
      {lastOpportunity && agentStatus !== 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-bold text-sm">
                {lastOpportunity.token.charAt(0)}
              </div>
              <div>
                <div className="font-semibold">{lastOpportunity.token} Arbitrage</div>
                <div className="text-sm text-gray-400">
                  {lastOpportunity.buyChain} → {lastOpportunity.sellChain}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-green-400 font-bold">
                +{lastOpportunity.profitPercent.toFixed(2)}%
              </div>
              <div className="text-xs text-gray-500">Expected Profit</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Flow visualization */}
      <div className="space-y-3">
        <AnimatePresence>
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ 
                opacity: step.status === 'pending' ? 0.4 : 1,
                x: 0,
                scale: step.status === 'active' ? 1.02 : 1,
              }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className={`flex items-center gap-4 p-4 rounded-lg border transition-all duration-300 ${getStepStyle(step.status)}`}
            >
              {/* Step number */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${getStepNumberStyle(step.status)}`}>
                {step.status === 'complete' ? '✓' : step.status === 'error' ? '!' : step.id}
              </div>

              {/* Icon */}
              <div className={`transition-colors ${getIconStyle(step.status)}`}>
                {step.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm">{step.title}</h4>
                <p className="text-xs text-gray-400 truncate">{step.description}</p>
              </div>

              {/* Progress indicator */}
              {step.status === 'active' && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  className="flex-shrink-0"
                >
                  <Loader className="w-4 h-4 text-purple-400" />
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Connection line */}
      <div className="absolute left-[23px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-500/50 via-purple-500/30 to-transparent -z-10" />
    </div>
  );
}

function getStepStatus(
  stepId: number, 
  activeStep: number, 
  completedSteps: number[], 
  errorStep: number | null
): FlowStep['status'] {
  if (errorStep === stepId) return 'error';
  if (completedSteps.includes(stepId)) return 'complete';
  if (activeStep === stepId) return 'active';
  return 'pending';
}

