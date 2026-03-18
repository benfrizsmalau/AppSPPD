export interface Pangkat {
    id: number;
    nama: string;
    urutan?: number;
}

export interface Golongan {
    id: number;
    nama: string;
    urutan?: number;
}

export interface TingkatPerjalanan {
    id: number;
    kode: string; // A, B, C, D
    deskripsi: string;
}

export interface AlatAngkut {
    id: number;
    nama: string;
}

export interface MataAnggaran {
    id: number;
    kode: string;
    nama: string;
    tahun: number;
}

export interface User {
    id: string; // uuid
    username: string;
    email: string;
    nama_lengkap: string;
    role: 'Admin' | 'Operator' | 'Pejabat' | 'Pegawai';
    pegawai_id?: number;
    status_aktif: boolean;
    last_login?: string;
    created_at?: string;
}

export interface AuditLog {
    id: number;
    user_id: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'PRINT' | 'FINALIZE';
    table_name: string;
    record_id: any;
    old_value?: any;
    new_value?: any;
    created_at: string;
    user?: User;
}

export interface Instansi {
    id: number;
    nama_lengkap: string;
    nama_singkat: string;
    logo_path?: string;
    logo_kabupaten_path?: string;
    alamat: string;
    kabupaten_kota: string;
    provinsi: string;
    kode_pos?: string;
    telepon?: string;
    email?: string;
    website?: string;
}

export interface Pegawai {
    id: number;
    nama_lengkap: string;
    gelar_depan?: string;
    gelar_belakang?: string;
    nip: string;
    pangkat_id?: number;
    golongan_id?: number;
    jabatan: string;
    unit_kerja_id?: number;
    status_aktif: boolean;
    tanggal_mulai?: string;
    email?: string;
    telepon?: string;
    created_at?: string;
    pangkat?: Pangkat;
    golongan?: Golongan;
    instansi?: Instansi;
}
