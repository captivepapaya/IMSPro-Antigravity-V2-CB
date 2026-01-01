import React from 'react';
import { CsvFile } from '../types';
import { Database, Activity, Cloud } from 'lucide-react';

interface DashboardOverviewProps {
  files: CsvFile[];
  onNavigate: (view: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ files, onNavigate }) => {
  const totalSize = files.reduce((acc, file) => acc + file.size, 0) / 1024; // KB
  const hasData = files.length > 0;

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-gemini-900 to-purple-950 border border-white/10 p-8 shadow-2xl">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-white mb-2">IMS Inventory System (Cloud)</h2>
          <p className="text-gemini-200 max-w-2xl">
            Intelligent Management System powered by Gemini 2.5. Manage inventory, analyze trends, and chat with your data directly in the browser.
          </p>
        </div>
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gemini-500/10 blur-3xl rounded-full pointer-events-none"></div>
      </div>

      {/* Data Prompt - Cloud Native */}
      {!hasData && (
        <div className="bg-blue-900/10 border border-blue-700/30 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center gap-4 animate-pulse-slow">
          <div className="p-3 bg-blue-900/20 rounded-lg text-blue-400 flex-shrink-0">
             <Cloud className="w-6 h-6" />
          </div>
          <div className="flex-1">
             <h4 className="text-blue-200 font-semibold mb-1">Ready for Data</h4>
             <p className="text-sm text-blue-200/70">
               Your cloud environment is ready. Please upload your master inventory data (CSV) to begin analysis.
             </p>
          </div>
          <button 
             onClick={() => onNavigate('DATA_SOURCES')}
             className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shadow-lg shadow-blue-900/20"
          >
             Manage Data
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl border border-dark-border">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
              <Database className="w-6 h-6" />
            </div>
            <span className="text-xs font-mono text-gray-500">DATASETS</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{files.length}</div>
          <p className="text-sm text-gray-400">Files Loaded</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-dark-border">
          <div className="flex items-center justify-between mb-4">
             <div className="p-2 bg-green-500/20 rounded-lg text-green-400">
              <Activity className="w-6 h-6" />
            </div>
            <span className="text-xs font-mono text-gray-500">STATUS</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {hasData ? 'Active' : 'Waiting'}
          </div>
          <p className="text-sm text-gray-400">{hasData ? 'System Ready' : 'Data Missing'}</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-dark-border">
           <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
              <Activity className="w-6 h-6" />
            </div>
            <span className="text-xs font-mono text-gray-500">SIZE</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{totalSize.toFixed(1)} KB</div>
          <p className="text-sm text-gray-400">Browser Memory</p>
        </div>
      </div>
    </div>
  );
};