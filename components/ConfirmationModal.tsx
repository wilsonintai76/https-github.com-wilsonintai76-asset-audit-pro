
import React from 'react';
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

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
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="sm:max-w-sm rounded-3xl border-none shadow-2xl p-0 overflow-hidden bg-white">
        <div className="p-8 text-center bg-white">
          <div className={`w-16 h-16 ${iconClasses[variant]} rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl`}>
            <IconComponent className="w-8 h-8" />
          </div>
          
          <AlertDialogHeader className="space-y-2">
            <AlertDialogTitle className="text-xl font-bold text-slate-900 mx-auto text-center">{title}</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 text-sm leading-relaxed mx-auto text-center">
              {message}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex flex-col space-y-3 mt-8 sm:space-x-0">
            <AlertDialogAction 
              onClick={onConfirm}
              className={`w-full py-6 text-white font-bold rounded-2xl transition-all shadow-lg border-none ${variantClasses[variant]}`}
            >
              {confirmLabel}
            </AlertDialogAction>
            <AlertDialogCancel 
              onClick={onCancel}
              variant="outline"
              size="default"
              className="w-full py-6 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all border-none"
            >
              {cancelLabel}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};
