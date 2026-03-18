-- Add refinements for hierarchical headers and reference data links
DO $$ 
BEGIN 
    -- 1. Add header_style to SPT (Bupati/Sekda style)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='spt' AND column_name='header_style') THEN
        ALTER TABLE public.spt ADD COLUMN header_style VARCHAR(20) DEFAULT 'SKPD';
    END IF;

    -- 2. Add tingkat_biaya_id to SPPD
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sppd' AND column_name='tingkat_biaya_id') THEN
        ALTER TABLE public.sppd ADD COLUMN tingkat_biaya_id INT REFERENCES public.ref_tingkat_perjalanan(id);
    END IF;

    -- 3. Add alat_angkut_id to SPPD
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sppd' AND column_name='alat_angkut_id') THEN
        ALTER TABLE public.sppd ADD COLUMN alat_angkut_id INT REFERENCES public.ref_alat_angkut(id);
    END IF;

    -- 4. Add mata_anggaran_id to SPPD
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sppd' AND column_name='mata_anggaran_id') THEN
        ALTER TABLE public.sppd ADD COLUMN mata_anggaran_id INT REFERENCES public.mata_anggaran(id);
    END IF;
END $$;
