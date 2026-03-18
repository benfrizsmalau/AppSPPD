import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useSPPD } from '../hooks/useSPPD';
import { useSPT } from '../hooks/useSPT';
import { usePegawai } from '../hooks/usePegawai';
import { useSettings } from '../hooks/useSettings';
import { useReferensi } from '../hooks/useReferensi';
import type { SPPD } from '../types/sppd';
import MultiSelectPegawai from '../components/MultiSelectPegawai';
import {
    ArrowLeft,
    Save,
    FileCheck,
    Calendar,
    MapPin,
    Plane,
    Link as LinkIcon,
    ChevronRight,
    Info,
    Users,
    Briefcase,
    Loader2
} from 'lucide-react';

const SPPDForm: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const fromSptId = queryParams.get('spt_id');

    const { sppds, createSPPD, updateSPPD, generateSPPDNumber } = useSPPD();
    const { spts } = useSPT();
    const { pegawai: allPegawai } = usePegawai();
    const { instansi, penandatangan } = useSettings();
    const { tingkatPerjalanan, alatAngkut: listAlatAngkut, mataAnggaran: listAnggaran } = useReferensi();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedPengikutIds, setSelectedPengikutIds] = useState<number[]>([]);

    const [formData, setFormData] = useState<Partial<SPPD>>({
        nomor_sppd: '',
        pejabat_pemberi_perintah_id: undefined,
        tingkat_perjalanan: '',
        tingkat_biaya_id: undefined,
        mata_anggaran: '',
        mata_anggaran_id: undefined,
        maksud_perjalanan: '',
        alat_angkut: '',
        alat_angkut_id: undefined,
        tempat_berangkat: instansi?.kabupaten_kota || '',
        tempat_tujuan: '',
        tempat_penerbitan: instansi?.kabupaten_kota || '',
        tanggal_penerbitan: new Date().toISOString().split('T')[0],
        lama_perjalanan: 1,
        tanggal_berangkat: new Date().toISOString().split('T')[0],
        tanggal_kembali: new Date().toISOString().split('T')[0],
        status: 'Draft'
    });

    useEffect(() => {
        if (fromSptId && spts.length > 0) {
            const spt = spts.find(s => s.id === Number(fromSptId));
            if (spt) {
                setFormData(prev => ({
                    ...prev,
                    spt_id: spt.id,
                    maksud_perjalanan: spt.tujuan_kegiatan.join('; '),
                    lama_perjalanan: spt.lama_kegiatan,
                    tanggal_berangkat: spt.tanggal_penetapan,
                    // Try to pre-fill from instansi if available
                    tempat_berangkat: prev.tempat_berangkat || instansi?.kabupaten_kota || '',
                    tempat_penerbitan: prev.tempat_penerbitan || instansi?.kabupaten_kota || ''
                }));
                // Auto-populate from SPT personnel
                if (spt?.pegawai_list && spt.pegawai_list.length > 0) {
                    // 1st person is Main
                    setFormData(prev => ({ ...prev, pegawai_id: spt.pegawai_list?.[0].pegawai_id }));
                    // Others are Followers
                    if (spt.pegawai_list.length > 1) {
                        setSelectedPengikutIds(spt.pegawai_list.slice(1).map(p => p.pegawai_id));
                    }
                }
            }
        }
    }, [fromSptId, spts, instansi]);

    // Update defaults when settings/instansi load
    useEffect(() => {
        if (instansi && !id) {
            setFormData(prev => ({
                ...prev,
                tempat_berangkat: prev.tempat_berangkat || instansi.kabupaten_kota,
                tempat_penerbitan: prev.tempat_penerbitan || instansi.kabupaten_kota
            }));
        }
    }, [instansi, id]);

    useEffect(() => {
        if (id && sppds.length > 0) {
            const existing = sppds.find(s => s.id === Number(id));
            if (existing) {
                setFormData(existing);
                setSelectedPengikutIds(existing.pengikut?.map(p => p.pegawai_id) || []);
            }
        } else if (!id) {
            generateSPPDNumber().then(num => setFormData(prev => ({ ...prev, nomor_sppd: num })));
        }
    }, [id, sppds, generateSPPDNumber]);

    const handleSubmit = async (e: React.FormEvent, status: 'Draft' | 'Final') => {
        e.preventDefault();
        if (!formData.pegawai_id) {
            alert('Mohon tentukan personel utama perjalanan dinas.');
            return;
        }

        setIsSubmitting(true);
        try {
            // Robustly strip all relation objects and non-column fields
            const {
                pegawai, spt, penandatangan: _, instansi: __, pengikut,
                pejabat_pemberi_perintah, tingkat_biaya, moda_transportasi,
                anggaran_ref,
                ...cleanData
            } = formData as any;

            const finalData = {
                ...cleanData,
                status,
                instansi_id: instansi?.id,
                penandatangan_id: formData.penandatangan_id || penandatangan.find(p => p.jenis_dokumen.includes('SPPD'))?.id,
                // Ensure mandatory fields are present
                tanggal_penerbitan: formData.tanggal_penerbitan || new Date().toISOString().split('T')[0]
            };

            console.log('Saving SPPD Data:', finalData);

            if (id) {
                await updateSPPD(Number(id), finalData, selectedPengikutIds);
            } else {
                await createSPPD(finalData, selectedPengikutIds);
            }
            navigate('/sppd');
        } catch (err: any) {
            alert('Proses penyimpanan gagal: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="form-page-v2">
            <header className="page-header-v2">
                <button onClick={() => navigate('/sppd')} className="back-btn-v2">
                    <ArrowLeft size={20} />
                </button>
                <div className="header-content-v2">
                    <div className="breadcrumb-v2">
                        <span>Administrasi SPPD</span>
                        <ChevronRight size={14} />
                        <span>{id ? 'Perbarui Perjalanan' : 'Registrasi Perjalanan Baru'}</span>
                    </div>
                    <h1>{id ? 'Redaksi Surat Jalan' : 'Penyusunan SPPD Baru'}</h1>
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
                        {isSubmitting ? <Loader2 className="spin" size={18} /> : <><FileCheck size={18} /> Finalkan Surat</>}
                    </button>
                </div>
            </header>

            <div className="form-grid-v2">
                <form className="main-form-v2">
                    <section className="form-section-v2 card">
                        <div className="section-header-v2">
                            <div className="section-icon-v2"><LinkIcon size={18} /></div>
                            <h3>Referesi & Personel Utama</h3>
                        </div>

                        <div className="form-row-v2">
                            <div className="form-group">
                                <label className="form-label-v2">No. Registrasi SPPD *</label>
                                <input
                                    type="text"
                                    className="form-input-v2"
                                    value={formData.nomor_sppd || ''}
                                    onChange={(e) => setFormData({ ...formData, nomor_sppd: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label-v2">Relasi Dokumen SPT</label>
                                <select
                                    className="form-input-v2"
                                    value={formData.spt_id || ''}
                                    onChange={(e) => {
                                        const sptId = Number(e.target.value);
                                        const spt = spts.find(s => s.id === sptId);
                                        setFormData({
                                            ...formData,
                                            spt_id: sptId,
                                            maksud_perjalanan: spt?.tujuan_kegiatan.join('; ') || formData.maksud_perjalanan
                                        });
                                    }}
                                >
                                    <option value="">-- Pilih Referensi SPT --</option>
                                    {spts.map(s => <option key={s.id} value={s.id}>{s.nomor_spt}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label-v2">Personel Pelaksana (Utama) *</label>
                            <select
                                className="form-input-v2"
                                required
                                value={formData.pegawai_id || ''}
                                onChange={(e) => setFormData({ ...formData, pegawai_id: Number(e.target.value) })}
                            >
                                <option value="">Pilih Personel Utama</option>
                                {allPegawai.map(p => (
                                    <option key={p.id} value={p.id}>{p.nama_lengkap} (NIP. {p.nip})</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label-v2">Pejabat Pemberi Mandat / Perintah *</label>
                            <select
                                className="form-input-v2"
                                required
                                value={formData.pejabat_pemberi_perintah_id || ''}
                                onChange={(e) => setFormData({ ...formData, pejabat_pemberi_perintah_id: Number(e.target.value) })}
                            >
                                <option value="">Pilih Pejabat Pemberi Perintah</option>
                                {allPegawai.map(p => (
                                    <option key={p.id} value={p.id}>{p.nama_lengkap} (NIP. {p.nip})</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label-v2">Pembebanan Mata Anggaran *</label>
                            <select
                                className="form-input-v2"
                                required
                                value={formData.mata_anggaran_id || ''}
                                onChange={(e) => {
                                    const id = Number(e.target.value);
                                    const selected = listAnggaran.find(a => a.id === id);
                                    setFormData({
                                        ...formData,
                                        mata_anggaran_id: id,
                                        mata_anggaran: selected ? `${selected.kode} - ${selected.nama}` : ''
                                    });
                                }}
                            >
                                <option value="">-- Pilih Mata Anggaran --</option>
                                {listAnggaran.map(a => (
                                    <option key={a.id} value={a.id}>{a.kode} - {a.nama}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label-v2">Personel Pengikut (Tambahan)</label>
                            <MultiSelectPegawai
                                availablePegawai={allPegawai.filter(p => p.id !== formData.pegawai_id)}
                                selectedIds={selectedPengikutIds}
                                onChange={setSelectedPengikutIds}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label-v2">Tingkat Biaya Perjalanan Dinas *</label>
                            <select
                                className="form-input-v2"
                                required
                                value={formData.tingkat_biaya_id || ''}
                                onChange={(e) => {
                                    const id = Number(e.target.value);
                                    const selected = tingkatPerjalanan.find(t => t.id === id);
                                    setFormData({
                                        ...formData,
                                        tingkat_biaya_id: id,
                                        tingkat_perjalanan: selected?.kode || ''
                                    });
                                }}
                            >
                                <option value="">Pilih Tingkat Biaya</option>
                                {tingkatPerjalanan.map(t => (
                                    <option key={t.id} value={t.id}>{t.kode} - {t.deskripsi}</option>
                                ))}
                            </select>
                        </div>
                    </section>

                    <section className="form-section-v2 card">
                        <div className="section-header-v2">
                            <div className="section-icon-v2"><Briefcase size={18} /></div>
                            <h3>Maksud & Detail Logistik Perjalanan</h3>
                        </div>

                        <div className="form-group">
                            <label className="form-label-v2">Maksud / Tujuan Perjalanan Dinas *</label>
                            <textarea
                                className="form-input-v2"
                                rows={6}
                                required
                                placeholder="Rincian tujuan spesifik dari perjalanan dinas (Contoh: Menghadiri Rapat Koordinasi Teknis...)"
                                value={formData.maksud_perjalanan || ''}
                                onChange={(e) => setFormData({ ...formData, maksud_perjalanan: e.target.value })}
                                style={{ resize: 'vertical', minHeight: '150px' }}
                            />
                        </div>

                        <div className="form-row-v2" style={{ marginTop: '20px' }}>
                            <div className="form-group">
                                <label className="form-label-v2"><Plane size={14} style={{ marginRight: '6px' }} /> Moda Transportasi</label>
                                <select
                                    className="form-input-v2"
                                    required
                                    value={formData.alat_angkut_id || ''}
                                    onChange={(e) => {
                                        const id = Number(e.target.value);
                                        const selected = listAlatAngkut.find(a => a.id === id);
                                        setFormData({
                                            ...formData,
                                            alat_angkut_id: id,
                                            alat_angkut: selected?.nama || ''
                                        });
                                    }}
                                >
                                    <option value="">Pilih Alat Angkut</option>
                                    {listAlatAngkut.map(a => (
                                        <option key={a.id} value={a.id}>{a.nama}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label-v2">Durasi Tugas (Hari)</label>
                                <input
                                    type="number"
                                    className="form-input-v2"
                                    value={formData.lama_perjalanan || 1}
                                    onChange={(e) => setFormData({ ...formData, lama_perjalanan: Number(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div className="form-row-v2" style={{ marginTop: '20px' }}>
                            <div className="form-group">
                                <label className="form-label-v2"><MapPin size={14} style={{ marginRight: '6px' }} /> Lokasi Keberangkatan</label>
                                <input
                                    type="text"
                                    className="form-input-v2"
                                    value={formData.tempat_berangkat || ''}
                                    onChange={(e) => setFormData({ ...formData, tempat_berangkat: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label-v2"><MapPin size={14} style={{ marginRight: '6px' }} /> Lokasi Tujuan</label>
                                <input
                                    type="text"
                                    className="form-input-v2"
                                    placeholder="Contoh: Medan / Jakarta (Kantor Kementerian)"
                                    value={formData.tempat_tujuan || ''}
                                    onChange={(e) => setFormData({ ...formData, tempat_tujuan: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-row-v2" style={{ marginTop: '20px' }}>
                            <div className="form-group">
                                <label className="form-label-v2"><Calendar size={14} style={{ marginRight: '6px' }} /> Tanggal Keberangkatan</label>
                                <input
                                    type="date"
                                    className="form-input-v2"
                                    value={formData.tanggal_berangkat || ''}
                                    onChange={(e) => setFormData({ ...formData, tanggal_berangkat: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label-v2"><Calendar size={14} style={{ marginRight: '6px' }} /> Tanggal Kepulangan</label>
                                <input
                                    type="date"
                                    className="form-input-v2"
                                    value={formData.tanggal_kembali || ''}
                                    onChange={(e) => setFormData({ ...formData, tanggal_kembali: e.target.value })}
                                />
                            </div>
                        </div>
                    </section>

                    <section className="form-section-v2 card">
                        <div className="section-header-v2">
                            <div className="section-icon-v2"><FileCheck size={18} /></div>
                            <h3>Pengesahan Dokumen</h3>
                        </div>

                        <div className="form-group">
                            <label className="form-label-v2">Pejabat Pengesah (Tanda Tangan) *</label>
                            <select
                                className="form-input-v2"
                                required
                                value={formData.penandatangan_id || ''}
                                onChange={(e) => setFormData({ ...formData, penandatangan_id: Number(e.target.value) })}
                            >
                                <option value="">Pilih Otoritas Penandatangan</option>
                                {penandatangan.filter(p => p.jenis_dokumen.includes('SPPD')).map(p => (
                                    <option key={p.id} value={p.id}>{p.nama_lengkap} - {p.jabatan}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-row-v2" style={{ marginTop: '20px' }}>
                            <div className="form-group">
                                <label className="form-label-v2">Tempat Penerbitan SPPD *</label>
                                <input
                                    type="text"
                                    className="form-input-v2"
                                    required
                                    placeholder="Contoh: Muaro Sijunjung"
                                    value={formData.tempat_penerbitan || ''}
                                    onChange={(e) => setFormData({ ...formData, tempat_penerbitan: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label-v2">Tanggal Penerbitan SPPD *</label>
                                <input
                                    type="date"
                                    className="form-input-v2"
                                    required
                                    value={formData.tanggal_penerbitan || ''}
                                    onChange={(e) => setFormData({ ...formData, tanggal_penerbitan: e.target.value })}
                                />
                            </div>
                        </div>
                    </section>
                </form>

                <aside className="side-panel-v2">
                    <div className="side-card-v2 glass-effect">
                        <div className="side-card-header-v2">
                            <div className="header-with-icon-v2">
                                <Users size={18} />
                                <h3>Personel Terikut</h3>
                            </div>
                            <span className="count-badge-v2">{selectedPengikutIds.length} Orang</span>
                        </div>
                        <div className="side-card-body-v2">
                            <MultiSelectPegawai
                                availablePegawai={allPegawai.filter(p => p.id !== formData.pegawai_id && p.status_aktif)}
                                selectedIds={selectedPengikutIds}
                                onChange={setSelectedPengikutIds}
                            />
                        </div>
                    </div>

                    <div className="help-box-v2" style={{ marginTop: '24px', padding: '20px', background: '#f0f9ff', borderRadius: '20px', border: '1px solid #bae6fd' }}>
                        <div style={{ display: 'flex', gap: '12px', color: '#0369a1' }}>
                            <Info size={20} style={{ flexShrink: 0 }} />
                            <div style={{ fontSize: '13px' }}>
                                <p style={{ margin: '0 0 8px', fontWeight: 800 }}>Tips Penyusunan</p>
                                <p style={{ margin: 0, lineHeight: 1.5, opacity: 0.8 }}>Pastikan tanggal keberangkatan dan kepulangan sesuai dengan durasi (hari) yang telah ditentukan untuk akurasi pelaporan anggaran.</p>
                            </div>
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
        .form-row-v2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }

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

export default SPPDForm;
