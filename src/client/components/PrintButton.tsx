import React from 'react';
import { Printer } from 'lucide-react';

interface PrintButtonProps {
  onClick: () => void;
  label?: string;
  title?: string;
  className?: string;
}

export const PrintButton: React.FC<PrintButtonProps> = ({
  onClick,
  label,
  title = 'Print Report',
  className = '',
}) => {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95 ${className}`}
    >
      <Printer className="w-4 h-4" />
      {label && <span>{label}</span>}
    </button>
  );
};
