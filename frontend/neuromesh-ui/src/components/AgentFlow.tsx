import { motion } from 'framer-motion';
import { Brain, Send, CheckCircle, Loader } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AgentFlowProps {
  agentStatus: 'idle' | 'thinking' | 'executing';
  setAgentStatus: (status: 'idle' | 'thinking' | 'executing') => void;
}

export default function AgentFlow({ setAgentStatus }: AgentFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Simulate agent execution flow
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        const next = (prev + 1) % 5;
        
        // Update agent status based on step
        if (next === 0 || next === 1) {
          setAgentStatus('thinking');
        } else if (next === 2 || next === 3) {
          setAgentStatus('executing');
        } else {
          setAgentStatus('idle');
        }
        
        return next;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [setAgentStatus]);

  const steps = [
    {
      id: 1,
      title: 'Agent Thinking',
      description: 'AI analyzes market conditions',
      icon: <Brain className="w-6 h-6" />,
      color: 'purple',
    },
    {
      id: 2,
      title: 'ZKML Proof Generation',
      description: 'Creating proof of decision',
      icon: <Loader className="w-6 h-6 animate-spin" />,
      color: 'blue',
    },
    {
      id: 3,
      title: 'Transaction Locked',
      description: 'Funds locked in Local Exit Tree',
      icon: <Send className="w-6 h-6" />,
      color: 'yellow',
    },
    {
      id: 4,
      title: 'Pessimistic Proof',
      description: 'AggLayer verification',
      icon: <CheckCircle className="w-6 h-6" />,
      color: 'green',
    },
    {
      id: 5,
      title: 'Execution Complete',
      description: 'Trade executed on destination',
      icon: <CheckCircle className="w-6 h-6" />,
      color: 'green',
    },
  ];

  return (
    <div className="relative">
      {/* Flow visualization */}
      <div className="space-y-4">
        {steps.map((step, index) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ 
              opacity: currentStep >= index ? 1 : 0.3,
              x: 0,
              scale: currentStep === index ? 1.05 : 1,
            }}
            transition={{ duration: 0.5 }}
            className={`flex items-center gap-4 p-4 rounded-lg border ${
              currentStep === index
                ? 'bg-purple-500/20 border-purple-500 glow-border'
                : 'bg-gray-800/20 border-gray-700'
            }`}
          >
            {/* Step number */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              currentStep >= index ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-400'
            }`}>
              {currentStep > index ? '✓' : step.id}
            </div>

            {/* Icon */}
            <div className={`text-${step.color}-400`}>
              {step.icon}
            </div>

            {/* Content */}
            <div className="flex-1">
              <h4 className="font-semibold">{step.title}</h4>
              <p className="text-sm text-gray-400">{step.description}</p>
            </div>

            {/* Progress indicator */}
            {currentStep === index && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="flex-shrink-0"
              >
                <Loader className="w-5 h-5 text-purple-400" />
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Connection lines */}
      <div className="absolute left-[29px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-500 to-transparent -z-10" />
    </div>
  );
}

