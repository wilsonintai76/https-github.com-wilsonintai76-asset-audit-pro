
import React from 'react';
import { AuditInsight } from '../types';
import { Brain, Sparkles, Loader2, Wand2 } from 'lucide-react';

interface AIInsightBoxProps {
  insight: AuditInsight | null;
  loading: boolean;
  onGenerate: () => void;
}

export const AIInsightBox: React.FC<AIInsightBoxProps> = ({ insight, loading, onGenerate }) => {
  return (
    <div className="bg-slate-900 rounded-2xl p-6 text-white mb-8 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
        <Brain className="w-24 h-24" />
      </div>
      
      <div className="flex items-center justify-between mb-4 relative z-10">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          Auditor AI Assistant
        </h3>
        <button 
          onClick={onGenerate}
          disabled={loading}
          className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Wand2 className="w-4 h-4" />
          )}
          {insight ? 'Refresh Analysis' : 'Analyze Schedule'}
        </button>
      </div>

      {insight ? (
        <div className="relative z-10 space-y-4">
          <p className="text-slate-300 leading-relaxed italic border-l-2 border-amber-400/50 pl-4">
            "{insight.summary}"
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {insight.recommendations.map((rec, idx) => (
              <div key={idx} className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-start gap-3">
                <span className="text-amber-400 font-bold">0{idx + 1}</span>
                <span className="text-sm text-slate-200">{rec}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-slate-400 relative z-10">
          Run the Auditor AI Assistant to identify gaps in your schedule, highlight critical risks, and get optimization suggestions.
        </p>
      )}
    </div>
  );
};
