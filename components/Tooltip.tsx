import React from 'react';
import { Info, X } from 'lucide-react';

interface TooltipProps {
  content: string;
  onClose: () => void;
  visible: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, onClose, visible }) => {
  if (!visible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm animate-fade-in-down">
      <div className="bg-slate-800/90 backdrop-blur-md border border-violet-500/30 text-slate-100 p-4 rounded-xl shadow-2xl flex items-start gap-3">
        <div className="bg-violet-500/20 p-2 rounded-lg shrink-0">
          <Info className="w-5 h-5 text-violet-300" />
        </div>
        <div className="flex-1 text-sm leading-relaxed">
          <h4 className="font-bold text-violet-300 mb-1">Art Theory</h4>
          {content}
        </div>
        <button 
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};