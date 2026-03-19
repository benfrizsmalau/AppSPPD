// =================================================================
// SiSPPD v2.1 — Sidebar (Module 15)
// =================================================================
import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FileText,
  Plane,
  Users,
  History,
  BarChart3,
  Settings,
  UserCog,
  Shield,
  ChevronLeft,
  ChevronRight,
  Bell,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles?: ('Admin' | 'Operator' | 'Pejabat' | 'Pegawai')[];
}

interface NavGroup {
  groupLabel: string;
  items: NavItem[];
  adminOnly?: boolean;
}

const Tooltip: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 pointer-events-none"
          >
            <div className="bg-slate-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap shadow-xl border border-white/10 uppercase tracking-wider">
              {label}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const NAV_GROUPS: NavGroup[] = [
  { groupLabel: 'Utama', items: [{ label: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> }] },
  {
    groupLabel: 'Dokumen',
    items: [
      { label: 'SPT - Tugas', path: '/spt', icon: <FileText size={20} />, roles: ['Admin', 'Operator', 'Pejabat'] },
      { label: 'SPPD - Dinas', path: '/sppd', icon: <Plane size={20} />, roles: ['Admin', 'Operator', 'Pejabat'] },
    ],
  },
  {
    groupLabel: 'Data & Laporan',
    items: [
      { label: 'Data Pegawai', path: '/pegawai', icon: <Users size={20} />, roles: ['Admin', 'Operator'] },
      { label: 'Riwayat SPT/SPPD', path: '/riwayat', icon: <History size={20} /> },
      { label: 'Statistik Analitik', path: '/laporan', icon: <BarChart3 size={20} />, roles: ['Admin', 'Operator', 'Pejabat'] },
    ],
  },
  {
    groupLabel: 'Sistem',
    adminOnly: true,
    items: [
      { label: 'Konfigurasi', path: '/settings', icon: <Settings size={20} />, roles: ['Admin', 'Operator'] },
      { label: 'Manajemen User', path: '/settings/users', icon: <UserCog size={20} />, roles: ['Admin'] },
      { label: 'Audit Trail', path: '/settings/audit', icon: <Shield size={20} />, roles: ['Admin'] },
    ],
  },
];

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { profile, signOut, hasRole, showSessionWarning } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/masuk');
  };

  const getInitials = (name: string) => name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  const isItemActive = (path: string) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path));
  const canViewItem = (item: NavItem) => !item.roles || hasRole(item.roles);
  const canViewGroup = (group: NavGroup) => !group.adminOnly || hasRole(['Admin', 'Operator']);

  const sidebarWidth = collapsed ? 80 : 280;

  return (
    <>
      <motion.aside
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="sidebar-nav"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-5 h-24 flex-shrink-0">
            <AnimatePresence mode="wait">
              {!collapsed ? (
                <motion.div
                  key="full-logo"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-center gap-3 overflow-hidden"
                >
                  <div className="sidebar-logo-glow">SP</div>
                  <div className="leading-tight">
                    <h2 className="text-white font-black text-lg tracking-tight">SiSPPD</h2>
                    <p className="text-blue-500/80 text-[9px] font-black uppercase tracking-[0.15em]">Versi 2.1.0</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="mini-logo"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="mx-auto flex flex-col items-center gap-4"
                >
                  <div className="sidebar-logo-glow w-9 h-9 text-xs">SP</div>
                  <button 
                    onClick={onToggle}
                    className="w-10 h-10 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all shadow-lg"
                    aria-label="Expand Sidebar"
                  >
                    <ChevronRight size={18} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            
            {!collapsed && (
              <button 
                onClick={onToggle}
                className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all"
                aria-label="Collapse Sidebar"
              >
                <ChevronLeft size={16} />
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto no-scrollbar py-4">
            {NAV_GROUPS.map(group => {
              if (!canViewGroup(group)) return null;
              const visibleItems = group.items.filter(canViewItem);
              if (visibleItems.length === 0) return null;

              return (
                <div key={group.groupLabel} className="mb-6">
                  {!collapsed && <p className="sidebar-group-label">{group.groupLabel}</p>}
                  <div className="px-3 space-y-1">
                    {visibleItems.map(item => {
                      const active = isItemActive(item.path);
                      const linkEl = (
                        <NavLink
                          to={item.path}
                          end={item.path === '/'}
                          className={`sidebar-item ${active ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`}
                        >
                          <span className={`${active ? 'text-white' : 'text-slate-500'} group-hover:text-white transition-colors`}>
                            {item.icon}
                          </span>
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </NavLink>
                      );
                      return <div key={item.path}>{collapsed ? <Tooltip label={item.label}>{linkEl}</Tooltip> : linkEl}</div>;
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Footer / Profile */}
          <div className="p-4 border-t border-slate-800/50 bg-slate-900/50">
            <div className="space-y-4">
              {profile && (
                <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white font-bold text-sm border border-white/5 shadow-inner">
                    {getInitials(profile.nama_lengkap)}
                  </div>
                  {!collapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-bold truncate">{profile.nama_lengkap}</p>
                      <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{profile.role}</p>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={handleSignOut}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all duration-300 ${collapsed ? 'justify-center px-0' : ''}`}
              >
                <LogOut size={16} />
                {!collapsed && <span>Keluar Sistem</span>}
              </button>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Session Warning */}
      <AnimatePresence>
        {showSessionWarning && (
          <div className="modal-backdrop z-[9999]">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="modal-panel modal-sm">
              <div className="modal-header">
                <h2 className="modal-title flex items-center gap-2"><Bell className="text-amber-500" size={18} /> Sesi Hampir Berakhir</h2>
              </div>
              <div className="modal-body">
                <p className="text-slate-600 text-sm">Anda telah tidak aktif selama beberapa waktu. Sesi akan berakhir dalam <span className="font-bold text-rose-500">5 menit</span>.</p>
              </div>
              <div className="modal-footer">
                <button className="btn-ghost" onClick={handleSignOut}>Keluar</button>
                <button className="btn-primary" onClick={() => window.dispatchEvent(new MouseEvent('click'))}>Lanjutkan Sesi</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
