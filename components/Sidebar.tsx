import React from 'react';
import { HistoryItem } from '../types';
import { FileClock, PlusCircle, Settings, Table2, Trash2, X } from 'lucide-react';

interface SidebarProps {
  history: HistoryItem[];
  onNewUpload: () => void;
  onSelectHistory: (id: string) => void;
  onDeleteHistory: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  history, 
  onNewUpload, 
  onSelectHistory, 
  onDeleteHistory,
  isOpen,
  onClose
}) => {
  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-brand-900/20 backdrop-blur-sm z-40 transition-opacity duration-300 no-print ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div 
        className={`
          fixed inset-y-0 left-0 z-50 w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-out flex flex-col h-full no-print
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="p-6 border-b border-brand-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand-900 rounded-lg flex items-center justify-center text-white">
                <Table2 size={18} />
              </div>
              <span className="font-bold text-lg tracking-tight text-brand-900">TableGenius</span>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-brand-400 hover:text-brand-900 hover:bg-brand-50 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <button
            onClick={() => {
              onNewUpload();
              onClose();
            }}
            className="w-full bg-brand-900 hover:bg-brand-800 text-white py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 shadow-sm"
          >
            <PlusCircle size={18} />
            <span className="font-medium">New Conversion</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-xs font-bold text-brand-400 uppercase tracking-wider mb-4 px-2">
            Recent History
          </div>
          
          <div className="space-y-1">
            {history.length === 0 ? (
              <div className="text-center py-8 text-brand-300 text-sm italic">
                No history yet.
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center w-full p-3 rounded-lg hover:bg-brand-50 transition-colors duration-150 cursor-pointer"
                  onClick={() => {
                    onSelectHistory(item.id);
                    onClose();
                  }}
                >
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    <FileClock className="text-brand-300 group-hover:text-brand-600 shrink-0" size={16} />
                    <div className="overflow-hidden">
                      <div className="text-sm font-semibold text-brand-700 truncate">
                        {item.fileName}
                      </div>
                      <div className="text-xs text-brand-400">
                        {item.date} • {item.rowCount} rows
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      onDeleteHistory(item.id); 
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-brand-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                    title="Remove from history"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-4 border-t border-brand-100 bg-brand-50/50">
          <button className="flex items-center gap-3 p-3 text-brand-500 hover:text-brand-900 hover:bg-white rounded-lg transition-all w-full">
            <Settings size={18} />
            <span className="text-sm font-medium">Settings</span>
          </button>
        </div>
      </div>
    </>
  );
};