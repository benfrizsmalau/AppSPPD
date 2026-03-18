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

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Tooltip wrapper (for collapsed state)
// ─────────────────────────────────────────────
const Tooltip: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const [show, setShow] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 pointer-events-none"
          >
            <div className="bg-slate-900 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-xl">
              {label}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────
// Navigation config
// ─────────────────────────────────────────────
const NAV_GROUPS: NavGroup[] = [
  {
    groupLabel: 'UTAMA',
    items: [
      { label: 'Dashboard', path: '/', icon: <LayoutDashboard size={18} /> },
    ],
  },
  {
    groupLabel: 'DOKUMEN',
    items: [
      {
        label: 'SPT - Surat Perintah Tugas',
        path: '/spt',
        icon: <FileText size={18} />,
        roles: ['Admin', 'Operator', 'Pejabat'],
      },
      {
        label: 'SPPD - Perjalanan Dinas',
        path: '/sppd',
        icon: <Plane size={18} />,
        roles: ['Admin', 'Operator', 'Pejabat'],
      },
    ],
  },
  {
    groupLabel: 'DATA',
    items: [
      {
        label: 'Data Pegawai',
        path: '/pegawai',
        icon: <Users size={18} />,
        roles: ['Admin', 'Operator'],
      },
      {
        label: 'Riwayat Dokumen',
        path: '/riwayat',
        icon: <History size={18} />,
      },
      {
        label: 'Laporan & Analitik',
        path: '/laporan',
        icon: <BarChart3 size={18} />,
        roles: ['Admin', 'Operator', 'Pejabat'],
      },
    ],
  },
  {
    groupLabel: 'PENGATURAN',
    adminOnly: true,
    items: [
      {
        label: 'Pengaturan',
        path: '/settings',
        icon: <Settings size={18} />,
        roles: ['Admin', 'Operator'],
      },
      {
        label: 'Manajemen Pengguna',
        path: '/settings/users',
        icon: <UserCog size={18} />,
        roles: ['Admin'],
      },
      {
        label: 'Log Audit',
        path: '/settings/audit',
        icon: <Shield size={18} />,
        roles: ['Admin'],
      },
    ],
  },
];

// ─────────────────────────────────────────────
// Main Sidebar component
// ─────────────────────────────────────────────
const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { profile, signOut, hasRole, showSessionWarning } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Unread notification count (placeholder — wire to real data as needed)
  const unreadCount = 0;

  const handleSignOut = async () => {
    await signOut();
    navigate('/masuk');
  };

  const handleKeepSession = () => {
    // Dispatching a user activity event resets the inactivity timers in useAuth
    window.dispatchEvent(new MouseEvent('click'));
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .slice(0, 2)
      .map(n => n[0])
      .join('')
      .toUpperCase();

  const isItemActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const canViewItem = (item: NavItem): boolean => {
    if (!item.roles) return true;
    return hasRole(item.roles);
  };

  const canViewGroup = (group: NavGroup): boolean => {
    if (!group.adminOnly) return true;
    return hasRole(['Admin', 'Operator']);
  };

  // ── Sidebar width via framer-motion ──
  const sidebarWidth = collapsed ? 72 : 280;

  return (
    <>
      {/* ── Sidebar ── */}
      <motion.aside
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="sidebar-nav flex-shrink-0 overflow-hidden"
        style={{ width: sidebarWidth }}
      >
        <div className="flex flex-col h-full">

          {/* ── Logo + Toggle ── */}
          <div className="flex items-center justify-between px-4 py-5 flex-shrink-0" style={{ minHeight: 72 }}>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-2.5 overflow-hidden"
                >
                  {/* Logo icon */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-extrabold text-sm text-white"
                    style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}
                  >
                    SP
                  </div>
                  <div className="leading-none">
                    <p className="text-white font-bold text-base tracking-tight">SiSPPD</p>
                    <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest">
                      Integrated System
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {collapsed && (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm text-white mx-auto"
                style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}
              >
                SP
              </div>
            )}

            {/* Notification bell — visible only when expanded */}
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="relative ml-auto mr-2"
                >
                  <button
                    className="btn-ghost p-1.5 rounded-lg relative"
                    style={{ color: '#94a3b8' }}
                    aria-label="Notifikasi"
                  >
                    <Bell size={18} />
                    {unreadCount > 0 && (
                      <span className="notif-dot" />
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Collapse toggle */}
            <button
              onClick={onToggle}
              className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors duration-150 flex-shrink-0"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: '#94a3b8',
              }}
              aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            >
              {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </button>
          </div>

          {/* ── Navigation ── */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 no-scrollbar">
            {NAV_GROUPS.map(group => {
              if (!canViewGroup(group)) return null;
              const visibleItems = group.items.filter(canViewItem);
              if (visibleItems.length === 0) return null;

              return (
                <div key={group.groupLabel}>
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="sidebar-group-label"
                      >
                        {group.groupLabel}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {collapsed && <div className="mt-4" />}

                  <ul className="space-y-0.5">
                    {visibleItems.map(item => {
                      const active = isItemActive(item.path);
                      const linkEl = (
                        <NavLink
                          to={item.path}
                          end={item.path === '/'}
                          className={() =>
                            `sidebar-item ${active ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`
                          }
                          aria-label={item.label}
                        >
                          <span className="flex-shrink-0">{item.icon}</span>
                          <AnimatePresence>
                            {!collapsed && (
                              <motion.span
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: 'auto' }}
                                exit={{ opacity: 0, width: 0 }}
                                transition={{ duration: 0.15 }}
                                className="truncate whitespace-nowrap overflow-hidden"
                              >
                                {item.label}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </NavLink>
                      );

                      return (
                        <li key={item.path}>
                          {collapsed ? (
                            <Tooltip label={item.label}>{linkEl}</Tooltip>
                          ) : (
                            linkEl
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </nav>

          {/* ── User Profile + Logout ── */}
          <div
            className="flex-shrink-0 border-t px-3 py-4"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}
          >
            {profile && (
              <>
                {/* Avatar + info row */}
                <div className={`flex items-center gap-3 mb-3 ${collapsed ? 'justify-center' : ''}`}>
                  {/* Avatar */}
                  {collapsed ? (
                    <Tooltip label={profile.nama_lengkap}>
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 text-white cursor-default"
                        style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}
                      >
                        {getInitials(profile.nama_lengkap)}
                      </div>
                    </Tooltip>
                  ) : (
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 text-white"
                      style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}
                    >
                      {getInitials(profile.nama_lengkap)}
                    </div>
                  )}

                  <AnimatePresence>
                    {!collapsed && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex-1 min-w-0"
                      >
                        <p className="text-white text-sm font-semibold truncate leading-tight">
                          {profile.nama_lengkap}
                        </p>
                        <span className="badge badge-blue text-[10px] mt-0.5">{profile.role}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Logout button */}
                {collapsed ? (
                  <Tooltip label="Keluar">
                    <button
                      onClick={handleSignOut}
                      className="sidebar-item collapsed w-full text-rose-400 hover:text-rose-300"
                      style={{ justifyContent: 'center' }}
                      aria-label="Keluar"
                    >
                      <LogOut size={18} />
                    </button>
                  </Tooltip>
                ) : (
                  <button
                    onClick={handleSignOut}
                    className="sidebar-item w-full text-rose-400 hover:text-rose-300"
                    style={{ gap: '0.75rem' }}
                    aria-label="Keluar"
                  >
                    <LogOut size={18} className="flex-shrink-0" />
                    <span className="text-sm font-medium">Keluar</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </motion.aside>

      {/* ── Inactivity / Session Warning Modal ── */}
      <AnimatePresence>
        {showSessionWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-backdrop"
            style={{ zIndex: 9999 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="modal-panel modal-sm"
            >
              <div className="modal-header">
                <h2 className="modal-title">Sesi Akan Berakhir</h2>
              </div>
              <div className="modal-body">
                <p className="text-slate-600 text-sm">
                  Sesi Anda akan berakhir dalam <span className="font-semibold text-amber-600">5 menit</span> karena
                  tidak ada aktivitas. Apakah Anda ingin tetap login?
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn-ghost" onClick={handleSignOut}>
                  Keluar
                </button>
                <button className="btn-primary" onClick={handleKeepSession}>
                  Tetap Login
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
