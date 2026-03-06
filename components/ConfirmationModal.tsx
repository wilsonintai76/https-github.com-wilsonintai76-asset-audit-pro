
import React from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  const variantClasses = {
    danger: 'bg-red-600 hover:bg-red-700 shadow-red-500/20',
    warning: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20',
    info: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
  };

  const iconClasses = {
    danger: 'text-red-500 bg-red-50',
    warning: 'text-amber-500 bg-amber-50',
    info: 'text-blue-500 bg-blue-50'
  };

  const IconComponent = {
    danger: AlertTriangle,
    warning: AlertCircle,
    info: Info
  }[variant];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={onCancel}
      ></div>
      <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
        <div className="p-8 text-center">
          <div className={`w-16 h-16 ${iconClasses[variant]} rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl`}>
            <IconComponent className="w-8 h-8" />
          </div>
          
          <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
          <p className="text-slate-500 text-sm leading-relaxed mb-8">
            {message}
          </p>

          <div className="space-y-3">
            <button 
              onClick={onConfirm}
              className={`w-full py-3.5 text-white font-bold rounded-2xl transition-all shadow-lg ${variantClasses[variant]}`}
            >
              {confirmLabel}
            </button>
            <button 
              onClick={onCancel}
              className="w-full py-3.5 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
