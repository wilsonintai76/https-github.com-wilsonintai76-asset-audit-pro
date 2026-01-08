
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItemProps {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${active
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      }`}
  >
    <i className={`fa-solid ${icon} ${active ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'}`}></i>
    <span className="font-semibold text-sm">{label}</span>
  </button>
);

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const userRoles = currentUser?.roles || [];
  const isAdmin = userRoles.includes('Admin');
  const isSupervisor = userRoles.includes('Supervisor');

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Content */}
      <aside className={`
        fixed top-0 left-0 h-full bg-white border-r border-slate-200 z-50 w-72 
        transition-transform duration-300 ease-in-out lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full p-6">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <i className="fa-solid fa-building-shield text-xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">Asset Audit</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Pro Edition</p>
            </div>
            <button
              onClick={onClose}
              className="ml-auto lg:hidden text-slate-400 hover:text-slate-600"
            >
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-grow space-y-2">
            <div className="px-2 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Main Menu</div>
            <NavItem
              icon="fa-chart-pie"
              label="Overview"
              active={currentPath === '/'}
              onClick={() => handleNav('/')}
            />
            <NavItem
              icon="fa-calendar-days"
              label="Audit Schedule"
              active={currentPath === '/schedule'}
              onClick={() => handleNav('/schedule')}
            />

            {(isAdmin || isSupervisor) && (
              <>
                <div className="px-2 pt-6 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Administration</div>
                <NavItem
                  icon="fa-users-gear"
                  label="Team Management"
                  active={currentPath === '/team'}
                  onClick={() => handleNav('/team')}
                />

                {isAdmin && (
                  <NavItem
                    icon="fa-sitemap"
                    label="Departments"
                    active={currentPath === '/departments'}
                    onClick={() => handleNav('/departments')}
                  />
                )}

                <NavItem
                  icon="fa-map-location-dot"
                  label="Locations"
                  active={currentPath === '/locations'}
                  onClick={() => handleNav('/locations')}
                />

                {isAdmin && (
                  <NavItem
                    icon="fa-gears"
                    label="System Settings"
                    active={currentPath === '/settings'}
                    onClick={() => handleNav('/settings')}
                  />
                )}
              </>
            )}
          </nav>

          {/* Bottom Card */}
          <div className="mt-auto pt-6">
            <div className="bg-slate-900 rounded-2xl p-4 text-white relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-xs font-medium text-slate-400 mb-1">Authenticated Session</p>
                <p className="text-sm font-bold mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-building-columns text-blue-400"></i>
                  Institutional ID
                </p>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full w-full bg-emerald-500"></div>
                </div>
                <p className="text-[10px] text-emerald-400 mt-2 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  Verified Internal Access
                </p>
              </div>
              <i className="fa-solid fa-shield-halved absolute -right-4 -bottom-4 text-white/5 text-6xl"></i>
            </div>

            <button
              onClick={logout}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-red-600 hover:border-red-100 transition-all text-sm font-semibold"
            >
              <i className="fa-solid fa-right-from-bracket"></i>
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
