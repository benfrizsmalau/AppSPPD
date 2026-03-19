import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { Printer, ArrowLeft, FileText, Loader2, Hash } from 'lucide-react';
import type { SPT, SPPD, Penandatangan, DasarPerintah, Instansi, KopSurat } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatNamaLengkap(p: any): string {
  if (!p) return '—';
  const gelar_depan = p.gelar_depan || '';
  const nama_lengkap = p.nama_lengkap || '';
  const gelar_belakang = p.gelar_belakang || '';
  if (!nama_lengkap) return '—';
  return [gelar_depan, nama_lengkap, gelar_belakang].filter(Boolean).join(' ');
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  try { return format(new Date(d), 'dd MMMM yyyy', { locale: localeID }); } catch { return d; }
}

const ROMAN_MONTHS = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
export function fmtDateRoman(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return `${dt.getDate()} ${ROMAN_MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
  } catch { return d ?? '—'; }
}

// ─── KOP SURAT ────────────────────────────────────────────────────────────────
// ─── Kop Surat — 3 Varian ────────────────────────────────────────────────────
const borderBottom = '3.5px double #000';
const kopFont: React.CSSProperties = { fontFamily: '"Times New Roman", Times, serif' };

/** Kop SKPD — format standar: Logo Kab | Pemerintah + Nama SKPD | Logo SKPD */
const KopSKPD: React.FC<{ instansi: Instansi | null | undefined }> = ({ instansi }) => (
  <div style={{ display: 'flex', alignItems: 'stretch', borderBottom, paddingBottom: '4px', marginBottom: '8px' }}>
    <div style={{ width: '85px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {instansi?.logo_kabupaten_path && (
        <img src={instansi.logo_kabupaten_path} alt="Logo Kab" style={{ width: '70px', height: 'auto', objectFit: 'contain' }} />
      )}
    </div>
    <div style={{ flex: 1, textAlign: 'center', padding: '0 8px', ...kopFont }}>
      <p style={{ margin: 0, fontSize: '12pt', fontWeight: 'bold', lineHeight: 1.2 }}>
        PEMERINTAH {instansi?.kabupaten_kota ? `KABUPATEN ${instansi.kabupaten_kota.toUpperCase()}` : ''}
      </p>
      <p style={{ margin: '3px 0 0', fontSize: '15pt', fontWeight: 'bold', lineHeight: 1.2 }}>
        {instansi?.nama_lengkap?.toUpperCase() ?? ''}
      </p>
      {instansi?.alamat && <p style={{ margin: '2px 0 0', fontSize: '9pt', lineHeight: 1.3, color: '#333' }}>{instansi.alamat}</p>}
      {(instansi?.telepon || instansi?.email) && (
        <p style={{ margin: 0, fontSize: '8pt', color: '#444' }}>
          {instansi?.telepon && `Telp. ${instansi.telepon}`}
          {instansi?.telepon && instansi?.email && ' | '}
          {instansi?.email && `Email: ${instansi.email}`}
          {instansi?.kode_pos && ` | Kode Pos: ${instansi.kode_pos}`}
        </p>
      )}
    </div>
    <div style={{ width: '85px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {instansi?.logo_path && (
        <img src={instansi.logo_path} alt="Logo SKPD" style={{ width: '70px', height: 'auto', objectFit: 'contain' }} />
      )}
    </div>
  </div>
);

/** Kop Bupati/Walikota
 *  Kiri : Logo Garuda (jika ada) atau Logo Kabupaten sebagai fallback
 *  Tengah: Jabatan Kepala Daerah (nama besar) + alamat/telepon
 *  Kanan : kosong (spacer simetris) */
const KopBupati: React.FC<{ instansi: Instansi | null | undefined }> = ({ instansi }) => {
  const jabatan = instansi?.jabatan_kepala_daerah
    ?? (instansi?.kabupaten_kota ? `BUPATI ${instansi.kabupaten_kota.toUpperCase()}` : 'BUPATI');
  const alamat = instansi?.alamat_bupati ?? instansi?.alamat;
  const telepon = instansi?.telepon_bupati ?? instansi?.telepon;
  // Garuda → logo kabupaten sebagai fallback
  const logoKiri = instansi?.logo_garuda_path ?? instansi?.logo_kabupaten_path;
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', borderBottom, paddingBottom: '4px', marginBottom: '8px' }}>
      <div style={{ width: '85px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {logoKiri && (
          <img src={logoKiri} alt="Logo" style={{ width: '75px', height: 'auto', objectFit: 'contain' }} />
        )}
      </div>
      <div style={{ flex: 1, textAlign: 'center', padding: '0 8px', ...kopFont }}>
        <p style={{ margin: 0, fontSize: '16pt', fontWeight: 'bold', lineHeight: 1.2, letterSpacing: '1px' }}>
          {jabatan}
        </p>
        {alamat && <p style={{ margin: '3px 0 0', fontSize: '9pt', lineHeight: 1.3, color: '#333' }}>{alamat}</p>}
        {telepon && (
          <p style={{ margin: 0, fontSize: '8pt', color: '#444' }}>Telp. {telepon}</p>
        )}
      </div>
      <div style={{ width: '85px' }} /> {/* spacer agar teks center seimbang */}
    </div>
  );
};

/** Kop Sekretariat Daerah — Logo Kab + Logo Pemda, Pemerintah + Sekretariat Daerah */
const KopSekda: React.FC<{ instansi: Instansi | null | undefined }> = ({ instansi }) => {
  const alamat = instansi?.alamat_sekda ?? instansi?.alamat;
  const telepon = instansi?.telepon_sekda ?? instansi?.telepon;
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', borderBottom, paddingBottom: '4px', marginBottom: '8px' }}>
      <div style={{ width: '85px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {instansi?.logo_kabupaten_path && (
          <img src={instansi.logo_kabupaten_path} alt="Logo Kab" style={{ width: '70px', height: 'auto', objectFit: 'contain' }} />
        )}
      </div>
      <div style={{ flex: 1, textAlign: 'center', padding: '0 8px', ...kopFont }}>
        <p style={{ margin: 0, fontSize: '12pt', fontWeight: 'bold', lineHeight: 1.2 }}>
          PEMERINTAH {instansi?.kabupaten_kota ? `KABUPATEN ${instansi.kabupaten_kota.toUpperCase()}` : ''}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: '15pt', fontWeight: 'bold', lineHeight: 1.2, letterSpacing: '0.5px' }}>
          SEKRETARIAT DAERAH
        </p>
        {alamat && <p style={{ margin: '2px 0 0', fontSize: '9pt', lineHeight: 1.3, color: '#333' }}>{alamat}</p>}
        {(telepon || instansi?.email) && (
          <p style={{ margin: 0, fontSize: '8pt', color: '#444' }}>
            {telepon && `Telp. ${telepon}`}
            {telepon && instansi?.email && ' | '}
            {instansi?.email && `Email: ${instansi.email}`}
            {instansi?.kode_pos && ` | Kode Pos: ${instansi.kode_pos}`}
          </p>
        )}
      </div>
      <div style={{ width: '85px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {instansi?.logo_path && (
          <img src={instansi.logo_path} alt="Logo Pemda" style={{ width: '70px', height: 'auto', objectFit: 'contain' }} />
        )}
      </div>
    </div>
  );
};

/** Router — pilih kop sesuai jenis */
interface KopSuratProps {
  instansi: Instansi | null | undefined;
  jenis?: KopSurat;
}
const KopSurat: React.FC<KopSuratProps> = ({ instansi, jenis = 'skpd' }) => {
  if (jenis === 'bupati') return <KopBupati instansi={instansi} />;
  if (jenis === 'sekda') return <KopSekda instansi={instansi} />;
  return <KopSKPD instansi={instansi} />;
};

// ─── Signature Block ──────────────────────────────────────────────────────────
interface SignatureBlockProps {
  label?: string;
  place: string;
  date: string;
  penandatangan: Penandatangan | undefined;
}
const SignatureBlock: React.FC<SignatureBlockProps> = ({ label, place, date, penandatangan }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px', pageBreakBefore: 'avoid', pageBreakInside: 'avoid' }}>
    <div style={{ width: '320px', textAlign: 'center', fontFamily: '"Times New Roman", Times, serif' }}>
      <div style={{ textAlign: 'left', marginBottom: '8px' }}>
        <p style={{ margin: 0, fontSize: '10.5pt' }}>{label ?? 'Ditetapkan di'} : {place}</p>
        <p style={{ margin: '1px 0 0', fontSize: '10.5pt' }}>Pada tanggal : {fmtDate(date)}</p>
      </div>

      <p style={{ margin: 0, fontSize: '10.5pt', fontWeight: 'bold', textTransform: 'uppercase' }}>{penandatangan?.jabatan ?? ''}</p>
      <div style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {penandatangan?.ttd_digital_path && (
          <img src={penandatangan.ttd_digital_path} alt="TTD" style={{ height: '65px', mixBlendMode: 'multiply', objectFit: 'contain' }} />
        )}
      </div>
      <p style={{ margin: 0, fontSize: '11.5pt', fontWeight: 'bold', textDecoration: 'underline' }}>{formatNamaLengkap(penandatangan)}</p>
      {penandatangan?.ref_pangkat && (
        <p style={{ margin: 0, fontSize: '10.5pt' }}>
          {penandatangan.ref_pangkat.nama}
          {penandatangan.ref_golongan?.nama ? ` / ${penandatangan.ref_golongan.nama}` : ''}
        </p>
      )}
      {penandatangan?.nip && (
        <p style={{ margin: 0, fontSize: '10.5pt' }}>NIP. {penandatangan.nip}</p>
      )}
    </div>
  </div>
);

// ─── DRAFT Watermark ──────────────────────────────────────────────────────────
const DraftWatermark = () => (
  <div style={{
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none', zIndex: 5, overflow: 'hidden',
  }}>
    <p style={{
      fontSize: '100pt', fontWeight: 900, color: 'rgba(220,38,38,0.12)',
      transform: 'rotate(-45deg)', whiteSpace: 'nowrap',
      fontFamily: '"Times New Roman", Times, serif', letterSpacing: '6px',
    }}>DRAFT</p>
  </div>
);

// ─── SPT Document ─────────────────────────────────────────────────────────────
const SPTDocument: React.FC<{ data: SPT }> = ({ data }) => {
  const isDraft = data.status === 'Draft';
  const pegawaiList = data.spt_pegawai ?? [];

  return (
    <div style={{ position: 'relative' }}>
      {isDraft && <DraftWatermark />}
      <KopSurat instansi={data.instansi} jenis={data.kop_surat ?? 'skpd'} />

      <div style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '11.5pt', color: '#000', lineHeight: 1.5 }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '12pt', fontWeight: 'bold', textDecoration: 'underline', letterSpacing: '1px' }}>SURAT PERINTAH TUGAS</h3>
          <p style={{ margin: '1px 0 0', fontSize: '10.5pt' }}>
            Nomor : <strong>{data.nomor_spt || `DRAFT-${data.tanggal_penetapan?.replace(/-/g, '') || '________'}`}</strong>
          </p>
        </div>

        {/* Dasar */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px' }}>
          <tbody>
            <tr>
              <td style={{ width: '90px', verticalAlign: 'top', paddingRight: '4px' }}>Dasar :</td>
              <td style={{ verticalAlign: 'top' }}>
                {Array.isArray(data.dasar_perintah) && data.dasar_perintah.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {(data.dasar_perintah as DasarPerintah[]).map((d, i) => {
                        let teks = d.perihal;
                        if (d.jenis === 'surat' && d.nomor) {
                          teks = `${d.perihal} Nomor : ${d.nomor} tanggal ${fmtDate(d.tanggal ?? '')}`;
                        } else if (d.jenis === 'lisan') {
                          teks = d.perihal;
                        }
                        return (
                          <tr key={i}>
                            <td style={{ width: '22px', verticalAlign: 'top', paddingBottom: '3px' }}>{i + 1}.</td>
                            <td style={{ verticalAlign: 'top', paddingBottom: '3px' }}>{teks}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <span>{String(data.dasar_perintah ?? '—')}</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Memerintahkan */}
        <div style={{ textAlign: 'center', margin: '8px 0 6px' }}>
          <strong style={{ fontSize: '11pt', textDecoration: 'underline', letterSpacing: '1.2px' }}>M E M E R I N T A H K A N :</strong>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: '90px', verticalAlign: 'top' }}>Kepada :</td>
              <td>
                {pegawaiList.map((pl, idx) => (
                  <table key={pl.id} style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
                    <tbody>
                      <tr>
                        <td style={{ width: '24px', verticalAlign: 'top' }}>{idx + 1}.</td>
                        <td>
                          <table style={{ borderCollapse: 'collapse', fontSize: '12pt' }}>
                            <tbody>
                              <tr><td style={{ width: '75px', padding: '0 0' }}>Nama</td><td style={{ padding: '0 4px' }}>:</td><td style={{ padding: '0 0', fontWeight: 'bold' }}>{formatNamaLengkap(pl.pegawai)}</td></tr>
                              <tr><td style={{ padding: '0 0' }}>NIP</td><td style={{ padding: '0 4px' }}>:</td><td style={{ padding: '0 0', fontFamily: 'monospace', fontSize: '10.5pt' }}>{pl.pegawai?.nip}</td></tr>
                              <tr><td style={{ padding: '0 0' }}>Pangkat</td><td style={{ padding: '0 4px' }}>:</td><td style={{ padding: '0 0' }}>{pl.pegawai?.ref_pangkat?.nama}{pl.pegawai?.ref_golongan ? ` / ${pl.pegawai.ref_golongan.nama}` : ''}</td></tr>
                              <tr><td style={{ padding: '0 0' }}>Jabatan</td><td style={{ padding: '0 4px' }}>:</td><td style={{ padding: '0 0' }}>{pl.pegawai?.jabatan}</td></tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ))}
              </td>
            </tr>
            <tr style={{ height: '8px' }} />
            <tr>
              <td style={{ verticalAlign: 'top' }}>Untuk :</td>
              <td>
                {(data.tujuan_kegiatan ?? []).length > 1 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {(data.tujuan_kegiatan ?? []).map((t, i) => (
                        <tr key={i}>
                          <td style={{ width: '22px', verticalAlign: 'top', paddingBottom: '2px' }}>{i + 1}.</td>
                          <td style={{ verticalAlign: 'top', paddingBottom: '2px' }}>{t}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <span>{(data.tujuan_kegiatan ?? [])[0] || '—'}</span>
                )}
              </td>
            </tr>
            {data.lama_kegiatan && (
              <tr>
                <td style={{ verticalAlign: 'top', paddingTop: '6px' }}>Selama :</td>
                <td style={{ paddingTop: '5px' }}>{data.lama_kegiatan} (hari)</td>
              </tr>
            )}
            {data.pembebanan_anggaran && (
              <tr>
                <td style={{ verticalAlign: 'top', paddingTop: '6px' }}>Biaya :</td>
                <td style={{ paddingTop: '6px' }}>Dibebankan pada {data.pembebanan_anggaran}</td>
              </tr>
            )}
          </tbody>
        </table>

        <SignatureBlock
          place={data.tempat_penetapan}
          date={data.tanggal_penetapan}
          penandatangan={data.penandatangan}
        />

        {data.catatan && (
          <p style={{ fontSize: '10pt', color: '#555', marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
            Catatan: {data.catatan}
          </p>
        )}
      </div>
    </div>
  );
};

// ─── SPPD Document Page 1 ─────────────────────────────────────────────────────
const SPPDDocumentPage1: React.FC<{ data: SPPD }> = ({ data }) => {
  const isDraft = data.status === 'Draft';
  const pengikut = data.sppd_pengikut ?? [];

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        @page { size: 215mm 330mm; margin: 15mm; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      `}</style>
      {isDraft && <DraftWatermark />}
      <KopSurat instansi={data.instansi} jenis={data.kop_surat ?? 'skpd'} />

      <div style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '11pt', color: '#000' }}>
        <div style={{ textAlign: 'center', marginBottom: '6px' }}>
          <h3 style={{ margin: 0, fontSize: '12pt', fontWeight: 'bold', textDecoration: 'underline' }}>SURAT PERINTAH PERJALANAN DINAS</h3>
          <p style={{ margin: '0', fontSize: '10pt' }}>(S P P D)</p>
          <p style={{ margin: '1px 0 0', fontSize: '10pt' }}>Nomor : <strong>{data.nomor_sppd || '................................'}</strong></p>
        </div>

        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse', 
          border: '1.5px solid #000', 
          tableLayout: 'fixed', 
          marginBottom: '4px',
          pageBreakAfter: 'avoid'
        }}>
          <tbody>
            {[
              { num: '1.', label: 'Pejabat Yang Memberi Perintah', value: (data as any).pejabat_pemberi_perintah?.jabatan || data.penandatangan?.jabatan || '—' },
              { num: '2.', label: 'Nama/NIP Pegawai yang Diperintah', value: (
                <><strong>{formatNamaLengkap(data.pegawai)}</strong><br />NIP. {data.pegawai?.nip}</>
              )},
              { num: '3.', label: (
                <>a. Pangkat dan Golongan<br />b. Jabatan/Instansi<br />c. Tingkat Biaya Perjalanan Dinas</>
              ), value: (
                <>
                  a. {data.pegawai?.ref_pangkat?.nama ?? '—'} / {(data.pegawai as unknown as { ref_golongan?: { nama: string } })?.ref_golongan?.nama ?? '—'}<br />
                  b. {data.pegawai?.jabatan ?? '—'} / {data.instansi?.nama_singkat ?? '—'}<br />
                  c. {data.tingkat_perjalanan ?? '—'}
                </>
              )},
              { num: '4.', label: 'Maksud Perjalanan Dinas', value: data.maksud_perjalanan },
              { num: '5.', label: 'Alat Angkut yang Dipergunakan', value: data.alat_angkut ?? '—' },
              { num: '6.', label: (<>a. Tempat Berangkat<br />b. Tempat Tujuan</>), value: (<>a. {data.tempat_berangkat}<br />b. {data.tempat_tujuan}</>) },
              { num: '7.', label: (<>a. Lamanya Perjalanan Dinas<br />b. Tanggal Berangkat<br />c. Tanggal Harus Kembali</>), value: (
                <>
                  a. {data.lama_perjalanan} (hari)<br />
                  b. {fmtDate(data.tanggal_berangkat)}<br />
                  c. {fmtDate(data.tanggal_kembali)}
                </>
              )},
              { num: '8.', label: 'Pengikut: Nama, Umur, Hub. Keluarga', value: (
                pengikut.length === 0 ? '—' : (
                  <ol style={{ margin: 0, paddingLeft: '14px', lineHeight: 1.5 }}>
                    {pengikut.map((p, i) => (
                      <li key={i}>
                        {p.tipe === 'pegawai' && p.pegawai
                          ? <>{formatNamaLengkap(p.pegawai)} — {p.pegawai.jabatan}</>
                          : <>{p.nama ?? '—'}{p.umur ? `, ${p.umur} thn` : ''}{p.keterangan ? ` (${p.keterangan})` : ''}</>}
                      </li>
                    ))}
                  </ol>
                )
              )},
              { num: '9.', label: (<>Pembebanan Anggaran<br />a. Instansi<br />b. Mata Anggaran</>), value: (
                <><br />a. {data.instansi?.nama_lengkap ?? '—'}<br />b. {
                  typeof data.mata_anggaran === 'object' && data.mata_anggaran !== null
                    ? `${(data.mata_anggaran as any).kode} — ${(data.mata_anggaran as any).nama}`
                    : (data.mata_anggaran || data.spt?.pembebanan_anggaran || '—')
                }</>
              )},
              { num: '10.', label: 'Keterangan Lain-Lain', value: data.keterangan_lain ?? '—' },
            ].map((row, i) => (
              <tr key={i} style={{ pageBreakInside: 'avoid' }}>
                <td style={{ border: '1px solid #000', padding: '2px 4px', width: '38px', verticalAlign: 'top', textAlign: 'center', fontWeight: 'bold', fontSize: '10pt' }}>{row.num}</td>
                <td style={{ border: '1px solid #000', padding: '2px 6px', width: '180px', verticalAlign: 'top', fontSize: '10pt' }}>{row.label}</td>
                <td style={{ border: '1px solid #000', padding: '2px 6px', verticalAlign: 'top', lineHeight: 1.2, fontSize: '10pt' }}>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <SignatureBlock
          label="Dikeluarkan di"
          place={data.tempat_penerbitan ?? data.tempat_berangkat}
          date={data.tanggal_penerbitan}
          penandatangan={data.penandatangan}
        />
      </div>
    </div>
  );
};

// ─── SPPD Document Page 2 (Lembar Belakang / Realisasi) ──────────────────────
const SPPDDocumentPage2: React.FC<{ data: SPPD }> = ({ data }) => {
  const sections = [
    {
      roman: 'I.', side: 'left',
      rows: [
        { label: 'Berangkat dari', value: data.tempat_berangkat },
        { label: 'Ke', value: data.tempat_tujuan },
        { label: 'Pada tanggal', value: fmtDate(data.tanggal_berangkat) },
        { label: 'Kepala', value: data.instansi?.nama_singkat ?? '' },
      ],
    },
    {
      roman: 'II.', side: 'left',
      rows: [
        { label: 'Tiba di', value: data.tempat_tujuan },
        { label: 'Pada tanggal', value: '…………………………' },
        { label: 'Kepala', value: '…………………………' },
      ],
    },
    {
      roman: '', side: 'right',
      rows: [
        { label: 'Berangkat dari', value: data.tempat_tujuan },
        { label: 'Ke', value: data.tempat_berangkat },
        { label: 'Pada tanggal', value: '…………………………' },
        { label: 'Kepala', value: '…………………………' },
      ],
    },
    {
      roman: 'III.', side: 'left',
      rows: [
        { label: 'Tiba di', value: '…………………………' },
        { label: 'Pada tanggal', value: '…………………………' },
        { label: 'Kepala', value: '…………………………' },
      ],
    },
    {
      roman: '', side: 'right',
      rows: [
        { label: 'Berangkat dari', value: '…………………………' },
        { label: 'Ke', value: '…………………………' },
        { label: 'Pada tanggal', value: '…………………………' },
        { label: 'Kepala', value: '…………………………' },
      ],
    },
    {
      roman: 'IV.', side: 'left',
      rows: [
        { label: 'Tiba kembali di', value: data.tempat_berangkat },
        { label: 'Pada tanggal', value: fmtDate(data.tanggal_kembali) },
      ],
    },
  ];

  return (
    <div style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '10pt', color: '#000', paddingTop: '10mm' }}>
      <style>{`
        @page { size: 215mm 330mm; margin: 15mm; }
      `}</style>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', marginBottom: '12px' }}>
        <tbody>
          {/* Row I: Berangkat + empty */}
          <tr>
            <td style={{ border: '1px solid #000', padding: 0, width: '50%', verticalAlign: 'top' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr><td style={{ padding: '5px 8px', fontWeight: 'bold', width: '24px' }}>I.</td><td style={{ padding: '5px 0' }}>Berangkat dari</td><td style={{ padding: '5px 8px' }}>: {data.tempat_berangkat}</td></tr>
                  <tr><td /><td style={{ padding: '2px 0' }}>Ke</td><td style={{ padding: '2px 8px' }}>: {data.tempat_tujuan}</td></tr>
                  <tr><td /><td style={{ padding: '2px 0' }}>Pada tanggal</td><td style={{ padding: '2px 8px' }}>: {fmtDate(data.tanggal_berangkat)}</td></tr>
                  <tr><td /><td style={{ padding: '2px 0' }}>Kepala</td><td style={{ padding: '2px 8px' }}>: {data.instansi?.nama_singkat}</td></tr>
                  <tr style={{ height: '70px' }}><td /><td colSpan={2} /></tr>
                  <tr><td /><td colSpan={2} style={{ textAlign: 'center' }}>
                    <strong><u>{formatNamaLengkap(data.penandatangan)}</u></strong><br />
                    {(data.penandatangan as any)?.ref_pangkat?.nama}
                    {data.penandatangan?.nip ? <><br />NIP. {data.penandatangan.nip}</> : null}
                  </td></tr>
                </tbody>
              </table>
            </td>
            <td style={{ border: '1px solid #000', padding: '8px', verticalAlign: 'top', width: '50%' }}></td>
          </tr>

          {/* Row II & Kanan */}
          <tr>
            <td style={{ border: '1px solid #000', padding: 0, verticalAlign: 'top' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr><td style={{ padding: '5px 8px', fontWeight: 'bold', width: '24px' }}>II.</td><td style={{ padding: '5px 0' }}>Tiba di</td><td style={{ padding: '5px 8px' }}>: …………………………</td></tr>
                  <tr><td /><td style={{ padding: '2px 0' }}>Pada tanggal</td><td style={{ padding: '2px 8px' }}>: …………………………</td></tr>
                  <tr><td /><td style={{ padding: '2px 0' }}>Kepala</td><td style={{ padding: '2px 8px' }}>: …………………………</td></tr>
                  <tr style={{ height: '70px' }}><td /><td colSpan={2} /></tr>
                  <tr><td /><td colSpan={2} style={{ textAlign: 'center' }}>( …………………………………… )</td></tr>
                </tbody>
              </table>
            </td>
            <td style={{ border: '1px solid #000', padding: 0, verticalAlign: 'top' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr><td style={{ padding: '5px 8px' }}>Berangkat dari</td><td style={{ padding: '5px 8px' }}>: {data.tempat_tujuan}</td></tr>
                  <tr><td style={{ padding: '2px 8px' }}>Ke</td><td style={{ padding: '2px 8px' }}>: {data.tempat_berangkat}</td></tr>
                  <tr><td style={{ padding: '2px 8px' }}>Pada tanggal</td><td style={{ padding: '2px 8px' }}>: …………………………</td></tr>
                  <tr><td style={{ padding: '2px 8px' }}>Kepala</td><td style={{ padding: '2px 8px' }}>: …………………………</td></tr>
                  <tr style={{ height: '70px' }}><td colSpan={2} /></tr>
                  <tr><td colSpan={2} style={{ textAlign: 'center' }}>( …………………………………… )</td></tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* Row III & Kanan */}
          <tr>
            <td style={{ border: '1px solid #000', padding: 0, verticalAlign: 'top' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr><td style={{ padding: '5px 8px', fontWeight: 'bold', width: '24px' }}>III.</td><td style={{ padding: '5px 0' }}>Tiba di</td><td style={{ padding: '5px 8px' }}>: …………………………</td></tr>
                  <tr><td /><td style={{ padding: '2px 0' }}>Pada tanggal</td><td style={{ padding: '2px 8px' }}>: …………………………</td></tr>
                  <tr><td /><td style={{ padding: '2px 0' }}>Kepala</td><td style={{ padding: '2px 8px' }}>: …………………………</td></tr>
                  <tr style={{ height: '70px' }}><td /><td colSpan={2} /></tr>
                  <tr><td /><td colSpan={2} style={{ textAlign: 'center' }}>( …………………………………… )</td></tr>
                </tbody>
              </table>
            </td>
            <td style={{ border: '1px solid #000', padding: 0, verticalAlign: 'top' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr><td style={{ padding: '5px 8px' }}>Berangkat dari</td><td style={{ padding: '5px 8px' }}>: …………………………</td></tr>
                  <tr><td style={{ padding: '2px 8px' }}>Ke</td><td style={{ padding: '2px 8px' }}>: …………………………</td></tr>
                  <tr><td style={{ padding: '2px 8px' }}>Pada tanggal</td><td style={{ padding: '2px 8px' }}>: …………………………</td></tr>
                  <tr><td style={{ padding: '2px 8px' }}>Kepala</td><td style={{ padding: '2px 8px' }}>: …………………………</td></tr>
                  <tr style={{ height: '70px' }}><td colSpan={2} /></tr>
                  <tr><td colSpan={2} style={{ textAlign: 'center' }}>( …………………………………… )</td></tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* Row IV */}
          <tr>
            <td style={{ border: '1px solid #000', padding: 0, verticalAlign: 'top' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr><td style={{ padding: '5px 8px', fontWeight: 'bold', width: '24px' }}>IV.</td><td style={{ padding: '5px 0' }}>Tiba kembali di</td><td style={{ padding: '5px 8px' }}>: {data.tempat_berangkat}</td></tr>
                  <tr><td /><td style={{ padding: '2px 0' }}>Pada tanggal</td><td style={{ padding: '2px 8px' }}>: {fmtDate(data.tanggal_kembali)}</td></tr>
                  <tr><td /><td colSpan={2} style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 'bold' }}>{data.penandatangan?.jabatan ?? 'Pejabat Pembuat Komitmen'}:</td></tr>
                  <tr style={{ height: '70px' }}><td /><td colSpan={2} /></tr>
                  <tr><td /><td colSpan={2} style={{ textAlign: 'center' }}>
                    <strong><u>{formatNamaLengkap(data.penandatangan)}</u></strong><br />
                    {(data.penandatangan as any)?.ref_pangkat?.nama}
                    {data.penandatangan?.nip ? <><br />NIP. {data.penandatangan.nip}</> : null}
                  </td></tr>
                </tbody>
              </table>
            </td>
            <td style={{ border: '1px solid #000', padding: '10px', verticalAlign: 'top', fontSize: '9.5pt' }}>
              <p>Telah diperiksa, dengan keterangan bahwa perjalanan tersebut di atas benar dilakukan atas perintahnya dan semata-mata untuk kepentingan jabatan dalam waktu yang sesingkat-singkatnya.</p>
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <p style={{ fontWeight: 'bold' }}>{data.penandatangan?.jabatan ?? 'Pejabat Pembuat Komitmen'}:</p>
                <div style={{ height: '70px' }} />
                <p>
                  <strong><u>{formatNamaLengkap(data.penandatangan)}</u></strong><br />
                  {(data.penandatangan as any)?.ref_pangkat?.nama}
                  {data.penandatangan?.nip ? <><br />NIP. {data.penandatangan.nip}</> : null}
                </p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* V. Catatan */}
      <div style={{ border: '1.5px solid #000', borderTop: 'none', padding: '8px 10px' }}>
        <strong>V. CATATAN LAIN-LAIN</strong>
        <p style={{ marginTop: '4px', minHeight: '40px', fontSize: '10pt' }}></p>
      </div>

      {/* VI. Perhatian */}
      <div style={{ border: '1.5px solid #000', borderTop: 'none', padding: '8px 10px' }}>
        <strong>VI. PERHATIAN</strong>
        <p style={{ fontSize: '9pt', marginTop: '4px' }}>
          Pejabat yang berwenang menerbitkan SPPD, pegawai yang melakukan perjalanan dinas, para pejabat yang mengesahkan tanggal berangkat/tiba serta Bendaharawan bertanggung jawab berdasarkan peraturan-peraturan Keuangan Negara apabila Negara mendapat rugi akibat kesalahan, kealpaan dan kealpaannya.
        </p>
      </div>

      {/* Ignore the sections variable if not needed in rendering above */}
      {sections.length === 0 && null}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// DOCUMENT RENDERER PAGE
// ═════════════════════════════════════════════════════════════════════════════
const DocumentRenderer: React.FC = () => {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<SPT | SPPD | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasPrinted = useRef(false);

  useEffect(() => {
    const fetchDoc = async () => {
      setLoading(true);
      setError(null);
      try {
        if (type === 'spt') {
          const { data: spt, error: err } = await supabase
            .from('spt')
            .select(`
              *,
              instansi:instansi_id(*),
              penandatangan:penandatangan_id(*, ref_pangkat(*), ref_golongan(*)),
              spt_pegawai(*, pegawai(*, ref_pangkat(*), ref_golongan(*))),
              mata_anggaran:mata_anggaran_id(*)
            `)
            .eq('id', id!)
            .single();
          if (err) throw err;
          setData(spt as SPT);
        } else if (type === 'sppd') {
          const { data: sppd, error: err } = await supabase
            .from('sppd')
            .select(`
              *,
              pejabat_pemberi_perintah:pejabat_pemberi_perintah_id(*),
              instansi:instansi_id(*),
              penandatangan:penandatangan_id(*, ref_pangkat:pangkat_id(*), ref_golongan:golongan_id(*)),
              pegawai:pegawai_id(*, ref_pangkat:pangkat_id(*), ref_golongan:golongan_id(*)),
              spt:spt_id(*),
              sppd_pengikut:sppd_pengikut(
                *,
                pegawai:pegawai_id(*, ref_pangkat:pangkat_id(*), ref_golongan:golongan_id(*))
              ),
              mata_anggaran:mata_anggaran_id(*)
            `)
            .eq('id', id!)
            .single();
          if (err) throw err;
          setData(sppd as SPPD);
        } else {
          throw new Error('Tipe dokumen tidak valid. Gunakan "spt" atau "sppd".');
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Dokumen tidak ditemukan.');
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [type, id]);

  const handlePrint = async () => {
    window.print();
    if (!hasPrinted.current && data && id) {
      hasPrinted.current = true;
      const table = type === 'spt' ? 'spt' : 'sppd';
      await supabase.from(table).update({
        print_count: ((data as SPT).print_count ?? 0) + 1,
        last_printed_at: new Date().toISOString(),
      }).eq('id', id);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', gap: '16px' }}>
        <Loader2 size={48} className="animate-spin" style={{ color: '#2563EB' }} />
        <p style={{ fontWeight: 600, color: '#64748b', margin: 0 }}>Mempersiapkan dokumen...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', gap: '16px', padding: '24px' }}>
        <FileText size={64} style={{ color: '#cbd5e1' }} />
        <h3 style={{ margin: 0, color: '#0f172a' }}>Dokumen Tidak Ditemukan</h3>
        <p style={{ margin: 0, color: '#64748b', textAlign: 'center' }}>{error ?? 'Pastikan ID dokumen benar atau hubungi administrator.'}</p>
        <button onClick={() => navigate(-1)} className="btn btn-primary">
          <ArrowLeft size={16} /> Kembali
        </button>
      </div>
    );
  }

  const docData = data as (SPT & SPPD);

  return (
    <div className="doc-preview-page">
      {/* Toolbar */}
      <div className="preview-toolbar no-print">
        <div className="toolbar-left">
          <button className="toolbar-btn" onClick={() => navigate(-1)} title="Kembali">
            <ArrowLeft size={18} />
          </button>
          <div className="toolbar-title">
            <FileText size={18} />
            <span>Pratinjau {type === 'spt' ? 'Surat Perintah Tugas' : 'Surat Perintah Perjalanan Dinas'}</span>
          </div>
          {(docData.nomor_spt || docData.nomor_sppd) && (
            <code className="doc-number text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
              {docData.nomor_spt ?? docData.nomor_sppd}
            </code>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {docData.print_count > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b' }}>
              <Hash size={14} />
              <span>Dicetak {docData.print_count}x</span>
            </div>
          )}
          <button onClick={handlePrint} className="btn-print-premium">
            <Printer size={18} /> Cetak Dokumen
          </button>
        </div>
      </div>

      {/* Document */}
      <div className="scroll-area">
        {type === 'spt' ? (
          <div className="print-container">
            <div className="spt-official">
              <SPTDocument data={data as SPT} />
            </div>
          </div>
        ) : (
          <>
            <div className="print-container">
              <div className="print-page">
                <SPPDDocumentPage1 data={data as SPPD} />
              </div>
              <div className="print-page page-break">
                <SPPDDocumentPage2 data={data as SPPD} />
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        .doc-preview-page {
          min-height: 100vh;
          background: #f1f5f9;
          display: flex;
          flex-direction: column;
        }
        .preview-toolbar {
          height: 64px;
          background: rgba(255,255,255,0.9);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(0,0,0,0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .toolbar-left { display: flex; align-items: center; gap: 16px; }
        .toolbar-title { display: flex; align-items: center; gap: 8px; color: #2563EB; font-weight: 700; font-size: 15px; }
        .toolbar-btn {
          width: 38px; height: 38px; border-radius: 10px;
          border: 1px solid #e2e8f0; background: white;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.15s; color: #475569;
        }
        .toolbar-btn:hover { background: #f8fafc; color: #2563EB; border-color: #2563EB; }
        .btn-print-premium {
          background: linear-gradient(135deg, #2563EB, #1D4ED8);
          color: white; border: none;
          padding: 0 20px; height: 42px; border-radius: 12px;
          font-weight: 700; font-size: 14px;
          display: flex; align-items: center; gap: 8px;
          cursor: pointer; transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(37,99,235,0.35);
        }
        .btn-print-premium:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(37,99,235,0.45); }
        .scroll-area {
          flex: 1;
          padding: 40px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
          overflow-y: auto;
        }
        .print-container {
          background: white;
          width: 215mm;
          min-height: 330mm;
          padding: 15mm 15mm 12mm;
          box-shadow: 0 8px 40px rgba(0,0,0,0.1);
          border-radius: 4px;
        }
        .print-page { min-height: 295mm; position: relative; }
        .page-break { border-top: 2px dashed #e2e8f0; margin-top: 32px; padding-top: 32px; }
        @media print {
          .no-print { display: none !important; }
          .doc-preview-page { background: white !important; }
          .scroll-area { padding: 0 !important; }
          .print-container {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-page, .spt-official { padding: 15mm 15mm 12mm; box-sizing: border-box; }
          .page-break { border-top: none !important; margin-top: 0 !important; padding-top: 0 !important; break-before: page; page-break-before: always; }
          @page { size: 215mm 330mm; margin: 0 !important; }
          body { margin: 0 !important; padding: 0 !important; background: white !important; }
        }
      `}</style>
    </div>
  );
};

export default DocumentRenderer;
