
import React, { useState } from 'react';
import { Network, Shield, Rocket, GitBranch, Calendar, Shuffle, UserRoundPen, BarChart3, Contact, CheckCircle2, XCircle, Flag } from 'lucide-react';

type Tab = 'workflow' | 'roles' | 'setup';

export const GuideView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('workflow');

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="max-w-xl">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">System Knowledge Base</h2>
        <p className="text-slate-500 text-lg mt-1">Institutional standard procedures, role hierarchies, and setup workflows.</p>
      </div>

      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-fit">
        {[
          { id: 'workflow', label: 'Audit Workflow', icon: Network },
          { id: 'roles', label: 'Access Roles', icon: Shield },
          { id: 'setup', label: 'Setup Guide', icon: Rocket }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === tab.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm p-8 md:p-12">
        {activeTab === 'workflow' && (
          <div className="animate-in fade-in duration-300">
            <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm">
                <GitBranch className="w-5 h-5" />
              </div>
              The Pro Audit Lifecycle
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { step: "01", title: "Setup Phases", desc: "Admins define temporal windows. All schedules are locked to these phases to ensure seasonal compliance.", icon: Calendar, color: "bg-blue-600" },
                { step: "02", title: "Pairing Logic", desc: "The Matrix Engine maps departments. It strictly prohibits JKE from auditing JKE, enforcing total neutrality.", icon: Shuffle, color: "bg-indigo-600" },
                { step: "03", title: "Self-Assignment", desc: "Certified auditors log in and claim open slots. Credentials are validated in real-time before assignment.", icon: UserRoundPen, color: "bg-emerald-600" },
                { step: "04", title: "KPI Reports", desc: "Completion rates are tracked by asset tier. Get visibility into high-risk, low-compliance zones instantly.", icon: BarChart3, color: "bg-rose-600" }
              ].map((item, i) => (
                <div key={i} className="relative p-6 rounded-3xl border border-slate-100 bg-slate-50/30">
                  <div className={`w-12 h-12 ${item.color} text-white rounded-2xl flex items-center justify-center text-xl mb-4 shadow-lg shadow-current/20`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Step {item.step}</div>
                  <h4 className="text-lg font-black text-slate-900 mb-3">{item.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'roles' && (
          <div className="animate-in fade-in duration-300">
            <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-sm">
                <Contact className="w-5 h-5" />
              </div>
              Access Control Matrix
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Functionality</th>
                    <th className="pb-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Admin</th>
                    <th className="pb-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Coordinator</th>
                    <th className="pb-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Auditor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[
                    { feature: 'Define Audit Phases', admin: true, coord: true, auditor: false },
                    { feature: 'Issue Staff Certificates', admin: true, coord: false, auditor: false },
                    { feature: 'Generate Audit Matrix', admin: true, coord: false, auditor: false },
                    { feature: 'Self-Assign to Slots', admin: true, coord: true, auditor: true },
                    { feature: 'Complete Audit Status', admin: true, coord: true, auditor: true },
                    { feature: 'Manage Site Locations', admin: true, coord: true, auditor: false },
                    { feature: 'View KPI Trends', admin: true, coord: true, auditor: true }
                  ].map((row, i) => (
                    <tr key={i}>
                      <td className="py-5 text-sm font-bold text-slate-700">{row.feature}</td>
                      <td className="py-5 text-center">
                        {row.admin ? <CheckCircle2 className="w-5 h-5 text-blue-500 mx-auto" /> : <XCircle className="w-5 h-5 text-slate-200 mx-auto" />}
                      </td>
                      <td className="py-5 text-center">
                        {row.coord ? <CheckCircle2 className="w-5 h-5 text-blue-500 mx-auto" /> : <XCircle className="w-5 h-5 text-slate-200 mx-auto" />}
                      </td>
                      <td className="py-5 text-center">
                        {row.auditor ? <CheckCircle2 className="w-5 h-5 text-blue-500 mx-auto" /> : <XCircle className="w-5 h-5 text-slate-200 mx-auto" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'setup' && (
          <div className="animate-in fade-in duration-300">
            <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm">
                <Flag className="w-5 h-5" />
              </div>
              Onboarding Checklist
            </h3>
            <div className="space-y-4 max-w-2xl">
              {[
                { step: "01", title: "Onboard Departments", desc: "Define your units (JKE, Kamsis, etc) and their base asset counts in the Departments tab." },
                { step: "02", title: "Map Locations", desc: "Identify every lab, block, and room requiring inspection in the Locations registry." },
                { step: "03", title: "Authorize Auditors", desc: "Go to Team Mgmt and issue certificates. No cert means no self-assignment capability." },
                { step: "04", title: "Activate Phases", desc: "Set the start/end dates in System Settings. This opens the gate for scheduling." },
                { step: "05", title: "Generate Matrix", desc: "Run the optimization engine in Settings to pair departments and prevent conflicts." }
              ].map((item, i) => (
                <div key={i} className="flex gap-6 p-6 rounded-3xl border border-slate-100 bg-slate-50/30 group hover:border-emerald-200 transition-colors">
                  <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center text-sm font-black shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                    {item.step}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 mb-1">{item.title}</h4>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
