import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export const AutoUpdater: React.FC = () => {
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Current running version baked in by Vite using import.meta.env
    const currentVersion = import.meta.env.VITE_APP_VERSION;

    const checkVersion = async () => {
      try {
        // Fetch public/version.json with a cache-busting timestamp param
        const res = await fetch(`/version.json?t=${Date.now()}`);
        if (!res.ok) return;
        
        const data = await res.json();
        const deployedVersion = data.version;

        // If a new version exists on the server, prompt reload
        if (deployedVersion && deployedVersion !== currentVersion) {
            
          console.log(`New version detected: ${deployedVersion}. Current: ${currentVersion}. Refreshing...`);
          setIsUpdating(true);

          // Force a reload safely after showing loading state for 2 seconds
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      } catch (err) {
        // Silently ignore network errors to prevent annoying users if offline
        console.error('Failed to check for app updates', err);
      }
    };

    // Check version silently every 5 minutes in the background
    const intervalId = setInterval(checkVersion, 5 * 60 * 1000);

    // Actively check whenever the user brings the web app tab back into focus
    window.addEventListener('focus', checkVersion);

    // Initial check (gives Vite 2 seconds to finish hydration initially)
    setTimeout(checkVersion, 2000);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', checkVersion);
    };
  }, []);

  if (!isUpdating) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Update Installed</h3>
        <p className="text-slate-500 text-sm font-medium">A new version of the app was just deployed. Refreshing to apply changes...</p>
      </div>
    </div>
  );
};
