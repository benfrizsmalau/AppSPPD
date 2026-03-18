import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Pangkat, Golongan, TingkatPerjalanan, AlatAngkut, MataAnggaran } from '../types';

export const useReferensi = () => {
    const [pangkats, setPangkats] = useState<Pangkat[]>([]);
    const [golongans, setGolongans] = useState<Golongan[]>([]);
    const [tingkatPerjalanan, setTingkatPerjalanan] = useState<TingkatPerjalanan[]>([]);
    const [alatAngkut, setAlatAngkut] = useState<AlatAngkut[]>([]);
    const [mataAnggaran, setMataAnggaran] = useState<MataAnggaran[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [
                { data: pk, error: pkErr },
                { data: gl, error: glErr },
                { data: tp, error: tpErr },
                { data: aa, error: aaErr },
                { data: ma, error: maErr }
            ] = await Promise.all([
                supabase.from('ref_pangkat').select('*').order('urutan', { ascending: true }),
                supabase.from('ref_golongan').select('*').order('urutan', { ascending: true }),
                supabase.from('ref_tingkat_perjalanan').select('*').order('kode', { ascending: true }),
                supabase.from('ref_alat_angkut').select('*').order('nama', { ascending: true }),
                supabase.from('mata_anggaran').select('*').order('kode', { ascending: true })
            ]);

            if (pkErr) console.error('Error pangkats:', pkErr);
            if (glErr) console.error('Error golongans:', glErr);
            if (tpErr) console.error('Error tingkat:', tpErr);
            if (aaErr) console.error('Error alat:', aaErr);
            if (maErr) console.error('Error anggaran:', maErr);

            setPangkats(pk || []);
            setGolongans(gl || []);
            setTingkatPerjalanan(tp || []);
            setAlatAngkut(aa || []);
            setMataAnggaran(ma || []);
        } catch (error) {
            console.error('Error fetching reference data:', error);
        } finally {
            setLoading(false);
        }
    }, [setPangkats, setGolongans, setTingkatPerjalanan, setAlatAngkut, setMataAnggaran, setLoading]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const savePangkat = useCallback(async (data: Partial<Pangkat>) => {
        const { error } = data.id
            ? await supabase.from('ref_pangkat').update(data).eq('id', data.id)
            : await supabase.from('ref_pangkat').insert(data);
        if (error) throw error;
        await fetchData();
    }, [fetchData]);

    const deletePangkat = useCallback(async (id: number) => {
        const { error } = await supabase.from('ref_pangkat').delete().eq('id', id);
        if (error) throw error;
        await fetchData();
    }, [fetchData]);

    const saveGolongan = useCallback(async (data: Partial<Golongan>) => {
        const { error } = data.id
            ? await supabase.from('ref_golongan').update(data).eq('id', data.id)
            : await supabase.from('ref_golongan').insert(data);
        if (error) throw error;
        await fetchData();
    }, [fetchData]);

    const deleteGolongan = useCallback(async (id: number) => {
        const { error } = await supabase.from('ref_golongan').delete().eq('id', id);
        if (error) throw error;
        await fetchData();
    }, [fetchData]);

    const saveTingkatPerjalanan = useCallback(async (data: Partial<TingkatPerjalanan>) => {
        const { error } = data.id
            ? await supabase.from('ref_tingkat_perjalanan').update(data).eq('id', data.id)
            : await supabase.from('ref_tingkat_perjalanan').insert(data);
        if (error) throw error;
        await fetchData();
    }, [fetchData]);

    const deleteTingkatPerjalanan = useCallback(async (id: number) => {
        const { error } = await supabase.from('ref_tingkat_perjalanan').delete().eq('id', id);
        if (error) throw error;
        await fetchData();
    }, [fetchData]);

    const saveAlatAngkut = useCallback(async (data: Partial<AlatAngkut>) => {
        const { error } = data.id
            ? await supabase.from('ref_alat_angkut').update(data).eq('id', data.id)
            : await supabase.from('ref_alat_angkut').insert(data);
        if (error) throw error;
        await fetchData();
    }, [fetchData]);

    const deleteAlatAngkut = useCallback(async (id: number) => {
        const { error } = await supabase.from('ref_alat_angkut').delete().eq('id', id);
        if (error) throw error;
        await fetchData();
    }, [fetchData]);

    const saveMataAnggaran = useCallback(async (data: Partial<MataAnggaran>) => {
        const { error } = data.id
            ? await supabase.from('mata_anggaran').update(data).eq('id', data.id)
            : await supabase.from('mata_anggaran').insert(data);
        if (error) throw error;
        await fetchData();
    }, [fetchData]);

    const deleteMataAnggaran = useCallback(async (id: number) => {
        const { error } = await supabase.from('mata_anggaran').delete().eq('id', id);
        if (error) throw error;
        await fetchData();
    }, [fetchData]);

    return {
        pangkats,
        golongans,
        tingkatPerjalanan,
        alatAngkut,
        mataAnggaran,
        loading,
        refresh: fetchData,
        savePangkat,
        deletePangkat,
        saveGolongan,
        deleteGolongan,
        saveTingkatPerjalanan,
        deleteTingkatPerjalanan,
        saveAlatAngkut,
        deleteAlatAngkut,
        saveMataAnggaran,
        deleteMataAnggaran
    };
};
