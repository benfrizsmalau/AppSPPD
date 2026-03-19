// =================================================================
// SiSPPD v2.1 — Core Types
// =================================================================

export type UserRole = 'Admin' | 'Operator' | 'Pejabat' | 'Pegawai';
export type DocumentStatus = 'Draft' | 'Menunggu Persetujuan' | 'Final' | 'Printed' | 'Completed' | 'Cancelled' | 'Expired';
export type ApprovalAction = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'REVISE' | 'BYPASS';
export type TenantPaket = 'free' | 'pro' | 'enterprise';
export type PengikutTipe = 'pegawai' | 'manual';

export interface Tenant {
  id: string;
  kode: string;
  nama_instansi: string;
  nama_singkat: string;
  subdomain?: string;
  paket: TenantPaket;
  is_active: boolean;
  email_admin: string;
  kabupaten_kota?: string;
  provinsi?: string;
  alamat?: string;
  telepon?: string;
  website?: string;
  setup_completed: boolean;
  setup_progress: Record<string, unknown>;
  trial_ends_at?: string;
  max_pegawai: number;
  max_dokumen_per_bulan: number;
  storage_gb: number;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  tenant_id?: string;
  username?: string;
  nama_lengkap: string;
  role: UserRole;
  pegawai_id?: number;
  status_aktif: boolean;
  last_active?: string;
  login_count: number;
  avatar_url?: string;
  telepon?: string;
  preferences?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  tenant?: Tenant;
  pegawai?: Pegawai;
}

export interface RefPangkat {
  id: number;
  tenant_id?: string;
  nama: string;
  urutan: number;
  is_global: boolean;
}

export interface RefGolongan {
  id: number;
  tenant_id?: string;
  nama: string;
  urutan: number;
  is_global: boolean;
}

export interface RefTingkatPerjalanan {
  id: number;
  tenant_id?: string;
  kode: string;
  deskripsi: string;
  is_global: boolean;
}

export interface RefAlatAngkut {
  id: number;
  tenant_id?: string;
  nama: string;
  is_global: boolean;
}

export type KopSurat = 'skpd' | 'bupati' | 'sekda';

export interface Instansi {
  id: number;
  tenant_id: string;
  nama_lengkap: string;
  nama_singkat: string;
  logo_path?: string;
  logo_kabupaten_path?: string;
  logo_garuda_path?: string;       // Logo Garuda untuk Kop Bupati
  alamat: string;
  kabupaten_kota: string;
  ibu_kota?: string;
  provinsi: string;
  kode_pos?: string;
  telepon?: string;
  email?: string;
  website?: string;
  is_primary: boolean;
  // ── Kop Bupati / Kepala Daerah ──────────────────────────────────
  jabatan_kepala_daerah?: string;  // cth: "BUPATI PEGUNUNGAN BINTANG"
  alamat_bupati?: string;          // alamat kantor Bupati (jika berbeda)
  telepon_bupati?: string;
  // ── Kop Sekretariat Daerah ──────────────────────────────────────
  alamat_sekda?: string;           // alamat Setda (jika berbeda)
  telepon_sekda?: string;
  created_at: string;
  updated_at: string;
}

export interface MataAnggaran {
  id: number;
  tenant_id: string;
  kode: string;
  kode_rekening?: string;
  nama: string;
  tahun: number;
  pagu: number;
  is_active: boolean;
  created_at: string;
}

export interface Pegawai {
  id: number;
  tenant_id: string;
  nip: string;
  nama_lengkap: string;
  gelar_depan?: string;
  gelar_belakang?: string;
  jabatan: string;
  pangkat_id?: number;
  golongan_id?: number;
  unit_kerja_id?: number;
  status_aktif: boolean;
  tanggal_mulai?: string;
  email?: string;
  telepon?: string;
  created_at: string;
  updated_at: string;
  ref_pangkat?: RefPangkat;
  ref_golongan?: RefGolongan;
  instansi?: Instansi;
}

// Penandatangan — defined in types/penandatangan.ts, re-exported via export * below
// Do not define a duplicate here.

export interface SettingPenomoran {
  id: number;
  tenant_id: string;
  instansi_id?: number;
  jenis_dokumen: 'SPT' | 'SPPD';
  format_pattern: string;
  digit_count: number;
  separator: string;
  counter_current: number;
  counter_year: number;
  reset_annually: boolean;
  kode_organisasi?: string;
  created_at: string;
  updated_at: string;
}

export type JenisDasarPerintah = 'surat' | 'lisan' | 'lainnya';

export interface DasarPerintah {
  id: string;
  jenis: JenisDasarPerintah; // 'surat' | 'lisan' | 'lainnya'
  nomor?: string;            // hanya untuk jenis 'surat'
  tanggal?: string;          // hanya untuk jenis 'surat'
  perihal: string;           // wajib untuk semua jenis (deskripsi/perihal/keterangan)
}

export interface SPTPegawai {
  id: number;
  spt_id: number;
  pegawai_id: number;
  urutan: number;
  pegawai?: Pegawai;
}

export interface SPTFormValues {
  tanggal_penetapan: string;
  tempat_penetapan: string;
  kop_surat: KopSurat;
  dasar_perintah: DasarPerintah[];
  tujuan_kegiatan: string[];
  lama_kegiatan: number;
  pembebanan_anggaran: string;
  mata_anggaran_id?: number;
  penandatangan_id?: number;
  instansi_id?: number;
  catatan?: string;
  pegawai_ids: number[];
}

export interface SPPDPengikut {
  id: number;
  sppd_id: number;
  tipe: PengikutTipe;
  pegawai_id?: number;
  nama?: string;
  umur?: number;
  keterangan?: string;
  urutan: number;
  pegawai?: Pegawai;
}

export interface SPPDRealisasi {
  id: number;
  sppd_id: number;
  section: 1 | 2 | 3 | 4;
  tanggal?: string;
  lokasi?: string;
  nama_pejabat?: string;
  jabatan_pejabat?: string;
  catatan?: string;
}

export interface SPPDFormValues {
  spt_id?: number;
  pegawai_id?: number;
  pejabat_pemberi_perintah_id?: number;
  tingkat_perjalanan?: string;
  maksud_perjalanan: string;
  alat_angkut?: string;
  tempat_berangkat: string;
  tempat_tujuan: string;
  lama_perjalanan: number;
  tanggal_berangkat: string;
  tanggal_penerbitan: string;
  instansi_id?: number;
  mata_anggaran_id?: number;
  keterangan_lain?: string;
  penandatangan_id?: number;
  pengikut: Omit<SPPDPengikut, 'id' | 'sppd_id'>[];
}

export interface ApprovalConfig {
  id: number;
  tenant_id: string;
  instansi_id?: number;
  jenis_dokumen: 'SPT' | 'SPPD' | 'Keduanya';
  level: number;
  approver_user_id?: string;
  approver_label?: string;
  is_active: boolean;
}

export interface ApprovalLog {
  id: number;
  tenant_id: string;
  dokumen_id: number;
  jenis_dokumen: string;
  level: number;
  approver_id?: string;
  action: ApprovalAction;
  komentar?: string;
  created_at: string;
  approver?: UserProfile;
}

export interface Notifikasi {
  id: number;
  tenant_id: string;
  user_id: string;
  tipe: string;
  judul: string;
  pesan: string;
  dokumen_id?: number;
  jenis_dokumen?: string;
  status: 'Draft' | 'Sent' | 'Read';
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: number;
  tenant_id?: string;
  user_id?: string;
  changed_by?: string;
  changed_by_name?: string;
  action: string;
  table_name: string;
  record_id?: number;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  user?: UserProfile;
}

export interface RekapPegawai {
  pegawai_id: number;
  nip: string;
  nama_lengkap: string;
  jabatan: string;
  unit_kerja: string;
  jumlah_spt: number;
  jumlah_sppd: number;
  total_hari: number;
  daftar_tujuan: string;
}

export interface MonthlyTrend {
  bulan: number;
  nama_bulan: string;
  jumlah_spt: number;
  jumlah_sppd: number;
}

export interface DashboardStats {
  total_pegawai_aktif: number;
  spt_bulan_ini: number;
  sppd_bulan_ini: number;
  total_draft: number;
  menunggu_persetujuan: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface AlertInfo {
  type: 'warning' | 'danger' | 'success' | 'info';
  title: string;
  message: string;
  action?: { label: string; href: string };
}

// Re-export specific document types to avoid circular issues
// but we remove the definitions from here to avoid duplication
export * from './spt';
export * from './sppd';
export * from './penandatangan';
