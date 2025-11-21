import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, Table } from 'lucide-react';

interface ProcessingViewProps {
  fileName: string;
  onComplete: () => void;
}

export const ProcessingView: React.FC<ProcessingViewProps> = ({ fileName, onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);

  const steps = [
    "Reading file contents...",
    "Parsing structure...",
    "Analyzing data types...",
    "Applying beautiful formatting...",
    "Finalizing table..."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const increment = Math.random() * 15;
        return Math.min(prev + increment, 100);
      });
    }, 400);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const currentStepIndex = Math.min(Math.floor((progress / 100) * steps.length), steps.length - 1);
    setStep(currentStepIndex);
  }, [progress]);

  const isComplete = progress === 100;

  return (
    <div className="max-w-xl mx-auto w-full flex flex-col items-center justify-center min-h-[400px]">
      <div className="w-full bg-white p-10 rounded-2xl border border-brand-200 relative overflow-hidden">
        
        <div className="flex justify-center mb-8">
          <div className={`w-16 h-16 rounded-xl flex items-center justify-center transition-colors duration-500 ${isComplete ? 'bg-green-100 text-green-600' : 'bg-brand-900 text-white'}`}>
             {isComplete ? <CheckCircle2 size={32} /> : <Loader2 size={32} className="animate-spin" />}
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center text-brand-900 mb-2">
          {isComplete ? "Ready to Beautify!" : "Converting File"}
        </h2>
        <p className="text-center text-brand-500 mb-10 text-sm">
          {fileName}
        </p>

        <div className="w-full h-2 bg-brand-100 rounded-full overflow-hidden mb-6">
          <div 
            className="h-full bg-brand-900 transition-all duration-300 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-xs font-bold text-brand-400 uppercase tracking-wide h-6">
          <span>{steps[step]}</span>
          <span>{Math.round(progress)}%</span>
        </div>

        {isComplete && (
          <div className="mt-10 pt-8 border-t border-brand-100 animate-fade-in-up">
            <button
              onClick={onComplete}
              className="w-full bg-brand-900 hover:bg-brand-800 text-white py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Table size={20} />
              Beautify Table
            </button>
          </div>
        )}
      </div>
    </div>
  );
};