
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { Sidebar } from './components/Sidebar';
import { NotificationCenter } from './components/NotificationCenter';
import { LandingPage } from './components/LandingPage';
import { OverviewDashboard } from './components/OverviewDashboard';
import { AuditTable } from './components/AuditTable';
import { TeamManagement } from './components/TeamManagement';
import { DepartmentManagement } from './components/DepartmentManagement';
import { LocationManagement } from './components/LocationManagement';
import { SystemSettings } from './components/SystemSettings';
import { useData } from './contexts/DataContext';

// Layout Component for Authenticated Users
const MainLayout: React.FC = () => {
  const { currentUser } = useAuth();
  const { notifications, markNotificationAsRead, clearNotifications } = useData();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const location = useLocation();

  if (!currentUser) return <Navigate to="/login" replace />;

  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case '/dashboard': return 'Overview Dashboard';
      case '/schedule': return 'Audit Schedule';
      case '/team': return 'Team Management';
      case '/departments': return 'Department Management';
      case '/locations': return 'Location Management';
      case '/settings': return 'System Configuration';
      default: return 'Asset Audit Pro';
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 animate-in fade-in duration-700">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      // Sidebar handles its own active state via router
      />

      <div className="flex-grow lg:pl-72 flex flex-col min-h-screen w-full">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between gap-3 md:gap-4">
          <div className="flex items-center gap-3 md:gap-4 shrink-0">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 active:bg-slate-200">
              <i className="fa-solid fa-bars"></i>
            </button>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <h1 className="text-base md:text-lg font-bold text-slate-900 capitalize leading-none">
                  {getPageTitle(location.pathname)}
                </h1>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-[8px] md:text-[9px] text-blue-600 font-black uppercase border border-blue-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                  Local Session Active
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Institutional Environment</p>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-4 flex-grow justify-end">
            <div className="flex items-center gap-3 md:gap-4 pl-3 md:pl-4 border-l border-slate-200 shrink-0">
              <NotificationCenter
                notifications={notifications}
                onMarkAsRead={markNotificationAsRead}
                onClearAll={clearNotifications}
              />
              <div className="flex items-center gap-2 md:gap-3">
                <div className="text-right hidden md:block">
                  <div className="text-sm font-bold text-slate-900 leading-none mb-1">{currentUser.name}</div>
                  <div className="text-[9px] text-blue-600 font-black uppercase tracking-widest">{currentUser.roles.join(' & ')}</div>
                </div>
                {currentUser.picture ? <img src={currentUser.picture} className="w-9 h-9 md:w-10 md:h-10 rounded-xl border-2 border-white shadow-sm shrink-0" alt="profile" /> :
                  <div className="w-9 h-9 md:w-10 md:h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold border-2 border-white shadow-sm shrink-0">{currentUser.name[0]}</div>}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-grow p-4 md:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

// Route Guard
const RequireAuth: React.FC<{ children: JSX.Element }> = ({ children }) => {
  const { currentUser, hasStarted } = useAuth();

  if (!hasStarted) {
    // Loading state or just redirect to login if session check done
    // AuthContext initializes hasStarted=false, then affects logic.
    // If hasStarted is true but currentUser is null -> Login.
    // If hasStarted is false -> Wait?
    // AuthContext useEffect sets hasStarted=true after checking local storage.
    // So we wait for hasStarted to be true.
    return null; // Or a loading spinner
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Redirect to dashboard if already logged in
const RedirectIfAuth: React.FC<{ children: JSX.Element }> = ({ children }) => {
  const { currentUser, hasStarted } = useAuth();
  if (hasStarted && currentUser) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

const AppRoutes = () => {
  const { hasStarted } = useAuth();

  if (!hasStarted) return null; // Initial loading

  return (
    <Routes>
      <Route path="/login" element={
        <RedirectIfAuth>
          <LandingPage />
        </RedirectIfAuth>
      } />

      <Route element={
        <RequireAuth>
          <MainLayout />
        </RequireAuth>
      }>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<OverviewDashboard />} />
        <Route path="/schedule" element={<AuditTable />} />
        <Route path="/team" element={<TeamManagement />} />
        <Route path="/departments" element={<DepartmentManagement />} />
        <Route path="/locations" element={<LocationManagement />} />
        <Route path="/settings" element={<SystemSettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <DataProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </DataProvider>
    </AuthProvider>
  );
};

export default App;
