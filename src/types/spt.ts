import type { Pegawai, Instansi, DocumentStatus, MataAnggaran, DasarPerintah } from './index';
import type { Penandatangan } from './penandatangan';

export type KopSurat = 'skpd' | 'bupati' | 'sekda';

export interface SPT {
    id: number;
    tenant_id: string;
    nomor_spt: string;
    tanggal_penetapan: string;
    tempat_penetapan: string;
    dasar_perintah: DasarPerintah[];
    tujuan_kegiatan: string[];
    lama_kegiatan: number;
    pembebanan_anggaran: string;
    mata_anggaran_id?: number;
    penandatangan_id: number;
    instansi_id: number;
    status: DocumentStatus;
    kop_surat: KopSurat;
    pdf_file_path?: string;
    catatan?: string;
    alasan_pembatalan?: string;
    cancelled_at?: string;
    finalized_at?: string;
    last_printed_at?: string;
    print_count: number;
    parent_spt_id?: number;
    created_at: string;
    updated_at: string;
    
    // Joined data
    penandatangan?: Penandatangan;
    instansi?: Instansi;
    mata_anggaran?: MataAnggaran;
    spt_pegawai?: SPT_Pegawai[];
}

export interface SPT_Pegawai {
    id: number;
    spt_id: number;
    pegawai_id: number;
    urutan: number;
    pegawai?: Pegawai;
}
