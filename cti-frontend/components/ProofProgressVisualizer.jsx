// components/ProofProgressVisualizer.jsx
'use client';

import { useState, useEffect } from 'react';

export default function ProofProgressVisualizer({ progress, isGenerating }) {
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    // Smooth animation of progress
    if (progress > animatedProgress) {
      const timer = setTimeout(() => {
        setAnimatedProgress(prev => Math.min(prev + 1, progress));
      }, 20);
      return () => clearTimeout(timer);
    }
  }, [progress, animatedProgress]);

  if (!isGenerating && progress === 0) {
    return null;
  }

  const stages = [
    { name: 'Loading snarkjs', threshold: 10, icon: '📦', color: 'blue' },
    { name: 'Starting proof generation', threshold: 15, icon: '🚀', color: 'indigo' },
    { name: 'Building Merkle proof', threshold: 30, icon: '🌳', color: 'green' },
    { name: 'Generating commitment', threshold: 50, icon: '🔐', color: 'purple' },
    { name: 'Preparing circuit', threshold: 60, icon: '⚙️', color: 'yellow' },
    { name: 'Computing witness', threshold: 80, icon: '🧮', color: 'orange' },
    { name: 'Formatting proof', threshold: 95, icon: '📦', color: 'cyan' },
    { name: 'Complete!', threshold: 100, icon: '✅', color: 'green' }
  ];

  const currentStage = [...stages].reverse().find(s => progress >= s.threshold) || stages[0];
  const currentStageIndex = stages.indexOf(currentStage);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 border border-purple-500">
        {/* Header */}
        <div className="text-center mb-6">
          <h3 className="text-3xl font-bold text-white mb-2">
            Generating Zero-Knowledge Proof
          </h3>
          <p className="text-gray-300">
            Cryptographic proof generation in progress... {animatedProgress}%
          </p>
        </div>

        {/* Main Progress Bar */}
        <div className="mb-8">
          <div className="relative h-6 bg-gray-700 rounded-full overflow-hidden">
            {/* Animated gradient background */}
            <div 
              className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-500 ease-out"
              style={{ 
                width: `${animatedProgress}%`,
                boxShadow: '0 0 20px rgba(147, 51, 234, 0.5)'
              }}
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer" />
            </div>
            
            {/* Progress text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white font-bold text-sm drop-shadow-lg">
                {animatedProgress}%
              </span>
            </div>
          </div>
        </div>

        {/* Stage List */}
        <div className="space-y-3 mb-6">
          {stages.map((stage, index) => {
            const isComplete = progress >= stage.threshold;
            const isCurrent = index === currentStageIndex;
            const isUpcoming = index > currentStageIndex;

            return (
              <div 
                key={index}
                className={`flex items-center gap-4 p-3 rounded-lg transition-all duration-300 ${
                  isComplete 
                    ? 'bg-green-900 bg-opacity-30 border-l-4 border-green-500' 
                    : isCurrent
                    ? 'bg-purple-900 bg-opacity-50 border-l-4 border-purple-500 animate-pulse'
                    : 'bg-gray-800 bg-opacity-30 border-l-4 border-gray-600'
                }`}
              >
                {/* Icon */}
                <div className={`text-3xl ${isCurrent ? 'animate-bounce' : ''}`}>
                  {isComplete ? '✅' : isCurrent ? stage.icon : '⏳'}
                </div>

                {/* Stage name */}
                <div className="flex-1">
                  <p className={`font-semibold ${
                    isComplete ? 'text-green-400' : 
                    isCurrent ? 'text-purple-300' : 
                    'text-gray-400'
                  }`}>
                    {stage.name}
                  </p>
                  {isCurrent && currentStage.threshold !== 100 && (
                    <p className="text-xs text-gray-400 mt-1">
                      Processing ~2,000 R1CS constraints...
                    </p>
                  )}
                </div>

                {/* Status indicator */}
                <div>
                  {isComplete ? (
                    <span className="text-green-400 text-xs">Complete</span>
                  ) : isCurrent ? (
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-purple-500 rounded-full animate-ping" />
                      <span className="w-2 h-2 bg-purple-500 rounded-full animate-ping delay-75" />
                      <span className="w-2 h-2 bg-purple-500 rounded-full animate-ping delay-150" />
                    </div>
                  ) : (
                    <span className="text-gray-500 text-xs">Pending</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Technical Details */}
        <div className="bg-gray-800 bg-opacity-50 p-4 rounded-lg border border-gray-700">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Proof System</p>
              <p className="text-white font-semibold">Groth16 zkSNARK</p>
            </div>
            <div>
              <p className="text-gray-400">Curve</p>
              <p className="text-white font-semibold">BN254 (128-bit)</p>
            </div>
            <div>
              <p className="text-gray-400">Constraints</p>
              <p className="text-white font-semibold">~2,000 R1CS</p>
            </div>
            <div>
              <p className="text-gray-400">Merkle Depth</p>
              <p className="text-white font-semibold">20 levels</p>
            </div>
            <div>
              <p className="text-gray-400">Proof Size</p>
              <p className="text-white font-semibold">768 bytes</p>
            </div>
            <div>
              <p className="text-gray-400">Expected Time</p>
              <p className="text-white font-semibold">2-3 seconds</p>
            </div>
          </div>
        </div>

        {/* Success message */}
        {progress === 100 && (
          <div className="mt-6 p-4 bg-green-900 bg-opacity-30 border border-green-500 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-4xl animate-bounce">🎉</span>
              <div>
                <p className="text-green-400 font-bold">Proof Generated Successfully!</p>
                <p className="text-gray-300 text-sm">
                  Your identity is cryptographically protected
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        .delay-75 {
          animation-delay: 75ms;
        }
        .delay-150 {
          animation-delay: 150ms;
        }
      `}</style>
    </div>
  );
}
