
import React, { useState, useEffect, useMemo } from 'react';
import { AppView } from '../types';
import {
  Database, Settings, Package, ChevronLeft, ChevronRight,
  CreditCard, ClipboardList, Camera, Image, ScanBarcode, Share2,
  Globe, LineChart, ShoppingCart, Aperture,
  List, Factory, Truck, Import, PlusCircle, LayoutGrid, BrainCircuit, Maximize2, Minimize2, Wand2
} from 'lucide-react';

// --- CONFIGURATION ---

export interface NavItem {
  id: string;
  label: string;
  icon: any;
  color: string; // Tailwind color class base (e.g., 'blue', 'purple')
  view?: AppView;
  children?: NavItem[];
}

export const NAV_STRUCTURE: NavItem[] = [
  {
    id: 'sales_ops',
    label: 'Sales',
    icon: ShoppingCart,
    color: 'blue',
    children: [
      { id: AppView.PRODUCT_DETAILS, view: AppView.PRODUCT_DETAILS, label: 'POS Terminal', icon: CreditCard, color: 'blue' },
      { id: AppView.ORDERS, view: AppView.ORDERS, label: 'Order Review', icon: ClipboardList, color: 'blue' },
      { id: AppView.AI_TERMINAL, view: AppView.AI_TERMINAL, label: 'AI Terminal', icon: BrainCircuit, color: 'blue' },
    ]
  },
  {
    id: 'inventory_mgt',
    label: 'Inventory',
    icon: Package,
    color: 'purple',
    children: [
      { id: AppView.INVENTORY, view: AppView.INVENTORY, label: 'Product List', icon: List, color: 'purple' },
      { id: AppView.ADD_PRODUCT, view: AppView.ADD_PRODUCT, label: 'New Product', icon: PlusCircle, color: 'purple' },
      { id: AppView.ADD_PRODUCT_QUEUE, view: AppView.ADD_PRODUCT_QUEUE, label: 'New Product Queue', icon: ClipboardList, color: 'purple' },
      { id: AppView.MANUFACTURING, view: AppView.MANUFACTURING, label: 'Manufacturing', icon: Factory, color: 'purple' },
      { id: AppView.BARCODE_PRINT, view: AppView.BARCODE_PRINT, label: 'Print Labels', icon: ScanBarcode, color: 'purple' },
      { id: AppView.IMAGE_CHECK, view: AppView.IMAGE_CHECK, label: 'Image DB', icon: Image, color: 'purple' },
      { id: AppView.DATA_SOURCES, view: AppView.DATA_SOURCES, label: 'Data Sources', icon: Database, color: 'purple' },
    ]
  },
  {
    id: 'purchasing',
    label: 'Purchasing',
    icon: Truck,
    color: 'orange',
    children: [
      { id: AppView.VENDOR_REVIEW, view: AppView.VENDOR_REVIEW, label: 'Vendor Review', icon: ClipboardList, color: 'orange' },
      { id: AppView.PO_IMPORT, view: AppView.PO_IMPORT, label: 'PO Import', icon: Import, color: 'orange' },
    ]
  },
  {
    id: 'website',
    label: 'Website',
    icon: Globe,
    color: 'green',
    children: [
      { id: AppView.PRODUCT_REVIEW_QUEUE, view: AppView.PRODUCT_REVIEW_QUEUE, label: 'Product Review Queue', icon: LayoutGrid, color: 'green' },
      { id: AppView.SEO, view: AppView.SEO, label: 'SEO Dashboard', icon: LineChart, color: 'green' },
    ]
  },
  {
    id: 'studio_mkt',
    label: 'Studio',
    icon: Aperture,
    color: 'pink',
    children: [
      { id: AppView.VCA_AGENT, view: AppView.VCA_AGENT, label: 'Visual Agent', icon: Wand2, color: 'pink' },
      { id: AppView.CAMERA_LAB, view: AppView.CAMERA_LAB, label: 'Camera Lab', icon: Camera, color: 'pink' },
      { id: AppView.SOCIAL_MEDIA, view: AppView.SOCIAL_MEDIA, label: 'Social Media', icon: Share2, color: 'pink' },
    ]
  },
  {
    id: 'system',
    label: 'System',
    icon: Settings,
    color: 'gray',
    children: [
      { id: AppView.SETTINGS, view: AppView.SETTINGS, label: 'Settings', icon: Settings, color: 'gray' },
      { id: AppView.AI_SETTINGS, view: AppView.AI_SETTINGS, label: 'AI Settings', icon: BrainCircuit, color: 'gray' },
    ]
  }
];

// Flat list for checking permissions in App.tsx
export const SIDEBAR_CONFIG = NAV_STRUCTURE.flatMap(group =>
  group.children ? group.children.map(child => ({ ...child, id: child.view || child.id })) : []
);

// --- COLOR MAPS ---
const COLOR_VARIANTS: Record<string, any> = {
  blue: { activeBg: 'bg-blue-600', text: 'text-blue-400', border: 'border-blue-500', softBg: 'bg-blue-500/10' },
  purple: { activeBg: 'bg-purple-600', text: 'text-purple-400', border: 'border-purple-500', softBg: 'bg-purple-500/10' },
  orange: { activeBg: 'bg-orange-600', text: 'text-orange-400', border: 'border-orange-500', softBg: 'bg-orange-500/10' },
  green: { activeBg: 'bg-green-600', text: 'text-green-400', border: 'border-green-500', softBg: 'bg-green-500/10' },
  pink: { activeBg: 'bg-pink-600', text: 'text-pink-400', border: 'border-pink-500', softBg: 'bg-pink-500/10' },
  gray: { activeBg: 'bg-gray-600', text: 'text-gray-400', border: 'border-gray-500', softBg: 'bg-gray-500/10' },
};

interface SidebarProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  fileCount: number;
  visibleViews: Record<string, boolean>;
  logoUrl?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, fileCount, visibleViews, logoUrl }) => {
  // Is the secondary panel (Level 2) visible pinned?
  const [isPanelPinned, setIsPanelPinned] = useState(true);

  // Which main group is currently selected (Level 1)
  const [activeGroupId, setActiveGroupId] = useState<string>('sales_ops');

  // Timer ref for auto-collapse
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsPanelPinned(true);
  };

  const handleMouseLeave = () => {
    timerRef.current = setTimeout(() => {
      setIsPanelPinned(false);
    }, 3000);
  };

  // Auto-select group and briefly show panel on view change
  useEffect(() => {
    const group = NAV_STRUCTURE.find(g => g.children?.some(c => c.view === currentView));
    if (group) setActiveGroupId(group.id);

    // Ensure panel is visible when navigating
    setIsPanelPinned(true);

    // Restart auto-hide timer if mouse isn't hovering (simulated by just setting it, 
    // expecting mouseEnter to clear it if user interacts)
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsPanelPinned(false);
    }, 3000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentView]);

  const activeGroup = useMemo(() => NAV_STRUCTURE.find(g => g.id === activeGroupId), [activeGroupId]);
  const activeColors = COLOR_VARIANTS[activeGroup?.color || 'gray'];
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => console.log(e));
    } else {
      document.exitFullscreen().catch(e => console.log(e));
    }
  };

  const handleGroupClick = (groupId: string) => {
    setActiveGroupId(groupId);
    // Expand on click
    setIsPanelPinned(true);
  };

  return (
    <div
      className="flex h-screen z-50 shadow-2xl"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >

      {/* === COLUMN 1: RAIL (Level 1 Categories) === */}
      <div className="w-[72px] bg-[#050b14] border-r border-white/5 flex flex-col items-center py-4 gap-4 z-20 flex-shrink-0">

        {/* Logo Area */}
        <div className="mb-2">
          {logoUrl ? (
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/5 p-1 border border-white/10">
              <img src={logoUrl} className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-gemini-500 to-gemini-700 rounded-xl flex items-center justify-center shadow-lg shadow-gemini-500/20">
              <span className="font-bold text-white text-xl">G</span>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="w-8 h-px bg-white/10 mb-2"></div>

        {/* Level 1 Icons */}
        <div className="flex-1 flex flex-col gap-3 w-full px-2">
          {NAV_STRUCTURE.map(group => {
            const isActive = activeGroupId === group.id;
            const colors = COLOR_VARIANTS[group.color];

            return (
              <button
                key={group.id}
                onClick={() => handleGroupClick(group.id)}
                className={`group relative w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-300 ${isActive
                  ? `${colors.softBg} ${colors.text}`
                  : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                  }`}
                title={group.label}
              >
                {/* Active Indicator Bar (Left) */}
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full transition-all duration-300 ${isActive ? `bg-current opacity-100` : 'opacity-0 h-0'}`} />

                <group.icon className={`w-6 h-6 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />

                {/* Tooltip on Hover (only relevant if not obvious) */}
                <div className="absolute left-full ml-3 px-2 py-1 bg-gray-900 text-white text-xs rounded border border-white/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  {group.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* System Status Footer & Fullscreen */}
        <div className="mt-auto flex flex-col items-center gap-3">
          <button
            onClick={toggleFullscreen}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <div className="w-8 h-px bg-white/10"></div>
          <div className="relative group cursor-help">
            <div className={`w-3 h-3 rounded-full ${fileCount > 0 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></div>
            <div className="absolute left-full ml-3 bottom-0 w-max px-3 py-2 bg-gray-900 border border-white/10 rounded-lg text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <p className="font-bold text-white mb-1">System Status</p>
              <p>DB: {fileCount > 0 ? 'Connected' : 'Offline'}</p>
              <p>Files: {fileCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* === COLUMN 2: DRAWER (Level 2 Sub-items) === */}
      <div
        className={`bg-dark-surface border-r border-dark-border flex flex-col transition-all duration-300 overflow-hidden ${isPanelPinned ? 'w-56 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-4'
          }`}
      >
        {/* Drawer Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-dark-border flex-shrink-0">
          <span className={`font-bold text-lg tracking-wide ${activeColors.text}`}>
            {activeGroup?.label}
          </span>
          <button
            onClick={() => setIsPanelPinned(false)}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            title="Collapse Panel"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Content (List) */}
        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          <div className="space-y-1">
            {activeGroup?.children?.map(item => {
              if (item.view && visibleViews[item.view] === false) return null;

              const isActive = currentView === item.view;

              return (
                <button
                  key={item.id}
                  onClick={() => item.view && onChangeView(item.view)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all group ${isActive
                    ? `${activeColors.activeBg} text-white shadow-md`
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                    }`}
                >
                  <item.icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`} />
                  <span className="truncate">{item.label}</span>

                  {/* Count Badge for Data Sources */}
                  {item.view === AppView.DATA_SOURCES && fileCount > 0 && (
                    <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-400'}`}>
                      {fileCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Expand Button (Only visible when panel is collapsed) */}
      {!isPanelPinned && (
        <div className="absolute left-[72px] top-4 z-10 animate-in fade-in duration-300">
          <button
            onClick={() => setIsPanelPinned(true)}
            className="p-1 bg-dark-surface border border-dark-border rounded-r-lg text-gray-400 hover:text-white shadow-lg"
            title="Expand Menu"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

    </div>
  );
};
