import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard,
  FileText,
  ChevronDown,
  BarChart3,
  Database,
  LogOut,
  Settings as SettingsIcon
} from 'lucide-react';

const Sidebar: React.FC = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [openMenus, setOpenMenus] = React.useState<string[]>(['dokumentasi']);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const toggleMenu = (menu: string) => {
    setOpenMenus(prev =>
      prev.includes(menu) ? prev.filter(m => m !== menu) : [...prev, menu]
    );
  };

  const isAdmin = profile?.role === 'Admin';
  const isOperator = profile?.role === 'Operator';
  const isPejabat = profile?.role === 'Pejabat';

  return (
    <aside className="sidebar glass-effect">
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-box">SP</div>
          <div className="logo-text-group">
            <span className="logo-text">SiSPPD</span>
            <span className="logo-subtext">Integrated System</span>
          </div>
        </div>
      </div>

      <div className="sidebar-user">
        <div className="user-avatar-glow">
          <div className="user-avatar">
            {profile?.nama_lengkap?.charAt(0) || 'U'}
          </div>
        </div>
        <div className="user-info">
          <p className="user-name">{profile?.nama_lengkap || 'User'}</p>
          <p className="user-role-badge">{profile?.role || 'Guest'}</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>

        <div className="nav-group">
          <button className="nav-group-header" onClick={() => toggleMenu('dokumentasi')}>
            <div className="header-left">
              <FileText size={20} />
              <span>Dokumentasi</span>
            </div>
            <ChevronDown size={14} className={`chevron ${openMenus.includes('dokumentasi') ? 'open' : ''}`} />
          </button>

          {openMenus.includes('dokumentasi') && (
            <div className="nav-group-items">
              {(isAdmin || isOperator || isPejabat) && (
                <NavLink to="/spt" className={({ isActive }) => `sub-nav-link ${isActive ? 'active' : ''}`}>
                  <span>Modul SPT</span>
                </NavLink>
              )}
              {(isAdmin || isOperator || isPejabat) && (
                <NavLink to="/sppd" className={({ isActive }) => `sub-nav-link ${isActive ? 'active' : ''}`}>
                  <span>Modul SPPD</span>
                </NavLink>
              )}
              {(isAdmin || isOperator || isPejabat) && (
                <NavLink to="/riwayat" className={({ isActive }) => `sub-nav-link ${isActive ? 'active' : ''}`}>
                  <span>Riwayat Arsip</span>
                </NavLink>
              )}
            </div>
          )}
        </div>

        {(isAdmin || isOperator || isPejabat) && (
          <NavLink to="/laporan" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <BarChart3 size={20} />
            <span>Laporan & Rekap</span>
          </NavLink>
        )}

        <div className="nav-group">
          <button className="nav-group-header" onClick={() => toggleMenu('master')}>
            <div className="header-left">
              <Database size={20} />
              <span>Master Data</span>
            </div>
            <ChevronDown size={14} className={`chevron ${openMenus.includes('master') ? 'open' : ''}`} />
          </button>

          {openMenus.includes('master') && (
            <div className="nav-group-items">
              {(isAdmin || isOperator) && (
                <NavLink to="/pegawai" className={({ isActive }) => `sub-nav-link ${isActive ? 'active' : ''}`}>
                  <span>Data Pegawai</span>
                </NavLink>
              )}
            </div>
          )}
        </div>

        {(isAdmin || isOperator) && (
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <SettingsIcon size={20} />
            <span>Pengaturan</span>
          </NavLink>
        )}
      </nav>

      <div className="sidebar-footer">
        <button onClick={handleSignOut} className="btn-logout">
          <div className="logout-icon-bg">
            <LogOut size={18} />
          </div>
          <span>Keluar Sesi</span>
        </button>
      </div>

      <style>{`
        .sidebar {
          width: 280px;
          height: 100vh;
          display: flex;
          flex-direction: column;
          position: fixed;
          left: 0;
          top: 0;
          z-index: 100;
          border-right: 1px solid var(--p-border);
        }
        .sidebar-header {
          padding: 32px 24px;
        }
        .logo-container {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .logo-box {
          width: 42px;
          height: 42px;
          background: var(--p-primary);
          border-radius: 12px;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 16px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);
        }
        .logo-text-group {
          display: flex;
          flex-direction: column;
        }
        .logo-text {
          font-family: var(--font-heading);
          font-size: 22px;
          font-weight: 800;
          color: var(--p-primary);
          letter-spacing: -1px;
          line-height: 1;
        }
        .logo-subtext {
          font-size: 10px;
          font-weight: 600;
          color: var(--p-text-muted);
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .sidebar-user {
          margin: 0 20px 32px;
          padding: 20px;
          background: white;
          border-radius: var(--radius-p);
          border: 1px solid var(--p-border);
          display: flex;
          align-items: center;
          gap: 14px;
          box-shadow: var(--shadow-p);
        }
        .user-avatar-glow {
          padding: 3px;
          background: linear-gradient(135deg, var(--p-accent), var(--p-accent-deep));
          border-radius: 50%;
        }
        .user-avatar {
          width: 44px;
          height: 44px;
          background: white;
          color: var(--p-primary);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 18px;
        }
        .user-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .user-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--p-text-main);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 130px;
        }
        .user-role-badge {
          font-size: 10px;
          font-weight: 700;
          color: var(--p-accent);
          background: #eff6ff;
          padding: 2px 8px;
          border-radius: 4px;
          display: inline-block;
          width: fit-content;
          text-transform: uppercase;
        }
        .sidebar-nav {
          flex: 1;
          padding: 0 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .nav-label {
          font-size: 11px;
          font-weight: 800;
          color: var(--p-text-muted);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 20px 12px 8px;
        }
        .nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          color: var(--p-text-muted);
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
          border-radius: 10px;
          transition: var(--transition-p);
        }
        .nav-link:hover {
          background: #f1f5f9;
          color: var(--p-primary);
          padding-left: 20px;
        }
        .nav-link.active {
          background: var(--p-primary);
          color: white;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
        }
        .sidebar-footer {
          padding: 24px 16px;
          border-top: 1px solid var(--p-border);
        }
        .btn-logout {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 16px;
          border: none;
          background: transparent;
          color: var(--p-error);
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          border-radius: 10px;
          transition: var(--transition-p);
        }
        .btn-logout:hover {
          background: #fef2f2;
          padding-left: 20px;
        }
        .logout-icon-bg {
          width: 32px;
          height: 32px;
          background: #fee2e2;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Nav Groups */
        .nav-group {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .nav-group-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          color: var(--p-text-muted);
          background: transparent;
          border: none;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border-radius: 10px;
          transition: all 0.2s;
        }
        .nav-group-header:hover {
          background: #f1f5f9;
          color: var(--p-primary);
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .chevron {
          transition: transform 0.3s;
        }
        .chevron.open {
          transform: rotate(180deg);
        }
        .nav-group-items {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-left: 20px;
          padding-left: 12px;
          border-left: 1px solid var(--p-border);
          margin-top: 4px;
          margin-bottom: 8px;
        }
        .sub-nav-link {
          padding: 8px 16px;
          color: var(--p-text-muted);
          text-decoration: none;
          font-size: 13px;
          font-weight: 500;
          border-radius: 8px;
          transition: all 0.2s;
        }
        .sub-nav-link:hover {
          color: var(--p-primary);
          background: #f8fafc;
        }
        .sub-nav-link.active {
          color: var(--p-primary);
          background: #eff6ff;
          font-weight: 700;
        }
      `}</style>
    </aside>
  );
};

export default Sidebar;
