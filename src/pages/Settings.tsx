import React, { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import type { Instansi } from '../types';
import type { Penandatangan } from '../types/penandatangan';
import Modal from '../components/Modal';
import { useNumbering } from '../hooks/useNumbering';
import { useUsers } from '../hooks/useUsers';
import { useReferensi } from '../hooks/useReferensi';
import {
    Building2,
    UserRound,
    Plus,
    Edit,
    Trash2,
    Upload,
    Loader2,
    CheckCircle2,
    Hash,
    Users,
    Database,
    Power
} from 'lucide-react';

const Settings: React.FC = () => {
    const {
        instansi,
        penandatangan,
        loading: settingsLoading,
        updateInstansi,
        savePenandatangan,
        deletePenandatangan,
        uploadFile
    } = useSettings();

    const { settings: numberingSettings, updatePattern } = useNumbering();
    const { users, toggleUserStatus } = useUsers();
    const {
        pangkats, golongans, tingkatPerjalanan, alatAngkut, mataAnggaran,
        savePangkat, deletePangkat, saveGolongan, deleteGolongan,
        saveTingkatPerjalanan, deleteTingkatPerjalanan,
        saveAlatAngkut, deleteAlatAngkut,
        saveMataAnggaran, deleteMataAnggaran,
        loading: referensiLoading
    } = useReferensi();

    const [activeTab, setActiveTab] = useState<'instansi' | 'penandatangan' | 'penomoran' | 'users' | 'referensi'>('instansi');
    const [subTab, setSubTab] = useState<'pangkat' | 'golongan' | 'tingkat' | 'alat' | 'anggaran'>('pangkat');

    // Instansi Form State
    const [instansiData, setInstansiData] = useState<Partial<Instansi>>({});
    const [isUpdatingInstansi, setIsUpdatingInstansi] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingLogoKab, setUploadingLogoKab] = useState(false);

    // Penandatangan Form State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTtd, setEditingTtd] = useState<Penandatangan | null>(null);
    const [ttdFormData, setTtdFormData] = useState<Partial<Penandatangan>>({
        jenis_dokumen: ['SPT', 'SPPD'],
        status_aktif: true
    });
    const [isSavingTtd, setIsSavingTtd] = useState(false);
    const [uploadingTtd, setUploadingTtd] = useState(false);

    // Referensi Form State
    const [isRefModalOpen, setIsRefModalOpen] = useState(false);
    const [editingRef, setEditingRef] = useState<any>(null);
    const [refFormData, setRefFormData] = useState<any>({});
    const [isSavingRef, setIsSavingRef] = useState(false);

    // Initialize instansi data when loaded
    React.useEffect(() => {
        if (instansi) {
            setInstansiData(instansi);
        }
    }, [instansi]);

    const handleInstansiSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUpdatingInstansi(true);
        try {
            await updateInstansi(instansiData);
            alert('Pengaturan instansi berhasil disimpan.');
        } catch (err: any) {
            alert('Gagal menyimpan: ' + err.message);
        } finally {
            setIsUpdatingInstansi(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo_path' | 'logo_kabupaten_path') => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (field === 'logo_path') setUploadingLogo(true);
        else setUploadingLogoKab(true);

        try {
            const prefix = field === 'logo_path' ? 'skpd' : 'kab';
            const fileName = `${prefix}-${Date.now()}.${file.name.split('.').pop()}`;
            const url = await uploadFile(file, 'assets', `instansi/${fileName}`);

            const updatedData = { ...instansiData, [field]: url };
            setInstansiData(updatedData);
            // Update DB immediately
            await updateInstansi(updatedData);
        } catch (err: any) {
            alert('Gagal upload logo. ' + err.message);
        } finally {
            setUploadingLogo(false);
            setUploadingLogoKab(false);
        }
    };

    const handleOpenTtdModal = (ttd?: Penandatangan) => {
        if (ttd) {
            setEditingTtd(ttd);
            setTtdFormData({
                ...ttd
            });
        } else {
            setEditingTtd(null);
            setTtdFormData({
                jenis_dokumen: ['SPT', 'SPPD'],
                status_aktif: true,
                unit_kerja_id: instansi?.id
            });
        }
        setIsModalOpen(true);
    };

    const handleTtdSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingTtd(true);
        try {
            await savePenandatangan(ttdFormData);
            setIsModalOpen(false);
        } catch (err: any) {
            alert('Gagal menyimpan: ' + err.message);
        } finally {
            setIsSavingTtd(false);
        }
    };

    const handleTtdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingTtd(true);
        try {
            const fileName = `ttd-${Date.now()}.${file.name.split('.').pop()}`;
            const url = await uploadFile(file, 'assets', `signatures/${fileName}`);
            setTtdFormData({ ...ttdFormData, ttd_digital_path: url });
        } catch (err: any) {
            alert('Gagal upload tanda tangan. Pastikan bucket "assets" sudah dibuat di Supabase Storage.\n' + err.message);
        } finally {
            setUploadingTtd(false);
        }
    };

    const handleOpenRefModal = (data?: any) => {
        if (data) {
            setEditingRef(data);
            setRefFormData({ ...data });
        } else {
            setEditingRef(null);
            setRefFormData(subTab === 'anggaran' ? { tahun: new Date().getFullYear() } : {});
        }
        setIsRefModalOpen(true);
    };

    const handleRefSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingRef(true);
        try {
            switch (subTab) {
                case 'pangkat': await savePangkat(refFormData); break;
                case 'golongan': await saveGolongan(refFormData); break;
                case 'tingkat': await saveTingkatPerjalanan(refFormData); break;
                case 'alat': await saveAlatAngkut(refFormData); break;
                case 'anggaran': await saveMataAnggaran(refFormData); break;
            }
            setIsRefModalOpen(false);
        } catch (err: any) {
            alert('Gagal menyimpan: ' + err.message);
        } finally {
            setIsSavingRef(false);
        }
    };

    if (settingsLoading || referensiLoading) return <div style={{ padding: '40px', textAlign: 'center' }}><Loader2 className="spin" /></div>;

    return (
        <div className="settings-page">
            <div style={{ marginBottom: '24px' }}>
                <h1>Pengaturan</h1>
                <div className="tabs">
                    <button
                        className={`tab-btn ${activeTab === 'instansi' ? 'active' : ''}`}
                        onClick={() => setActiveTab('instansi')}
                    >
                        <Building2 size={18} />
                        Data Instansi
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'penandatangan' ? 'active' : ''}`}
                        onClick={() => setActiveTab('penandatangan')}
                    >
                        <UserRound size={18} />
                        Penandatangan
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'penomoran' ? 'active' : ''}`}
                        onClick={() => setActiveTab('penomoran')}
                    >
                        <Hash size={18} />
                        Penomoran
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                        onClick={() => setActiveTab('users')}
                    >
                        <Users size={18} />
                        User Management
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'referensi' ? 'active' : ''}`}
                        onClick={() => setActiveTab('referensi')}
                    >
                        <Database size={18} />
                        Referensi Data
                    </button>
                </div>
            </div>

            <div className="tab-content">
                {activeTab === 'instansi' && (
                    <div className="card">
                        <div className="card-header">
                            <h3>Informasi Instansi</h3>
                            <p>Pengaturan nama dinas, alamat, dan logo yang tampil di kop surat.</p>
                        </div>

                        <form onSubmit={handleInstansiSubmit} className="settings-form">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px' }}>
                                <div className="logo-upload-section">
                                    <label className="form-label" style={{ textAlign: 'center', display: 'block', marginBottom: '15px' }}>Logo Kabupaten</label>
                                    <div className="logo-preview">
                                        {instansiData.logo_kabupaten_path ? (
                                            <img src={instansiData.logo_kabupaten_path} alt="Logo Kabupaten" />
                                        ) : (
                                            <div className="no-logo">
                                                <Building2 size={48} color="#cbd5e1" />
                                                <span>Pemkab</span>
                                            </div>
                                        )}
                                        {uploadingLogoKab && <div className="logo-overlay"><Loader2 className="spin" /></div>}
                                    </div>
                                    <label className="btn btn-outline logo-btn">
                                        <Upload size={16} />
                                        Upload Logo Pemkab
                                        <input type="file" hidden onChange={(e) => handleLogoUpload(e, 'logo_kabupaten_path')} accept="image/*" />
                                    </label>

                                    <div style={{ height: '30px' }}></div>

                                    <label className="form-label" style={{ textAlign: 'center', display: 'block', marginBottom: '15px' }}>Logo SKPD / Dinas</label>
                                    <div className="logo-preview">
                                        {instansiData.logo_path ? (
                                            <img src={instansiData.logo_path} alt="Logo Instansi" />
                                        ) : (
                                            <div className="no-logo">
                                                <Building2 size={48} color="#cbd5e1" />
                                                <span>SKPD</span>
                                            </div>
                                        )}
                                        {uploadingLogo && <div className="logo-overlay"><Loader2 className="spin" /></div>}
                                    </div>
                                    <label className="btn btn-outline logo-btn">
                                        <Upload size={16} />
                                        Upload Logo Dinas
                                        <input type="file" hidden onChange={(e) => handleLogoUpload(e, 'logo_path')} accept="image/*" />
                                    </label>
                                    <p className="help-text">JPG/PNG, Rekomendasi: 200x200px</p>
                                </div>

                                <div className="fields-section">
                                    <div className="form-group">
                                        <label className="form-label">Nama Lengkap Instansi *</label>
                                        <textarea
                                            className="form-input"
                                            rows={2}
                                            required
                                            value={instansiData.nama_lengkap || ''}
                                            onChange={(e) => setInstansiData({ ...instansiData, nama_lengkap: e.target.value })}
                                            placeholder="Contoh: BADAN PENDAPATAN PENGELOLAAN KEUANGAN DAN ASET DAERAH"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Nama Singkat *</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            required
                                            value={instansiData.nama_singkat || ''}
                                            onChange={(e) => setInstansiData({ ...instansiData, nama_singkat: e.target.value })}
                                            placeholder="Contoh: BPPKAD"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Alamat Lengkap *</label>
                                        <textarea
                                            className="form-input"
                                            rows={3}
                                            required
                                            value={instansiData.alamat || ''}
                                            onChange={(e) => setInstansiData({ ...instansiData, alamat: e.target.value })}
                                            placeholder="Masukan alamat lengkap kantor..."
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                                        <div className="form-group">
                                            <label className="form-label">Kabupaten/Kota</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={instansiData.kabupaten_kota || ''}
                                                onChange={(e) => setInstansiData({ ...instansiData, kabupaten_kota: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Provinsi</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={instansiData.provinsi || ''}
                                                onChange={(e) => setInstansiData({ ...instansiData, provinsi: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Kode Pos</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={instansiData.kode_pos || ''}
                                                onChange={(e) => setInstansiData({ ...instansiData, kode_pos: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                                        <div className="form-group">
                                            <label className="form-label">Telepon</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={instansiData.telepon || ''}
                                                onChange={(e) => setInstansiData({ ...instansiData, telepon: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Email Resmi</label>
                                            <input
                                                type="email"
                                                className="form-input"
                                                value={instansiData.email || ''}
                                                onChange={(e) => setInstansiData({ ...instansiData, email: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Website</label>
                                            <input
                                                type="url"
                                                className="form-input"
                                                value={instansiData.website || ''}
                                                onChange={(e) => setInstansiData({ ...instansiData, website: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                                        <button type="submit" className="btn btn-primary" disabled={isUpdatingInstansi}>
                                            {isUpdatingInstansi ? <Loader2 className="spin" /> : <><CheckCircle2 size={18} /> Simpan Perubahan</>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                )}

                {activeTab === 'penandatangan' && (
                    <div className="penandatangan-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div>
                                <h3>Pejabat Penandatangan</h3>
                                <p style={{ color: 'var(--medium-grey)' }}>Kelola data pejabat yang berhak menandatangani SPT dan SPPD.</p>
                            </div>
                            <button className="btn btn-primary" onClick={() => handleOpenTtdModal()}>
                                <Plus size={18} />
                                Tambah Pejabat
                            </button>
                        </div>

                        <div className="ttd-list">
                            {penandatangan.length === 0 ? (
                                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                                    <p>Belum ada data penandatangan.</p>
                                </div>
                            ) : (
                                <div className="ttd-grid">
                                    {penandatangan.map((ttd) => (
                                        <div key={ttd.id} className="card ttd-card">
                                            <div className="ttd-header">
                                                <span className={`status-badge ${ttd.status_aktif ? 'active' : 'inactive'}`}>
                                                    {ttd.status_aktif ? 'Aktif' : 'Non-Aktif'}
                                                </span>
                                                <div className="ttd-actions">
                                                    <button className="btn-icon-sm" onClick={() => handleOpenTtdModal(ttd)}>
                                                        <Edit size={16} />
                                                    </button>
                                                    <button className="btn-icon-sm btn-icon-danger" onClick={() => {
                                                        if (confirm('Hapus data penandatangan ini?')) deletePenandatangan(ttd.id);
                                                    }}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="ttd-body">
                                                <div className="ttd-sign-preview">
                                                    {ttd.ttd_digital_path ? (
                                                        <img src={ttd.ttd_digital_path} alt="Tanda Tangan" />
                                                    ) : (
                                                        <div className="no-sign">Tanpa TTD</div>
                                                    )}
                                                </div>
                                                <div className="ttd-info">
                                                    <h4 style={{ marginBottom: '4px' }}>{ttd.nama_lengkap}</h4>
                                                    <p className="ttd-nip">NIP. {ttd.nip}</p>
                                                    <p className="ttd-jabatan">{ttd.jabatan}</p>
                                                    <p className="ttd-pangkat">{ttd.pangkat?.nama} ({ttd.golongan?.nama})</p>
                                                    <div className="ttd-doc-types">
                                                        {ttd.jenis_dokumen?.map(type => (
                                                            <span key={type} className="doc-type-badge">{type}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'penomoran' && (
                    <div className="numbering-section">
                        <div className="card-header">
                            <h3>Pengaturan Penomoran</h3>
                            <p>Sesuaikan pola nomor surat otomatis yang digunakan oleh sistem.</p>
                        </div>

                        <div className="settings-grid">
                            {numberingSettings.map((s) => (
                                <div key={s.id} className="card" style={{ marginBottom: '20px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Format Nomor {s.jenis_dokumen}</label>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <input
                                                type="text"
                                                className="form-input"
                                                defaultValue={s.format_pattern}
                                                onBlur={(e) => updatePattern(s.jenis_dokumen, e.target.value)}
                                            />
                                            <button className="btn btn-primary" style={{ height: '42px' }}>Simpan</button>
                                        </div>
                                        <p className="help-text">
                                            Gunakan placeholder: <strong>{"{num}"}</strong> (nomor urut),
                                            <strong>{"{year}"}</strong> (tahun),
                                            <strong>{"{month}"}</strong> (bulan 01-12),
                                            <strong>{"{month_roman}"}</strong> (bulan I-XII),
                                            <strong>{"{org}"}</strong> (kode instansi).
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="info-box-blue" style={{ marginTop: '10px' }}>
                            <p><strong>Contoh:</strong> {"{num}/SPT/BPPKAD/{year}"} akan menghasilkan <strong>001/SPT/BPPKAD/2026</strong></p>
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="users-section">
                        <div className="card-header">
                            <h3>Manajemen User</h3>
                            <p>Kelola akun pengguna, peran, dan status akses sistem.</p>
                        </div>

                        <div className="card no-padding">
                            <table className="settings-table">
                                <thead>
                                    <tr>
                                        <th>Nama Lengkap</th>
                                        <th>Username</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                        <th style={{ textAlign: 'right' }}>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{u.nama_lengkap}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--p-text-muted)' }}>{u.email}</div>
                                            </td>
                                            <td><code>{u.username}</code></td>
                                            <td>
                                                <span className={`role-badge ${u.role.toLowerCase()}`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`status-pill ${u.status_aktif ? 'online' : 'offline'}`}>
                                                    {u.status_aktif ? 'Aktif' : 'Non-Aktif'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button
                                                    className={`btn-icon-sm ${u.status_aktif ? 'btn-icon-danger' : 'btn-icon-success'}`}
                                                    onClick={() => toggleUserStatus(u.id, u.status_aktif)}
                                                    title={u.status_aktif ? 'Nonaktifkan User' : 'Aktifkan User'}
                                                >
                                                    <Power size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'referensi' && (
                    <div className="referensi-section">
                        <div className="inner-tabs">
                            <button className={`inner-tab ${subTab === 'pangkat' ? 'active' : ''}`} onClick={() => setSubTab('pangkat')}>Pangkat</button>
                            <button className={`inner-tab ${subTab === 'golongan' ? 'active' : ''}`} onClick={() => setSubTab('golongan')}>Golongan</button>
                            <button className={`inner-tab ${subTab === 'tingkat' ? 'active' : ''}`} onClick={() => setSubTab('tingkat')}>Tingkat Perjalanan</button>
                            <button className={`inner-tab ${subTab === 'alat' ? 'active' : ''}`} onClick={() => setSubTab('alat')}>Alat Angkut</button>
                            <button className={`inner-tab ${subTab === 'anggaran' ? 'active' : ''}`} onClick={() => setSubTab('anggaran')}>Mata Anggaran</button>
                        </div>

                        <div className="referensi-content">
                            {subTab === 'pangkat' && (
                                <div className="card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                        <h4>Master Pangkat</h4>
                                        <button className="btn btn-primary btn-sm" onClick={() => handleOpenRefModal()}><Plus size={16} /> Tambah</button>
                                    </div>
                                    <table className="simple-table">
                                        <thead><tr><th>Nama Pangkat</th><th>Urutan</th><th>Aksi</th></tr></thead>
                                        <tbody>
                                            {pangkats.map(p => (
                                                <tr key={p.id}><td>{p.nama}</td><td>{p.urutan}</td><td>
                                                    <button className="btn-icon-sm" onClick={() => handleOpenRefModal(p)}><Edit size={14} /></button>
                                                    <button className="btn-icon-sm" onClick={() => { if (confirm('Hapus pangkat ini?')) deletePangkat(p.id); }}><Trash2 size={14} /></button>
                                                </td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {subTab === 'golongan' && (
                                <div className="card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                        <h4>Master Golongan</h4>
                                        <button className="btn btn-primary btn-sm" onClick={() => handleOpenRefModal()}><Plus size={16} /> Tambah</button>
                                    </div>
                                    <table className="simple-table">
                                        <thead><tr><th>Nama Golongan</th><th>Urutan</th><th>Aksi</th></tr></thead>
                                        <tbody>
                                            {golongans.map(g => (
                                                <tr key={g.id}><td>{g.nama}</td><td>{g.urutan}</td><td>
                                                    <button className="btn-icon-sm" onClick={() => handleOpenRefModal(g)}><Edit size={14} /></button>
                                                    <button className="btn-icon-sm" onClick={() => { if (confirm('Hapus golongan ini?')) deleteGolongan(g.id); }}><Trash2 size={14} /></button>
                                                </td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {subTab === 'tingkat' && (
                                <div className="card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                        <h4>Tingkat Perjalanan Dinas</h4>
                                        <button className="btn btn-primary btn-sm" onClick={() => handleOpenRefModal()}><Plus size={16} /> Tambah</button>
                                    </div>
                                    <table className="simple-table">
                                        <thead><tr><th>Kode</th><th>Deskripsi</th><th>Aksi</th></tr></thead>
                                        <tbody>
                                            {tingkatPerjalanan.map(t => (
                                                <tr key={t.id}><td><strong>{t.kode}</strong></td><td>{t.deskripsi}</td><td>
                                                    <button className="btn-icon-sm" onClick={() => handleOpenRefModal(t)}><Edit size={14} /></button>
                                                    <button className="btn-icon-sm" onClick={() => { if (confirm('Hapus tingkat ini?')) deleteTingkatPerjalanan(t.id); }}><Trash2 size={14} /></button>
                                                </td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {subTab === 'alat' && (
                                <div className="card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                        <h4>Alat Angkut</h4>
                                        <button className="btn btn-primary btn-sm" onClick={() => handleOpenRefModal()}><Plus size={16} /> Tambah</button>
                                    </div>
                                    <table className="simple-table">
                                        <thead><tr><th>Nama Alat Angkut</th><th>Aksi</th></tr></thead>
                                        <tbody>
                                            {alatAngkut.map(a => (
                                                <tr key={a.id}><td>{a.nama}</td><td>
                                                    <button className="btn-icon-sm" onClick={() => handleOpenRefModal(a)}><Edit size={14} /></button>
                                                    <button className="btn-icon-sm" onClick={() => { if (confirm('Hapus alat angkut ini?')) deleteAlatAngkut(a.id); }}><Trash2 size={14} /></button>
                                                </td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {subTab === 'anggaran' && (
                                <div className="card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                        <h4>Mata Anggaran</h4>
                                        <button className="btn btn-primary btn-sm" onClick={() => handleOpenRefModal()}><Plus size={16} /> Tambah</button>
                                    </div>
                                    <table className="simple-table">
                                        <thead><tr><th>Kode</th><th>Nama Anggaran</th><th>Tahun</th><th>Aksi</th></tr></thead>
                                        <tbody>
                                            {mataAnggaran.map(m => (
                                                <tr key={m.id}><td><code>{m.kode}</code></td><td>{m.nama}</td><td>{m.tahun}</td><td>
                                                    <button className="btn-icon-sm" onClick={() => handleOpenRefModal(m)}><Edit size={14} /></button>
                                                    <button className="btn-icon-sm" onClick={() => { if (confirm('Hapus mata anggaran ini?')) deleteMataAnggaran(m.id); }}><Trash2 size={14} /></button>
                                                </td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isRefModalOpen}
                onClose={() => setIsRefModalOpen(false)}
                title={editingRef ? `Edit ${subTab}` : `Tambah ${subTab}`}
            >
                <form onSubmit={handleRefSubmit}>
                    {(subTab === 'pangkat' || subTab === 'golongan' || subTab === 'alat') && (
                        <div className="form-group">
                            <label className="form-label">Nama {subTab} *</label>
                            <input
                                type="text"
                                className="form-input"
                                required
                                value={refFormData.nama || ''}
                                onChange={(e) => setRefFormData({ ...refFormData, nama: e.target.value })}
                            />
                        </div>
                    )}

                    {(subTab === 'pangkat' || subTab === 'golongan') && (
                        <div className="form-group">
                            <label className="form-label">Urutan</label>
                            <input
                                type="number"
                                className="form-input"
                                value={refFormData.urutan || ''}
                                onChange={(e) => setRefFormData({ ...refFormData, urutan: parseInt(e.target.value) })}
                            />
                        </div>
                    )}

                    {subTab === 'tingkat' && (
                        <>
                            <div className="form-group">
                                <label className="form-label">Kode Tingkat *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    required
                                    placeholder="Contoh: A"
                                    value={refFormData.kode || ''}
                                    onChange={(e) => setRefFormData({ ...refFormData, kode: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Deskripsi *</label>
                                <textarea
                                    className="form-input"
                                    required
                                    value={refFormData.deskripsi || ''}
                                    onChange={(e) => setRefFormData({ ...refFormData, deskripsi: e.target.value })}
                                />
                            </div>
                        </>
                    )}

                    {subTab === 'anggaran' && (
                        <>
                            <div className="form-group">
                                <label className="form-label">Kode Anggaran *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    required
                                    value={refFormData.kode || ''}
                                    onChange={(e) => setRefFormData({ ...refFormData, kode: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Nama Anggaran *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    required
                                    value={refFormData.nama || ''}
                                    onChange={(e) => setRefFormData({ ...refFormData, nama: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Tahun</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={refFormData.tahun || ''}
                                    onChange={(e) => setRefFormData({ ...refFormData, tahun: parseInt(e.target.value) })}
                                />
                            </div>
                        </>
                    )}

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                        <button type="button" className="btn btn-outline" onClick={() => setIsRefModalOpen(false)}>Batal</button>
                        <button type="submit" className="btn btn-primary" disabled={isSavingRef}>
                            {isSavingRef ? <Loader2 className="spin" /> : 'Simpan Data'}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingTtd ? 'Edit Pejabat Penandatangan' : 'Tambah Pejabat Penandatangan'}
            >
                <form onSubmit={handleTtdSubmit}>
                    <div className="form-group">
                        <label className="form-label">Nama Lengkap & Gelar *</label>
                        <input
                            type="text"
                            className="form-input"
                            required
                            value={ttdFormData.nama_lengkap || ''}
                            onChange={(e) => setTtdFormData({ ...ttdFormData, nama_lengkap: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">NIP *</label>
                        <input
                            type="text"
                            className="form-input"
                            required
                            value={ttdFormData.nip || ''}
                            onChange={(e) => setTtdFormData({ ...ttdFormData, nip: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Jabatan Lengkap *</label>
                        <textarea
                            className="form-input"
                            rows={2}
                            required
                            placeholder="Contoh: Plt. Kepala Badan Pendapatan Pengelolaan Keuangan dan Aset Daerah"
                            value={ttdFormData.jabatan || ''}
                            onChange={(e) => setTtdFormData({ ...ttdFormData, jabatan: e.target.value })}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group">
                            <label className="form-label">Pangkat</label>
                            <select
                                className="form-input"
                                value={ttdFormData.pangkat_id || ''}
                                onChange={(e) => setTtdFormData({ ...ttdFormData, pangkat_id: Number(e.target.value) })}
                            >
                                <option value="">Pilih Pangkat</option>
                                {pangkats?.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Golongan</label>
                            <select
                                className="form-input"
                                value={ttdFormData.golongan_id || ''}
                                onChange={(e) => setTtdFormData({ ...ttdFormData, golongan_id: Number(e.target.value) })}
                            >
                                <option value="">Pilih Golongan</option>
                                {golongans?.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Jenis Dokumen yang Ditandatangani</label>
                        <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                            {['SPT', 'SPPD'].map(type => (
                                <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={ttdFormData.jenis_dokumen?.includes(type)}
                                        onChange={(e) => {
                                            const current = ttdFormData.jenis_dokumen || [];
                                            if (e.target.checked) setTtdFormData({ ...ttdFormData, jenis_dokumen: [...current, type] });
                                            else setTtdFormData({ ...ttdFormData, jenis_dokumen: current.filter(t => t !== type) });
                                        }}
                                    />
                                    {type}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Tanda Tangan Digital</label>
                        <div className="ttd-upload-box">
                            {ttdFormData.ttd_digital_path ? (
                                <div className="ttd-preview-box">
                                    <img src={ttdFormData.ttd_digital_path} alt="Preview TTD" />
                                    <label className="change-btn">
                                        Ubah
                                        <input type="file" hidden onChange={handleTtdUpload} accept="image/*" />
                                    </label>
                                </div>
                            ) : (
                                <label className="upload-placeholder">
                                    {uploadingTtd ? <Loader2 className="spin" /> : <><Upload size={24} /> <span>Upload Tanda Tangan (PNG Transparan)</span></>}
                                    <input type="file" hidden onChange={handleTtdUpload} accept="image/*" />
                                </label>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                        <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Batal</button>
                        <button type="submit" className="btn btn-primary" disabled={isSavingTtd}>
                            {isSavingTtd ? <Loader2 className="spin" /> : 'Simpan Pejabat'}
                        </button>
                    </div>
                </form>
            </Modal>

            <style>{`
        .tabs {
          display: flex;
          gap: 8px;
          border-bottom: 2px solid var(--light-grey);
          padding-bottom: 1px;
        }
        .tab-btn {
          padding: 12px 24px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          color: var(--medium-grey);
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: all 0.2s;
          margin-bottom: -2px;
        }
        .tab-btn:hover {
          color: var(--primary-blue);
        }
        .tab-btn.active {
          color: var(--primary-blue);
          border-bottom-color: var(--primary-blue);
        }
        
        /* Instansi Styles */
        .card-header {
          margin-bottom: 24px;
        }
        .logo-preview {
          width: 200px;
          height: 200px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
          position: relative;
          overflow: hidden;
          background: white;
        }
        .logo-preview img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        .no-logo {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          color: #94a3b8;
        }
        .logo-btn {
          width: 200px;
          justify-content: center;
        }
        .help-text {
          font-size: 12px;
          color: var(--medium-grey);
          margin-top: 8px;
        }
        .logo-overlay {
          position: absolute;
          inset: 0;
          background: rgba(255,255,255,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Penandatangan Grid */
        .ttd-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
        }
        .ttd-card {
          margin-bottom: 0px;
          padding: 20px;
        }
        .ttd-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .status-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .status-badge.active { background: #dcfce7; color: #166534; }
        .status-badge.inactive { background: #f1f5f9; color: #64748b; }
        
        .ttd-body {
          display: flex;
          gap: 20px;
        }
        .ttd-sign-preview {
          width: 100px;
          height: 100px;
          border: 1px dashed #cbd5e1;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8fafc;
        }
        .ttd-sign-preview img {
          max-width: 90%;
          max-height: 90%;
          object-fit: contain;
        }
        .no-sign { font-size: 10px; color: #94a3b8; text-transform: uppercase; }
        
        .ttd-info h4 { margin-top: 0; font-size: 16px; }
        .ttd-nip { font-family: monospace; font-size: 13px; margin-bottom: 4px; }
        .ttd-jabatan { font-size: 13px; line-height: 1.4; margin-bottom: 4px; }
        .ttd-pangkat { font-size: 12px; color: var(--medium-grey); margin-bottom: 10px; }
        
        .ttd-doc-types { display: flex; gap: 4px; }
        .doc-type-badge {
          background: #e0f2fe;
          color: #0369a1;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
        }

        /* Modal Sign Upload */
        .ttd-upload-box {
          border: 1px dashed #cbd5e1;
          border-radius: 8px;
          padding: 10px;
          background: #f8fafc;
        }
        .upload-placeholder {
          height: 120px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: var(--medium-grey);
          cursor: pointer;
        }
        .ttd-preview-box {
          position: relative;
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border-radius: 4px;
        }
        .ttd-preview-box img { max-height: 100%; max-width: 100%; object-fit: contain; }
        .change-btn {
          position: absolute;
          bottom: 8px;
          right: 8px;
          background: var(--dark-grey);
          color: white;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
        }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* New Tables and Badges */
        .settings-table { width: 100%; border-collapse: collapse; }
        .settings-table th { background: #f8fafc; padding: 16px; text-align: left; font-size: 12px; text-transform: uppercase; color: var(--p-text-muted); border-bottom: 1px solid var(--p-border); }
        .settings-table td { padding: 16px; border-bottom: 1px solid var(--p-border); vertical-align: middle; }
        
        .role-badge { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .role-badge.admin { background: #fee2e2; color: #b91c1c; }
        .role-badge.operator { background: #e0f2fe; color: #0369a1; }
        .role-badge.pejabat { background: #fef9c3; color: #a16207; }
        .role-badge.pegawai { background: #f1f5f9; color: #475569; }

        .status-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; }
        .status-pill::before { content: ""; width: 8px; height: 8px; border-radius: 50%; }
        .status-pill.online::before { background: #22c55e; box-shadow: 0 0 8px rgba(34, 197, 94, 0.5); }
        .status-pill.offline::before { background: #94a3b8; }

        .inner-tabs { display: flex; gap: 4px; margin-bottom: 20px; background: #f1f5f9; padding: 4px; border-radius: 10px; width: fit-content; }
        .inner-tab { padding: 8px 16px; border: none; background: transparent; color: var(--p-text-muted); font-size: 13px; font-weight: 600; cursor: pointer; border-radius: 8px; transition: all 0.2s; }
        .inner-tab.active { background: white; color: var(--p-primary); shadow: var(--shadow-p); }

        .simple-table { width: 100%; border-collapse: collapse; }
        .simple-table th { text-align: left; font-size: 11px; color: var(--p-text-muted); padding: 8px; border-bottom: 1px solid var(--p-border); }
        .simple-table td { padding: 12px 8px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        
        .btn-icon-success { color: #22c55e; }
        .btn-icon-success:hover { background: #f0fdf4; }
      `}</style>
        </div>
    );
};

export default Settings;
