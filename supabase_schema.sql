-- Database Schema for SPT & SPPD Integrated Application

-- 1. Reference Tables
CREATE TABLE ref_pangkat (
    id SERIAL PRIMARY KEY,
    nama VARCHAR(50) NOT NULL UNIQUE,
    urutan INT DEFAULT 0
);

CREATE TABLE ref_golongan (
    id SERIAL PRIMARY KEY,
    nama VARCHAR(10) NOT NULL UNIQUE,
    urutan INT DEFAULT 0
);

CREATE TABLE ref_tingkat_perjalanan (
    id SERIAL PRIMARY KEY,
    kode VARCHAR(5) NOT NULL UNIQUE,
    deskripsi TEXT NOT NULL
);

CREATE TABLE ref_alat_angkut (
    id SERIAL PRIMARY KEY,
    nama VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE mata_anggaran (
    id SERIAL PRIMARY KEY,
    kode VARCHAR(100) NOT NULL UNIQUE,
    nama VARCHAR(255) NOT NULL,
    tahun INT NOT NULL
);

-- 2. Instansi Table
CREATE TABLE instansi (
    id SERIAL PRIMARY KEY,
    nama_lengkap VARCHAR(255) NOT NULL,
    nama_singkat VARCHAR(50) NOT NULL,
    logo_path TEXT,
    logo_kabupaten_path TEXT,
    alamat TEXT NOT NULL,
    kabupaten_kota VARCHAR(100) NOT NULL,
    provinsi VARCHAR(100) NOT NULL,
    kode_pos VARCHAR(10),
    telepon VARCHAR(20),
    email VARCHAR(100),
    website VARCHAR(100),
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Pegawai Table
CREATE TABLE pegawai (
    id SERIAL PRIMARY KEY,
    nama_lengkap VARCHAR(100) NOT NULL,
    gelar_depan VARCHAR(20),
    gelar_belakang VARCHAR(20),
    nip VARCHAR(18) NOT NULL UNIQUE,
    pangkat_id INT REFERENCES ref_pangkat(id),
    golongan_id INT REFERENCES ref_golongan(id),
    jabatan VARCHAR(150) NOT NULL,
    unit_kerja_id INT REFERENCES instansi(id),
    status_aktif BOOLEAN DEFAULT TRUE,
    tanggal_mulai DATE,
    email VARCHAR(100),
    telepon VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. User Profiles & RBAC
CREATE TYPE user_role AS ENUM ('Admin', 'Operator', 'Pejabat', 'Pegawai');

CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    nama_lengkap VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'Operator',
    pegawai_id INT REFERENCES pegawai(id),
    status_aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Penandatangan
CREATE TABLE penandatangan (
    id SERIAL PRIMARY KEY,
    nama_lengkap VARCHAR(100) NOT NULL,
    nip VARCHAR(18) NOT NULL,
    jabatan VARCHAR(150) NOT NULL,
    pangkat_id INT REFERENCES ref_pangkat(id),
    golongan_id INT REFERENCES ref_golongan(id),
    unit_kerja_id INT REFERENCES instansi(id),
    jenis_dokumen TEXT[], -- ['SPT', 'SPPD']
    ttd_digital_path TEXT,
    status_aktif BOOLEAN DEFAULT TRUE,
    periode_mulai DATE,
    periode_selesai DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. SPT (Surat Perintah Tugas)
CREATE TABLE spt (
    id SERIAL PRIMARY KEY,
    nomor_spt VARCHAR(50) UNIQUE NOT NULL,
    tanggal_penetapan DATE NOT NULL,
    tempat_penetapan VARCHAR(100) NOT NULL,
    dasar_perintah TEXT NOT NULL,
    tujuan_kegiatan TEXT[] NOT NULL,
    lama_kegiatan INT NOT NULL,
    pembebanan_anggaran TEXT NOT NULL,
    penandatangan_id INT REFERENCES penandatangan(id),
    instansi_id INT REFERENCES instansi(id),
    status TEXT NOT NULL DEFAULT 'Draft',
    pdf_file_path TEXT,
    catatan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    finalized_at TIMESTAMP WITH TIME ZONE,
    finalized_by UUID REFERENCES auth.users(id)
);

-- Junction table for multiple pegawai in one SPT
CREATE TABLE spt_pegawai (
    id SERIAL PRIMARY KEY,
    spt_id INT REFERENCES spt(id) ON DELETE CASCADE,
    pegawai_id INT REFERENCES pegawai(id),
    urutan INT NOT NULL
);

-- 7. SPPD (Surat Perintah Perjalanan Dinas)
CREATE TABLE sppd (
    id SERIAL PRIMARY KEY,
    nomor_sppd VARCHAR(50) UNIQUE NOT NULL,
    spt_id INT REFERENCES spt(id),
    pejabat_pemberi_perintah_id INT REFERENCES pegawai(id),
    pegawai_id INT REFERENCES pegawai(id),
    tingkat_perjalanan VARCHAR(5) NOT NULL,
    maksud_perjalanan TEXT NOT NULL,
    alat_angkut VARCHAR(50) NOT NULL,
    tempat_berangkat VARCHAR(100) NOT NULL,
    tempat_tujuan VARCHAR(100) NOT NULL,
    lama_perjalanan INT NOT NULL,
    tanggal_berangkat DATE NOT NULL,
    tanggal_kembali DATE NOT NULL,
    instansi_id INT REFERENCES instansi(id),
    mata_anggaran VARCHAR(200) NOT NULL,
    keterangan_lain TEXT,
    tempat_penerbitan VARCHAR(100) NOT NULL,
    tanggal_penerbitan DATE NOT NULL,
    penandatangan_id INT REFERENCES penandatangan(id),
    status TEXT NOT NULL DEFAULT 'Draft',
    pdf_file_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE sppd_pengikut (
    id SERIAL PRIMARY KEY,
    sppd_id INT REFERENCES sppd(id) ON DELETE CASCADE,
    nama VARCHAR(100) NOT NULL,
    umur INT NOT NULL,
    keterangan VARCHAR(100),
    urutan INT NOT NULL
);

-- 8. Numbering Settings
CREATE TABLE setting_penomoran (
    id SERIAL PRIMARY KEY,
    jenis_dokumen VARCHAR(10) NOT NULL, -- 'SPT', 'SPPD'
    format_pattern VARCHAR(100) NOT NULL,
    digit_count INT DEFAULT 3,
    separator VARCHAR(5) DEFAULT '/',
    counter_current INT DEFAULT 0,
    counter_year INT NOT NULL,
    reset_annually BOOLEAN DEFAULT TRUE,
    instansi_id INT REFERENCES instansi(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Audit Log
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id INT,
    old_data JSONB,
    new_data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed Data (Ref Pangkat & Golongan)
INSERT INTO ref_pangkat (nama, urutan) VALUES 
('Juru Muda', 1), ('Juru Muda Tingkat I', 2), ('Juru', 3), ('Juru Tingkat I', 4),
('Pengatur Muda', 5), ('Pengatur Muda Tingkat I', 6), ('Pengatur', 7), ('Pengatur Tingkat I', 8),
('Penata Muda', 9), ('Penata Muda Tingkat I', 10), ('Penata', 11), ('Penata Tingkat I', 12),
('Pembina', 13), ('Pembina Tingkat I', 14), ('Pembina Utama Muda', 15), ('Pembina Utama Madya', 16), ('Pembina Utama', 17);

INSERT INTO ref_golongan (nama, urutan) VALUES 
('I/a', 1), ('I/b', 2), ('I/c', 3), ('I/d', 4),
('II/a', 5), ('II/b', 6), ('II/c', 7), ('II/d', 8),
('III/a', 9), ('III/b', 10), ('III/c', 11), ('III/d', 12),
('IV/a', 13), ('IV/b', 14), ('IV/c', 15), ('IV/d', 16), ('IV/e', 17);

INSERT INTO ref_tingkat_perjalanan (kode, deskripsi) VALUES
('A', 'Pejabat Negara/Eselon I'),
('B', 'Pejabat Eselon II/Pegawai Golongan IV'),
('C', 'Pejabat Eselon III/Pegawai Golongan III'),
('D', 'Pejabat Eselon IV/Pegawai Golongan II & I');

INSERT INTO ref_alat_angkut (nama) VALUES
('Kendaraan Dinas'), ('Pesawat Terbang'), ('Kapal Laut'), ('Bus/Travel'), ('Lainnya');
