import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSPT } from '../hooks/useSPT';
import { usePegawai } from '../hooks/usePegawai';
import { useSettings } from '../hooks/useSettings';
import type { SPT } from '../types/spt';
import MultiSelectPegawai from '../components/MultiSelectPegawai';
import {
    ArrowLeft,
    Save,
    FileCheck,
    FileText,
    Plus,
    Trash2,
    Info,
    ChevronRight,
    Loader2,
    Users
} from 'lucide-react';

const SPTForm: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { spts, createSPT, updateSPT, generateSPTNumber } = useSPT();
    const { pegawai: allPegawai } = usePegawai();
    const { instansi, penandatangan } = useSettings();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedPegawaiIds, setSelectedPegawaiIds] = useState<number[]>([]);

    const [formData, setFormData] = useState<Partial<SPT>>({
        nomor_spt: '',
        tanggal_penetapan: new Date().toISOString().split('T')[0],
        tempat_penetapan: instansi?.kabupaten_kota || '',
        dasar_perintah: [''],
        tujuan_kegiatan: [''],
        lama_kegiatan: 1,
        pembebanan_anggaran: '',
        status: 'Draft',
        header_style: 'SKPD',
        catatan: ''
    });

    useEffect(() => {
        if (id && spts.length > 0) {
            const existing = spts.find(s => s.id === Number(id));
            if (existing) {
                setFormData({
                    ...existing,
                    dasar_perintah: Array.isArray(existing.dasar_perintah) ? existing.dasar_perintah : [existing.dasar_perintah || ''],
                    tujuan_kegiatan: Array.isArray(existing.tujuan_kegiatan) ? existing.tujuan_kegiatan : [existing.tujuan_kegiatan || '']
                });
                setSelectedPegawaiIds(existing.pegawai_list?.map(p => p.pegawai_id) || []);
            }
        } else if (!id) {
            generateSPTNumber().then(num => setFormData(prev => ({ ...prev, nomor_spt: num })));
        }
    }, [id, spts, generateSPTNumber]);

    const handleSubmit = async (e: React.FormEvent, status: 'Draft' | 'Final') => {
        e.preventDefault();
        if (selectedPegawaiIds.length === 0) {
            alert('Mohon pilih minimal satu personel penugasan.');
            return;
        }

        setIsSubmitting(true);
        try {
            const { instansi: _, penandatangan: __, pegawai_list: ___, ...cleanData } = formData;
            const data = {
                ...cleanData,
                status,
                instansi_id: instansi?.id,
                dasar_perintah: formData.dasar_perintah?.filter(d => d.trim() !== ''),
                tujuan_kegiatan: formData.tujuan_kegiatan?.filter(t => t.trim() !== '')
            };

            if (id) {
                await updateSPT(Number(id), data, selectedPegawaiIds);
            } else {
                await createSPT(data, selectedPegawaiIds);
            }
            navigate('/spt');
        } catch (err: any) {
            alert('Gagal menyimpan: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddTujuan = () => {
        setFormData({ ...formData, tujuan_kegiatan: [...(formData.tujuan_kegiatan || []), ''] });
    };

    const handleUpdateTujuan = (index: number, value: string) => {
        const next = [...(formData.tujuan_kegiatan || [])];
        next[index] = value;
        setFormData({ ...formData, tujuan_kegiatan: next });
    };

    const handleRemoveTujuan = (index: number) => {
        const next = (formData.tujuan_kegiatan || []).filter((_, i) => i !== index);
        setFormData({ ...formData, tujuan_kegiatan: next.length ? next : [''] });
    };

    const handleAddDasar = () => {
        setFormData({ ...formData, dasar_perintah: [...(formData.dasar_perintah || []), ''] });
    };

    const handleUpdateDasar = (index: number, value: string) => {
        const next = [...(formData.dasar_perintah || [])];
        next[index] = value;
        setFormData({ ...formData, dasar_perintah: next });
    };

    const handleRemoveDasar = (index: number) => {
        const next = (formData.dasar_perintah || []).filter((_, i) => i !== index);
        setFormData({ ...formData, dasar_perintah: next.length ? next : [''] });
    };

    return (
        <div className="form-page-v2">
            <header className="page-header-v2">
                <button onClick={() => navigate('/spt')} className="back-btn-v2">
                    <ArrowLeft size={20} />
                </button>
                <div className="header-content-v2">
                    <div className="breadcrumb-v2">
                        <span>Administrasi SPT</span>
                        <ChevronRight size={14} />
                        <span>{id ? 'Perbarui Dokumen' : 'Registrasi Baru'}</span>
                    </div>
                    <h1>{id ? 'Redaksi Surat Perintah' : 'Penyusunan SPT Baru'}</h1>
                </div>
                <div className="header-actions-v2">
                    <button
                        type="button"
                        className="btn btn-outline"
                        onClick={(e) => handleSubmit(e, 'Draft')}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? <Loader2 className="spin" size={18} /> : <><Save size={18} /> Simpan Draft</>}
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={(e) => handleSubmit(e, 'Final')}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? <Loader2 className="spin" size={18} /> : <><FileCheck size={18} /> Finalkan Dokumen</>}
                    </button>
                </div>
            </header>

            <div className="form-grid-v2">
                <form className="main-form-v2">
                    <section className="form-section-v2 card">
                        <div className="section-header-v2">
                            <div className="section-icon-v2"><Info size={18} /></div>
                            <h3>Informasi Fondasi Dokumen</h3>
                        </div>

                        <div className="form-group">
                            <label className="form-label-v2">Dasar Hukum / Perintah Pelaksanaan *</label>
                            <div className="tujuan-list-v2">
                                {(formData.dasar_perintah || ['']).map((d, i) => (
                                    <div key={i} className="tujuan-item-v2">
                                        <div className="tujuan-index-v2">{i + 1}</div>
                                        <textarea
                                            className="form-input-v2"
                                            rows={3}
                                            required
                                            placeholder="Contoh: Undang-Undang Nomor 28 Tahun 2009 tentang Pajak Daerah..."
                                            value={d}
                                            onChange={(e) => handleUpdateDasar(i, e.target.value)}
                                            style={{ resize: 'vertical', minHeight: '80px' }}
                                        />
                                        <button type="button" className="remove-tujuan-v2" onClick={() => handleRemoveDasar(i)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                <button type="button" className="add-tujuan-btn-v2" onClick={handleAddDasar}>
                                    <Plus size={16} /> Tambah Dasar Hukum
                                </button>
                            </div>
                        </div>

                        <div className="form-row-v2">
                            <div className="form-group">
                                <label className="form-label-v2">Nomor Registrasi SPT *</label>
                                <input
                                    type="text"
                                    className="form-input-v2"
                                    required
                                    value={formData.nomor_spt || ''}
                                    onChange={(e) => setFormData({ ...formData, nomor_spt: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label-v2">Model Kop Surat (Hierarki)</label>
                                <select
                                    className="form-input-v2"
                                    value={formData.header_style || 'SKPD'}
                                    onChange={(e) => setFormData({ ...formData, header_style: e.target.value as any })}
                                >
                                    <option value="SKPD">Logo SKPD (Standar Dinas)</option>
                                    <option value="Bupati">Kop Bupati (Untuk Kepala Dinas)</option>
                                    <option value="Sekda">Kop Sekretariat Daerah</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group" style={{ marginTop: '20px' }}>
                            <label className="form-label-v2">Sumber Pembiayaan</label>
                            <input
                                type="text"
                                className="form-input-v2"
                                placeholder="Contoh: APBD Perubahan 2024"
                                value={formData.pembebanan_anggaran || ''}
                                onChange={(e) => setFormData({ ...formData, pembebanan_anggaran: e.target.value })}
                            />
                        </div>
                    </section>

                    <section className="form-section-v2 card">
                        <div className="section-header-v2">
                            <div className="section-icon-v2"><FileText size={18} /></div>
                            <h3>Deskripsi & Tujuan Penugasan</h3>
                        </div>

                        <div className="tujuan-list-v2">
                            <label className="form-label-v2">Maksud / Tujuan Kegiatan Dinas *</label>
                            {(formData.tujuan_kegiatan || ['']).map((t, i) => (
                                <div key={i} className="tujuan-item-v2">
                                    <div className="tujuan-index-v2">{i + 1}</div>
                                    <textarea
                                        className="form-input-v2"
                                        rows={5}
                                        required
                                        placeholder="Contoh: Melakukan koordinasi teknis terkait pengelolaan pajak daerah..."
                                        value={t}
                                        onChange={(e) => handleUpdateTujuan(i, e.target.value)}
                                        style={{ resize: 'vertical', minHeight: '120px' }}
                                    />
                                    <button type="button" className="remove-tujuan-v2" onClick={() => handleRemoveTujuan(i)}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                            <button type="button" className="add-tujuan-btn-v2" onClick={handleAddTujuan}>
                                <Plus size={16} /> Tambah Poin Tujuan
                            </button>
                        </div>

                        <div className="form-row-v2" style={{ marginTop: '20px' }}>
                            <div className="form-group">
                                <label className="form-label-v2">Durasi Pelaksanaan (Hari)</label>
                                <input
                                    type="number"
                                    className="form-input-v2"
                                    min={1}
                                    value={formData.lama_kegiatan || 1}
                                    onChange={(e) => setFormData({ ...formData, lama_kegiatan: Number(e.target.value) })}
                                />
                            </div>
                            <div className="form-group"></div>
                        </div>
                    </section>

                    <section className="form-section-v2 card">
                        <div className="section-header-v2">
                            <div className="section-icon-v2"><FileCheck size={18} /></div>
                            <h3>Legalisasi & Penetapan</h3>
                        </div>

                        <div className="form-row-v2">
                            <div className="form-group">
                                <label className="form-label-v2">Tempat Penetapan *</label>
                                <input
                                    type="text"
                                    className="form-input-v2"
                                    required
                                    value={formData.tempat_penetapan || ''}
                                    onChange={(e) => setFormData({ ...formData, tempat_penetapan: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label-v2">Tanggal Penetapan *</label>
                                <input
                                    type="date"
                                    className="form-input-v2"
                                    required
                                    value={formData.tanggal_penetapan || ''}
                                    onChange={(e) => setFormData({ ...formData, tanggal_penetapan: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label-v2">Otoritas Penandatangan *</label>
                            <select
                                className="form-input-v2"
                                required
                                value={formData.penandatangan_id || ''}
                                onChange={(e) => setFormData({ ...formData, penandatangan_id: Number(e.target.value) })}
                            >
                                <option value="">Pilih Pejabat Berwenang</option>
                                {penandatangan.filter(p => p.jenis_dokumen.includes('SPT')).map(p => (
                                    <option key={p.id} value={p.id}>{p.nama_lengkap} - {p.jabatan}</option>
                                ))}
                            </select>
                        </div>
                    </section>
                </form>

                <aside className="side-panel-v2">
                    <div className="side-card-v2 glass-effect">
                        <div className="side-card-header-v2">
                            <div className="header-with-icon-v2">
                                <Users size={18} />
                                <h3>Personel Ditugaskan</h3>
                            </div>
                            <span className="count-badge-v2">{selectedPegawaiIds.length} Pegawai</span>
                        </div>
                        <div className="side-card-body-v2">
                            <MultiSelectPegawai
                                availablePegawai={allPegawai.filter(p => p.status_aktif)}
                                selectedIds={selectedPegawaiIds}
                                onChange={setSelectedPegawaiIds}
                            />
                        </div>
                    </div>

                    <div className="side-card-v2" style={{ marginTop: '24px' }}>
                        <div className="side-card-header-v2">
                            <h3>Catatan Internal</h3>
                        </div>
                        <div className="side-card-body-v2">
                            <textarea
                                className="form-input-v2"
                                rows={4}
                                placeholder="Catatan rahasia/internal (tidak untuk dicetak)..."
                                value={formData.catatan || ''}
                                onChange={(e) => setFormData({ ...formData, catatan: e.target.value })}
                            />
                        </div>
                    </div>
                </aside>
            </div>

            <style>{`
        .form-page-v2 { max-width: 1400px; margin: 0 auto; padding-bottom: 60px; }
        .page-header-v2 { display: flex; align-items: center; gap: 24px; margin-bottom: 32px; background: white; padding: 24px 32px; border-radius: 20px; border: 1px solid var(--p-border); box-shadow: var(--shadow-p); }
        .back-btn-v2 { width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--p-border); background: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: var(--transition-p); color: var(--p-text-muted); }
        .back-btn-v2:hover { background: #f8fafc; color: var(--p-primary); border-color: var(--p-primary); }
        .header-content-v2 { flex: 1; }
        .breadcrumb-v2 { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: var(--p-accent); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .header-content-v2 h1 { font-size: 28px; color: var(--p-primary); margin: 0; letter-spacing: -0.5px; }
        .header-actions-v2 { display: flex; gap: 12px; }

        .form-grid-v2 { display: grid; grid-template-columns: 1fr 380px; gap: 32px; align-items: start; }
        .main-form-v2 { display: flex; flex-direction: column; gap: 24px; }
        .form-section-v2 { padding: 32px; }
        .section-header-v2 { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px; }
        .section-icon-v2 { width: 36px; height: 36px; background: #eff6ff; color: var(--p-accent); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .section-header-v2 h3 { font-size: 18px; color: var(--p-primary); margin: 0; }

        .form-label-v2 { display: block; font-size: 14px; font-weight: 700; color: var(--p-text-main); margin-bottom: 10px; }
        .form-input-v2 { width: 100%; padding: 12px 16px; border-radius: 12px; border: 1px solid var(--p-border); background: #f8fafc; font-size: 15px; color: var(--p-text-main); font-family: var(--font-main); transition: var(--transition-p); outline: none; }
        .form-input-v2:focus { border-color: var(--p-accent); background: white; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1); }
        .form-row-v2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 20px; }

        .tujuan-list-v2 { display: flex; flex-direction: column; gap: 16px; }
        .tujuan-item-v2 { display: flex; gap: 16px; align-items: flex-start; background: #f8fafc; padding: 18px; border-radius: 16px; border: 1px solid var(--p-border); }
        .tujuan-index-v2 { width: 32px; height: 32px; background: var(--p-primary); color: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; flex-shrink: 0; margin-top: 4px; }
        .remove-tujuan-v2 { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: var(--p-text-muted); background: white; border: 1px solid var(--p-border); cursor: pointer; border-radius: 10px; transition: 0.2s; margin-top: 4px; }
        .remove-tujuan-v2:hover { background: #fee2e2; color: var(--p-error); border-color: #fecaca; }
        .add-tujuan-btn-v2 { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 12px; background: transparent; border: 2px dashed var(--p-border); border-radius: 12px; color: var(--p-text-muted); font-weight: 700; font-size: 14px; cursor: pointer; transition: 0.2s; margin-top: 12px; }
        .add-tujuan-btn-v2:hover { border-color: var(--p-accent); color: var(--p-accent); background: #f0f9ff; }

        .side-panel-v2 { position: sticky; top: 24px; }
        .side-card-v2 { background: white; border: 1px solid var(--p-border); border-radius: 20px; box-shadow: var(--shadow-p); overflow: hidden; }
        .side-card-header-v2 { padding: 20px 24px; border-bottom: 1px solid var(--p-border); display: flex; justify-content: space-between; align-items: center; }
        .header-with-icon-v2 { display: flex; align-items: center; gap: 10px; }
        .side-card-header-v2 h3 { font-size: 16px; color: var(--p-primary); margin: 0; }
        .count-badge-v2 { font-size: 11px; font-weight: 800; background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 99px; }
        .side-card-body-v2 { padding: 20px; }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
        </div>
    );
};

export default SPTForm;
