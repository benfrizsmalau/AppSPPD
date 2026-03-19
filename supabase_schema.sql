-- =================================================================
-- SiSPPD v2.1 — Complete Database Schema
-- Platform: Supabase (PostgreSQL)
-- Multi-Tenant | RLS | Audit Trail | Atomic Numbering
-- =================================================================

-- 0. CLEAN SLATE (UNCOMMENT TO RESET DATABASE)
-- DROP VIEW IF EXISTS v_mata_anggaran_realisasi CASCADE;
-- DROP TABLE IF EXISTS sppd_realisasi, sppd_pengikut, sppd, spt_pegawai, spt, setting_penomoran, nomor_history, penandatangan, pegawai, user_profiles, mata_anggaran, instansi, ref_alat_angkut, ref_tingkat_perjalanan, ref_golongan, ref_pangkat, tenants, super_admins, audit_log, login_events, notifikasi, approval_log, approval_config CASCADE;
-- DROP TYPE IF EXISTS user_role CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =================================================================
-- 0. SUPER ADMIN (outside tenant scope)
-- =================================================================
CREATE TABLE IF NOT EXISTS super_admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama_lengkap VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================================================================
-- 1. TENANTS (Multi-Tenant SaaS)
-- =================================================================
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode VARCHAR(50) UNIQUE NOT NULL,
  nama_instansi VARCHAR(255) NOT NULL,
  nama_singkat VARCHAR(50) NOT NULL,
  subdomain VARCHAR(100) UNIQUE,
  paket VARCHAR(20) DEFAULT 'free' CHECK (paket IN ('free','pro','enterprise')),
  is_active BOOLEAN DEFAULT FALSE,
  email_admin VARCHAR(255) NOT NULL,
  kabupaten_kota VARCHAR(100),
  provinsi VARCHAR(100),
  alamat TEXT,
  telepon VARCHAR(20),
  website VARCHAR(100),
  setup_completed BOOLEAN DEFAULT FALSE,
  setup_progress JSONB DEFAULT '{}',
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  max_pegawai INT DEFAULT 50,
  max_dokumen_per_bulan INT DEFAULT 100,
  storage_gb NUMERIC(5,2) DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================================================================
-- 2. REFERENCE TABLES (per-tenant)
-- =================================================================
CREATE TABLE IF NOT EXISTS ref_pangkat (
  id SERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  nama VARCHAR(100) NOT NULL,
  urutan INT DEFAULT 0,
  is_global BOOLEAN DEFAULT FALSE,
  UNIQUE(tenant_id, nama)
);

CREATE TABLE IF NOT EXISTS ref_golongan (
  id SERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  nama VARCHAR(10) NOT NULL,
  urutan INT DEFAULT 0,
  is_global BOOLEAN DEFAULT FALSE,
  UNIQUE(tenant_id, nama)
);

CREATE TABLE IF NOT EXISTS ref_tingkat_perjalanan (
  id SERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  kode VARCHAR(5) NOT NULL,
  deskripsi TEXT NOT NULL,
  is_global BOOLEAN DEFAULT FALSE,
  UNIQUE(tenant_id, kode)
);

CREATE TABLE IF NOT EXISTS ref_alat_angkut (
  id SERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  nama VARCHAR(100) NOT NULL,
  is_global BOOLEAN DEFAULT FALSE,
  UNIQUE(tenant_id, nama)
);

-- =================================================================
-- 3. INSTANSI (Institution settings per tenant)
-- =================================================================
CREATE TABLE IF NOT EXISTS instansi (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nama_lengkap VARCHAR(255) NOT NULL,
  nama_singkat VARCHAR(50) NOT NULL,
  logo_path TEXT,
  logo_kabupaten_path TEXT,
  logo_garuda_path TEXT,              -- Logo Garuda/Lambang Negara untuk Kop Bupati
  alamat TEXT NOT NULL,
  kabupaten_kota VARCHAR(100) NOT NULL,
  ibu_kota VARCHAR(100),
  provinsi VARCHAR(100) NOT NULL,
  kode_pos VARCHAR(10),
  telepon VARCHAR(20),
  email VARCHAR(100),
  website VARCHAR(100),
  is_primary BOOLEAN DEFAULT FALSE,
  -- ── Kop Bupati / Kepala Daerah ──────────────────────────────
  -- Digunakan saat SPT diterbitkan atas nama Bupati/Walikota
  jabatan_kepala_daerah VARCHAR(200),   -- cth: "BUPATI PEGUNUNGAN BINTANG"
  alamat_bupati TEXT,                   -- alamat kantor Bupati (jika berbeda)
  telepon_bupati VARCHAR(50),
  -- ── Kop Sekretariat Daerah ──────────────────────────────────
  -- Digunakan saat SPT diterbitkan atas nama Sekda
  alamat_sekda TEXT,                    -- alamat Setda (jika berbeda)
  telepon_sekda VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================================================================
-- 4. MATA ANGGARAN (Budget codes)
-- =================================================================
CREATE TABLE IF NOT EXISTS mata_anggaran (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kode VARCHAR(100) NOT NULL,
  kode_rekening VARCHAR(100),
  nama VARCHAR(255) NOT NULL,
  tahun INT NOT NULL,
  pagu BIGINT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, kode, tahun)
);

-- =================================================================
-- 5. USER PROFILES & RBAC
-- =================================================================
CREATE TYPE user_role AS ENUM ('Admin', 'Operator', 'Pejabat', 'Pegawai');

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  username VARCHAR(50),
  nama_lengkap VARCHAR(100) NOT NULL,
  role user_role NOT NULL DEFAULT 'Operator',
  pegawai_id INT,
  status_aktif BOOLEAN DEFAULT TRUE,
  last_active TIMESTAMP WITH TIME ZONE,
  login_count INT DEFAULT 0,
  avatar_url TEXT,
  telepon VARCHAR(20),
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================================================================
-- 5b. TRIGGER: Auto-create user_profiles on new Supabase Auth user
-- Fires for BOTH self-register AND admin invite flows.
-- Reads tenant_id, nama_lengkap, role from raw_user_meta_data.
-- =================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id UUID;
  v_role      user_role;
  v_nama      TEXT;
BEGIN
  -- Parse tenant_id from metadata (may be NULL for Super Admin)
  BEGIN
    v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_tenant_id := NULL;
  END;

  -- Parse role safely (default Operator for invited users, Admin for first registration)
  BEGIN
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'Operator')::user_role;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'Operator'::user_role;
  END;

  -- Use provided nama or derive from email
  v_nama := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'nama_lengkap'), ''),
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.user_profiles (
    id, tenant_id, nama_lengkap, role, status_aktif, created_at, updated_at
  ) VALUES (
    NEW.id,
    v_tenant_id,
    v_nama,
    v_role,
    TRUE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop + recreate trigger to ensure idempotency
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =================================================================
-- 6. PEGAWAI (Civil Servants)
-- =================================================================
CREATE TABLE IF NOT EXISTS pegawai (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nip VARCHAR(18) NOT NULL,
  nama_lengkap VARCHAR(100) NOT NULL,
  gelar_depan VARCHAR(20),
  gelar_belakang VARCHAR(30),
  jabatan VARCHAR(150) NOT NULL,
  pangkat_id INT REFERENCES ref_pangkat(id),
  golongan_id INT REFERENCES ref_golongan(id),
  unit_kerja_id INT REFERENCES instansi(id),
  status_aktif BOOLEAN DEFAULT TRUE,
  tanggal_mulai DATE,
  email VARCHAR(100),
  telepon VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, nip)
);

CREATE INDEX IF NOT EXISTS idx_pegawai_tenant ON pegawai(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pegawai_nip ON pegawai(tenant_id, nip);
CREATE INDEX IF NOT EXISTS idx_pegawai_nama ON pegawai(tenant_id, nama_lengkap);
CREATE INDEX IF NOT EXISTS idx_pegawai_status ON pegawai(tenant_id, status_aktif);

-- =================================================================
-- 7. PENANDATANGAN (Authorized Signatories)
-- =================================================================
CREATE TABLE IF NOT EXISTS penandatangan (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nama_lengkap VARCHAR(100) NOT NULL,
  gelar_depan VARCHAR(20),
  gelar_belakang VARCHAR(30),
  nip VARCHAR(18),                    -- opsional: Bupati/pejabat politik tidak punya NIP
  jabatan VARCHAR(150) NOT NULL,
  pangkat_id INT REFERENCES ref_pangkat(id),
  golongan_id INT REFERENCES ref_golongan(id),
  unit_kerja_id INT REFERENCES instansi(id),
  jenis_dokumen TEXT[],
  ttd_digital_path TEXT,
  status_aktif BOOLEAN DEFAULT TRUE,
  periode_mulai DATE,
  periode_selesai DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_penandatangan_tenant ON penandatangan(tenant_id);

-- =================================================================
-- 8. SETTING PENOMORAN (Numbering Configuration)
-- =================================================================
CREATE TABLE IF NOT EXISTS setting_penomoran (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instansi_id INT REFERENCES instansi(id),
  jenis_dokumen VARCHAR(10) NOT NULL CHECK (jenis_dokumen IN ('SPT','SPPD')),
  format_pattern VARCHAR(200) NOT NULL DEFAULT '{num}/{jenis}/{org}/{month_roman}/{year}',
  digit_count INT DEFAULT 3,
  separator VARCHAR(5) DEFAULT '/',
  counter_current INT DEFAULT 0,
  counter_year INT NOT NULL,
  reset_annually BOOLEAN DEFAULT TRUE,
  kode_organisasi VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, jenis_dokumen)
);

CREATE INDEX IF NOT EXISTS idx_setting_nomor_tenant ON setting_penomoran(tenant_id);

-- NOMOR HISTORY (prevent duplicate numbers ever)
CREATE TABLE IF NOT EXISTS nomor_history (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nomor_dokumen VARCHAR(200) NOT NULL,
  jenis_dokumen VARCHAR(10) NOT NULL,
  dokumen_id INT NOT NULL,
  counter_value INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(tenant_id, nomor_dokumen)
);

-- =================================================================
-- 9. SPT (Surat Perintah Tugas)
-- =================================================================
CREATE TABLE IF NOT EXISTS spt (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nomor_spt VARCHAR(200),
  tanggal_penetapan DATE NOT NULL,
  tempat_penetapan VARCHAR(100) NOT NULL,
  dasar_perintah JSONB DEFAULT '[]',
  tujuan_kegiatan TEXT[] NOT NULL DEFAULT '{}',
  lama_kegiatan INT NOT NULL DEFAULT 1,
  pembebanan_anggaran VARCHAR(200),
  mata_anggaran_id INT REFERENCES mata_anggaran(id),
  penandatangan_id INT REFERENCES penandatangan(id),
  instansi_id INT REFERENCES instansi(id),
  kop_surat TEXT NOT NULL DEFAULT 'skpd'
    CHECK (kop_surat IN ('skpd','bupati','sekda')),
  status TEXT NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft','Menunggu Persetujuan','Final','Printed','Completed','Cancelled','Expired')),
  pdf_file_path TEXT,
  catatan TEXT,
  alasan_pembatalan TEXT,
  parent_spt_id INT REFERENCES spt(id),
  print_count INT DEFAULT 0,
  last_printed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  finalized_at TIMESTAMP WITH TIME ZONE,
  finalized_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_spt_tenant ON spt(tenant_id);
CREATE INDEX IF NOT EXISTS idx_spt_status ON spt(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_spt_tanggal ON spt(tenant_id, tanggal_penetapan);
CREATE INDEX IF NOT EXISTS idx_spt_nomor ON spt(tenant_id, nomor_spt);

-- Junction: multiple pegawai per SPT
CREATE TABLE IF NOT EXISTS spt_pegawai (
  id SERIAL PRIMARY KEY,
  spt_id INT REFERENCES spt(id) ON DELETE CASCADE,
  pegawai_id INT REFERENCES pegawai(id),
  urutan INT NOT NULL DEFAULT 1,
  UNIQUE(spt_id, pegawai_id)
);

CREATE INDEX IF NOT EXISTS idx_spt_pegawai_spt ON spt_pegawai(spt_id);
CREATE INDEX IF NOT EXISTS idx_spt_pegawai_peg ON spt_pegawai(pegawai_id);

-- =================================================================
-- 10. SPPD (Surat Perintah Perjalanan Dinas)
-- =================================================================
CREATE TABLE IF NOT EXISTS sppd (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nomor_sppd VARCHAR(200),
  spt_id INT REFERENCES spt(id),
  pejabat_pemberi_perintah_id INT REFERENCES pegawai(id),
  pegawai_id INT REFERENCES pegawai(id),
  tingkat_perjalanan VARCHAR(50),
  tingkat_biaya_id INT REFERENCES ref_tingkat_perjalanan(id),
  maksud_perjalanan TEXT NOT NULL,
  alat_angkut VARCHAR(100),
  alat_angkut_id INT REFERENCES ref_alat_angkut(id),
  tempat_berangkat VARCHAR(100) NOT NULL,
  tempat_tujuan VARCHAR(100) NOT NULL,
  lama_perjalanan INT NOT NULL DEFAULT 1 CHECK (lama_perjalanan BETWEEN 1 AND 365),
  tanggal_berangkat DATE NOT NULL,
  tanggal_kembali DATE NOT NULL,
  instansi_id INT REFERENCES instansi(id),
  mata_anggaran_id INT REFERENCES mata_anggaran(id),
  mata_anggaran VARCHAR(200),
  keterangan_lain TEXT,
  tempat_penerbitan VARCHAR(100),
  tanggal_penerbitan DATE NOT NULL,
  penandatangan_id INT REFERENCES penandatangan(id),
  kop_surat TEXT NOT NULL DEFAULT 'skpd'
    CHECK (kop_surat IN ('skpd','bupati','sekda')),
  status TEXT NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft','Menunggu Persetujuan','Final','Printed','Completed','Cancelled')),
  pdf_file_path TEXT,
  print_count INT DEFAULT 0,
  last_printed_at TIMESTAMP WITH TIME ZONE,
  alasan_pembatalan TEXT,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  finalized_at TIMESTAMP WITH TIME ZONE,
  parent_sppd_id INT REFERENCES sppd(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_sppd_tenant ON sppd(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sppd_status ON sppd(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sppd_tanggal ON sppd(tenant_id, tanggal_berangkat);
CREATE INDEX IF NOT EXISTS idx_sppd_pegawai ON sppd(tenant_id, pegawai_id);
CREATE INDEX IF NOT EXISTS idx_sppd_spt ON sppd(spt_id);

-- Pengikut (companions)
CREATE TABLE IF NOT EXISTS sppd_pengikut (
  id SERIAL PRIMARY KEY,
  sppd_id INT REFERENCES sppd(id) ON DELETE CASCADE,
  tipe VARCHAR(10) DEFAULT 'manual' CHECK (tipe IN ('pegawai','manual')),
  pegawai_id INT REFERENCES pegawai(id),
  nama VARCHAR(100),
  umur INT,
  keterangan VARCHAR(100),
  urutan INT NOT NULL DEFAULT 1
);

-- Realisasi (back page of SPPD)
CREATE TABLE IF NOT EXISTS sppd_realisasi (
  id SERIAL PRIMARY KEY,
  sppd_id INT REFERENCES sppd(id) ON DELETE CASCADE,
  section INT NOT NULL CHECK (section BETWEEN 1 AND 4),
  tanggal DATE,
  lokasi VARCHAR(100),
  nama_pejabat VARCHAR(100),
  jabatan_pejabat VARCHAR(150),
  catatan TEXT,
  UNIQUE(sppd_id, section)
);

-- =================================================================
-- VIEWS
-- =================================================================
-- View: budget realization
CREATE OR REPLACE VIEW v_mata_anggaran_realisasi AS
SELECT
  ma.*,
  COUNT(s.id) AS jumlah_sppd,
  COALESCE(SUM(s.lama_perjalanan), 0) AS total_hari,
  COALESCE(ma.pagu, 0) AS pagu_anggaran
FROM mata_anggaran ma
LEFT JOIN sppd s ON s.mata_anggaran_id = ma.id
  AND s.status IN ('Final','Printed','Completed')
  AND s.tenant_id = ma.tenant_id
GROUP BY ma.id;

-- =================================================================
-- 11. APPROVAL WORKFLOW
-- =================================================================
CREATE TABLE IF NOT EXISTS approval_config (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instansi_id INT REFERENCES instansi(id),
  jenis_dokumen VARCHAR(10) NOT NULL CHECK (jenis_dokumen IN ('SPT','SPPD','Keduanya')),
  level INT NOT NULL DEFAULT 1,
  approver_user_id UUID REFERENCES auth.users(id),
  approver_label VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(tenant_id, jenis_dokumen, level)
);

CREATE TABLE IF NOT EXISTS approval_log (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dokumen_id INT NOT NULL,
  jenis_dokumen VARCHAR(10) NOT NULL,
  level INT NOT NULL,
  approver_id UUID REFERENCES auth.users(id),
  action VARCHAR(20) NOT NULL CHECK (action IN ('SUBMIT','APPROVE','REJECT','REVISE','BYPASS')),
  komentar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_log_dokumen ON approval_log(jenis_dokumen, dokumen_id);

-- =================================================================
-- 12. NOTIFICATIONS
-- =================================================================
CREATE TABLE IF NOT EXISTS notifikasi (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipe VARCHAR(50) NOT NULL,
  judul VARCHAR(255) NOT NULL,
  pesan TEXT NOT NULL,
  dokumen_id INT,
  jenis_dokumen VARCHAR(10),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifikasi(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notif_tenant ON notifikasi(tenant_id);

-- =================================================================
-- 13. AUDIT LOG
-- =================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(50) NOT NULL,
  record_id BIGINT,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);

-- =================================================================
-- 14. LOGIN EVENTS (security tracking)
-- =================================================================
CREATE TABLE IF NOT EXISTS login_events (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_user ON login_events(user_id, created_at DESC);

-- =================================================================
-- STORED PROCEDURES
-- =================================================================

-- A. Atomic Document Numbering (prevents duplicates via row lock)
CREATE OR REPLACE FUNCTION get_next_document_number(
  p_jenis VARCHAR(10),
  p_tenant_id UUID
) RETURNS VARCHAR AS $$
DECLARE
  v_setting RECORD;
  v_counter INT;
  v_year INT;
  v_nomor VARCHAR(200);
  v_month_roman VARCHAR(5);
  v_pattern VARCHAR(200);
  v_padded VARCHAR(20);
  v_kode_org VARCHAR(20);
BEGIN
  -- Lock the row to prevent race conditions
  SELECT * INTO v_setting
  FROM setting_penomoran
  WHERE tenant_id = p_tenant_id AND jenis_dokumen = p_jenis
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Konfigurasi penomoran untuk % tidak ditemukan', p_jenis;
  END IF;

  v_year := EXTRACT(YEAR FROM NOW())::INT;

  -- Reset counter if year changed (and reset_annually = true)
  IF v_setting.reset_annually AND v_setting.counter_year < v_year THEN
    UPDATE setting_penomoran
    SET counter_current = 0, counter_year = v_year, updated_at = NOW()
    WHERE tenant_id = p_tenant_id AND jenis_dokumen = p_jenis;
    v_setting.counter_current := 0;
  END IF;

  -- Increment
  v_counter := v_setting.counter_current + 1;

  UPDATE setting_penomoran
  SET counter_current = v_counter, updated_at = NOW()
  WHERE tenant_id = p_tenant_id AND jenis_dokumen = p_jenis;

  -- Build Roman numeral for month
  v_month_roman := CASE EXTRACT(MONTH FROM NOW())::INT
    WHEN 1 THEN 'I' WHEN 2 THEN 'II' WHEN 3 THEN 'III' WHEN 4 THEN 'IV'
    WHEN 5 THEN 'V' WHEN 6 THEN 'VI' WHEN 7 THEN 'VII' WHEN 8 THEN 'VIII'
    WHEN 9 THEN 'IX' WHEN 10 THEN 'X' WHEN 11 THEN 'XI' WHEN 12 THEN 'XII'
  END;

  -- Pad counter
  v_padded := LPAD(v_counter::TEXT, v_setting.digit_count, '0');

  -- Get org code
  v_kode_org := COALESCE(v_setting.kode_organisasi, 'ORG');

  -- Apply format pattern
  v_pattern := v_setting.format_pattern;
  v_pattern := REPLACE(v_pattern, '{num}', v_padded);
  v_pattern := REPLACE(v_pattern, '{jenis}', p_jenis);
  v_pattern := REPLACE(v_pattern, '{year}', v_year::TEXT);
  v_pattern := REPLACE(v_pattern, '{month}', LPAD(EXTRACT(MONTH FROM NOW())::TEXT, 2, '0'));
  v_pattern := REPLACE(v_pattern, '{month_roman}', v_month_roman);
  v_pattern := REPLACE(v_pattern, '{org}', v_kode_org);
  v_nomor := v_pattern;

  RETURN v_nomor;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Rekap Pegawai for reports
CREATE OR REPLACE FUNCTION get_rekap_pegawai(
  p_tenant_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_unit_kerja_id INT DEFAULT NULL
) RETURNS TABLE(
  pegawai_id INT,
  nip VARCHAR,
  nama_lengkap VARCHAR,
  jabatan VARCHAR,
  unit_kerja VARCHAR,
  jumlah_spt BIGINT,
  jumlah_sppd BIGINT,
  total_hari BIGINT,
  daftar_tujuan TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.nip,
    p.nama_lengkap,
    p.jabatan,
    COALESCE(i.nama_singkat, '-') AS unit_kerja,
    COUNT(DISTINCT sp.spt_id) AS jumlah_spt,
    COUNT(DISTINCT s.id) AS jumlah_sppd,
    COALESCE(SUM(s.lama_perjalanan), 0) AS total_hari,
    COALESCE(STRING_AGG(DISTINCT s.tempat_tujuan, ', '), '-') AS daftar_tujuan
  FROM pegawai p
  LEFT JOIN instansi i ON p.unit_kerja_id = i.id
  LEFT JOIN spt_pegawai sp ON sp.pegawai_id = p.id
  LEFT JOIN spt t ON t.id = sp.spt_id AND t.tenant_id = p_tenant_id
    AND t.tanggal_penetapan BETWEEN p_start_date AND p_end_date
    AND t.status IN ('Final','Printed','Completed')
  LEFT JOIN sppd s ON s.pegawai_id = p.id AND s.tenant_id = p_tenant_id
    AND s.tanggal_berangkat BETWEEN p_start_date AND p_end_date
    AND s.status IN ('Final','Printed','Completed')
  WHERE p.tenant_id = p_tenant_id
    AND (p_unit_kerja_id IS NULL OR p.unit_kerja_id = p_unit_kerja_id)
  GROUP BY p.id, p.nip, p.nama_lengkap, p.jabatan, i.nama_singkat
  ORDER BY jumlah_sppd DESC, p.nama_lengkap;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. Get monthly trend for dashboard
CREATE OR REPLACE FUNCTION get_monthly_trend(
  p_tenant_id UUID,
  p_year INT DEFAULT NULL
) RETURNS TABLE(
  bulan INT,
  nama_bulan TEXT,
  jumlah_spt BIGINT,
  jumlah_sppd BIGINT
) AS $$
DECLARE
  v_year INT := COALESCE(p_year, EXTRACT(YEAR FROM NOW())::INT);
BEGIN
  RETURN QUERY
  SELECT
    m.bulan,
    CASE m.bulan
      WHEN 1 THEN 'Jan' WHEN 2 THEN 'Feb' WHEN 3 THEN 'Mar' WHEN 4 THEN 'Apr'
      WHEN 5 THEN 'Mei' WHEN 6 THEN 'Jun' WHEN 7 THEN 'Jul' WHEN 8 THEN 'Agt'
      WHEN 9 THEN 'Sep' WHEN 10 THEN 'Okt' WHEN 11 THEN 'Nov' WHEN 12 THEN 'Des'
    END AS nama_bulan,
    COUNT(DISTINCT t.id) FILTER (WHERE t.id IS NOT NULL) AS jumlah_spt,
    COUNT(DISTINCT s.id) FILTER (WHERE s.id IS NOT NULL) AS jumlah_sppd
  FROM generate_series(1,12) AS m(bulan)
  LEFT JOIN spt t ON t.tenant_id = p_tenant_id
    AND EXTRACT(MONTH FROM t.tanggal_penetapan) = m.bulan
    AND EXTRACT(YEAR FROM t.tanggal_penetapan) = v_year
    AND t.status NOT IN ('Cancelled')
  LEFT JOIN sppd s ON s.tenant_id = p_tenant_id
    AND EXTRACT(MONTH FROM s.tanggal_berangkat) = m.bulan
    AND EXTRACT(YEAR FROM s.tanggal_berangkat) = v_year
    AND s.status NOT IN ('Cancelled')
  GROUP BY m.bulan
  ORDER BY m.bulan;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- D. Dashboard stats
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_month_start DATE := DATE_TRUNC('month', CURRENT_DATE);
BEGIN
  SELECT jsonb_build_object(
    'total_pegawai_aktif', (SELECT COUNT(*) FROM pegawai WHERE tenant_id = p_tenant_id AND status_aktif = TRUE),
    'spt_bulan_ini', (SELECT COUNT(*) FROM spt WHERE tenant_id = p_tenant_id AND tanggal_penetapan >= v_month_start AND status NOT IN ('Cancelled')),
    'sppd_bulan_ini', (SELECT COUNT(*) FROM sppd WHERE tenant_id = p_tenant_id AND tanggal_berangkat >= v_month_start AND status NOT IN ('Cancelled')),
    'total_draft', (SELECT COUNT(*) FROM (
      SELECT id FROM spt WHERE tenant_id = p_tenant_id AND status = 'Draft'
      UNION ALL
      SELECT id FROM sppd WHERE tenant_id = p_tenant_id AND status = 'Draft'
    ) AS drafts),
    'menunggu_persetujuan', (SELECT COUNT(*) FROM (
      SELECT id FROM spt WHERE tenant_id = p_tenant_id AND status = 'Menunggu Persetujuan'
      UNION ALL
      SELECT id FROM sppd WHERE tenant_id = p_tenant_id AND status = 'Menunggu Persetujuan'
    ) AS pending)
  ) INTO v_result;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =================================================================
-- AUDIT TRIGGER FUNCTION
-- =================================================================
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_old JSONB;
  v_new JSONB;
  v_record_id BIGINT;
  v_action VARCHAR(50);
BEGIN
  -- Get current user from JWT
  BEGIN
    v_user_id := (auth.jwt() ->> 'sub')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_new := to_jsonb(NEW);
    v_old := NULL;
    v_record_id := (v_new ->> 'id')::BIGINT;
    BEGIN v_tenant_id := (v_new ->> 'tenant_id')::UUID; EXCEPTION WHEN OTHERS THEN v_tenant_id := NULL; END;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := (v_new ->> 'id')::BIGINT;
    BEGIN v_tenant_id := (v_new ->> 'tenant_id')::UUID; EXCEPTION WHEN OTHERS THEN v_tenant_id := NULL; END;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_record_id := (v_old ->> 'id')::BIGINT;
    BEGIN v_tenant_id := (v_old ->> 'tenant_id')::UUID; EXCEPTION WHEN OTHERS THEN v_tenant_id := NULL; END;
  END IF;

  INSERT INTO audit_log (tenant_id, user_id, action, table_name, record_id, old_data, new_data)
  VALUES (v_tenant_id, v_user_id, v_action, TG_TABLE_NAME, v_record_id, v_old, v_new);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach audit triggers to critical tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['spt','sppd','pegawai','penandatangan','instansi','setting_penomoran','user_profiles','approval_config','mata_anggaran']
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS audit_%1$s ON %1$s;
      CREATE TRIGGER audit_%1$s
        AFTER INSERT OR UPDATE OR DELETE ON %1$s
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
    ', t);
  END LOOP;
END;
$$;

-- =================================================================
-- JWT HOOK: inject tenant_id & role into JWT claims
-- =================================================================
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB AS $$
DECLARE
  v_profile RECORD;
  v_claims JSONB;
BEGIN
  SELECT tenant_id, role, status_aktif INTO v_profile
  FROM user_profiles
  WHERE id = (event ->> 'user_id')::UUID;

  IF FOUND AND v_profile.tenant_id IS NOT NULL THEN
    v_claims := event->'claims';
    v_claims := jsonb_set(v_claims, '{tenant_id}', to_jsonb(v_profile.tenant_id::TEXT));
    v_claims := jsonb_set(v_claims, '{user_role}', to_jsonb(v_profile.role::TEXT));
    event := jsonb_set(event, '{claims}', v_claims);
  END IF;

  -- Check if super admin
  IF EXISTS (SELECT 1 FROM super_admins WHERE id = (event ->> 'user_id')::UUID) THEN
    v_claims := event->'claims';
    v_claims := jsonb_set(v_claims, '{is_super_admin}', 'true'::jsonb);
    event := jsonb_set(event, '{claims}', v_claims);
  END IF;

  RETURN event;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Helper to extract tenant_id from JWT
CREATE OR REPLACE FUNCTION get_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN (auth.jwt() ->> 'tenant_id')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Helper to extract user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN auth.jwt() ->> 'user_role';
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =================================================================
-- ROW LEVEL SECURITY (RLS)
-- =================================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE instansi ENABLE ROW LEVEL SECURITY;
ALTER TABLE pegawai ENABLE ROW LEVEL SECURITY;
ALTER TABLE penandatangan ENABLE ROW LEVEL SECURITY;
ALTER TABLE spt ENABLE ROW LEVEL SECURITY;
ALTER TABLE spt_pegawai ENABLE ROW LEVEL SECURITY;
ALTER TABLE sppd ENABLE ROW LEVEL SECURITY;
ALTER TABLE sppd_pengikut ENABLE ROW LEVEL SECURITY;
ALTER TABLE sppd_realisasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE setting_penomoran ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomor_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE mata_anggaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifikasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_pangkat ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_golongan ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_tingkat_perjalanan ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_alat_angkut ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_events ENABLE ROW LEVEL SECURITY;

-- TENANT ISOLATION POLICIES (template)
CREATE POLICY "tenant_isolation_instansi" ON instansi
  USING (tenant_id = get_tenant_id());

CREATE POLICY "tenant_isolation_pegawai" ON pegawai
  USING (tenant_id = get_tenant_id());

CREATE POLICY "tenant_isolation_penandatangan" ON penandatangan
  USING (tenant_id = get_tenant_id());

CREATE POLICY "tenant_isolation_spt" ON spt
  USING (tenant_id = get_tenant_id());

CREATE POLICY "tenant_isolation_spt_pegawai" ON spt_pegawai
  USING (EXISTS (SELECT 1 FROM spt WHERE spt.id = spt_pegawai.spt_id AND spt.tenant_id = get_tenant_id()));

CREATE POLICY "tenant_isolation_sppd" ON sppd
  USING (tenant_id = get_tenant_id());

CREATE POLICY "tenant_isolation_sppd_pengikut" ON sppd_pengikut
  USING (EXISTS (SELECT 1 FROM sppd WHERE sppd.id = sppd_pengikut.sppd_id AND sppd.tenant_id = get_tenant_id()));

CREATE POLICY "tenant_isolation_sppd_realisasi" ON sppd_realisasi
  USING (EXISTS (SELECT 1 FROM sppd WHERE sppd.id = sppd_realisasi.sppd_id AND sppd.tenant_id = get_tenant_id()));

CREATE POLICY "tenant_isolation_setting_penomoran" ON setting_penomoran
  USING (tenant_id = get_tenant_id());

CREATE POLICY "tenant_isolation_nomor_history" ON nomor_history
  USING (tenant_id = get_tenant_id());

CREATE POLICY "tenant_isolation_mata_anggaran" ON mata_anggaran
  USING (tenant_id = get_tenant_id());

CREATE POLICY "tenant_isolation_approval_config" ON approval_config
  USING (tenant_id = get_tenant_id());

CREATE POLICY "tenant_isolation_approval_log" ON approval_log
  USING (tenant_id = get_tenant_id());

CREATE POLICY "own_notifications" ON notifikasi
  USING (user_id = auth.uid());

CREATE POLICY "tenant_isolation_audit_log" ON audit_log
  USING (tenant_id = get_tenant_id());

CREATE POLICY "own_profile" ON user_profiles
  USING (id = auth.uid() OR tenant_id = get_tenant_id());

CREATE POLICY "tenant_isolation_login_events" ON login_events
  USING (tenant_id = get_tenant_id() OR user_id = auth.uid());

-- Reference data: global or tenant
CREATE POLICY "ref_pangkat_access" ON ref_pangkat
  USING (is_global = TRUE OR tenant_id = get_tenant_id());

CREATE POLICY "ref_golongan_access" ON ref_golongan
  USING (is_global = TRUE OR tenant_id = get_tenant_id());

CREATE POLICY "ref_tingkat_perjalanan_access" ON ref_tingkat_perjalanan
  USING (is_global = TRUE OR tenant_id = get_tenant_id());

CREATE POLICY "ref_alat_angkut_access" ON ref_alat_angkut
  USING (is_global = TRUE OR tenant_id = get_tenant_id());

-- RBAC: only Admin can manage users
CREATE POLICY "admin_only_user_profiles" ON user_profiles
  FOR ALL
  USING (get_user_role() = 'Admin' OR id = auth.uid());

-- Pegawai: Pejabat & Pegawai can only read
CREATE POLICY "pegawai_read_all" ON pegawai FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY "pegawai_write_admin_operator" ON pegawai FOR INSERT WITH CHECK (
  tenant_id = get_tenant_id() AND get_user_role() IN ('Admin','Operator')
);
CREATE POLICY "pegawai_update_admin_operator" ON pegawai FOR UPDATE USING (
  tenant_id = get_tenant_id() AND get_user_role() IN ('Admin','Operator')
);

-- Approval: Pejabat can approve (update status only via RPC)
CREATE POLICY "spt_read" ON spt FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY "spt_write" ON spt FOR INSERT WITH CHECK (
  tenant_id = get_tenant_id() AND get_user_role() IN ('Admin','Operator')
);
CREATE POLICY "spt_update" ON spt FOR UPDATE USING (
  tenant_id = get_tenant_id() AND get_user_role() IN ('Admin','Operator','Pejabat')
);

CREATE POLICY "sppd_read" ON sppd FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY "sppd_write" ON sppd FOR INSERT WITH CHECK (
  tenant_id = get_tenant_id() AND get_user_role() IN ('Admin','Operator')
);
CREATE POLICY "sppd_update" ON sppd FOR UPDATE USING (
  tenant_id = get_tenant_id() AND get_user_role() IN ('Admin','Operator','Pejabat')
);

-- Audit log: Admin only
CREATE POLICY "audit_log_admin" ON audit_log FOR SELECT USING (
  tenant_id = get_tenant_id() AND get_user_role() = 'Admin'
);

-- =================================================================
-- GLOBAL SEED DATA
-- =================================================================

-- Global reference data (pangkat)
INSERT INTO ref_pangkat (tenant_id, nama, urutan, is_global) VALUES
(NULL, 'Juru Muda', 1, TRUE),
(NULL, 'Juru Muda Tingkat I', 2, TRUE),
(NULL, 'Juru', 3, TRUE),
(NULL, 'Juru Tingkat I', 4, TRUE),
(NULL, 'Pengatur Muda', 5, TRUE),
(NULL, 'Pengatur Muda Tingkat I', 6, TRUE),
(NULL, 'Pengatur', 7, TRUE),
(NULL, 'Pengatur Tingkat I', 8, TRUE),
(NULL, 'Penata Muda', 9, TRUE),
(NULL, 'Penata Muda Tingkat I', 10, TRUE),
(NULL, 'Penata', 11, TRUE),
(NULL, 'Penata Tingkat I', 12, TRUE),
(NULL, 'Pembina', 13, TRUE),
(NULL, 'Pembina Tingkat I', 14, TRUE),
(NULL, 'Pembina Utama Muda', 15, TRUE),
(NULL, 'Pembina Utama Madya', 16, TRUE),
(NULL, 'Pembina Utama', 17, TRUE)
ON CONFLICT DO NOTHING;

-- Global golongan
INSERT INTO ref_golongan (tenant_id, nama, urutan, is_global) VALUES
(NULL, 'I/a', 1, TRUE), (NULL, 'I/b', 2, TRUE), (NULL, 'I/c', 3, TRUE), (NULL, 'I/d', 4, TRUE),
(NULL, 'II/a', 5, TRUE), (NULL, 'II/b', 6, TRUE), (NULL, 'II/c', 7, TRUE), (NULL, 'II/d', 8, TRUE),
(NULL, 'III/a', 9, TRUE), (NULL, 'III/b', 10, TRUE), (NULL, 'III/c', 11, TRUE), (NULL, 'III/d', 12, TRUE),
(NULL, 'IV/a', 13, TRUE), (NULL, 'IV/b', 14, TRUE), (NULL, 'IV/c', 15, TRUE), (NULL, 'IV/d', 16, TRUE), (NULL, 'IV/e', 17, TRUE)
ON CONFLICT DO NOTHING;

-- Global tingkat perjalanan
INSERT INTO ref_tingkat_perjalanan (tenant_id, kode, deskripsi, is_global) VALUES
(NULL, 'A', 'Pejabat Negara/Eselon I', TRUE),
(NULL, 'B', 'Pejabat Eselon II/Pegawai Golongan IV', TRUE),
(NULL, 'C', 'Pejabat Eselon III/Pegawai Golongan III', TRUE),
(NULL, 'D', 'Pejabat Eselon IV/Pegawai Golongan II & I', TRUE)
ON CONFLICT DO NOTHING;

-- Global alat angkut
INSERT INTO ref_alat_angkut (tenant_id, nama, is_global) VALUES
(NULL, 'Kendaraan Dinas', TRUE),
(NULL, 'Pesawat Terbang', TRUE),
(NULL, 'Kapal Laut', TRUE),
(NULL, 'Bus/Travel', TRUE),
(NULL, 'Kendaraan Pribadi', TRUE),
(NULL, 'Lainnya', TRUE)
ON CONFLICT DO NOTHING;

-- =================================================================
-- MIGRATION: Logo Garuda & NIP opsional untuk Penandatangan Bupati
-- Jalankan di Supabase SQL Editor jika database sudah berjalan
-- =================================================================
-- ALTER TABLE instansi ADD COLUMN IF NOT EXISTS logo_garuda_path TEXT;
-- ALTER TABLE penandatangan ALTER COLUMN nip DROP NOT NULL;

-- =================================================================
-- MIGRATION: Kop Surat Hierarki (tambahkan ke database yang sudah ada)
-- Jalankan script ini jika database sudah berjalan sebelum update ini
-- =================================================================
-- ALTER TABLE instansi ADD COLUMN IF NOT EXISTS jabatan_kepala_daerah VARCHAR(200);
-- ALTER TABLE instansi ADD COLUMN IF NOT EXISTS alamat_bupati TEXT;
-- ALTER TABLE instansi ADD COLUMN IF NOT EXISTS telepon_bupati VARCHAR(50);
-- ALTER TABLE instansi ADD COLUMN IF NOT EXISTS alamat_sekda TEXT;
-- ALTER TABLE instansi ADD COLUMN IF NOT EXISTS telepon_sekda VARCHAR(50);
-- ALTER TABLE spt ADD COLUMN IF NOT EXISTS kop_surat TEXT NOT NULL DEFAULT 'skpd'
--   CHECK (kop_surat IN ('skpd','bupati','sekda'));
-- ALTER TABLE sppd ADD COLUMN IF NOT EXISTS kop_surat TEXT NOT NULL DEFAULT 'skpd'
--   CHECK (kop_surat IN ('skpd','bupati','sekda'));

-- =================================================================
-- MIGRATION: Profil Pengguna — kolom telepon & preferences
-- Jalankan di Supabase SQL Editor jika database sudah berjalan
-- =================================================================
-- ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS telepon VARCHAR(20);
-- ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- =================================================================
-- MIGRATION: Storage buckets
-- Jalankan di Supabase SQL Editor
-- =================================================================

-- Bucket untuk avatar pengguna (public)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

-- Bucket untuk tanda tangan digital penandatangan (public agar bisa ditampilkan di dokumen)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', true) ON CONFLICT (id) DO NOTHING;

-- Policy RLS storage: avatar
-- CREATE POLICY "avatars_upload_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
-- CREATE POLICY "avatars_update_own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
-- CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');

-- Policy RLS storage: signatures (Admin & Operator bisa upload, semua bisa baca)
-- CREATE POLICY "signatures_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'signatures');
-- CREATE POLICY "signatures_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'signatures');
-- CREATE POLICY "signatures_public_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'signatures');
