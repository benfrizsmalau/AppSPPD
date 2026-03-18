import React, { useState } from 'react';
import { useSPT } from '../hooks/useSPT';
import { useNavigate, Link } from 'react-router-dom';
import {
    Calendar,
    Edit,
    FileText,
    Filter,
    Plus,
    Search,
    Trash2,
    Printer,
    Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

const SPTList: React.FC = () => {
    const { spts, loading, deleteSPT } = useSPT();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const filteredSPTs = spts.filter(s => {
        const matchesSearch = s.nomor_spt.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.tujuan_kegiatan.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleDelete = async (id: number) => {
        if (confirm('Apakah Anda yakin ingin menghapus SPT ini?')) {
            try {
                await deleteSPT(id);
            } catch (err: any) {
                alert('Gagal menghapus: ' + err.message);
            }
        }
    };

    return (
        <div className="list-page-v2">
            <header className="page-header">
                <div className="header-info">
                    <h1>Modul Surat Perintah Tugas</h1>
                    <p>Daftar administrasi perintah tugas dinas ASN.</p>
                </div>
                <div className="header-actions">
                    <Link to="/spt/new" className="btn btn-primary">
                        <Plus size={18} />
                        Buat SPT Baru
                    </Link>
                </div>
            </header>

            <div className="card list-controls glass-effect">
                <div className="search-box-premium">
                    <Search size={20} color="var(--p-text-muted)" />
                    <input
                        type="text"
                        placeholder="Cari nomor SPT atau tujuan kegiatan..."
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
                        <p>Memuat database SPT...</p>
                    </div>
                ) : filteredSPTs.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon"><FileText size={48} /></div>
                        <h3>Data tidak ditemukan</h3>
                        <p>Belum ada rekaman SPT yang sesuai dengan kriteria.</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Nomor Dokumen</th>
                                    <th>Tanggal Terbit</th>
                                    <th>Personel Terlibat</th>
                                    <th>Maksud & Tujuan</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSPTs.map((s) => (
                                    <tr key={s.id}>
                                        <td>
                                            <div className="doc-number-cell">
                                                <strong>{s.nomor_spt}</strong>
                                                <span className="doc-id">DOC-ID: {s.id}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="date-cell">
                                                <Calendar size={14} />
                                                {format(new Date(s.tanggal_penetapan), 'dd MMM yyyy', { locale: localeID })}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="overlapping-avatars">
                                                {s.pegawai_list?.slice(0, 3).map((p, i) => (
                                                    <div key={i} className="avatar-circle" title={p.pegawai?.nama_lengkap}>
                                                        {p.pegawai?.nama_lengkap.charAt(0)}
                                                    </div>
                                                ))}
                                                {(s.pegawai_list?.length || 0) > 3 && (
                                                    <div className="avatar-more-count">+{s.pegawai_list!.length - 3}</div>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="text-truncate-premium">
                                                {s.tujuan_kegiatan?.[0]}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge ${s.status === 'Final' ? 'badge-success' : 'badge-warning'}`}>
                                                {s.status}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div className="action-group">
                                                <button className="icon-btn" title="Cetak Dokumen" onClick={() => window.open(`/print/spt/${s.id}`, '_blank')}>
                                                    <Printer size={16} />
                                                </button>
                                                <button className="icon-btn" title="Edit SPT" onClick={() => navigate(`/spt/edit/${s.id}`)}>
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
        
        .date-cell { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--p-text-main); }
        .date-cell svg { color: var(--p-text-muted); }
        
        .overlapping-avatars { display: flex; align-items: center; }
        .avatar-circle {
          width: 28px; height: 28px;
          border-radius: 50%; border: 2px solid white;
          background: #e0f2fe; color: #0369a1;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 800;
          margin-left: -10px;
        }
        .avatar-circle:first-child { margin-left: 0; }
        .avatar-more-count {
          width: 28px; height: 28px;
          border-radius: 50%; border: 2px solid white;
          background: #f1f5f9; color: var(--p-text-muted);
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 800;
          margin-left: 4px;
        }

        .text-truncate-premium {
          font-size: 13px; font-weight: 500; color: var(--p-text-main);
          max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

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
        
        .table-container table { width: 100%; border-collapse: collapse; }
        .table-container th { text-align: left; padding: 16px 20px; font-size: 12px; font-weight: 700; color: var(--p-text-muted); text-transform: uppercase; border-bottom: 1px solid var(--p-border); }
        .table-container td { padding: 16px 20px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
        
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

export default SPTList;
