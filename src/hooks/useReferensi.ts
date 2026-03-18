import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { RefPangkat, RefGolongan, RefTingkatPerjalanan, RefAlatAngkut, Instansi, Penandatangan, MataAnggaran } from '../types';

export function useReferensi() {
  const { tenantId } = useAuth();

  const pangkat = useQuery({
    queryKey: ['ref_pangkat'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ref_pangkat')
        .select('*')
        .order('urutan');
      if (error) throw error;
      return data as RefPangkat[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const golongan = useQuery({
    queryKey: ['ref_golongan'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ref_golongan')
        .select('*')
        .order('urutan');
      if (error) throw error;
      return data as RefGolongan[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const tingkatPerjalanan = useQuery({
    queryKey: ['ref_tingkat_perjalanan'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ref_tingkat_perjalanan')
        .select('*')
        .order('kode');
      if (error) throw error;
      return data as RefTingkatPerjalanan[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const alatAngkut = useQuery({
    queryKey: ['ref_alat_angkut'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ref_alat_angkut')
        .select('*')
        .order('nama');
      if (error) throw error;
      return data as RefAlatAngkut[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const instansi = useQuery({
    queryKey: ['instansi', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instansi')
        .select('*')
        .order('is_primary', { ascending: false });
      if (error) throw error;
      return data as Instansi[];
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000,
  });

  const instansiPrimary = instansi.data?.find(i => i.is_primary) ?? instansi.data?.[0];

  const penandatangan = useQuery({
    queryKey: ['penandatangan', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('penandatangan')
        .select('*, ref_pangkat(*), ref_golongan(*)')
        .eq('status_aktif', true)
        .order('nama_lengkap');
      if (error) throw error;
      return data as Penandatangan[];
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000,
  });

  const mataAnggaran = useQuery({
    queryKey: ['mata_anggaran', tenantId],
    queryFn: async () => {
      const year = new Date().getFullYear();
      const { data, error } = await supabase
        .from('mata_anggaran')
        .select('*')
        .eq('tahun', year)
        .eq('is_active', true)
        .order('kode');
      if (error) throw error;
      return data as MataAnggaran[];
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000,
  });

  return {
    pangkat: pangkat.data ?? [],
    golongan: golongan.data ?? [],
    tingkatPerjalanan: tingkatPerjalanan.data ?? [],
    alatAngkut: alatAngkut.data ?? [],
    instansi: instansi.data ?? [],
    instansiPrimary,
    penandatangan: penandatangan.data ?? [],
    mataAnggaran: mataAnggaran.data ?? [],
    isLoading: pangkat.isLoading || golongan.isLoading,
  };
}
