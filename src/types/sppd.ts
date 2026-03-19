import type { Pegawai, Instansi, KopSurat } from './index';
import type { SPT } from './spt';
import type { Penandatangan } from './penandatangan';

export interface SPPD {
    id: number;
    spt_id: number;
    pegawai_id: number;
    nomor_sppd: string;
    pejabat_pemberi_perintah_id: number;
    tingkat_perjalanan: string;
    maksud_perjalanan: string;
    alat_angkut: string;
    tempat_berangkat: string;
    tempat_tujuan: string;
    tempat_penerbitan: string;
    tanggal_penerbitan: string;
    lama_perjalanan: number;
    tanggal_berangkat: string;
    tanggal_kembali: string;
    tingkat_biaya_id?: number;
    alat_angkut_id?: number;
    mata_anggaran: string;
    mata_anggaran_id?: number;
    instansi_id: number;
    penandatangan_id: number;
    status: 'Draft' | 'Final';
    kop_surat: KopSurat;
    pdf_file_path?: string;
    created_at?: string;

    // Relations
    spt?: SPT;
    pegawai?: Pegawai;
    pejabat_pemberi_perintah?: Pegawai;
    instansi?: Instansi;
    penandatangan?: Penandatangan;
    pengikut?: SPPD_Pengikut[];
}

export interface SPPD_Pengikut {
    id: number;
    sppd_id: number;
    pegawai_id: number;
    keterangan?: string;
    pegawai?: Pegawai;
}
