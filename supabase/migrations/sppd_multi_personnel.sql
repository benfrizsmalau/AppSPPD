-- Migration to support multiple personnel (Pelaksana Utama) in SPPD
-- Creates a junction table for sppd and pegawai

CREATE TABLE IF NOT EXISTS public.sppd_pelaksana (
    id SERIAL PRIMARY KEY,
    sppd_id INT REFERENCES public.sppd(id) ON DELETE CASCADE,
    pegawai_id INT REFERENCES public.pegawai(id),
    urutan INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migrate existing data from sppd.pegawai_id to sppd_pelaksana
INSERT INTO public.sppd_pelaksana (sppd_id, pegawai_id, urutan)
SELECT id, pegawai_id, 1
FROM public.sppd
WHERE pegawai_id IS NOT NULL;

-- Note: We keep sppd.pegawai_id for now to avoid breaking existing queries, 
-- but we will primarily use sppd_pelaksana for UI and Rendering.
