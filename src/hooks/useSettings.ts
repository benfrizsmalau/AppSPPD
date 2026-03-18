import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Instansi } from '../types';
import type { Penandatangan } from '../types/penandatangan';

export const useSettings = () => {
    const [instansi, setInstansi] = useState<Instansi | null>(null);
    const [penandatangan, setPenandatangan] = useState<Penandatangan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);

            // Fetch Primary Instansi
            const { data: instData, error: instError } = await supabase
                .from('instansi')
                .select('*')
                .eq('is_primary', true)
                .maybeSingle();

            if (instError) throw instError;
            setInstansi(instData);

            // Fetch Penandatangan
            const { data: ttdData, error: ttdError } = await supabase
                .from('penandatangan')
                .select('*, pangkat:ref_pangkat(*), golongan:ref_golongan(*), instansi(*)')
                .order('id', { ascending: true });

            if (ttdError) throw ttdError;
            setPenandatangan(ttdData || []);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const updateInstansi = useCallback(async (data: Partial<Instansi>) => {
        if (instansi) {
            const { error } = await supabase.from('instansi').update(data).eq('id', instansi.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('instansi').insert({ ...data, is_primary: true });
            if (error) throw error;
        }
        fetchData();
    }, [instansi, fetchData]);

    const savePenandatangan = useCallback(async (data: Partial<Penandatangan>) => {
        if (data.id) {
            const { error } = await supabase.from('penandatangan').update(data).eq('id', data.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('penandatangan').insert(data);
            if (error) throw error;
        }
        fetchData();
    }, [fetchData]);

    const deletePenandatangan = useCallback(async (id: number) => {
        const { error } = await supabase.from('penandatangan').delete().eq('id', id);
        if (error) throw error;
        fetchData();
    }, [fetchData]);

    const uploadFile = useCallback(async (file: File, bucket: string, path: string) => {
        const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
            upsert: true
        });
        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
        return publicUrl;
    }, []);

    return {
        instansi,
        penandatangan,
        loading,
        error,
        updateInstansi,
        savePenandatangan,
        deletePenandatangan,
        uploadFile,
        refresh: fetchData
    };
};
