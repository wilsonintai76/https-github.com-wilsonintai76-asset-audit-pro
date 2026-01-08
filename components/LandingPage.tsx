
import React from 'react';

import { useAuth } from '../contexts/AuthContext';

interface LandingPageProps { }

export const LandingPage: React.FC<LandingPageProps> = () => {
  const { login } = useAuth();

  const handleEnter = () => {
    login({
      name: 'Institutional Admin',
      email: 'admin@institution.edu',
      roles: ['Admin', 'Supervisor'],
      status: 'Active',
      lastActive: new Date().toLocaleString(),
      department: 'Finance & Records',
      contactNumber: '+1 (555) 999-0001',
      permissions: ['all']
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-400/10 rounded-full blur-[120px]"></div>
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-indigo-400/10 rounded-full blur-[100px]"></div>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-xl shadow-slate-900/20">
            <i className="fa-solid fa-building-shield text-lg"></i>
          </div>
          <span className="text-xl font-black text-slate-900 tracking-tight">Asset Audit <span className="text-blue-600">Pro</span></span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-500 uppercase tracking-widest">
          <a href="#" className="hover:text-blue-600 transition-colors">Solutions</a>
          <a href="#" className="hover:text-blue-600 transition-colors">Compliance</a>
          <a href="#" className="hover:text-blue-600 transition-colors">Security</a>
        </div>
        {/* Removed redundant Enter Dashboard button to clean up header */}
        <div className="w-10 hidden md:block"></div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-12 md:pt-24 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-in fade-in slide-in-from-left-4 duration-1000">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-full border border-blue-100 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              Institutional Portal Active
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-slate-900 leading-[1.1] mb-6 tracking-tight">
              Master Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Audit Lifecycle.</span>
            </h1>
            <p className="text-lg text-slate-500 mb-10 leading-relaxed max-w-lg">
              The professional scheduling platform for institutional asset management.
              Manage your audit schedule, assign teams, and track compliance trends with ease.
            </p>

            <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-xl inline-block">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Ready to begin?</p>
              <button
                onClick={handleEnter}
                className="group flex items-center gap-4 px-8 py-4 bg-blue-600 text-white rounded-2xl text-lg font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95"
              >
                Launch Audit Console
                <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
              </button>
              <p className="mt-4 text-[10px] text-slate-400">
                <i className="fa-solid fa-lock mr-1"></i>
                Secure Institutional Session
              </p>
            </div>

            <div className="mt-12 flex items-center gap-6 grayscale opacity-50">
              <i className="fa-solid fa-award text-2xl"></i>
              <i className="fa-solid fa-shield-halved text-2xl"></i>
              <i className="fa-solid fa-building-columns text-2xl"></i>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">SOC2 & ISO Compliant</span>
            </div>
          </div>

          <div className="relative animate-in fade-in slide-in-from-right-8 duration-1000 delay-200">
            <div className="relative bg-white rounded-[40px] shadow-2xl border border-slate-100 p-2 overflow-hidden aspect-[4/3] group">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/5 to-transparent"></div>
              <div className="h-full bg-slate-50 rounded-[32px] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-24 h-4 bg-slate-200 rounded-full"></div>
                  <div className="flex gap-2">
                    <div className="w-4 h-4 bg-blue-100 rounded-full"></div>
                    <div className="w-4 h-4 bg-emerald-100 rounded-full"></div>
                  </div>
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100"></div>
                        <div className="space-y-1">
                          <div className="w-20 h-2 bg-slate-200 rounded-full"></div>
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full"></div>
                        </div>
                      </div>
                      <div className="w-16 h-6 bg-blue-50 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200 mt-20 py-12 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-slate-400 text-sm font-medium">© 2024 Asset Audit Pro. Local Persistent Storage Enabled.</p>
          <div className="flex gap-8 text-xs font-black uppercase tracking-widest text-slate-500">
            <a href="#" className="hover:text-blue-600 transition-colors">Support</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
