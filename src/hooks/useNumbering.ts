import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface NumberingSetting {
    id: number;
    jenis_dokumen: 'SPT' | 'SPPD';
    format_pattern: string;
    digit_count: number;
    counter_year: number;
    instansi_id?: number;
}

export const useNumbering = () => {
    const [settings, setSettings] = useState<NumberingSetting[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('setting_penomoran')
                .select('*');

            if (error) {
                console.warn('setting_penomoran table issue:', error.message);
                // Fallback defaults
                setSettings([
                    { id: 1, jenis_dokumen: 'SPT', format_pattern: '{num}/SPT/BPPKAD/{year}', digit_count: 3, counter_year: new Date().getFullYear() },
                    { id: 2, jenis_dokumen: 'SPPD', format_pattern: '{num}/SPPD/BPPKAD/{year}', digit_count: 3, counter_year: new Date().getFullYear() }
                ]);
            } else {
                setSettings(data || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [setLoading, setSettings]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]); // fetchSettings is now a dependency

    const updatePattern = useCallback(async (jenis: string, newPattern: string) => {
        const { error } = await supabase
            .from('setting_penomoran')
            .upsert({
                jenis_dokumen: jenis,
                format_pattern: newPattern,
                counter_year: new Date().getFullYear(),
                digit_count: 3 // Default digit count
            }, { onConflict: 'jenis_dokumen' });

        if (error) throw error;
        fetchSettings();
    }, [fetchSettings]); // fetchSettings is a dependency for updatePattern

    const resolveNumber = useCallback((pattern: string, count: number, orgCode: string, digitCount: number = 3) => {
        const date = new Date();
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
        const monthRoman = romanMonths[date.getMonth()];
        const padded = (count + 1).toString().padStart(digitCount, '0');

        return pattern
            .replace('{num}', padded)
            .replace('{year}', year.toString())
            .replace('{month}', month)
            .replace('{month_roman}', monthRoman)
            .replace('{org}', orgCode);
    }, []);

    return {
        settings,
        loading,
        updatePattern,
        resolveNumber,
        refresh: fetchSettings
    };
};
