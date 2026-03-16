import React from 'react';
import { X } from 'lucide-react';

interface LocationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const LocationFormModal: React.FC<LocationFormModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative z-10 p-6 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
