import React, { useState, useEffect, useMemo } from 'react';
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
  Check,
  Clock,
  ChevronDown,
  Trophy,
  History
} from 'lucide-react';
import { AuditPhase, SystemActivity, UserRole, AppView } from '../types';
import { BRANDING } from '../constants';

interface LandingPageProps {
  onEnter: () => void;
  onShowKnowledgeBase: () => void;
  totalAssets?: number;
  totalPhases?: number;
  complianceProgress?: number;
  phases?: AuditPhase[];
  activities?: SystemActivity[];
  topDepartments?: { name: string, compliance: number }[];
}

export const LandingPage: React.FC<LandingPageProps> = ({ 
  onEnter, 
  onShowKnowledgeBase,
  totalAssets,
  totalPhases,
  complianceProgress,
  phases = [],
  activities = [],
  topDepartments = []
}) => {
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const faqs = [
    {
      q: "How do I get my Auditor Certification?",
      a: "Certification ensures you remain compliant with JKE and Kamsis institutional inspection standards. Certifications are issued by the Institutional Admin after you complete the mandatory audit training module. Once issued, your Staff ID will be unlocked for audit assignments."
    },
    {
      q: "What is the Conflict-of-Interest (COI) Engine?",
      a: "Our system automatically prevents staff from auditing assets within their own department. It uses a neutral pairing matrix to ensure maximum objectivity during every audit phase."
    },
    {
      q: "Can I perform audits outside the active phase?",
      a: "No. The system only permits data entry and scheduling within the authorized window for Phase 1, 2, or 3. All other periods are read-only to maintain data integrity."
    }
  ];

  const isActivePhase = (phase: AuditPhase) => {
    const today = new Date().toISOString().split('T')[0];
    return today >= phase.startDate && today <= phase.endDate;
  };

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
        <div 
          className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-400/10 rounded-full blur-[120px] transition-transform duration-700 ease-out"
          style={{ transform: `translate(${mousePos.x}px, ${mousePos.y}px)` }}
        ></div>
        <div 
          className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-indigo-400/10 rounded-full blur-[100px] transition-transform duration-1000 ease-out"
          style={{ transform: `translate(${-mousePos.x * 1.5}px, ${-mousePos.y * 1.5}px)` }}
        ></div>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-[100] bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="h-10 flex items-center justify-center">
               <img 
                 src={BRANDING.logoHorizontal} 
                 alt="Institutional Logo" 
                 className="h-8 w-auto object-contain" 
               />
            </div>
            <span className="text-xl font-black text-slate-900 tracking-tight">Inspect-<span className="text-blue-600">able</span></span>

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
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-32 md:pt-48 pb-20">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div className="animate-in fade-in slide-in-from-left-4 duration-1000">
            {/* Phase Timeline (Feature 1) */}
            {phases.length > 0 && (
              <div className="mb-12 flex flex-wrap gap-4 items-center">
                {phases.map((p, i) => {
                  const active = isActivePhase(p);
                  return (
                    <div key={p.id} className="flex items-center gap-2">
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase transition-all duration-500 ${
                        active 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30 scale-110' 
                          : 'bg-white text-slate-400 border-slate-200'
                      }`}>
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>}
                        {p.name}
                      </div>
                      {i < phases.length - 1 && <div className="w-4 h-px bg-slate-200"></div>}
                    </div>
                  );
                })}
              </div>
            )}

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
              The central source of truth for Inspect-able operations. Understand how our anti-bias pairing works and how to manage institutional compliance.
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
                  {/* Department Spotlight (Feature 2) */}
                  {topDepartments.length > 0 && (
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                      <div className="flex items-center gap-2 mb-3">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        <span className="text-[10px] whitespace-nowrap font-black uppercase tracking-widest text-slate-300">Live Top Performers</span>
                      </div>
                      <div className="space-y-3">
                        {topDepartments.map((dept, idx) => (
                          <div key={dept.name} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black text-slate-500">0{idx + 1}</span>
                              <span className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">{dept.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-1 w-12 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500" style={{ width: `${dept.compliance}%` }}></div>
                              </div>
                              <span className="text-[10px] font-mono text-emerald-400">{dept.compliance}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-xs font-bold">Overall Compliance Progress</span>
                      <span className="text-[10px] font-mono text-emerald-400">
                        {complianceProgress !== undefined ? `${complianceProgress}%` : '---'}
                      </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all duration-1000" 
                        style={{ width: `${complianceProgress ?? 0}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
                      <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Total Assets</p>
                      <p className="text-2xl font-black">
                        {totalAssets !== undefined ? totalAssets.toLocaleString() : '---'}
                      </p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
                      <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Active Phases</p>
                      <p className="text-2xl font-black text-amber-500">
                        {totalPhases !== undefined ? String(totalPhases).padStart(2, '0') : '---'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Activity Ticker (Feature 3) */}
        {activities.length > 0 && (
          <div className="mt-20 py-4 border-y border-slate-200 bg-white/50 backdrop-blur-sm overflow-hidden flex items-center gap-8 group">
            <div className="flex items-center gap-2 px-6 border-r border-slate-200 shrink-0">
              <History className="w-4 h-4 text-blue-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Activity</span>
            </div>
            <div className="flex gap-12 animate-marquee-slower whitespace-nowrap">
              {activities.slice(0, 5).map((act, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{act.message}</span>
                </div>
              ))}
              {/* Duplicate for seamless scroll */}
              {activities.slice(0, 5).map((act, i) => (
                <div key={`dup-${i}`} className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{act.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FAQ Section (Feature 4) */}
        <section className="mt-40 max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black text-slate-900 mb-4">Staff FAQ</h2>
            <p className="text-slate-500 text-lg mt-1">Real-time status of your institutional asset inspection operations.</p>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div 
                key={i}
                className="bg-white border border-slate-200 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-slate-200/50"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-8 py-6 flex items-center justify-between text-left"
                >
                  <span className="font-bold text-slate-900">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                <div className={`transition-all duration-300 ease-in-out px-8 overflow-hidden ${openFaq === i ? 'max-h-40 pb-6 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <p className="text-slate-500 leading-relaxed">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
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
            <div className="h-8 flex items-center justify-center">
              <img 
                src={BRANDING.logoHorizontal} 
                alt="Institutional Logo" 
                className="h-6 w-auto object-contain" 
              />
            </div>
            <span className="text-sm font-black text-slate-900 tracking-tight">Inspect-<span className="text-blue-600">able</span></span>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">© 2026 PKS Asset Management Unit</p>
          <a
            href="/privacy_policy.html"
            className="text-[10px] font-black uppercase text-blue-600/60 hover:text-blue-600 tracking-[0.2em] transition-colors"
          >
            Privacy Policy
          </a>
        </div>
      </footer>
    </div>
  );
};
