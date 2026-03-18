import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  Plus, Search, Download, Upload, Edit2, UserCheck, UserX,
  History, Loader2, Users, AlertTriangle, X, FileSpreadsheet,
  CheckCircle2, Building2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Pegawai, RefPangkat, RefGolongan, Instansi, PaginatedResult } from '../types';

const PAGE_SIZE = 25;

// ── Zod schema ────────────────────────────────────────────────────────────────
const pegawaiSchema = z.object({
  nip: z.string().length(18, 'NIP harus 18 digit'),
  nama_lengkap: z.string().min(2, 'Minimal 2 karakter'),
  gelar_depan: z.string().optional(),
  gelar_belakang: z.string().optional(),
  jabatan: z.string().min(2, 'Minimal 2 karakter'),
  pangkat_id: z.number().optional().nullable(),
  golongan_id: z.number().optional().nullable(),
  unit_kerja_id: z.number().optional().nullable(),
  tanggal_mulai: z.string().optional(),
  email: z.string().email('Email tidak valid').optional().or(z.literal('')),
  telepon: z.string().optional(),
  status_aktif: z.boolean(),
});
type PegawaiForm = z.infer<typeof pegawaiSchema>;

// ── Import row type ───────────────────────────────────────────────────────────
interface ImportRow {
  nip: string;
  nama_lengkap: string;
  gelar_depan?: string;
  gelar_belakang?: string;
  jabatan: string;
  pangkat?: string;
  golongan?: string;
  unit_kerja?: string;
  tanggal_mulai?: string;
  email?: string;
  telepon?: string;
  status_aktif?: string;
  _rowIndex: number;
  _errors: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const EXCEL_HEADERS = [
  'nip', 'nama_lengkap', 'gelar_depan', 'gelar_belakang', 'jabatan',
  'pangkat', 'golongan', 'unit_kerja', 'tanggal_mulai', 'email', 'telepon', 'status_aktif',
];

// ── Component ─────────────────────────────────────────────────────────────────
const PegawaiList: React.FC = () => {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  // Filter state
  const [page, setPage] = useState(1);
  const [searchRaw, setSearchRaw] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'aktif' | 'nonaktif'>('all');
  const [filterPangkat, setFilterPangkat] = useState<number | ''>('');
  const [filterGolongan, setFilterGolongan] = useState<number | ''>('');
  const [filterUnit, setFilterUnit] = useState<number | ''>('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'nama_lengkap' | 'nip' | 'jabatan'>('nama_lengkap');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Pegawai | null>(null);
  const [nipCheckMsg, setNipCheckMsg] = useState('');
  const [nipChecking, setNipChecking] = useState(false);

  // Import state
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setPage(1); }, [search, filterStatus, filterPangkat, filterGolongan, filterUnit, sortBy, sortDir]);

  const handleSearchChange = useCallback((v: string) => {
    setSearchRaw(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(v), 350);
  }, []);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: refPangkat = [] } = useQuery<RefPangkat[]>({
    queryKey: ['ref-pangkat'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ref_pangkat').select('*').order('urutan');
      if (error) throw error;
      return data as RefPangkat[];
    },
  });

  const { data: refGolongan = [] } = useQuery<RefGolongan[]>({
    queryKey: ['ref-golongan'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ref_golongan').select('*').order('urutan');
      if (error) throw error;
      return data as RefGolongan[];
    },
  });

  const { data: instansiList = [] } = useQuery<Instansi[]>({
    queryKey: ['instansi-list', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('instansi').select('id, nama_singkat').eq('tenant_id', tenantId!);
      if (error) throw error;
      return data as Instansi[];
    },
    enabled: !!tenantId,
  });

  const queryKey = ['pegawai-list', tenantId, page, search, filterStatus, filterPangkat, filterGolongan, filterUnit, sortBy, sortDir];

  const { data, isLoading, isFetching } = useQuery<PaginatedResult<Pegawai>>({
    queryKey,
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = supabase
        .from('pegawai')
        .select('*, ref_pangkat:pangkat_id(id, nama), ref_golongan:golongan_id(id, nama), instansi:unit_kerja_id(id, nama_singkat)', { count: 'exact' })
        .eq('tenant_id', tenantId!)
        .order(sortBy, { ascending: sortDir === 'asc' })
        .range(from, to);

      if (filterStatus === 'aktif') q = q.eq('status_aktif', true);
      else if (filterStatus === 'nonaktif') q = q.eq('status_aktif', false);
      if (filterPangkat) q = q.eq('pangkat_id', filterPangkat);
      if (filterGolongan) q = q.eq('golongan_id', filterGolongan);
      if (filterUnit) q = q.eq('unit_kerja_id', filterUnit);
      if (search) q = q.or(`nama_lengkap.ilike.%${search}%,nip.ilike.%${search}%`);

      const { data, count, error } = await q;
      if (error) throw error;
      return {
        data: (data ?? []) as Pegawai[],
        total: count ?? 0,
        page,
        limit: PAGE_SIZE,
        total_pages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
      };
    },
    enabled: !!tenantId,
    placeholderData: prev => prev,
    staleTime: 20_000,
  });

  // Summary stats
  const { data: stats } = useQuery({
    queryKey: ['pegawai-stats', tenantId],
    queryFn: async () => {
      const [totalRes, aktifRes, unitRes] = await Promise.all([
        supabase.from('pegawai').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId!),
        supabase.from('pegawai').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId!).eq('status_aktif', true),
        supabase.from('pegawai').select('unit_kerja_id, instansi:unit_kerja_id(nama_singkat)').eq('tenant_id', tenantId!).not('unit_kerja_id', 'is', null),
      ]);
      const unitCounts: Record<string, { name: string; count: number }> = {};
      (unitRes.data ?? []).forEach((r: any) => {
        const uid = r.unit_kerja_id;
        if (!unitCounts[uid]) unitCounts[uid] = { name: r.instansi?.nama_singkat ?? '-', count: 0 };
        unitCounts[uid].count++;
      });
      const topUnits = Object.values(unitCounts).sort((a, b) => b.count - a.count).slice(0, 3);
      return {
        total: totalRes.count ?? 0,
        aktif: aktifRes.count ?? 0,
        nonaktif: (totalRes.count ?? 0) - (aktifRes.count ?? 0),
        topUnits,
      };
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  // ── Form ───────────────────────────────────────────────────────────────────
  const {
    register, handleSubmit, reset, watch,
    formState: { errors: formErrors },
  } = useForm<PegawaiForm>({
    resolver: zodResolver(pegawaiSchema),
    defaultValues: { status_aktif: true },
  });

  const nipValue = watch('nip');

  // Real-time NIP duplicate check
  useEffect(() => {
    if (!nipValue || nipValue.length !== 18 || !tenantId) { setNipCheckMsg(''); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setNipChecking(true);
      let q = supabase.from('pegawai').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).eq('nip', nipValue);
      if (editingId) q = q.neq('id', editingId);
      const { count } = await q;
      if (!cancelled) {
        setNipCheckMsg(count ? 'NIP sudah terdaftar.' : '');
        setNipChecking(false);
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [nipValue, tenantId, editingId]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (values: PegawaiForm) => {
      if (nipCheckMsg) throw new Error(nipCheckMsg);
      const payload = {
        ...values,
        tenant_id: tenantId!,
        pangkat_id: values.pangkat_id ?? null,
        golongan_id: values.golongan_id ?? null,
        unit_kerja_id: values.unit_kerja_id ?? null,
        email: values.email || null,
        gelar_depan: values.gelar_depan || null,
        gelar_belakang: values.gelar_belakang || null,
        tanggal_mulai: values.tanggal_mulai || null,
        telepon: values.telepon || null,
      };
      if (editingId) {
        const { error } = await supabase.from('pegawai').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('pegawai').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pegawai-list'] });
      queryClient.invalidateQueries({ queryKey: ['pegawai-stats'] });
      toast.success(editingId ? 'Data pegawai diperbarui.' : 'Pegawai berhasil ditambahkan.');
      setModalOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, aktif }: { id: number; aktif: boolean }) => {
      const { error } = await supabase.from('pegawai').update({ status_aktif: aktif }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, { aktif }) => {
      queryClient.invalidateQueries({ queryKey: ['pegawai-list'] });
      queryClient.invalidateQueries({ queryKey: ['pegawai-stats'] });
      toast.success(aktif ? 'Pegawai diaktifkan.' : 'Pegawai dinonaktifkan.');
      setDeactivateTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    reset({ status_aktif: true, nip: '', nama_lengkap: '', jabatan: '' });
    setNipCheckMsg('');
    setModalOpen(true);
  };

  const openEdit = (p: Pegawai) => {
    setEditingId(p.id);
    reset({
      nip: p.nip,
      nama_lengkap: p.nama_lengkap,
      gelar_depan: p.gelar_depan ?? '',
      gelar_belakang: p.gelar_belakang ?? '',
      jabatan: p.jabatan,
      pangkat_id: p.pangkat_id ?? null,
      golongan_id: p.golongan_id ?? null,
      unit_kerja_id: p.unit_kerja_id ?? null,
      tanggal_mulai: p.tanggal_mulai ?? '',
      email: p.email ?? '',
      telepon: p.telepon ?? '',
      status_aktif: p.status_aktif,
    });
    setNipCheckMsg('');
    setModalOpen(true);
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    const { data: allData, error } = await supabase
      .from('pegawai')
      .select('*, ref_pangkat:pangkat_id(nama), ref_golongan:golongan_id(nama), instansi:unit_kerja_id(nama_singkat)')
      .eq('tenant_id', tenantId!).order('nama_lengkap');
    if (error) { toast.error(error.message); return; }
    const rows = (allData ?? []).map((p: any) => ({
      NIP: p.nip,
      'Nama Lengkap': p.nama_lengkap,
      'Gelar Depan': p.gelar_depan ?? '',
      'Gelar Belakang': p.gelar_belakang ?? '',
      Jabatan: p.jabatan,
      Pangkat: p.ref_pangkat?.nama ?? '',
      Golongan: p.ref_golongan?.nama ?? '',
      'Unit Kerja': p.instansi?.nama_singkat ?? '',
      'Tanggal Mulai': p.tanggal_mulai ?? '',
      Email: p.email ?? '',
      Telepon: p.telepon ?? '',
      'Status Aktif': p.status_aktif ? 'Aktif' : 'Nonaktif',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Pegawai');
    XLSX.writeFile(wb, `Data_Pegawai_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    toast.success('Data pegawai diekspor.');
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([EXCEL_HEADERS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Template_Import_Pegawai.xlsx');
  };

  // ── Import ─────────────────────────────────────────────────────────────────
  const handleFileChange = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const wb = XLSX.read(e.target?.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
      const rows: ImportRow[] = raw.slice(0, 500).map((r, i) => {
        const errs: string[] = [];
        const nip = String(r.nip ?? '').trim();
        if (!nip || nip.length !== 18) errs.push('NIP harus 18 digit');
        if (!r.nama_lengkap?.trim()) errs.push('Nama wajib diisi');
        if (!r.jabatan?.trim()) errs.push('Jabatan wajib diisi');
        return {
          nip,
          nama_lengkap: r.nama_lengkap ?? '',
          gelar_depan: r.gelar_depan,
          gelar_belakang: r.gelar_belakang,
          jabatan: r.jabatan ?? '',
          pangkat: r.pangkat,
          golongan: r.golongan,
          unit_kerja: r.unit_kerja,
          tanggal_mulai: r.tanggal_mulai,
          email: r.email,
          telepon: r.telepon,
          status_aktif: r.status_aktif,
          _rowIndex: i + 2,
          _errors: errs,
        };
      });
      setImportRows(rows);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportSubmit = async () => {
    const validRows = importRows.filter(r => r._errors.length === 0);
    if (!validRows.length) { toast.error('Tidak ada baris valid untuk diimpor.'); return; }
    setImportLoading(true);
    const results: { success: number; failed: number } = { success: 0, failed: 0 };

    for (const r of validRows) {
      const pangkat = refPangkat.find(p => p.nama.toLowerCase() === r.pangkat?.toLowerCase());
      const golongan = refGolongan.find(g => g.nama.toLowerCase() === r.golongan?.toLowerCase());
      const unit = instansiList.find(i => i.nama_singkat.toLowerCase() === r.unit_kerja?.toLowerCase());
      const { error } = await supabase.from('pegawai').upsert({
        tenant_id: tenantId!,
        nip: r.nip,
        nama_lengkap: r.nama_lengkap,
        gelar_depan: r.gelar_depan || null,
        gelar_belakang: r.gelar_belakang || null,
        jabatan: r.jabatan,
        pangkat_id: pangkat?.id ?? null,
        golongan_id: golongan?.id ?? null,
        unit_kerja_id: unit?.id ?? null,
        tanggal_mulai: r.tanggal_mulai || null,
        email: r.email || null,
        telepon: r.telepon || null,
        status_aktif: r.status_aktif?.toLowerCase() !== 'nonaktif',
      }, { onConflict: 'nip, tenant_id' });
      if (error) results.failed++; else results.success++;
    }
    setImportLoading(false);
    toast.success(`Import selesai: ${results.success} berhasil, ${results.failed} gagal.`);
    queryClient.invalidateQueries({ queryKey: ['pegawai-list'] });
    queryClient.invalidateQueries({ queryKey: ['pegawai-stats'] });
    setImportOpen(false);
    setImportRows([]);
  };

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.total_pages ?? 1;
  const pageNumbers = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const p = page;
    const pages: (number | '...')[] = [1];
    if (p > 3) pages.push('...');
    for (let i = Math.max(2, p - 1); i <= Math.min(totalPages - 1, p + 1); i++) pages.push(i);
    if (p < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Pegawai</h1>
          <p className="page-subtitle">Manajemen data Aparatur Sipil Negara</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
            <FileSpreadsheet size={15} /> Template
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setImportOpen(true)}>
            <Upload size={15} /> Import Excel
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>
            <Download size={15} /> Export Excel
          </button>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={15} /> Tambah Pegawai
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="stat-icon bg-blue-50"><Users size={20} className="text-blue-600" /></div>
            <div>
              <p className="stat-value text-2xl">{stats?.total ?? '—'}</p>
              <p className="stat-label">Total Pegawai</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="stat-icon bg-emerald-50"><UserCheck size={20} className="text-emerald-600" /></div>
            <div>
              <p className="stat-value text-2xl">{stats?.aktif ?? '—'}</p>
              <p className="stat-label">Aktif</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="stat-icon bg-rose-50"><UserX size={20} className="text-rose-600" /></div>
            <div>
              <p className="stat-value text-2xl">{stats?.nonaktif ?? '—'}</p>
              <p className="stat-label">Tidak Aktif</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-start gap-3">
            <div className="stat-icon bg-violet-50 mt-0.5"><Building2 size={20} className="text-violet-600" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-500 mb-1">Top Unit Kerja</p>
              {stats?.topUnits.length ? stats.topUnits.map((u, i) => (
                <p key={i} className="text-xs text-slate-700 truncate">
                  <span className="font-bold">{u.count}</span> · {u.name}
                </p>
              )) : <p className="text-xs text-slate-400">—</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="card card-body flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 search-wrap">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input form-input"
              placeholder="Cari nama atau NIP..."
              value={searchRaw}
              onChange={e => handleSearchChange(e.target.value)}
            />
          </div>
          <button
            className={`btn btn-sm ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowFilters(v => !v)}
          >
            Filter Lanjutan {showFilters ? '▴' : '▾'}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as any)}>
                <option value="all">Semua</option>
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Pangkat</label>
              <select className="form-select" value={filterPangkat}
                onChange={e => setFilterPangkat(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Semua</option>
                {refPangkat.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Golongan</label>
              <select className="form-select" value={filterGolongan}
                onChange={e => setFilterGolongan(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Semua</option>
                {refGolongan.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Unit Kerja</label>
              <select className="form-select" value={filterUnit}
                onChange={e => setFilterUnit(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Semua</option>
                {instansiList.map(i => <option key={i.id} value={i.id}>{i.nama_singkat}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <span className="text-sm font-semibold text-slate-700">
            {isFetching ? 'Memuat...' : `${total} pegawai`}
          </span>
        </div>
        <div className="table-wrap rounded-none border-0">
          {isLoading ? (
            <div className="empty-state">
              <Loader2 size={32} className="animate-spin text-blue-500 mb-3" />
              <p className="text-slate-400 text-sm">Memuat data pegawai...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <Users size={40} className="text-slate-300 mb-3" />
              <p className="empty-state-title">Tidak ada data</p>
              <p className="empty-state-desc">Coba ubah filter atau tambah pegawai baru.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Foto</th>
                  <th className="sortable" onClick={() => handleSort('nip')}>
                    NIP {sortBy === 'nip' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="sortable" onClick={() => handleSort('nama_lengkap')}>
                    Nama Lengkap {sortBy === 'nama_lengkap' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="sortable" onClick={() => handleSort('jabatan')}>
                    Jabatan {sortBy === 'jabatan' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th>Pangkat</th>
                  <th>Golongan</th>
                  <th>Unit Kerja</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p, idx) => (
                  <tr key={p.id}>
                    <td className="text-slate-400 text-xs">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                    <td>
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 text-white flex items-center justify-center text-xs font-bold">
                        {initials(p.nama_lengkap)}
                      </div>
                    </td>
                    <td>
                      <span className="doc-number text-slate-600">{p.nip}</span>
                    </td>
                    <td>
                      <p className="font-semibold text-slate-800 text-sm">
                        {p.gelar_depan ? `${p.gelar_depan} ` : ''}{p.nama_lengkap}{p.gelar_belakang ? `, ${p.gelar_belakang}` : ''}
                      </p>
                      {p.email && <p className="text-xs text-slate-400">{p.email}</p>}
                    </td>
                    <td className="text-sm text-slate-700">{p.jabatan}</td>
                    <td className="text-sm text-slate-600">{p.ref_pangkat?.nama ?? '—'}</td>
                    <td className="text-sm text-slate-600">{p.ref_golongan?.nama ?? '—'}</td>
                    <td className="text-sm text-slate-600">{p.instansi?.nama_singkat ?? '—'}</td>
                    <td>
                      <span className={p.status_aktif ? 'status-approved' : 'status-cancelled'}>
                        {p.status_aktif ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1 justify-end">
                        <button title="Edit" className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(p)}>
                          <Edit2 size={14} />
                        </button>
                        <button
                          title={p.status_aktif ? 'Nonaktifkan' : 'Aktifkan'}
                          className={`btn btn-ghost btn-icon btn-sm ${p.status_aktif ? 'text-rose-500' : 'text-emerald-500'}`}
                          onClick={() => {
                            if (p.status_aktif) setDeactivateTarget(p);
                            else toggleActiveMutation.mutate({ id: p.id, aktif: true });
                          }}
                        >
                          {p.status_aktif ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                        <button
                          title="Lihat Riwayat Perjalanan"
                          className="btn btn-ghost btn-icon btn-sm text-violet-500"
                          onClick={() => window.open(`/riwayat?pegawai_id=${p.id}`, '_blank')}
                        >
                          <History size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">Halaman {page} dari {totalPages} · {total} total</p>
            <div className="pagination">
              <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={14} />
              </button>
              {pageNumbers().map((p, i) =>
                p === '...' ? (
                  <span key={`e${i}`} className="page-btn cursor-default text-slate-400">…</span>
                ) : (
                  <button key={p} className={`page-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(p as number)}>{p}</button>
                )
              )}
              <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-panel modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingId ? 'Edit Pegawai' : 'Tambah Pegawai Baru'}</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModalOpen(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit(v => saveMutation.mutate(v))}>
              <div className="modal-body flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Gelar Depan</label>
                    <input className="form-input" placeholder="Dr., Drs., dll." {...register('gelar_depan')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gelar Belakang</label>
                    <input className="form-input" placeholder="S.E., M.M., dll." {...register('gelar_belakang')} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Nama Lengkap <span className="required-mark">*</span></label>
                  <input className={`form-input ${formErrors.nama_lengkap ? 'is-error' : ''}`}
                    {...register('nama_lengkap')} />
                  {formErrors.nama_lengkap && <p className="form-error"><AlertTriangle size={12} />{formErrors.nama_lengkap.message}</p>}
                </div>

                <div className="form-group">
                  <label className="form-label">NIP (18 digit) <span className="required-mark">*</span></label>
                  <div className="relative">
                    <input
                      className={`form-input ${formErrors.nip || nipCheckMsg ? 'is-error' : nipValue?.length === 18 && !nipCheckMsg && !nipChecking ? 'border-emerald-400' : ''}`}
                      maxLength={18}
                      {...register('nip')}
                    />
                    {nipChecking && <Loader2 size={14} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />}
                    {!nipChecking && nipValue?.length === 18 && !nipCheckMsg && (
                      <CheckCircle2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                    )}
                  </div>
                  {(formErrors.nip || nipCheckMsg) && (
                    <p className="form-error"><AlertTriangle size={12} />{formErrors.nip?.message ?? nipCheckMsg}</p>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Jabatan <span className="required-mark">*</span></label>
                  <input className={`form-input ${formErrors.jabatan ? 'is-error' : ''}`}
                    {...register('jabatan')} />
                  {formErrors.jabatan && <p className="form-error"><AlertTriangle size={12} />{formErrors.jabatan.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Pangkat</label>
                    <select className="form-select"
                      {...register('pangkat_id', { setValueAs: v => v === '' ? null : Number(v) })}>
                      <option value="">Pilih Pangkat</option>
                      {refPangkat.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Golongan</label>
                    <select className="form-select"
                      {...register('golongan_id', { setValueAs: v => v === '' ? null : Number(v) })}>
                      <option value="">Pilih Golongan</option>
                      {refGolongan.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Unit Kerja</label>
                    <select className="form-select"
                      {...register('unit_kerja_id', { setValueAs: v => v === '' ? null : Number(v) })}>
                      <option value="">Pilih Unit</option>
                      {instansiList.map(i => <option key={i.id} value={i.id}>{i.nama_singkat}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tanggal Mulai</label>
                    <input type="date" className="form-input" {...register('tanggal_mulai')} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" className={`form-input ${formErrors.email ? 'is-error' : ''}`}
                      {...register('email')} />
                    {formErrors.email && <p className="form-error"><AlertTriangle size={12} />{formErrors.email.message}</p>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Telepon</label>
                    <input type="tel" className="form-input" {...register('telepon')} />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <label className="relative inline-block w-11 h-6 cursor-pointer">
                    <input type="checkbox" className="sr-only peer" {...register('status_aktif')} />
                    <div className="w-11 h-6 bg-slate-300 rounded-full peer-checked:bg-emerald-500 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                  </label>
                  <span className="text-sm font-medium text-slate-700">Pegawai Aktif</span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModalOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={saveMutation.isPending || !!nipCheckMsg}>
                  {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                  {editingId ? 'Simpan Perubahan' : 'Tambahkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Confirm */}
      {deactivateTarget && (
        <div className="modal-backdrop" onClick={() => setDeactivateTarget(null)}>
          <div className="modal-panel modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Nonaktifkan Pegawai</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDeactivateTarget(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p className="text-slate-600 text-sm">
                Nonaktifkan <strong>{deactivateTarget.nama_lengkap}</strong>? Pegawai tidak akan bisa membuat dokumen baru.
              </p>
              <div className="alert alert-warning mt-3">
                <AlertTriangle size={14} />
                <span className="text-xs">Data historis tetap terjaga. Pegawai dapat diaktifkan kembali kapan saja.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setDeactivateTarget(null)}>Batal</button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => toggleActiveMutation.mutate({ id: deactivateTarget.id, aktif: false })}
                disabled={toggleActiveMutation.isPending}
              >
                {toggleActiveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                Ya, Nonaktifkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importOpen && (
        <div className="modal-backdrop" onClick={() => { setImportOpen(false); setImportRows([]); }}>
          <div className="modal-panel modal-xl" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Import Data Pegawai dari Excel</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setImportOpen(false); setImportRows([]); }}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">Unggah file Excel (.xlsx, .xls) maksimal 500 baris.</p>
                <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
                  <Download size={14} /> Download Template
                </button>
              </div>

              {/* Drop zone */}
              <div
                className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileChange(f); }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={32} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">Drag & drop atau klik untuk pilih file</p>
                <p className="text-xs text-slate-400">.xlsx, .xls</p>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(f); }} />
              </div>

              {importRows.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-slate-700">{importRows.length} baris terdeteksi</p>
                    <p className="text-xs text-slate-400">
                      {importRows.filter(r => r._errors.length === 0).length} valid ·{' '}
                      {importRows.filter(r => r._errors.length > 0).length} error
                    </p>
                  </div>
                  <div className="table-wrap max-h-80 overflow-y-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Baris</th>
                          <th>NIP</th>
                          <th>Nama</th>
                          <th>Jabatan</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.map(r => (
                          <tr key={r._rowIndex} className={r._errors.length ? 'bg-rose-50' : ''}>
                            <td className="text-xs text-slate-400">{r._rowIndex}</td>
                            <td className="text-xs">{r.nip}</td>
                            <td className="text-sm">{r.nama_lengkap}</td>
                            <td className="text-sm">{r.jabatan}</td>
                            <td>
                              {r._errors.length ? (
                                <span className="badge badge-red text-xs">{r._errors.join(', ')}</span>
                              ) : (
                                <span className="badge badge-green text-xs">OK</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => { setImportOpen(false); setImportRows([]); }}>Batal</button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleImportSubmit}
                disabled={importLoading || importRows.filter(r => r._errors.length === 0).length === 0}
              >
                {importLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Import {importRows.filter(r => r._errors.length === 0).length} Baris Valid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PegawaiList;
