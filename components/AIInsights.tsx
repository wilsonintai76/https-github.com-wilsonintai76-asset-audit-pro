
import React, { useState } from 'react';
import { AuditSchedule, AuditInsight } from '../types';
import { analyzeSchedule } from '../services/geminiService';

interface AIInsightsProps {
    schedules: AuditSchedule[];
}

export const AIInsights: React.FC<AIInsightsProps> = ({ schedules }) => {
    const [insight, setInsight] = useState<AuditInsight | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAnalyze = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await analyzeSchedule(schedules);
            setInsight(result);
        } catch (err) {
            setError("Failed to generate insights. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-md relative overflow-hidden group">
            {/* Decorative Gradient Background */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>

            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                        <i className="fa-solid fa-wand-magic-sparkles text-lg animate-pulse"></i>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 leading-none">AI Smart Insights</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Powered by Gemini Pro</p>
                    </div>
                </div>
                {!insight && !isLoading && (
                    <button
                        onClick={handleAnalyze}
                        className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center gap-2"
                    >
                        <i className="fa-solid fa-microchip"></i>
                        Analyze Schedule
                    </button>
                )}
            </div>

            {isLoading && (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <i className="fa-solid fa-brain text-indigo-300 text-xl animate-pulse"></i>
                        </div>
                    </div>
                    <p className="text-sm font-bold text-slate-500 animate-pulse">Analyzing schedule patterns and conflicts...</p>
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100 flex items-center gap-3">
                    <i className="fa-solid fa-circle-exclamation text-lg"></i>
                    {error}
                </div>
            )}

            {insight && !isLoading && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <i className="fa-solid fa-chart-line text-blue-500"></i> Analysis Summary
                        </h4>
                        <p className="text-slate-700 text-sm leading-relaxed font-medium">
                            {insight.summary}
                        </p>
                    </div>

                    <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <i className="fa-solid fa-lightbulb text-amber-500"></i> Key Recommendations
                        </h4>
                        <div className="grid gap-3">
                            {insight.recommendations.map((rec, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-indigo-100 transition-colors">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black flex items-center justify-center mt-0.5">
                                        {idx + 1}
                                    </span>
                                    <p className="text-sm text-slate-600 font-medium">{rec}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleAnalyze}
                        className="w-full py-3 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2 group/btn"
                    >
                        <i className="fa-solid fa-rotate group-hover/btn:rotate-180 transition-transform duration-500"></i>
                        Refresh Analysis
                    </button>
                </div>
            )}
        </div>
    );
};
