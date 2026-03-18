import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Pegawai, Pangkat, Golongan } from '../types';

export const usePegawai = () => {
    const [pegawai, setPegawai] = useState<Pegawai[]>([]);
    const [pangkats, setPangkats] = useState<Pangkat[]>([]);
    const [golongans, setGolongans] = useState<Golongan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);

            // Fetch Reference Data (needed for rank/grade names)
            const [
                { data: pk, error: pkErr },
                { data: gl, error: glErr }
            ] = await Promise.all([
                supabase.from('ref_pangkat').select('*').order('urutan', { ascending: true }),
                supabase.from('ref_golongan').select('*').order('urutan', { ascending: true })
            ]);

            if (pkErr) console.error('Error fetching ref_pangkat:', pkErr.message);
            if (glErr) console.error('Error fetching ref_golongan:', glErr.message);

            setPangkats(pk || []);
            setGolongans(gl || []);

            const { data: fetchPg, error: pgErr } = await supabase
                .from('pegawai')
                .select('*, pangkat:ref_pangkat(*), golongan:ref_golongan(*), instansi(*)')
                .order('nama_lengkap', { ascending: true });

            if (pgErr) throw pgErr;
            setPegawai(fetchPg || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const addPegawai = useCallback(async (data: Partial<Pegawai>) => {
        const { error } = await supabase.from('pegawai').insert(data);
        if (error) throw error;
        fetchData();
    }, [fetchData]);

    const updatePegawai = useCallback(async (id: number, data: Partial<Pegawai>) => {
        const { error } = await supabase.from('pegawai').update(data).eq('id', id);
        if (error) throw error;
        fetchData();
    }, [fetchData]);

    const deletePegawai = useCallback(async (id: number) => {
        const { error } = await supabase.from('pegawai').delete().eq('id', id);
        if (error) throw error;
        fetchData();
    }, [fetchData]);

    return {
        pegawai,
        pangkats,
        golongans,
        loading,
        error,
        refresh: fetchData,
        addPegawai,
        updatePegawai,
        deletePegawai
    };
};
