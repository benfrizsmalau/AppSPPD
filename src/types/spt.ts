import type { Pegawai, Instansi } from './index';
import type { Penandatangan } from './penandatangan';

export type KopSurat = 'skpd' | 'bupati' | 'sekda';

export interface SPT {
    id: number;
    nomor_spt: string;
    tanggal_penetapan: string;
    tempat_penetapan: string;
    dasar_perintah: string[];
    tujuan_kegiatan: string[];
    lama_kegiatan: number;
    pembebanan_anggaran: string;
    penandatangan_id: number;
    instansi_id: number;
    status: 'Draft' | 'Final';
    kop_surat: KopSurat;
    pdf_file_path?: string;
    catatan?: string;
    created_at?: string;
    penandatangan?: Penandatangan;
    instansi?: Instansi;
    pegawai_list?: SPT_Pegawai[];
}

export interface SPT_Pegawai {
    id: number;
    spt_id: number;
    pegawai_id: number;
    urutan: number;
    pegawai?: Pegawai;
}
