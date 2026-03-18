-- Migration to refine SPPD personnel logic: 
-- 1. Ensure sppd_pengikut can link to pegawai
-- 2. Cleanup sppd_pelaksana (merged into pengikut logic as per user request)

-- Add pegawai_id to sppd_pengikut if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sppd_pengikut' AND column_name='pegawai_id') THEN
        ALTER TABLE public.sppd_pengikut ADD COLUMN pegawai_id INT REFERENCES public.pegawai(id);
        -- Make name/age optional if it's a linked pegawai
        ALTER TABLE public.sppd_pengikut ALTER COLUMN nama DROP NOT NULL;
        ALTER TABLE public.sppd_pengikut ALTER COLUMN umur DROP NOT NULL;
    END IF;
END $$;

-- Cleanup the previous multi-pelaksana table as it's no longer used
DROP TABLE IF EXISTS public.sppd_pelaksana;
