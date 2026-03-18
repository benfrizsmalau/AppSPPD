import React, { useMemo } from 'react';
import { usePegawai } from '../hooks/usePegawai';
import { useSPT } from '../hooks/useSPT';
import { useSPPD } from '../hooks/useSPPD';
import { useAuth } from '../hooks/useAuth';
import {
  Users,
  FileText,
  Map,
  ChevronRight,
  Sparkles,
  Clock,
  Calendar,
  Plus,
  ArrowUpRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, isSameMonth } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

const Dashboard: React.FC = () => {
  const { profile } = useAuth();
  const { pegawai } = usePegawai();
  const { spts } = useSPT();
  const { sppds } = useSPPD();

  const now = new Date();

  const stats = useMemo(() => {
    const activePegawai = pegawai.filter(p => p.status_aktif).length;
    const sptsThisMonth = spts.filter(s => isSameMonth(new Date(s.tanggal_penetapan), now)).length;
    const sppdsThisMonth = sppds.filter(s => isSameMonth(new Date(s.tanggal_berangkat), now)).length;
    const draftCount = spts.filter(s => s.status === 'Draft').length + sppds.filter(s => s.status === 'Draft').length;

    return { activePegawai, sptsThisMonth, sppdsThisMonth, draftCount };
  }, [pegawai, spts, sppds, now]);

  const recentItems = useMemo(() => {
    const combined = [
      ...spts.map(s => ({ ...s, type: 'SPT', date: s.created_at || s.tanggal_penetapan })),
      ...sppds.map(s => ({ ...s, type: 'SPPD', date: s.created_at || s.tanggal_berangkat }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return combined.slice(0, 5);
  }, [spts, sppds]);

  return (
    <div className="dashboard-wrapper">
      <header className="dashboard-header glass-effect">
        <div className="welcome-box">
          <div className="spark-icon">
            <Sparkles size={20} color="var(--p-accent)" />
          </div>
          <div>
            <h1>Halo, {profile?.nama_lengkap || 'User'}</h1>
            <p>Selamat datang kembali di Pusat Kendali Administrasi SiSPPD.</p>
          </div>
        </div>
        <div className="header-date">
          <div className="date-icon-box">
            <Calendar size={18} />
          </div>
          <div className="date-text">
            <span>{format(now, 'EEEE', { locale: localeID })}</span>
            <strong>{format(now, 'dd MMMM yyyy', { locale: localeID })}</strong>
          </div>
        </div>
      </header>

      <section className="stats-container">
        <div className="stat-tile">
          <div className="stat-tile-top">
            <div className="stat-tile-icon blue">
              <Users size={22} />
            </div>
            <div className="stat-tile-badge">Aktif</div>
          </div>
          <div className="stat-tile-body">
            <div className="stat-tile-value">{stats.activePegawai}</div>
            <div className="stat-tile-label">Total Pegawai</div>
          </div>
          <div className="stat-tile-footer">
            <span>Data master terverifikasi</span>
            <ArrowUpRight size={14} />
          </div>
        </div>

        <div className="stat-tile">
          <div className="stat-tile-top">
            <div className="stat-tile-icon indigo">
              <FileText size={22} />
            </div>
            <Link to="/spt" className="stat-tile-link"><ChevronRight size={16} /></Link>
          </div>
          <div className="stat-tile-body">
            <div className="stat-tile-value">{stats.sptsThisMonth}</div>
            <div className="stat-tile-label">SPT Terbit (Bulan Ini)</div>
          </div>
          <div className="stat-tile-footer">
            <span>Siap cetak dokumen</span>
          </div>
        </div>

        <div className="stat-tile">
          <div className="stat-tile-top">
            <div className="stat-tile-icon emerald">
              <Map size={22} />
            </div>
            <Link to="/sppd" className="stat-tile-link"><ChevronRight size={16} /></Link>
          </div>
          <div className="stat-tile-body">
            <div className="stat-tile-value">{stats.sppdsThisMonth}</div>
            <div className="stat-tile-label">SPPD Terbit (Bulan Ini)</div>
          </div>
          <div className="stat-tile-footer">
            <span>Penugasan dinas aktif</span>
          </div>
        </div>

        <div className="stat-tile">
          <div className="stat-tile-top">
            <div className="stat-tile-icon sunset">
              <Clock size={22} />
            </div>
            <div className="stat-tile-badge warning">Perlu Atensi</div>
          </div>
          <div className="stat-tile-body">
            <div className="stat-tile-value">{stats.draftCount}</div>
            <div className="stat-tile-label">Draft Menunggu Final</div>
          </div>
        </div>
      </section>

      <section className="analytics-overview glass-effect">
        <div className="analytics-header">
          <h3>Statistik & Tren Perjalanan</h3>
          <div className="period-selector">Bulan Terakhir</div>
        </div>
        <div className="analytics-grid">
          <div className="chart-item">
            <span className="chart-label">Frekuensi SPT</span>
            <div className="simple-bar-chart">
              <div className="bar" style={{ height: '40%' }}></div>
              <div className="bar" style={{ height: '60%' }}></div>
              <div className="bar" style={{ height: '35%' }}></div>
              <div className="bar" style={{ height: '85%' }}></div>
              <div className="bar active" style={{ height: '95%' }}></div>
            </div>
            <span className="chart-footer">Meningkat 15% dari bulan lalu</span>
          </div>
          <div className="chart-item">
            <span className="chart-label">Realisasi SPPD</span>
            <div className="simple-bar-chart">
              <div className="bar" style={{ height: '30%', background: 'var(--p-accent)' }}></div>
              <div className="bar" style={{ height: '50%', background: 'var(--p-accent)' }}></div>
              <div className="bar" style={{ height: '45%', background: 'var(--p-accent)' }}></div>
              <div className="bar" style={{ height: '70%', background: 'var(--p-accent)' }}></div>
              <div className="bar active" style={{ height: '80%', background: 'var(--p-accent)' }}></div>
            </div>
            <span className="chart-footer">Target tercapai 82%</span>
          </div>
        </div>
      </section>

      <div className="dashboard-main-grid">
        <div className="activity-section">
          <div className="section-card">
            <div className="section-header">
              <div className="header-info">
                <h3>Aktivitas Dokumentasi</h3>
                <p>Ulasan riwayat pembuatan dokumen terbaru</p>
              </div>
              <Link to="/riwayat" className="btn btn-outline btn-sm">
                Lihat Semua
              </Link>
            </div>
            <div className="activity-list-v2">
              {recentItems.length === 0 ? (
                <div className="empty-activity">
                  <div className="empty-icon"><Clock size={32} /></div>
                  <p>Belum ada aktivitas dokumen tercatat hari ini.</p>
                </div>
              ) : recentItems.map((item: any, idx) => (
                <div key={idx} className="activity-card-v2">
                  <div className={`activity-indicator ${item.type.toLowerCase()}`}>
                    {item.type === 'SPT' ? <FileText size={16} /> : <Map size={16} />}
                  </div>
                  <div className="activity-info">
                    <div className="activity-top">
                      <span className="activity-type-tag">{item.type}</span>
                      <span className="activity-time-tag">{format(new Date(item.date), 'HH:mm', { locale: localeID })}</span>
                    </div>
                    <p className="activity-desc"><strong>{item.nomor_spt || item.nomor_sppd}</strong></p>
                    <p className="activity-subdesc">{item.tujuan_kegiatan?.[0] || item.maksud_perjalanan}</p>
                  </div>
                  <Link to={`/${item.type.toLowerCase()}`} className="activity-action-btn">
                    <ChevronRight size={18} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="quick-action-section">
          <div className="section-card">
            <h3>Aksi Cepat</h3>
            <div className="quick-grid">
              <Link to="/spt/new" className="quick-tile purple">
                <div className="quick-icon"><FileText size={24} /></div>
                <span>Buat SPT Baru</span>
              </Link>
              <Link to="/sppd/new" className="quick-tile indigo">
                <div className="quick-icon"><Map size={24} /></div>
                <span>Buat SPPD Baru</span>
              </Link>
              <Link to="/pegawai" className="quick-tile slate">
                <div className="quick-icon"><Users size={24} /></div>
                <span>Kelola Pegawai</span>
              </Link>
              <Link to="/settings" className="quick-tile deep-blue">
                <div className="quick-icon"><Plus size={24} /></div>
                <span>Set Penomoran</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .dashboard-wrapper {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }
        .dashboard-header {
          padding: 32px;
          border-radius: var(--radius-p);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(to right, white, #f1f5f9);
        }
        .welcome-box {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .spark-icon {
          width: 48px;
          height: 48px;
          background: #eff6ff;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .welcome-box h1 {
          font-size: 28px;
          margin: 0;
          color: var(--p-primary);
        }
        .welcome-box p {
          color: var(--p-text-muted);
          margin: 4px 0 0;
          font-weight: 500;
        }
        .header-date {
          display: flex;
          align-items: center;
          gap: 12px;
          background: white;
          padding: 8px 16px;
          border-radius: 12px;
          border: 1px solid var(--p-border);
        }
        .date-icon-box {
          color: var(--p-accent);
        }
        .date-text {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
        }
        .date-text span {
          font-size: 10px;
          text-transform: uppercase;
          font-weight: 800;
          color: var(--p-text-muted);
        }
        .date-text strong {
          font-size: 14px;
        }

        /* Stats Blocks */
        .stats-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 24px;
        }
        .stat-tile {
          background: white;
          border: 1px solid var(--p-border);
          border-radius: var(--radius-p);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          transition: var(--transition-p);
        }
        .stat-tile:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-p-lg);
        }
        .stat-tile-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .stat-tile-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .stat-tile-icon.blue { background: #e0f2fe; color: #0369a1; }
        .stat-tile-icon.indigo { background: #e0e7ff; color: #4338ca; }
        .stat-tile-icon.emerald { background: #dcfce7; color: #065f46; }
        .stat-tile-icon.sunset { background: #ffedd5; color: #9a3412; }
        
        .stat-tile-badge {
          font-size: 10px;
          font-weight: 800;
          background: #f1f5f9;
          padding: 4px 8px;
          border-radius: 4px;
          text-transform: uppercase;
        }
        .stat-tile-badge.warning { background: #fee2e2; color: #991b1b; }
        
        .stat-tile-value {
          font-family: var(--font-heading);
          font-size: 36px;
          font-weight: 800;
          line-height: 1;
          color: var(--p-primary);
        }
        .stat-tile-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--p-text-muted);
          margin-top: 4px;
        }
        .stat-tile-footer {
          margin-top: auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          font-weight: 700;
          color: var(--p-text-muted);
          padding-top: 12px;
          border-top: 1px solid #f1f5f9;
        }

        /* Main Grid */
        .dashboard-main-grid {
          display: grid;
          grid-template-columns: 1.8fr 1fr;
          gap: 24px;
        }
        .section-card {
          background: white;
          border: 1px solid var(--p-border);
          border-radius: var(--radius-p);
          padding: 24px;
          height: 100%;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }
        .section-header h3 { font-size: 18px; margin: 0; }
        .section-header p { font-size: 13px; color: var(--p-text-muted); margin: 4px 0 0; }
        
        .activity-card-v2 {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 16px;
          border-radius: 12px;
          transition: var(--transition-p);
          border: 1px solid transparent;
        }
        .activity-card-v2:hover {
          background: #f8fafc;
          border-color: var(--p-border);
        }
        .activity-indicator {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .activity-indicator.spt { background: #eff6ff; color: #2563eb; }
        .activity-indicator.sppd { background: #ecfdf5; color: #10b981; }
        
        .activity-info { flex: 1; }
        .activity-top { display: flex; justify-content: space-between; margin-bottom: 2px; }
        .activity-type-tag { font-size: 10px; font-weight: 800; color: var(--p-text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .activity-time-tag { font-size: 11px; font-weight: 600; color: var(--p-text-muted); }
        .activity-desc { font-size: 14px; margin: 0; color: var(--p-primary); }
        .activity-subdesc { font-size: 12px; color: var(--p-text-muted); margin: 2px 0 0; }
        
        .activity-action-btn {
          align-self: center;
          color: var(--p-text-muted);
          transition: var(--transition-p);
        }
        .activity-action-btn:hover { color: var(--p-accent); transform: translateX(3px); }

        .quick-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 16px;
        }
        .quick-tile {
          padding: 20px;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          text-decoration: none;
          transition: var(--transition-p);
        }
        .quick-tile:hover { transform: scale(1.02); }
        .quick-tile.purple { background: #f5f3ff; color: #5b21b6; }
        .quick-tile.indigo { background: #eef2ff; color: #3730a3; }
        .quick-tile.slate { background: #f8fafc; color: #334155; }
        .quick-tile.deep-blue { background: #f0f9ff; color: #075985; }
        
        .quick-icon {
          width: 40px;
          height: 40px;
          background: rgba(255,255,255,0.8);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .quick-tile span { font-size: 13px; font-weight: 700; }

        /* Analytics Section */
        .analytics-overview {
            padding: 24px;
            border-radius: var(--radius-p);
            border: 1px solid var(--p-border);
            background: white;
        }
        .analytics-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
        }
        .analytics-header h3 { font-size: 16px; margin: 0; }
        .period-selector { font-size: 12px; font-weight: 700; color: var(--p-accent); cursor: pointer; }
        
        .analytics-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
        }
        .chart-item {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .chart-label { font-size: 12px; font-weight: 700; color: var(--p-text-muted); text-transform: uppercase; }
        .simple-bar-chart {
            height: 100px;
            display: flex;
            align-items: flex-end;
            gap: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--p-border);
        }
        .bar {
            flex: 1;
            background: #e2e8f0;
            border-radius: 4px 4px 0 0;
            transition: all 0.3s;
        }
        .bar.active {
            background: var(--p-primary);
        }
        .chart-footer { font-size: 11px; color: var(--p-text-muted); font-weight: 600; }
      `}</style>
    </div >
  );
};

export default Dashboard;
