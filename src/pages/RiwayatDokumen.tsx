import React, { useState, useMemo } from 'react';
import { useSPT } from '../hooks/useSPT';
import { useSPPD } from '../hooks/useSPPD';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    FileText,
    Map,
    Printer,
    Edit,
    Calendar,
    Loader2,
    Download
} from 'lucide-react';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import * as XLSX from 'xlsx';

const RiwayatDokumen: React.FC = () => {
    const { spts, loading: loadingSpt } = useSPT();
    const { sppds, loading: loadingSppd } = useSPPD();
    const navigate = useNavigate();

    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'SPT' | 'SPPD'>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'Draft' | 'Final'>('all');

    const allDocuments = useMemo(() => {
        const combined = [
            ...spts.map(s => ({
                id: s.id,
                nomor: s.nomor_spt,
                type: 'SPT' as const,
                date: s.tanggal_penetapan,
                status: s.status,
                subject: s.tujuan_kegiatan?.[0] || '',
                pegawai: s.pegawai_list?.length + ' Orang'
            })),
            ...sppds.map(s => ({
                id: s.id,
                nomor: s.nomor_sppd,
                type: 'SPPD' as const,
                date: s.tanggal_berangkat,
                status: s.status,
                subject: s.maksud_perjalanan,
                pegawai: s.pegawai?.nama_lengkap
            }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return combined.filter(doc => {
            const matchesSearch = doc.nomor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                doc.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (doc.pegawai || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesType = filterType === 'all' || doc.type === filterType;
            const matchesStatus = filterStatus === 'all' || doc.status === filterStatus;

            return matchesSearch && matchesType && matchesStatus;
        });
    }, [spts, sppds, searchTerm, filterType, filterStatus]);

    const handleExportExcel = () => {
        const dataToExport = allDocuments.map(doc => ({
            'Nomor Dokumen': doc.nomor,
            'Tipe': doc.type,
            'Tanggal': format(new Date(doc.date), 'dd/MM/yyyy'),
            'Perihal/Maksud': doc.subject,
            'Pegawai': doc.pegawai,
            'Status': doc.status
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Riwayat Dokumentasi');

        // Generate filename based on filters
        const dateStr = format(new Date(), 'yyyyMMdd');
        XLSX.writeFile(workbook, `Rekap_Dokumen_${dateStr}.xlsx`);
    };

    const loading = loadingSpt || loadingSppd;

    return (
        <div className="history-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1>Riwayat Dokumen</h1>
                    <p style={{ color: 'var(--medium-grey)' }}>Pencarian global dan riwayat seluruh dokumen SPT & SPPD.</p>
                </div>
                <button
                    className="btn btn-outline"
                    onClick={handleExportExcel}
                    disabled={allDocuments.length === 0}
                >
                    <Download size={18} />
                    Export Excel
                </button>
            </div>

            <div className="card filters-card" style={{ marginBottom: '24px' }}>
                <div className="filters-grid">
                    <div className="search-box">
                        <Search size={18} color="var(--medium-grey)" />
                        <input
                            type="text"
                            placeholder="Cari nomor, pegawai, atau tujuan..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="filter-group">
                        <div className="filter-item">
                            <label>Tipe</label>
                            <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
                                <option value="all">Semua Tipe</option>
                                <option value="SPT">Surat Perintah Tugas (SPT)</option>
                                <option value="SPPD">Surat Perjalanan Dinas (SPPD)</option>
                            </select>
                        </div>
                        <div className="filter-item">
                            <label>Status</label>
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
                                <option value="all">Semua Status</option>
                                <option value="Draft">Draft</option>
                                <option value="Final">Final</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: '0' }}>
                <div className="table-container">
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>
                            <Loader2 className="spin" size={32} color="var(--primary-blue)" />
                            <p style={{ marginTop: '12px' }}>Memuat riwayat...</p>
                        </div>
                    ) : allDocuments.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>
                            <p>Tidak ada dokumen yang ditemukan.</p>
                        </div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Dokumen</th>
                                    <th>Tanggal</th>
                                    <th>Tujuan / Maksud</th>
                                    <th>Pegawai</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allDocuments.map((doc, idx) => (
                                    <tr key={`${doc.type}-${doc.id}-${idx}`}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div className={`doc-icon-mini ${doc.type.toLowerCase()}`}>
                                                    {doc.type === 'SPT' ? <FileText size={14} /> : <Map size={14} />}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{doc.nomor}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--medium-grey)' }}>{doc.type}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Calendar size={14} color="var(--medium-grey)" />
                                                {format(new Date(doc.date), 'dd MMM yyyy', { locale: localeID })}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="text-truncate" style={{ maxWidth: '250px', fontSize: '13px' }}>
                                                {doc.subject}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '13px' }}>{doc.pegawai}</div>
                                        </td>
                                        <td>
                                            <span className={`badge ${doc.status === 'Final' ? 'badge-success' : 'badge-warning'}`}>
                                                {doc.status}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button
                                                    className="btn-icon-sm"
                                                    title="Cetak"
                                                    onClick={() => window.open(`/print/${doc.type.toLowerCase()}/${doc.id}`, '_blank')}
                                                >
                                                    <Printer size={16} />
                                                </button>
                                                <button
                                                    className="btn-icon-sm"
                                                    title="Edit"
                                                    onClick={() => navigate(`/${doc.type.toLowerCase()}/edit/${doc.id}`)}
                                                >
                                                    <Edit size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <style>{`
        .filters-grid { display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: center; }
        .search-box { display: flex; align-items: center; gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 16px; border-radius: 8px; }
        .search-box input { border: none; background: transparent; outline: none; width: 100%; font-size: 14px; }
        .filter-group { display: flex; gap: 16px; }
        .filter-item { display: flex; flex-direction: column; gap: 4px; }
        .filter-item label { font-size: 11px; font-weight: 700; color: var(--medium-grey); text-transform: uppercase; }
        .filter-item select { padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; background: white; font-size: 13px; }
        .doc-icon-mini { width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; }
        .doc-icon-mini.spt { background: #eff6ff; color: #1e40af; }
        .doc-icon-mini.sppd { background: #ecfdf5; color: #065f46; }
        .badge { padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .badge-success { background: #dcfce7; color: #166534; }
        .badge-warning { background: #fef9c3; color: #854d0e; }
        .btn-icon-sm { padding: 6px; border-radius: 6px; border: 1px solid #e2e8f0; background: white; cursor: pointer; color: var(--medium-grey); display: flex; }
        .btn-icon-sm:hover { background-color: var(--light-grey); color: var(--dark-grey); }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .text-truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      `}</style>
        </div>
    );
};

export default RiwayatDokumen;
