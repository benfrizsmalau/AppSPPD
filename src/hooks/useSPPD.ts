import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { SPPD } from '../types/sppd';
import { useNumbering } from './useNumbering';

export const useSPPD = () => {
    const [sppds, setSppds] = useState<SPPD[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { settings, resolveNumber } = useNumbering();

    const fetchSPPDs = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('sppd')
                .select(`
          *,
          pegawai:pegawai!pegawai_id(*, pangkat:ref_pangkat(*), golongan:ref_golongan(*)),
          pejabat_pemberi_perintah:pegawai!pejabat_pemberi_perintah_id(*, pangkat:ref_pangkat(*), golongan:ref_golongan(*)),
          spt:spt(*),
          penandatangan:penandatangan(*, pangkat:ref_pangkat(*), golongan:ref_golongan(*)),
          instansi:instansi(*),
          tingkat_biaya:ref_tingkat_perjalanan!tingkat_biaya_id(*),
          moda_transportasi:ref_alat_angkut!alat_angkut_id(*),
          anggaran_ref:mata_anggaran!mata_anggaran_id(*),
          pengikut:sppd_pengikut(
            *,
            pegawai:pegawai(*, pangkat:ref_pangkat(*), golongan:ref_golongan(*))
          )
        `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSppds(data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSPPDs();
    }, [fetchSPPDs]);

    const createSPPD = useCallback(async (data: Partial<SPPD>, pengikutIds: number[]) => {
        const { data: sppdData, error: sppdError } = await supabase
            .from('sppd')
            .insert(data)
            .select()
            .single();

        if (sppdError) throw sppdError;

        if (pengikutIds.length > 0) {
            const followers = pengikutIds.map((pid, idx) => ({
                sppd_id: sppdData.id,
                pegawai_id: pid,
                urutan: idx + 1
            }));
            const { error: fError } = await supabase.from('sppd_pengikut').insert(followers);
            if (fError) throw fError;
        }

        fetchSPPDs();
        return sppdData;
    }, [fetchSPPDs]);

    const updateSPPD = useCallback(async (id: number, data: Partial<SPPD>, pengikutIds?: number[]) => {
        const { error: sppdError } = await supabase
            .from('sppd')
            .update(data)
            .eq('id', id);

        if (sppdError) throw sppdError;

        if (pengikutIds) {
            await supabase.from('sppd_pengikut').delete().eq('sppd_id', id);
            if (pengikutIds.length > 0) {
                const followers = pengikutIds.map((pid, index) => ({
                    sppd_id: id,
                    pegawai_id: pid,
                    urutan: index + 1
                }));
                await supabase.from('sppd_pengikut').insert(followers);
            }
        }

        fetchSPPDs();
    }, [fetchSPPDs]);

    const deleteSPPD = useCallback(async (id: number) => {
        const { error } = await supabase.from('sppd').delete().eq('id', id);
        if (error) throw error;
        fetchSPPDs();
    }, [fetchSPPDs]);

    const generateSPPDNumber = useCallback(async () => {
        const { count } = await supabase
            .from('sppd')
            .select('*', { count: 'exact', head: true });

        const sppdPattern = settings.find(s => s.jenis_dokumen === 'SPPD')?.format_pattern || '{num}/SPPD/BPPKAD/{year}';
        return resolveNumber(sppdPattern, count || 0, 'BPPKAD');
    }, [settings, resolveNumber]);

    return {
        sppds,
        loading,
        error,
        createSPPD,
        updateSPPD,
        deleteSPPD,
        generateSPPDNumber,
        refresh: fetchSPPDs
    };
};
