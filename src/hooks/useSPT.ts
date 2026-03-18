import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { SPT } from '../types/spt';
import { useNumbering } from './useNumbering';

export const useSPT = () => {
    const [spts, setSpts] = useState<SPT[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { settings, resolveNumber } = useNumbering();

    const fetchSPTs = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('spt')
                .select(`
          *,
          penandatangan:penandatangan(*),
          instansi:instansi(*),
          pegawai_list:spt_pegawai(
            *,
            pegawai:pegawai(*)
          )
        `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSpts(data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSPTs();
    }, [fetchSPTs]);

    const createSPT = useCallback(async (data: Partial<SPT>, pegawaiIds: number[]) => {
        const { data: sptData, error: sptError } = await supabase
            .from('spt')
            .insert(data)
            .select()
            .single();

        if (sptError) throw sptError;

        const relations = pegawaiIds.map((id, index) => ({
            spt_id: sptData.id,
            pegawai_id: id,
            urutan: index + 1
        }));

        const { error: relError } = await supabase
            .from('spt_pegawai')
            .insert(relations);

        if (relError) throw relError;

        fetchSPTs();
        return sptData;
    }, [fetchSPTs]);

    const updateSPT = useCallback(async (id: number, data: Partial<SPT>, pegawaiIds?: number[]) => {
        const { error: sptError } = await supabase
            .from('spt')
            .update(data)
            .eq('id', id);

        if (sptError) throw sptError;

        if (pegawaiIds) {
            await supabase.from('spt_pegawai').delete().eq('spt_id', id);
            const relations = pegawaiIds.map((pid, index) => ({
                spt_id: id,
                pegawai_id: pid,
                urutan: index + 1
            }));
            await supabase.from('spt_pegawai').insert(relations);
        }

        fetchSPTs();
    }, [fetchSPTs]);

    const deleteSPT = useCallback(async (id: number) => {
        const { error } = await supabase.from('spt').delete().eq('id', id);
        if (error) throw error;
        fetchSPTs();
    }, [fetchSPTs]);

    const generateSPTNumber = useCallback(async () => {
        const { count } = await supabase
            .from('spt')
            .select('*', { count: 'exact', head: true });

        const sptPattern = settings.find(s => s.jenis_dokumen === 'SPT')?.format_pattern || '{num}/SPT/BPPKAD/{year}';
        return resolveNumber(sptPattern, count || 0, 'BPPKAD');
    }, [settings, resolveNumber]);

    return {
        spts,
        loading,
        error,
        createSPT,
        updateSPT,
        deleteSPT,
        generateSPTNumber,
        refresh: fetchSPTs
    };
};
