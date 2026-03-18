import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { Printer, ArrowLeft, FileText, Loader2 } from 'lucide-react';

const DocumentRenderer: React.FC = () => {
    const { type, id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                if (type === 'spt') {
                    const { data: spt, error } = await supabase
                        .from('spt')
                        .select(`
                            *,
                            instansi:instansi(*),
                            penandatangan:penandatangan(*, pangkat:ref_pangkat(*)),
                            pegawai_list:spt_pegawai(
                                *,
                                pegawai:pegawai(*, pangkat:ref_pangkat(*), golongan:ref_golongan(*))
                            )
                        `)
                        .eq('id', id)
                        .single();

                    if (error) throw error;
                    setData(spt);
                } else if (type === 'sppd') {
                    const { data: sppd, error } = await supabase
                        .from('sppd')
                        .select(`
                            *,
                            instansi:instansi(*),
                            penandatangan:penandatangan(*, pangkat:ref_pangkat(*)),
                            pegawai:pegawai!pegawai_id(*, pangkat:ref_pangkat(*), golongan:ref_golongan(*)),
                            pejabat_pemberi_perintah:pegawai!pejabat_pemberi_perintah_id(*, pangkat:ref_pangkat(*), golongan:ref_golongan(*)),
                            spt:spt(*),
                            tingkat_biaya:ref_tingkat_perjalanan!tingkat_biaya_id(*),
                            moda_transportasi:ref_alat_angkut!alat_angkut_id(*),
                            pengikut:sppd_pengikut(
                                *,
                                pegawai:pegawai!pegawai_id(*, pangkat:ref_pangkat(*), golongan:ref_golongan(*))
                            )
                        `)
                        .eq('id', id)
                        .single();

                    if (error) throw error;
                    setData(sppd);
                }
            } catch (error) {
                console.error('Error fetching document:', error);
            }
            setLoading(false);
        };

        fetchData();
    }, [type, id]);

    const handlePrint = () => {
        window.print();
    };

    const formatNamaPenuh = (pegawai: any) => {
        if (!pegawai) return '-';
        const { gelar_depan, nama_lengkap, gelar_belakang } = pegawai;
        let pName = nama_lengkap;
        if (gelar_depan) pName = `${gelar_depan} ${pName}`;
        if (gelar_belakang) pName = `${pName}, ${gelar_belakang}`;
        return pName;
    };

    if (loading) {
        return (
            <div className="preview-loading">
                <Loader2 className="spin" size={48} color="var(--p-accent)" />
                <p>Mempersiapkan Pratinjau Dokumen...</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="preview-error">
                <FileText size={64} color="var(--p-text-muted)" />
                <h3>Dokumen Tidak Ditemukan</h3>
                <p>Pastikan ID dokumen benar atau hubungi administrator.</p>
                <button onClick={() => navigate(-1)} className="btn btn-primary">
                    <ArrowLeft size={18} /> Kembali
                </button>
            </div>
        );
    }

    const renderSppdBelakang = () => {
        return (
            <div className="sppd-belakang">
                <table className="sppd-back-table">
                    <tbody>
                        <tr>
                            <td width="50%" className="no-padding">
                                <table className="inner-back-table">
                                    <tbody>
                                        <tr><td width="30">I.</td><td>Berangkat dari</td><td>: {data.tempat_berangkat}</td></tr>
                                        <tr><td></td><td>Ke</td><td>: {data.tempat_tujuan}</td></tr>
                                        <tr><td></td><td>Pada tanggal</td><td>: {data.tanggal_berangkat ? format(new Date(data.tanggal_berangkat), 'dd MMMM yyyy', { locale: localeID }) : '-'}</td></tr>
                                        <tr><td></td><td>Kepala</td><td>: {data.instansi?.nama_singkat}</td></tr>
                                        <tr style={{ height: '80px' }}><td></td><td colSpan={2}></td></tr>
                                        <tr><td></td><td colSpan={2} align="center"><strong><u>{formatNamaPenuh(data.penandatangan)}</u></strong><br />{data.penandatangan?.pangkat?.nama}<br />NIP. {data.penandatangan?.nip}</td></tr>
                                    </tbody>
                                </table>
                            </td>
                            <td width="50%" className="no-padding"></td>
                        </tr>
                        <tr>
                            <td className="no-padding">
                                <table className="inner-back-table">
                                    <tbody>
                                        <tr><td width="30">II.</td><td>Tiba di</td><td>: {data.tempat_tujuan}</td></tr>
                                        <tr><td></td><td>Pada tanggal</td><td>: {data.tanggal_berangkat ? format(new Date(data.tanggal_berangkat), 'dd MMMM yyyy', { locale: localeID }) : '-'}</td></tr>
                                        <tr><td></td><td>Kepala</td><td>: </td></tr>
                                        <tr style={{ height: '80px' }}><td></td><td colSpan={2}></td></tr>
                                        <tr><td></td><td colSpan={2}>(...................................................)</td></tr>
                                    </tbody>
                                </table>
                            </td>
                            <td className="no-padding">
                                <table className="inner-back-table">
                                    <tbody>
                                        <tr><td>Berangkat dari</td><td>: {data.tempat_tujuan}</td></tr>
                                        <tr><td>Ke</td><td>: {data.tempat_berangkat}</td></tr>
                                        <tr><td>Pada tanggal</td><td>: {data.tanggal_kembali ? format(new Date(data.tanggal_kembali), 'dd MMMM yyyy', { locale: localeID }) : '-'}</td></tr>
                                        <tr><td>Kepala</td><td>: </td></tr>
                                        <tr style={{ height: '80px' }}><td colSpan={2}></td></tr>
                                        <tr><td colSpan={2}>(...................................................)</td></tr>
                                    </tbody>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td className="no-padding">
                                <table className="inner-back-table">
                                    <tbody>
                                        <tr><td width="30">III.</td><td>Tiba di</td><td>: </td></tr>
                                        <tr><td></td><td>Pada tanggal</td><td>: </td></tr>
                                        <tr><td></td><td>Kepala</td><td>: </td></tr>
                                        <tr style={{ height: '80px' }}><td></td><td colSpan={2}></td></tr>
                                        <tr><td></td><td colSpan={2}>(...................................................)</td></tr>
                                    </tbody>
                                </table>
                            </td>
                            <td className="no-padding">
                                <table className="inner-back-table">
                                    <tbody>
                                        <tr><td>Berangkat dari</td><td>: </td></tr>
                                        <tr><td>Ke</td><td>: </td></tr>
                                        <tr><td>Pada tanggal</td><td>: </td></tr>
                                        <tr><td>Kepala</td><td>: </td></tr>
                                        <tr style={{ height: '80px' }}><td colSpan={2}></td></tr>
                                        <tr><td colSpan={2}>(...................................................)</td></tr>
                                    </tbody>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td className="no-padding">
                                <table className="inner-back-table">
                                    <tbody>
                                        <tr><td width="30">IV.</td><td>Tiba kembali di</td><td>: {data.tempat_berangkat}</td></tr>
                                        <tr><td></td><td>Pada tanggal</td><td>: {data.tanggal_kembali ? format(new Date(data.tanggal_kembali), 'dd MMMM yyyy', { locale: localeID }) : '-'}</td></tr>
                                        <tr><td></td><td colSpan={2} align="center" className="signature-title">{data.penandatangan?.jabatan || 'Pejabat Pembuat Komitmen'}:</td></tr>
                                        <tr style={{ height: '80px' }}><td></td><td colSpan={2}></td></tr>
                                        <tr><td></td><td colSpan={2} align="center"><strong><u>{formatNamaPenuh(data.penandatangan)}</u></strong><br />{data.penandatangan?.pangkat?.nama}<br />NIP. {data.penandatangan?.nip}</td></tr>
                                    </tbody>
                                </table>
                            </td>
                            <td className="no-padding" style={{ verticalAlign: 'top', padding: '10px' }}>
                                <p style={{ fontSize: '10pt' }}>Telah diperiksa, dengan keterangan bahwa perjalanan tersebut di atas benar dilakukan atas perintahnya dan semata-mata untuk kepentingan jabatan dalam waktu yang sesingkat-singkatnya.</p>
                                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                                    <p className="signature-title">{data.penandatangan?.jabatan || 'Pejabat Pembuat Komitmen'}:</p>
                                    <div style={{ height: '80px' }}></div>
                                    <p><strong><u>{formatNamaPenuh(data.penandatangan)}</u></strong><br />{data.penandatangan?.pangkat?.nama}<br />NIP. {data.penandatangan?.nip}</p>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td colSpan={2} style={{ padding: '15px' }}>
                                <strong>V. CATATAN LAIN-LAIN</strong>
                            </td>
                        </tr>
                        <tr>
                            <td colSpan={2} style={{ padding: '15px' }}>
                                <strong>VI. PERHATIAN</strong>
                                <p style={{ fontSize: '9pt', marginTop: '5px' }}>Pejabat yang berwenang menerbitkan SPPD, pegawai yang melakukan perjalanan dinas, para pejabat yang mengesahkan tanggal berangkat/tiba serta Bendaharawan bertanggung jawab berdasarkan peraturan-peraturan Keuangan Negara apabila Negara mendapat rugi akibat kesalahan, kealpaan dan kealpaannya.</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };

    const renderKopSurat = () => {
        // Special logic for SPT dynamic headers
        if (type === 'spt' && data.header_style !== 'SKPD') {
            if (data.header_style === 'Bupati') {
                return (
                    <div className="kop-surat kop-bupati">
                        <div className="kop-logo-center">
                            {data.instansi?.logo_kabupaten_path && <img src={data.instansi.logo_kabupaten_path} alt="Logo Kab" />}
                        </div>
                        <div className="kop-text centered">
                            <h1 className="bupati">BUPATI {data.instansi?.kabupaten_kota?.toUpperCase()}</h1>
                        </div>
                        <div className="kop-border thicker"></div>
                    </div>
                );
            }
            if (data.header_style === 'Sekda') {
                return (
                    <div className="kop-surat kop-sekda">
                        <div className="kop-logo-left">
                            {data.instansi?.logo_kabupaten_path && <img src={data.instansi.logo_kabupaten_path} alt="Logo Kab" />}
                        </div>
                        <div className="kop-text">
                            <h2 className="pemkab">PEMERINTAH KABUPATEN {data.instansi?.kabupaten_kota?.toUpperCase()}</h2>
                            <h1 className="sekda">SEKRETARIAT DAERAH</h1>
                            <p className="alamat">{data.instansi?.alamat}</p>
                            <div className="kop-border"></div>
                        </div>
                    </div>
                );
            }
        }

        // Standard SKPD Header (Dinas)
        return (
            <div className="kop-surat">
                <div className="kop-logo-left">
                    {data.instansi?.logo_kabupaten_path && <img src={data.instansi.logo_kabupaten_path} alt="Logo Kab" />}
                </div>
                <div className="kop-text">
                    <h2 className="pemkab">PEMERINTAH KABUPATEN {data.instansi?.kabupaten_kota?.toUpperCase()}</h2>
                    <h1 className="dinas">{data.instansi?.nama_lengkap?.toUpperCase()}</h1>
                    <p className="alamat">{data.instansi?.alamat}</p>
                    <div className="kontak">
                        {data.instansi?.telepon && <span>Telp. {data.instansi.telepon} </span>}
                        {data.instansi?.kode_pos && <span>KODEPOS {data.instansi.kode_pos} </span>}
                    </div>
                    <div className="kontak">
                        {data.instansi?.email && <span>Email: {data.instansi.email} </span>}
                        {data.instansi?.website && <span>Website: {data.instansi.website}</span>}
                    </div>
                </div>
                <div className="kop-logo-right">
                    {data.instansi?.logo_path && <img src={data.instansi.logo_path} alt="Logo SKPD" />}
                </div>
                <div className="kop-border"></div>
            </div>
        );
    };

    return (
        <div className="doc-preview-page">
            <div className="preview-toolbar no-print">
                <div className="toolbar-left">
                    <button onClick={() => navigate(-1)} className="toolbar-btn" title="Kembali">
                        <ArrowLeft size={18} />
                    </button>
                    <div className="toolbar-title">
                        <FileText size={18} />
                        <span>Pratinjau {type === 'spt' ? 'SPT' : 'SPPD'}</span>
                    </div>
                </div>
                <div className="toolbar-right">
                    <button onClick={handlePrint} className="btn-print-premium">
                        <Printer size={18} />
                        Cetak Dokumen
                    </button>
                </div>
            </div>

            <div className="scroll-area">
                <div className="print-container">
                    {type === 'spt' ? (
                        <div className="spt-official">
                            {renderKopSurat()}
                            <div className="doc-content-body">
                                <div className="doc-title-section">
                                    <h3 className="underline">SURAT PERINTAH TUGAS</h3>
                                    <p>Nomor : {data.nomor_spt}</p>
                                </div>

                                <div className="doc-main-sections">
                                    <table className="borderless-table">
                                        <tbody>
                                            <tr>
                                                <td width="90" valign="top">Dasar :</td>
                                                <td>
                                                    {Array.isArray(data.dasar_perintah) ? (
                                                        <ol className="tujuan-ol" style={{ paddingLeft: '20px', margin: 0 }}>
                                                            {data.dasar_perintah.map((d: string, idx: number) => (
                                                                <li key={idx}>{d}</li>
                                                            ))}
                                                        </ol>
                                                    ) : data.dasar_perintah}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    <div className="commands-header">
                                        <h4>M E M E R I N T A H K A N :</h4>
                                    </div>

                                    <table className="borderless-table">
                                        <tbody>
                                            <tr>
                                                <td width="90" valign="top">Kepada :</td>
                                                <td>
                                                    {data.pegawai_list?.map((pl: any, idx: number) => (
                                                        <div key={idx} className="pegawai-item">
                                                            <div className="pegawai-num">{idx + 1}.</div>
                                                            <div className="pegawai-details">
                                                                <table className="inner-data-table">
                                                                    <tbody>
                                                                        <tr><td width="70">Nama</td><td>:</td><td><strong>{formatNamaPenuh(pl.pegawai)}</strong></td></tr>
                                                                        <tr><td>NIP</td><td>:</td><td>{pl.pegawai?.nip}</td></tr>
                                                                        <tr><td>Pangkat</td><td>:</td><td>{pl.pegawai?.pangkat?.nama} / {pl.pegawai?.golongan?.nama}</td></tr>
                                                                        <tr><td>Jabatan</td><td>:</td><td>{pl.pegawai?.jabatan}</td></tr>
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </td>
                                            </tr>
                                            <tr style={{ height: '15px' }}></tr>
                                            <tr>
                                                <td width="90" valign="top">Untuk :</td>
                                                <td>
                                                    <ol className="tujuan-ol">
                                                        {data.tujuan_kegiatan?.map((t: string, idx: number) => (
                                                            <li key={idx}>{t}</li>
                                                        ))}
                                                    </ol>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div className="signature-area">
                                    <div className="signature-box">
                                        <p>Ditetapkan di : {data.tempat_penetapan}</p>
                                        <p>Pada tanggal : {data.tanggal_penetapan ? format(new Date(data.tanggal_penetapan), 'dd MMMM yyyy', { locale: localeID }) : '-'}</p>
                                        <div className="sign-role">
                                            <strong>{data.penandatangan?.jabatan}</strong>
                                        </div>
                                        <div className="sign-space">
                                            {data.penandatangan?.ttd_digital_path && (
                                                <img src={data.penandatangan.ttd_digital_path} alt="TTD" />
                                            )}
                                        </div>
                                        <div className="sign-name">
                                            <strong><u>{formatNamaPenuh(data.penandatangan)}</u></strong>
                                            <p>{data.penandatangan?.pangkat?.nama}</p>
                                            <p>NIP. {data.penandatangan?.nip}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="sppd-official">
                            <div className="print-page">
                                {renderKopSurat()}
                                <div className="doc-content-body">
                                    <div className="doc-title-section">
                                        <h3 className="underline">SURAT PERJALANAN DINAS (SPPD)</h3>
                                        <p>Nomor : {data.nomor_sppd}</p>
                                    </div>

                                    <table className="sppd-grid-table">
                                        <tbody>
                                            <tr><td width="45" align="center">1.</td><td width="215">Pejabat Pemberi Perintah</td><td>{data.pejabat_pemberi_perintah?.jabatan || data.pejabat_pemberi_perintah_id}</td></tr>
                                            <tr><td align="center">2.</td><td>Nama Pegawai yang diperintah</td><td><strong>{formatNamaPenuh(data.pegawai)}</strong></td></tr>
                                            <tr><td align="center">3.</td><td>a. Pangkat dan Golongan<br />b. Jabatan / Instansi<br />c. Tingkat Biaya Perjalanan Dinas</td><td>a. {data.pegawai?.pangkat?.nama} / {data.pegawai?.golongan?.nama}<br />b. {data.pegawai?.jabatan} / {data.instansi?.nama_singkat}<br />c. {data.tingkat_biaya?.kode || data.tingkat_perjalanan}</td></tr>
                                            <tr><td align="center">4.</td><td>Maksud Perjalanan Dinas</td><td>{data.maksud_perjalanan}</td></tr>
                                            <tr><td align="center">5.</td><td>Alat angkut yang dipergunakan</td><td>{data.moda_transportasi?.nama || data.alat_angkut}</td></tr>
                                            <tr><td align="center">6.</td><td>a. Tempat berangkat<br />b. Tempat tujuan</td><td>a. {data.tempat_berangkat}<br />b. {data.tempat_tujuan}</td></tr>
                                            <tr><td align="center">7.</td><td>a. Lamanya Perjalanan Dinas<br />b. Tanggal berangkat<br />c. Tanggal harus kembali</td><td>a. {data.lama_perjalanan} (hari)<br />b. {data.tanggal_berangkat ? format(new Date(data.tanggal_berangkat), 'dd MMMM yyyy', { locale: localeID }) : '-'}<br />c. {data.tanggal_kembali ? format(new Date(data.tanggal_kembali), 'dd MMMM yyyy', { locale: localeID }) : '-'}</td></tr>
                                            <tr><td align="center">8.</td><td>Pengikut : Nama</td><td>
                                                <ol className="list-unstyled-ol">
                                                    {data.pengikut?.map((p: any, i: number) => (
                                                        <li key={i}>
                                                            {p.pegawai ? (
                                                                <>
                                                                    {formatNamaPenuh(p.pegawai)}
                                                                    <span style={{ fontSize: '9pt', display: 'block', color: '#444' }}>
                                                                        ({p.pegawai.pangkat?.nama || '-'} / {p.pegawai.golongan?.nama || '-'}) - {p.pegawai.jabatan || '-'}
                                                                    </span>
                                                                </>
                                                            ) : p.nama}
                                                        </li>
                                                    ))}
                                                    {!data.pengikut?.length && <li>-</li>}
                                                </ol>
                                            </td></tr>
                                            <tr><td align="center">9.</td><td>Pembebanan Anggaran<br />a. Instansi<br />b. Mata Anggaran</td><td><br />a. {data.instansi?.nama_lengkap}<br />b. {data.mata_anggaran || data.spt?.pembebanan_anggaran || '-'}</td></tr>
                                            <tr><td align="center">10.</td><td>Keterangan lain-lain</td><td>-</td></tr>
                                        </tbody>
                                    </table>

                                    <div className="signature-area sppd-foot">
                                        <div className="signature-box">
                                            <p>Dikeluarkan di : {data.tempat_penerbitan || data.tempat_berangkat}</p>
                                            <p>Pada tanggal : {data.tanggal_penerbitan ? format(new Date(data.tanggal_penerbitan), 'dd MMMM yyyy', { locale: localeID }) : format(new Date(), 'dd MMMM yyyy', { locale: localeID })}</p>
                                            <div className="sign-role">
                                                <strong>{data.penandatangan?.jabatan}</strong>
                                            </div>
                                            <div className="sign-space">
                                                {data.penandatangan?.ttd_digital_path && (
                                                    <img src={data.penandatangan.ttd_digital_path} alt="TTD" />
                                                )}
                                            </div>
                                            <div className="sign-name">
                                                <strong><u>{formatNamaPenuh(data.penandatangan)}</u></strong>
                                                <p>{data.penandatangan?.pangkat?.nama}</p>
                                                <p>NIP. {data.penandatangan?.nip}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="print-page page-break">
                                <div className="doc-content-body">
                                    {renderSppdBelakang()}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .doc-preview-page {
                    min-height: 100vh;
                    background: #f8fafc;
                    display: flex;
                    flex-direction: column;
                }

                .preview-toolbar {
                    height: 70px;
                    background: rgba(255, 255, 255, 0.8);
                    backdrop-filter: blur(12px);
                    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 40px;
                    position: sticky;
                    top: 0;
                    z-index: 1000;
                }

                .toolbar-left { display: flex; align-items: center; gap: 24px; }
                .toolbar-title { display: flex; align-items: center; gap: 10px; color: var(--p-primary); font-weight: 700; font-size: 16px; }
                .toolbar-btn {
                    width: 40px; height: 40px; border-radius: 12px;
                    border: 1px solid var(--p-border);
                    background: white; color: var(--p-text-main);
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer; transition: all 0.2s;
                }
                .toolbar-btn:hover { background: #f1f5f9; color: var(--p-accent); border-color: var(--p-accent); }

                .btn-print-premium {
                    background: var(--p-accent); color: white;
                    border: none; padding: 0 24px; height: 44px;
                    border-radius: 12px; font-weight: 700; font-size: 14px;
                    display: flex; align-items: center; gap: 10px;
                    cursor: pointer; transition: all 0.2s;
                    box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
                }
                .btn-print-premium:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(14, 165, 233, 0.4); }

                .scroll-area {
                    flex: 1;
                    padding: 40px 0;
                    overflow-y: auto;
                    display: flex;
                    justify-content: center;
                }

                .print-container {
                    background: white;
                    width: 215mm;
                    min-height: 330mm;
                    padding: 15mm 15mm 10mm;
                    box-shadow: 0 10px 50px rgba(0, 0, 0, 0.08);
                    border-radius: 4px;
                    font-family: "Times New Roman", Times, serif;
                    color: black;
                }

                .kop-surat {
                    display: flex; align-items: center; justify-content: space-between;
                    border-bottom: 4px double black;
                    padding-bottom: 5px; margin-bottom: 15px;
                }
                .kop-surat.kop-bupati { border-bottom: none; margin-bottom: 10px; }
                .kop-surat.kop-bupati .kop-logo-center { width: 100%; display: flex; justify-content: center; margin-bottom: 15px; }
                .kop-surat.kop-bupati .kop-logo-center img { width: 90px; height: auto; }
                .kop-surat.kop-bupati .bupati { font-size: 18pt; font-weight: bold; letter-spacing: 2px; }
                .kop-surat.kop-sekda .sekda { font-size: 16pt; font-weight: bold; margin-top: 2px; }
                .kop-surat.kop-sekda .kop-logo-left { width: 100px; }
                .kop-border.thicker { border-bottom: 4px solid black; margin-top: 10px; }
                .kop-logo-left, .kop-logo-right { width: 90px; display: flex; justify-content: center; }
                .kop-logo-left img, .kop-logo-right img { width: 75px; height: auto; }
                .kop-text { flex: 1; text-align: center; }
                .kop-text h2 { margin: 0; font-size: 14pt; font-weight: bold; line-height: 1.2; }
                .kop-text h1 { margin: 0; font-size: 16pt; font-weight: bold; line-height: 1.2; margin-top: 4px; }
                .kop-text .alamat { margin: 0; font-size: 9pt; line-height: 1.3; margin-top: 2px; }
                .kop-text .kontak { margin: 0; font-size: 8pt; line-height: 1.2; color: #333; }

                .doc-title-section { text-align: center; margin-bottom: 10px; }
                .doc-title-section h3 { margin: 0; font-size: 13pt; letter-spacing: 1px; }
                .doc-title-section p { margin: 2px 0 0; font-size: 11pt; }
                .underline { text-decoration: underline; }

                .borderless-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12pt; line-height: 1.5; }
                .borderless-table td { border: none; padding: 2px 0; }

                .commands-header { text-align: center; margin: 15px 0; }
                .commands-header h4 { margin: 0; font-size: 12pt; text-decoration: underline; font-weight: bold; }

                .pegawai-item { display: flex; gap: 10px; margin-bottom: 10px; }
                .pegawai-num { width: 25px; }
                .inner-data-table { border-collapse: collapse; font-size: 12pt; }
                .inner-data-table td { border: none; padding: 1px 4px; }

                .tujuan-ol { margin: 0; padding-left: 20px; line-height: 1.4; }
                .list-unstyled-ol { margin: 0; padding-left: 15px; }

                .signature-area { margin-top: 15px; display: flex; justify-content: flex-end; page-break-inside: avoid; }
                .signature-box { width: 320px; text-align: center; }
                .signature-box p { margin: 0; font-size: 11pt; }
                .sign-role { margin: 15px 0 0; font-size: 12pt; text-align: center; }
                .sign-space { height: 75px; display: flex; align-items: center; justify-content: center; }
                .sign-space img { height: 65px; mix-blend-mode: multiply; }
                .sign-name { line-height: 1.3; text-align: center; }
                .sign-name strong { display: block; white-space: nowrap; font-size: 12pt; }
                .sign-name p { font-size: 10.5pt; margin: 0; }

                .sppd-grid-table { width: 100%; border-collapse: collapse; border: 1.5px solid black; table-layout: fixed; margin-bottom: 10px; }
                .sppd-grid-table td { border: 1px solid black; padding: 4px 8px; vertical-align: top; font-size: 10.5pt; line-height: 1.3; overflow-wrap: break-word; }

                .print-page { min-height: 290mm; display: flex; flex-direction: column; }
                .page-break { break-before: page; page-break-before: always; border-top: 1px dashed #ccc; margin-top: 40px; }
                @media print { 
                    .page-break { border-top: none; margin-top: 0; } 
                    .print-page { min-height: 300mm; }
                }

                .sppd-back-table { width: 100%; border-collapse: collapse; border: 1.5px solid black; }
                .sppd-back-table td { border: 1px solid black; vertical-align: top; font-size: 10pt; }
                .inner-back-table { width: 100%; border-collapse: collapse; }
                .inner-back-table td { border: none !important; padding: 5px 8px !important; font-size: 9pt !important; }
                .no-padding { padding: 0 !important; }

                .preview-loading { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; background: white; }
                .signature-title { text-wrap: balance; -webkit-text-wrap: balance; line-height: 1.2; margin-bottom: 5px; text-align: center; }
                .preview-loading p { font-weight: 600; color: var(--p-text-muted); }
                .spin { animation: spin 1s linear infinite; }

                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                @media print {
                    .no-print { display: none !important; }
                    .doc-preview-page { background: white; padding: 0; }
                    .scroll-area { padding: 0; }
                    .print-container { 
                        box-shadow: none; border: none; 
                        padding: 0;
                        width: 100%; margin: 0; 
                    }
                    .print-page, .spt-official {
                        padding: 15mm 15mm 10mm;
                        box-sizing: border-box;
                    }
                    @page { size: 215mm 330mm; margin: 0 !important; }
                    body { margin: 0; padding: 0; }
                }
            `}</style>
        </div>
    );
};

export default DocumentRenderer;
