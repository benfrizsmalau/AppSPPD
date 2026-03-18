import React, { useState } from 'react';
import { useSPPD } from '../hooks/useSPPD';
import { useNavigate, Link } from 'react-router-dom';
import {
    Plus,
    Search,
    Printer,
    Calendar,
    Edit,
    Trash2,
    Loader2,
    MapPin,
    Briefcase,
    Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

const SPPDList: React.FC = () => {
    const { sppds, loading, error, deleteSPPD } = useSPPD();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const filteredSPPDs = sppds.filter(s => {
        const matchesSearch = s.nomor_sppd.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.pegawai?.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.tempat_tujuan.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleDelete = async (id: number) => {
        if (confirm('Apakah Anda yakin ingin menghapus SPPD ini?')) {
            try {
                await deleteSPPD(id);
            } catch (err: any) {
                alert('Gagal menghapus: ' + err.message);
            }
        }
    };

    return (
        <div className="list-page-v2">
            <header className="page-header">
                <div className="header-info">
                    <h1>Surat Perjalanan Dinas</h1>
                    <p>Dokumentasi resmi perjalanan dinas luar daerah ASN.</p>
                </div>
                <div className="header-actions">
                    <Link to="/sppd/new" className="btn btn-primary">
                        <Plus size={18} />
                        Buat SPPD Baru
                    </Link>
                </div>
            </header>

            {error && (
                <div className="error-banner card" style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', padding: '16px', borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Edit size={20} />
                    <div>
                        <p style={{ fontWeight: 800, margin: 0 }}>Gagal Memuat Data</p>
                        <p style={{ fontSize: '13px', margin: '4px 0 0', opacity: 0.8 }}>{error}</p>
                    </div>
                </div>
            )}

            <div className="card list-controls glass-effect">
                <div className="search-box-premium">
                    <Search size={20} color="var(--p-text-muted)" />
                    <input
                        type="text"
                        placeholder="Cari nomor SPPD, nama pegawai, atau tujuan..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="filter-group-premium">
                    <Filter size={18} color="var(--p-text-muted)" />
                    <select
                        className="filter-select"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">Semua Status</option>
                        <option value="Draft">Draft</option>
                        <option value="Final">Final</option>
                    </select>
                </div>
            </div>

            <div className="table-wrapper-premium">
                {loading ? (
                    <div className="loading-state">
                        <Loader2 className="spin" size={40} />
                        <p>Sinkronisasi Database SPPD...</p>
                    </div>
                ) : filteredSPPDs.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon"><Briefcase size={48} /></div>
                        <h3>Belum Ada Dokumen</h3>
                        <p>Tidak ditemukan data SPPD yang terdaftar di sistem.</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Nomor SPPD</th>
                                    <th>Informasi Personel</th>
                                    <th>Tujuan & Durasi</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSPPDs.map((s) => (
                                    <tr key={s.id}>
                                        <td>
                                            <div className="doc-number-cell">
                                                <strong>{s.nomor_sppd}</strong>
                                                <span className="doc-id">SPT: {s.spt?.nomor_spt || '-'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="person-cell">
                                                <div className="person-avatar">
                                                    {s.pegawai?.nama_lengkap.charAt(0)}
                                                </div>
                                                <div className="person-info">
                                                    <strong>{s.pegawai?.nama_lengkap}</strong>
                                                    <span>NIP. {s.pegawai?.nip}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="dest-cell">
                                                <div className="dest-location">
                                                    <MapPin size={14} />
                                                    <span>{s.tempat_tujuan}</span>
                                                </div>
                                                <div className="dest-date">
                                                    <Calendar size={14} />
                                                    {format(new Date(s.tanggal_berangkat), 'dd MMM', { locale: localeID })} - {format(new Date(s.tanggal_kembali), 'dd MMM yyyy', { locale: localeID })}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge ${s.status === 'Final' ? 'badge-success' : 'badge-warning'}`}>
                                                {s.status}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div className="action-group">
                                                <button className="icon-btn" title="Cetak SPPD" onClick={() => window.open(`/print/sppd/${s.id}`, '_blank')}>
                                                    <Printer size={16} />
                                                </button>
                                                <button className="icon-btn" title="Edit Data" onClick={() => navigate(`/sppd/edit/${s.id}`)}>
                                                    <Edit size={16} />
                                                </button>
                                                <button className="icon-btn danger" title="Hapus" onClick={() => handleDelete(s.id)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <style>{`
        .doc-number-cell { display: flex; flex-direction: column; }
        .doc-number-cell strong { font-size: 14px; color: var(--p-primary); }
        .doc-id { font-size: 10px; font-weight: 700; color: var(--p-text-muted); text-transform: uppercase; }
        
        .person-cell { display: flex; align-items: center; gap: 12px; }
        .person-avatar {
          width: 32px; height: 32px;
          background: #f1f5f9; color: var(--p-accent);
          border-radius: 8px; font-weight: 800; font-size: 14px;
          display: flex; align-items: center; justify-content: center;
        }
        .person-info { display: flex; flex-direction: column; }
        .person-info strong { font-size: 14px; color: var(--p-primary); }
        .person-info span { font-size: 11px; color: var(--p-text-muted); font-weight: 600; }
        
        .dest-cell { display: flex; flex-direction: column; gap: 4px; }
        .dest-location { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--p-primary); }
        .dest-location svg { color: var(--p-accent); }
        .dest-date { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--p-text-muted); }
        
        .filter-group-premium { display: flex; align-items: center; gap: 10px; border-left: 1px solid var(--p-border); padding-left: 20px; }
        .filter-select { border: none; background: transparent; font-size: 14px; font-weight: 700; color: var(--p-primary); outline: none; cursor: pointer; }

        .list-page-v2 { display: flex; flex-direction: column; gap: 24px; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-end; }
        .page-header h1 { font-size: 32px; color: var(--p-primary); margin: 0; }
        .page-header p { margin: 8px 0 0; color: var(--p-text-muted); font-weight: 500; }
        .header-actions { display: flex; gap: 12px; }
        
        .list-controls { display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; }
        .search-box-premium { display: flex; align-items: center; gap: 12px; flex: 1; }
        .search-box-premium input { border: none; background: transparent; width: 100%; font-size: 15px; font-weight: 500; outline: none; }
        
        .action-group { display: flex; gap: 8px; justify-content: flex-end; }
        .icon-btn { width: 34px; height: 34px; border-radius: 8px; border: 1px solid var(--p-border); background: white; color: var(--p-text-muted); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: var(--transition-p); }
        .icon-btn:hover { border-color: var(--p-accent); color: var(--p-accent); background: #f0f9ff; }
        .icon-btn.danger:hover { border-color: var(--p-error); color: var(--p-error); background: #fef2f2; }

        .loading-state, .empty-state { padding: 80px 0; text-align: center; background: white; border-radius: 16px; border: 1px dashed var(--p-border); }
        .empty-icon { color: var(--p-border); margin-bottom: 16px; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
        </div>
    );
};

export default SPPDList;
