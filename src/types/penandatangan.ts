import type { RefPangkat, RefGolongan, Instansi } from './index';

/** Single canonical Penandatangan type — dipakai di seluruh aplikasi */
export interface Penandatangan {
  id: number;
  tenant_id?: string;
  nama_lengkap: string;
  gelar_depan?: string;
  gelar_belakang?: string;
  nip?: string;                 // opsional — Bupati/pejabat politik tidak punya NIP
  jabatan: string;
  pangkat_id?: number;
  golongan_id?: number;
  unit_kerja_id?: number;
  jenis_dokumen?: string[];     // ['SPT', 'SPPD']
  ttd_digital_path?: string;
  status_aktif: boolean;
  periode_mulai?: string;
  periode_selesai?: string;
  created_at?: string;
  updated_at?: string;
  // Joined relations — dari query Supabase dengan select(*, ref_pangkat(*), ...)
  ref_pangkat?: RefPangkat;     // via query alias ref_pangkat:pangkat_id(*)
  ref_golongan?: RefGolongan;   // via query alias ref_golongan:golongan_id(*)
  pangkat?: RefPangkat;         // alias lama (backward compat)
  golongan?: RefGolongan;       // alias lama (backward compat)
  instansi?: Instansi;
}
