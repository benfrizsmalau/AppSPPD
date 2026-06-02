-- Migration: Ubah referensi pejabat_pemberi_perintah_id di tabel sppd
-- dari tabel pegawai ke tabel penandatangan.
--
-- Justifikasi yuridis:
--   Pejabat yang memberi perintah perjalanan dinas (kolom 1 SPPD) adalah
--   Sekretaris Daerah atau Kepala Daerah — pejabat ini terdaftar di tabel
--   penandatangan (bukan sebagai pegawai operasional). Memindahkan FK ke
--   penandatangan memungkinkan operator memilih Sekda langsung dari daftar
--   penandatangan yang sudah dikonfigurasi, sesuai prinsip PA/KPA dalam
--   pengelolaan keuangan daerah (Permendagri 77/2020).

DO $$
DECLARE
    fk_name TEXT;
BEGIN
    -- 1. Temukan nama constraint FK lama (jika ada) yang mengarah ke pegawai
    SELECT tc.constraint_name INTO fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.table_constraints ccu
        ON rc.unique_constraint_name = ccu.constraint_name
    WHERE tc.table_name        = 'sppd'
      AND tc.constraint_type   = 'FOREIGN KEY'
      AND kcu.column_name      = 'pejabat_pemberi_perintah_id'
      AND ccu.table_name       = 'pegawai'
    LIMIT 1;

    -- 2. Jika FK lama ditemukan, drop dulu
    IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.sppd DROP CONSTRAINT %I', fk_name);
        RAISE NOTICE 'Dropped old FK constraint: %', fk_name;
    END IF;

    -- 3. Null-kan nilai yang mungkin salah referensi ke pegawai.id
    --    (nilai lama tidak valid lagi karena target tabel berbeda)
    UPDATE public.sppd SET pejabat_pemberi_perintah_id = NULL
    WHERE pejabat_pemberi_perintah_id IS NOT NULL;

    -- 4. Tambahkan FK baru yang mengarah ke penandatangan
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.referential_constraints rc
            ON tc.constraint_name = rc.constraint_name
        JOIN information_schema.table_constraints ccu
            ON rc.unique_constraint_name = ccu.constraint_name
        WHERE tc.table_name      = 'sppd'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name    = 'pejabat_pemberi_perintah_id'
          AND ccu.table_name     = 'penandatangan'
    ) THEN
        ALTER TABLE public.sppd
            ADD CONSTRAINT sppd_pejabat_pemberi_perintah_id_fkey
            FOREIGN KEY (pejabat_pemberi_perintah_id)
            REFERENCES public.penandatangan(id)
            ON DELETE SET NULL;
        RAISE NOTICE 'Added new FK: sppd.pejabat_pemberi_perintah_id → penandatangan(id)';
    END IF;
END $$;
