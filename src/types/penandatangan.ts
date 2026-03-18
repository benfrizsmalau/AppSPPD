import type { RefPangkat, RefGolongan, Instansi } from './index';

export interface Penandatangan {
    id: number;
    nama_lengkap: string;
    nip: string;
    jabatan: string;
    pangkat_id?: number;
    golongan_id?: number;
    unit_kerja_id?: number;
    jenis_dokumen: string[]; // ['SPT', 'SPPD']
    ttd_digital_path?: string;
    status_aktif: boolean;
    periode_mulai?: string;
    periode_selesai?: string;
    created_at?: string;
    pangkat?: RefPangkat;
    golongan?: RefGolongan;
    instansi?: Instansi;
}
