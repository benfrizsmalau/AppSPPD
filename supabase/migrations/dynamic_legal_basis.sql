-- Migration to change dasar_perintah column type to text[]
-- This allows multiple legal basis items per SPT

ALTER TABLE public.spt 
ALTER COLUMN dasar_perintah TYPE text[] 
USING CASE 
    WHEN dasar_perintah IS NULL THEN ARRAY[]::text[]
    WHEN dasar_perintah = '' THEN ARRAY[]::text[]
    ELSE ARRAY[dasar_perintah]
END;

-- Set default to empty array
ALTER TABLE public.spt ALTER COLUMN dasar_perintah SET DEFAULT ARRAY[]::text[];
