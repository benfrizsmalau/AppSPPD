-- SQL Script for RLS Policies (Synced with supabase_schema.sql)
-- Run this in the Supabase SQL Editor

-- 1. Enable Row Level Security on all tables
ALTER TABLE public.pegawai ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spt_pegawai ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sppd ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sppd_pengikut ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instansi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penandatangan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setting_penomoran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_pangkat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_golongan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DO $$ 
DECLARE 
    pol record;
BEGIN
    FOR pol IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 3. Public/Read Policies (Authenticated Users only)
-- Most data can be viewed by all staff
CREATE POLICY "Viewable references" ON public.ref_pangkat FOR SELECT TO authenticated USING (true);
CREATE POLICY "Viewable references" ON public.ref_golongan FOR SELECT TO authenticated USING (true);
CREATE POLICY "Viewable instansi" ON public.instansi FOR SELECT TO authenticated USING (true);
CREATE POLICY "Viewable profiles" ON public.user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Viewable penandatangan" ON public.penandatangan FOR SELECT TO authenticated USING (true);
CREATE POLICY "Viewable pegawai" ON public.pegawai FOR SELECT TO authenticated USING (true);
CREATE POLICY "Viewable spt" ON public.spt FOR SELECT TO authenticated USING (true);
CREATE POLICY "Viewable sppd" ON public.sppd FOR SELECT TO authenticated USING (true);
CREATE POLICY "Viewable junction" ON public.spt_pegawai FOR SELECT TO authenticated USING (true);
CREATE POLICY "Viewable junction" ON public.sppd_pengikut FOR SELECT TO authenticated USING (true);
CREATE POLICY "Viewable numbering" ON public.setting_penomoran FOR SELECT TO authenticated USING (true);

-- 4. Admin & Operator Management Policies
CREATE POLICY "Manage instansi" ON public.instansi FOR ALL TO authenticated 
USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('Admin', 'Operator'));

CREATE POLICY "Manage penandatangan" ON public.penandatangan FOR ALL TO authenticated 
USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('Admin', 'Operator'));

CREATE POLICY "Manage reference data" ON public.ref_pangkat FOR ALL TO authenticated 
USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('Admin', 'Operator'));

CREATE POLICY "Manage reference data" ON public.ref_golongan FOR ALL TO authenticated 
USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('Admin', 'Operator'));

CREATE POLICY "Manage numbering" ON public.setting_penomoran FOR ALL TO authenticated 
USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('Admin', 'Operator'));

-- 5. Operator Policies (Insert/Update for Documents)
CREATE POLICY "Operator manage spt" ON public.spt FOR INSERT TO authenticated WITH CHECK ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('Admin', 'Operator'));
CREATE POLICY "Operator update spt" ON public.spt FOR UPDATE TO authenticated USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('Admin', 'Operator'));
CREATE POLICY "Operator manage sppd" ON public.sppd FOR INSERT TO authenticated WITH CHECK ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('Admin', 'Operator'));
CREATE POLICY "Operator update sppd" ON public.sppd FOR UPDATE TO authenticated USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('Admin', 'Operator'));

-- 6. Pegawai & Junction Management Policies
CREATE POLICY "Manage pegawai" ON public.pegawai FOR ALL TO authenticated 
USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('Admin', 'Operator'));

CREATE POLICY "Manage spt_pegawai" ON public.spt_pegawai FOR ALL TO authenticated 
USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('Admin', 'Operator'));

CREATE POLICY "Manage sppd_pengikut" ON public.sppd_pengikut FOR ALL TO authenticated 
USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('Admin', 'Operator'));

-- 7. Audit Log Policy
CREATE POLICY "Insert audit logs" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- 8. User Personal Privacy
CREATE POLICY "Self update profile" ON public.user_profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- 7. Storage Policies (Assets Bucket)
-- Allow anyone to view public assets
CREATE POLICY "Public Access" ON storage.objects FOR SELECT TO public USING (bucket_id = 'assets');

-- Allow Admin & Operator to upload/update/delete assets
CREATE POLICY "Manage Assets" ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'assets' AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('Admin', 'Operator'));

CREATE POLICY "Update Assets" ON storage.objects FOR UPDATE TO authenticated 
USING (bucket_id = 'assets' AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('Admin', 'Operator'));

CREATE POLICY "Delete Assets" ON storage.objects FOR DELETE TO authenticated 
USING (bucket_id = 'assets' AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('Admin', 'Operator'));
