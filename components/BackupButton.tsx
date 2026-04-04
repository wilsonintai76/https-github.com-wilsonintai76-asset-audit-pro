import React from 'react';
import { DatabaseBackup, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { getAuthHeaders } from '../services/honoClient';

interface BackupResult {
  success: boolean;
  rowsSync?: number;
  tablesSync?: number;
  error?: string;
}

export const BackupButton: React.FC = () => {
  const [isBackingUp, setIsBackingUp] = React.useState(false);
  const [status, setStatus] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleBackup = async () => {
    setIsBackingUp(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: await getAuthHeaders(),
      });
      const data = await res.json() as BackupResult;
      if (res.ok && data.success) {
        setStatus({ type: 'success', message: `Backed up ${data.rowsSync} rows across ${data.tablesSync} tables.` });
      } else {
        setStatus({ type: 'error', message: data.error || 'Backup failed.' });
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Network error.' });
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className="rounded-[32px] p-8 border-2 border-blue-100 bg-blue-50">
      <div className="flex items-center gap-3 mb-2">
        <DatabaseBackup className="w-5 h-5 text-blue-600" />
        <div>
          <h3 className="text-xl font-bold text-blue-900">Data Backup</h3>
          <p className="text-sm text-blue-700">
            Sync all D1 data to Supabase as a backup. Also runs automatically every day at 10:00 AM MYT.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-4">
        <button
          onClick={handleBackup}
          disabled={isBackingUp}
          className="px-6 py-3 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
        >
          {isBackingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <DatabaseBackup className="w-4 h-4" />}
          {isBackingUp ? 'Backing up...' : 'Backup Now'}
        </button>
        {status && (
          <div className={`flex items-center gap-2 text-sm font-medium ${status.type === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
            {status.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
};
