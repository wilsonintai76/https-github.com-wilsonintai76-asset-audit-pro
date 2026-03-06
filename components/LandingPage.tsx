
import React, { useState } from 'react';
import { 
  CalendarCheck, 
  Network, 
  Stamp, 
  UserPlus, 
  PieChart, 
  ShieldCheck, 
  BookOpen, 
  ArrowRight, 
  X, 
  ArrowLeft, 
  Check 
} from 'lucide-react';

interface LandingPageProps {
  onEnter: () => void;
  onShowKnowledgeBase: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnter, onShowKnowledgeBase }) => {
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const tourSteps = [
    {
      title: "Strategic Phase Planning",
      desc: "Audit operations are locked to institutional phases. No date can be selected outside of an authorized window.",
      icon: CalendarCheck,
      color: "text-blue-500"
    },
    {
      title: "Conflict-of-Interest Engine",
      desc: "Our Matrix Engine ensures JKE staff never audit JKE assets. It automatically pairs departments based on asset counts and staff strength.",
      icon: Network,
      color: "text-indigo-500"
    },
    {
      title: "Auditor Certification Lock",
      desc: "Only staff with an active, Admin-issued certificate can self-assign to audits. If your cert expires, you are automatically locked out.",
      icon: Stamp,
      color: "text-emerald-500"
    },
    {
      title: "Self-Assignment Slots",
      desc: "Auditors pick their own slots from the available pool, reducing administrative workload for coordinators.",
      icon: UserPlus,
      color: "text-amber-500"
    },
    {
      title: "Live KPI Monitoring",
      desc: "Real-time tracking of completion percentages against institutional targets, weighted by asset complexity.",
      icon: PieChart,
      color: "text-rose-500"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-400/10 rounded-full blur-[120px]"></div>
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-indigo-400/10 rounded-full blur-[100px]"></div>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-[100] bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-xl shadow-slate-900/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <span className="text-xl font-black text-slate-900 tracking-tight">Asset Audit <span className="text-blue-600">Pro</span></span>
          </div>
          
          <div className="flex items-center gap-8">
             <button 
               onClick={onShowKnowledgeBase}
               className="text-[10px] font-black uppercase text-slate-500 tracking-widest hover:text-blue-600 transition-colors flex items-center gap-2"
             >
               <BookOpen className="w-3 h-3" />
               Knowledge Base
             </button>
             <div className="hidden lg:block h-6 w-px bg-slate-200"></div>
             <span className="hidden lg:block text-[10px] font-black uppercase text-slate-400 tracking-widest">v2.5 Institutional Edition</span>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-32 md:pt-48 pb-40">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="animate-in fade-in slide-in-from-left-4 duration-1000">
            <div className="flex items-center gap-4 mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-full border border-blue-100">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                Secure Institutional Access
              </div>
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-slate-900 leading-[1.1] mb-6 tracking-tight">
              Eliminate <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Bias</span> in Auditing.
            </h1>
            <p className="text-lg text-slate-500 mb-10 leading-relaxed max-w-lg font-medium">
              The institutional standard for automated asset audit scheduling. Enforce neutral pairings, monitor weighted KPIs, and ensure staff compliance across all departments.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={onEnter}
                className="group flex items-center justify-center gap-4 px-10 py-5 bg-slate-900 text-white rounded-2xl text-lg font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
              >
                Launch Console
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={() => setIsTourOpen(true)}
                className="flex items-center justify-center gap-2 px-8 py-5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-lg font-bold hover:bg-slate-50 transition-all"
              >
                Take System Tour
              </button>
            </div>
          </div>

          <div className="relative animate-in fade-in slide-in-from-right-8 duration-1000 delay-200 hidden lg:block">
            <div className="relative bg-white rounded-[56px] shadow-2xl border border-slate-100 p-4">
              <div className="bg-slate-900 rounded-[44px] p-8 text-white min-h-[400px]">
                 <div className="flex items-center justify-between mb-8">
                    <div className="flex gap-2">
                       <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                       <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                       <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Dashboard Preview</span>
                 </div>
                 
                 <div className="space-y-6">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                       <div className="flex justify-between items-end mb-2">
                          <span className="text-xs font-bold">Overall Compliance Progress</span>
                          <span className="text-[10px] font-mono text-emerald-400">84%</span>
                       </div>
                       <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full w-[84%]"></div>
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
                          <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Total Assets</p>
                          <p className="text-2xl font-black">18,302</p>
                       </div>
                       <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
                          <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Active Phases</p>
                          <p className="text-2xl font-black text-amber-500">03</p>
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* TOUR OVERLAY */}
      {isTourOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl animate-in fade-in" onClick={() => setIsTourOpen(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[48px] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
             <div className="p-8 md:p-12 text-center">
                <button 
                  onClick={() => setIsTourOpen(false)}
                  className="absolute top-8 right-8 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-8 h-8" />
                </button>

                <div className={`w-24 h-24 rounded-[32px] bg-slate-50 flex items-center justify-center text-4xl mx-auto mb-8 shadow-inner ${tourSteps[tourStep].color}`}>
                  {React.createElement(tourSteps[tourStep].icon, { className: "w-12 h-12" })}
                </div>

                <div className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-4">Core Feature {tourStep + 1} of 5</div>
                <h3 className="text-3xl font-black text-slate-900 mb-6">{tourSteps[tourStep].title}</h3>
                <p className="text-slate-500 text-lg leading-relaxed max-w-md mx-auto mb-12">
                  {tourSteps[tourStep].desc}
                </p>

                <div className="flex items-center justify-center gap-6">
                   <button 
                     onClick={() => setTourStep(prev => Math.max(0, prev - 1))}
                     disabled={tourStep === 0}
                     className="w-12 h-12 rounded-full border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all disabled:opacity-30 flex items-center justify-center"
                   >
                     <ArrowLeft className="w-5 h-5" />
                   </button>
                   
                   <div className="flex gap-2">
                     {tourSteps.map((_, i) => (
                       <div key={i} className={`h-1.5 rounded-full transition-all ${i === tourStep ? 'w-8 bg-blue-600' : 'w-2 bg-slate-200'}`}></div>
                     ))}
                   </div>

                   <button 
                     onClick={() => tourStep === 4 ? setIsTourOpen(false) : setTourStep(prev => prev + 1)}
                     className="w-12 h-12 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center"
                   >
                     {tourStep === 4 ? <Check className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 py-16 bg-white relative z-10">
        <div className="max-w-7xl mx-auto px-6 text-center">
           <div className="flex items-center justify-center gap-3 mb-8">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="text-sm font-black text-slate-900 tracking-tight">Asset Audit <span className="text-blue-600">Pro</span></span>
           </div>
           <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">© 2026 PKS Asset Management Unit</p>
        </div>
      </footer>
    </div>
  );
};
