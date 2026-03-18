import React, { useState } from 'react';
import { usePegawai } from '../hooks/usePegawai';
import type { Pegawai } from '../types';
import Modal from '../components/Modal';
import { Plus, Edit, Trash2, Download, Search, Loader2, Users, Filter, UserPlus } from 'lucide-react';
import * as XLSX from 'xlsx';

const PegawaiList: React.FC = () => {
    const {
        pegawai,
        pangkats,
        golongans,
        loading,
        error,
        addPegawai,
        updatePegawai,
        deletePegawai
    } = usePegawai();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPegawai, setEditingPegawai] = useState<Pegawai | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState<Partial<Pegawai>>({
        nama_lengkap: '',
        nip: '',
        jabatan: '',
        gelar_depan: '',
        gelar_belakang: '',
        status_aktif: true
    });

    const filteredPegawai = pegawai.filter(p =>
        p.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.nip.includes(searchTerm) ||
        p.jabatan.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleOpenModal = (p?: Pegawai) => {
        if (p) {
            setEditingPegawai(p);
            setFormData({
                nama_lengkap: p.nama_lengkap,
                nip: p.nip,
                jabatan: p.jabatan,
                gelar_depan: p.gelar_depan || '',
                gelar_belakang: p.gelar_belakang || '',
                pangkat_id: p.pangkat_id,
                golongan_id: p.golongan_id,
                status_aktif: p.status_aktif
            });
        } else {
            setEditingPegawai(null);
            setFormData({
                nama_lengkap: '',
                nip: '',
                jabatan: '',
                gelar_depan: '',
                gelar_belakang: '',
                status_aktif: true
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editingPegawai) {
                await updatePegawai(editingPegawai.id, formData);
            } else {
                await addPegawai(formData);
            }
            setIsModalOpen(false);
        } catch (err: any) {
            alert('Gagal menyimpan: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Hapus data pegawai ini?')) {
            try {
                await deletePegawai(id);
            } catch (err: any) {
                alert('Gagal menghapus: ' + err.message);
            }
        }
    };

    return (
        <div className="list-page-v2">
            <header className="page-header">
                <div className="header-info">
                    <h1>Master Data Pegawai</h1>
                    <p>Daftar Aparatur Sipil Negara terverifikasi di sistem.</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-outline" onClick={() => {
                        const ws = XLSX.utils.json_to_sheet(filteredPegawai);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, "Pegawai");
                        XLSX.writeFile(wb, "Data_Pegawai.xlsx");
                    }}>
                        <Download size={18} /> Ekspor Excel
                    </button>
                    <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                        <Plus size={18} /> Tambah Pegawai
                    </button>
                </div>
            </header>

            <div className="card list-controls glass-effect">
                <div className="search-box-premium">
                    <Search size={20} color="var(--p-text-muted)" />
                    <input
                        type="text"
                        placeholder="Cari berdasarkan Nama, NIP, atau Jabatan..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="filter-group">
                    <Filter size={18} />
                    <span>Filter Lanjutan</span>
                </div>
            </div>

            <div className="table-wrapper-premium">
                {loading ? (
                    <div className="loading-state">
                        <Loader2 className="spin" size={40} />
                        <p>Sinkronisasi Database Pegawai...</p>
                    </div>
                ) : filteredPegawai.length === 0 ? (
                    <div className="empty-state">
                        <Users size={48} />
                        <h3>Tidak Ada Data</h3>
                        <p>Database tidak menemukan rekaman yang cocok.</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>NIP</th>
                                    <th>Nama & Gelar</th>
                                    <th>Jabatan</th>
                                    <th>Pangkat/Gol</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPegawai.map((p) => (
                                    <tr key={p.id}>
                                        <td><code>{p.nip}</code></td>
                                        <td>
                                            <div className="user-meta-cell">
                                                <span className="user-full-name">
                                                    {p.gelar_depan && `${p.gelar_depan} `}{p.nama_lengkap}{p.gelar_belakang && `, ${p.gelar_belakang}`}
                                                </span>
                                            </div>
                                        </td>
                                        <td><span className="jabatan-text">{p.jabatan}</span></td>
                                        <td>
                                            <div className="badge-outline">
                                                {p.pangkat?.nama || '-'} ({p.golongan?.nama || '-'})
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge ${p.status_aktif ? 'badge-success' : 'badge-danger'}`}>
                                                {p.status_aktif ? 'Aktif' : 'Non-Aktif'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div className="action-group">
                                                <button className="icon-btn" onClick={() => handleOpenModal(p)}><Edit size={16} /></button>
                                                <button className="icon-btn danger" onClick={() => handleDelete(p.id)}><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingPegawai ? 'Edit Pegawai' : 'Register Pegawai Baru'}
            >
                <form onSubmit={handleSubmit} className="premium-form">
                    <div className="form-grid">
                        <div className="form-group">
                            <label className="form-label">Gelar Depan</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.gelar_depan || ''}
                                onChange={(e) => setFormData({ ...formData, gelar_depan: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Gelar Belakang</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.gelar_belakang || ''}
                                onChange={(e) => setFormData({ ...formData, gelar_belakang: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Nama Lengkap *</label>
                        <input
                            type="text"
                            className="form-input"
                            required
                            value={formData.nama_lengkap || ''}
                            onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">NIP (18 Digit) *</label>
                        <input
                            type="text"
                            className="form-input"
                            required
                            maxLength={18}
                            value={formData.nip || ''}
                            onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                        />
                    </div>
                    <div className="form-grid">
                        <div className="form-group">
                            <label className="form-label">Pangkat</label>
                            <select
                                className="form-input"
                                value={formData.pangkat_id || ''}
                                onChange={(e) => setFormData({ ...formData, pangkat_id: Number(e.target.value) })}
                            >
                                <option value="">Pilih Pangkat</option>
                                {pangkats?.map(pk => <option key={pk.id} value={pk.id}>{pk.nama}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Golongan</label>
                            <select
                                className="form-input"
                                value={formData.golongan_id || ''}
                                onChange={(e) => setFormData({ ...formData, golongan_id: Number(e.target.value) })}
                            >
                                <option value="">Pilih Golongan</option>
                                {golongans?.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Jabatan Struktural/Fungsional *</label>
                        <input
                            type="text"
                            className="form-input"
                            required
                            value={formData.jabatan || ''}
                            onChange={(e) => setFormData({ ...formData, jabatan: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={formData.status_aktif}
                                onChange={(e) => setFormData({ ...formData, status_aktif: e.target.checked })}
                            />
                            <span className="slider"></span>
                            <span className="toggle-label">Status Pegawai Aktif</span>
                        </label>
                    </div>
                    <div className="modal-actions-v2">
                        <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Batal</button>
                        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="spin" size={18} /> : (editingPegawai ? 'Simpan Perubahan' : 'Daftarkan')}
                        </button>
                    </div>
                </form>
            </Modal>

            <style>{`
        .list-page-v2 { display: flex; flex-direction: column; gap: 32px; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-end; }
        .header-info h1 { font-size: 32px; color: var(--p-primary); margin: 0; letter-spacing: -0.025em; }
        .header-info p { color: var(--p-text-muted); margin: 8px 0 0; font-weight: 500; }
        .header-actions { display: flex; gap: 12px; }
        
        .list-controls { display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; }
        .search-box-premium { display: flex; align-items: center; gap: 12px; flex: 1; }
        .search-box-premium input { border: none; background: transparent; width: 100%; font-size: 15px; font-weight: 500; outline: none; }
        .filter-group { display: flex; align-items: center; gap: 10px; color: var(--p-text-muted); font-size: 13px; font-weight: 700; cursor: pointer; }
        
        .jabatan-text { font-size: 14px; font-weight: 600; color: var(--p-primary); }
        .user-full-name { font-weight: 700; color: var(--p-primary); }
        .badge-outline { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 6px; border: 1px solid var(--p-border); background: #f8fafc; display: inline-block; }
        
        .action-group { display: flex; gap: 8px; justify-content: flex-end; }
        .icon-btn { width: 34px; height: 34px; border-radius: 8px; border: 1px solid var(--p-border); background: white; color: var(--p-text-muted); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: var(--transition-p); }
        .icon-btn:hover { border-color: var(--p-accent); color: var(--p-accent); background: #f0f9ff; }
        .icon-btn.danger:hover { border-color: var(--p-error); color: var(--p-error); background: #fef2f2; }
        
        .loading-state, .empty-state { padding: 80px 0; text-align: center; background: white; border-radius: 16px; border: 1px dashed var(--p-border); }
        .empty-state h3 { margin: 16px 0 8px; color: var(--p-primary); }
        .empty-state p { color: var(--p-text-muted); }
        
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .premium-form { padding: 10px 0; }
        .modal-actions-v2 { display: flex; justify-content: flex-end; gap: 12px; margin-top: 32px; border-top: 1px solid var(--p-border); padding-top: 24px; }
        
        .toggle-switch { display: flex; align-items: center; gap: 12px; cursor: pointer; }
        .toggle-switch input { display: none; }
        .slider { position: relative; width: 44px; height: 22px; background: #cbd5e1; border-radius: 20px; transition: 0.3s; }
        .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s; }
        input:checked + .slider { background: var(--p-success); }
        input:checked + .slider:before { transform: translateX(22px); }
        .toggle-label { font-size: 14px; font-weight: 600; color: var(--p-text-main); }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
        </div>
    );
};

export default PegawaiList;
