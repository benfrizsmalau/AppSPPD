-- SQL Script for Final Automation & Defaults (VERIFIED)
-- Jalankan di SQL Editor Supabase

-- 1. Penyesuaian Skema (Robustness)
-- Memastikan tabel penomoran unik per jenis dokumen agar ON CONFLICT bekerja
ALTER TABLE IF EXISTS public.setting_penomoran 
ADD CONSTRAINT setting_penomoran_jenis_dokumen_key UNIQUE (jenis_dokumen);

-- Memperpanjang username agar muat email yang panjang
ALTER TABLE IF EXISTS public.user_profiles 
ALTER COLUMN username TYPE VARCHAR(100);

-- 2. Fungsi Otomatis untuk updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 3. Pasang Trigger updated_at pada tabel yang memiliki kolom updated_at
-- (Memastikan trigger tidak error jika dijalankan berulang kali)
DROP TRIGGER IF EXISTS update_instansi_modtime ON instansi;
CREATE TRIGGER update_instansi_modtime BEFORE UPDATE ON instansi FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_pegawai_modtime ON pegawai;
CREATE TRIGGER update_pegawai_modtime BEFORE UPDATE ON pegawai FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_profiles_modtime ON user_profiles;
CREATE TRIGGER update_user_profiles_modtime BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_penandatangan_modtime ON penandatangan;
CREATE TRIGGER update_penandatangan_modtime BEFORE UPDATE ON penandatangan FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_spt_modtime ON spt;
CREATE TRIGGER update_spt_modtime BEFORE UPDATE ON spt FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_sppd_modtime ON sppd;
CREATE TRIGGER update_sppd_modtime BEFORE UPDATE ON sppd FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_setting_penomoran_modtime ON setting_penomoran;
CREATE TRIGGER update_setting_penomoran_modtime BEFORE UPDATE ON setting_penomoran FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 4. Inisialisasi Data Default Penomoran
INSERT INTO public.setting_penomoran (jenis_dokumen, format_pattern, digit_count, counter_year)
VALUES 
('SPT', '{num}/SPT/BPPKAD/{year}', 3, EXTRACT(YEAR FROM CURRENT_DATE)),
('SPPD', '{num}/SPPD/BPPKAD/{year}', 3, EXTRACT(YEAR FROM CURRENT_DATE))
ON CONFLICT (jenis_dokumen) DO UPDATE 
SET format_pattern = EXCLUDED.format_pattern;

-- 5. Trigger Otomatis Pembuatan User Profile saat Sign Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, username, nama_lengkap, role, tenant_id)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'nama_lengkap', new.raw_user_meta_data->>'full_name', new.email), 
    COALESCE(new.raw_user_meta_data->>'role', 'Operator'),
    (new.raw_user_meta_data->>'tenant_id')::uuid
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
