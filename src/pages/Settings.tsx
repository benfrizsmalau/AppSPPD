import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type {
  Instansi, Penandatangan, SettingPenomoran, MataAnggaran,
  RefTingkatPerjalanan, RefAlatAngkut, RefPangkat, RefGolongan,
} from '../types';
import {
  Building2, Hash, UserRound, DollarSign, Route,
  Plus, Edit2, Trash2, Upload, X, AlertTriangle, RefreshCw,
  CheckCircle, Eye, ToggleLeft, ToggleRight, Download, Loader2,
  FileSpreadsheet, Settings as SettingsIcon,
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ─── Roman numeral helper ────────────────────────────────────────────────────
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
function toRoman(n: number) { return ROMAN[n - 1] ?? String(n); }

// ─── Number preview builder ───────────────────────────────────────────────────
function buildPreview(pattern: string, digits: number, org: string, jenis: string = 'SPT') {
  const pad = String(1).padStart(digits, '0');
  const now = new Date();
  return pattern
    .replace('{num}', pad)
    .replace('{year}', String(now.getFullYear()))
    .replace('{month}', String(now.getMonth() + 1).padStart(2, '0'))
    .replace('{month_roman}', toRoman(now.getMonth() + 1))
    .replace('{org}', org || 'ORG')
    .replace('{jenis}', jenis);
}

// ─── Logo Upload Area ─────────────────────────────────────────────────────────
interface LogoUploadProps {
  label: string;
  currentUrl?: string;
  onUpload: (file: File) => Promise<string | null>;
  previewSize?: number;
}
const LogoUpload: React.FC<LogoUploadProps> = ({ label, currentUrl, onUpload, previewSize = 72 }) => {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setPreview(currentUrl ?? null); }, [currentUrl]);

  const handleFile = useCallback(async (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) {
      toast.error('Format tidak didukung. Gunakan PNG, JPG, atau SVG.'); return;
    }
    if (file.size > 500 * 1024) { toast.error('Ukuran maks 500KB.'); return; }
    const local = URL.createObjectURL(file);
    setPreview(local);
    setUploading(true);
    const url = await onUpload(file);
    setUploading(false);
    if (url) setPreview(url);
  }, [onUpload]);

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div
        className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-colors
          ${dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        {preview ? (
          <img src={preview} alt="preview" style={{ height: previewSize, width: 'auto', objectFit: 'contain' }} />
        ) : (
          <Upload size={28} className="text-slate-400" />
        )}
        {uploading ? (
          <span className="text-xs text-blue-600 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Mengunggah...</span>
        ) : (
          <span className="text-xs text-slate-400">Klik atau seret file PNG/JPG/SVG (maks 500KB)</span>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
};

// ─── Letterhead Preview ───────────────────────────────────────────────────────
interface KopPreviewProps { instansi: Partial<Instansi> }
const KopPreview: React.FC<KopPreviewProps> = ({ instansi }) => (
  <div className="border border-slate-200 rounded-xl p-4 bg-white" style={{ transform: 'scale(0.7)', transformOrigin: 'top left', width: '143%' }}>
    <div className="flex items-center gap-3 pb-2 border-b-2 border-double border-slate-800">
      <div className="w-16 flex justify-center">
        {instansi.logo_kabupaten_path
          ? <img src={instansi.logo_kabupaten_path} alt="kab" className="h-14 w-auto object-contain" />
          : <div className="h-14 w-14 bg-slate-100 rounded-full flex items-center justify-center text-xs text-slate-400">Logo Kab</div>}
      </div>
      <div className="flex-1 text-center" style={{ fontFamily: 'Times New Roman, serif' }}>
        <p className="text-sm font-bold leading-tight">PEMERINTAH {instansi.kabupaten_kota ? `KABUPATEN ${instansi.kabupaten_kota.toUpperCase()}` : 'KABUPATEN/KOTA'}</p>
        <p className="text-base font-bold leading-tight mt-0.5">{instansi.nama_lengkap?.toUpperCase() || 'NAMA INSTANSI'}</p>
        <p className="text-xs text-slate-500 mt-0.5">{instansi.alamat || 'Alamat belum diisi'}</p>
        {(instansi.telepon || instansi.email) && (
          <p className="text-xs text-slate-400">
            {instansi.telepon && `Telp. ${instansi.telepon}`}
            {instansi.telepon && instansi.email && ' | '}
            {instansi.email}
          </p>
        )}
      </div>
      <div className="w-16 flex justify-center">
        {instansi.logo_path
          ? <img src={instansi.logo_path} alt="instansi" className="h-14 w-auto object-contain" />
          : <div className="h-14 w-14 bg-slate-100 rounded-full flex items-center justify-center text-xs text-slate-400">Logo</div>}
      </div>
    </div>
  </div>
);

// ─── Reset Counter Modal ──────────────────────────────────────────────────────
interface ResetCounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  jenis: 'SPT' | 'SPPD';
  onConfirm: (reason: string) => Promise<void>;
}
const ResetCounterModal: React.FC<ResetCounterModalProps> = ({ isOpen, onClose, jenis, onConfirm }) => {
  const [step, setStep] = useState(1);
  const [confirm, setConfirm] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  if (!isOpen) return null;
  const handleConfirm = async () => {
    if (confirm !== 'KONFIRMASI RESET') { toast.error('Ketik teks konfirmasi dengan benar.'); return; }
    if (!reason.trim()) { toast.error('Alasan wajib diisi.'); return; }
    setLoading(true);
    await onConfirm(reason);
    setLoading(false);
    onClose();
    setStep(1); setConfirm(''); setReason('');
  };
  return (
    <div className="modal-backdrop">
      <div className="modal-panel modal-sm">
        <div className="modal-header">
          <span className="modal-title text-rose-600">Reset Counter Nomor {jenis}</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body space-y-4">
          {step === 1 ? (
            <>
              <div className="alert alert-danger">
                <AlertTriangle size={16} />
                <div><strong>Perhatian!</strong> Reset counter akan mereset nomor urut ke 0. Tindakan ini tidak dapat dibatalkan.</div>
              </div>
              <button className="btn btn-danger w-full" onClick={() => setStep(2)}>Lanjut Reset</button>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Alasan Reset <span className="required-mark">*</span></label>
                <textarea className="form-textarea" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Masukkan alasan reset counter..." />
              </div>
              <div className="form-group">
                <label className="form-label">Ketik <code className="bg-rose-50 text-rose-600 px-1 rounded">KONFIRMASI RESET</code> untuk melanjutkan</label>
                <input className="form-input" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="KONFIRMASI RESET" />
              </div>
            </>
          )}
        </div>
        {step === 2 && (
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Batal</button>
            <button className="btn btn-danger" onClick={handleConfirm} disabled={loading}>
              {loading && <Loader2 size={14} className="animate-spin" />} Konfirmasi Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Penandatangan Modal ──────────────────────────────────────────────────────
interface PenandatanganForm {
  nama_lengkap: string; nip: string; jabatan: string;
  pangkat_id: number | ''; golongan_id: number | '';
  unit_kerja_id: number | '';
  jenis_dokumen: string[];
  ttd_digital_path: string;
  periode_mulai: string; periode_selesai: string;
  status_aktif: boolean;
}
const EMPTY_TTD: PenandatanganForm = {
  nama_lengkap: '', nip: '', jabatan: '',
  pangkat_id: '', golongan_id: '', unit_kerja_id: '',
  jenis_dokumen: [], ttd_digital_path: '',
  periode_mulai: '', periode_selesai: '', status_aktif: true,
};
interface PenandatanganModalProps {
  isOpen: boolean; onClose: () => void;
  data?: Penandatangan | null;
  pangkats: RefPangkat[]; golongans: RefGolongan[];
  onSave: (v: Partial<Penandatangan>, file?: File) => Promise<void>;
}
const PenandatanganModal: React.FC<PenandatanganModalProps> = ({ isOpen, onClose, data, pangkats, golongans, onSave }) => {
  const [form, setForm] = useState<PenandatanganForm>(EMPTY_TTD);
  const [ttdFile, setTtdFile] = useState<File | null>(null);
  const [ttdPreview, setTtdPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ttdRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data) {
      setForm({
        nama_lengkap: data.nama_lengkap, nip: data.nip, jabatan: data.jabatan,
        pangkat_id: data.pangkat_id ?? '', golongan_id: data.golongan_id ?? '',
        unit_kerja_id: data.unit_kerja_id ?? '',
        jenis_dokumen: data.jenis_dokumen ?? [],
        ttd_digital_path: data.ttd_digital_path ?? '',
        periode_mulai: data.periode_mulai ?? '', periode_selesai: data.periode_selesai ?? '',
        status_aktif: data.status_aktif,
      });
      setTtdPreview(data.ttd_digital_path ?? null);
    } else {
      setForm(EMPTY_TTD);
      setTtdPreview(null);
      setTtdFile(null);
    }
  }, [data, isOpen]);

  if (!isOpen) return null;

  const toggleJenis = (j: string) => setForm(f => ({
    ...f, jenis_dokumen: f.jenis_dokumen.includes(j) ? f.jenis_dokumen.filter(x => x !== j) : [...f.jenis_dokumen, j],
  }));

  const handleSubmit = async () => {
    if (!form.nama_lengkap || !form.nip || !form.jabatan) { toast.error('Nama, NIP, dan Jabatan wajib diisi.'); return; }
    if (form.nip.length !== 18) { toast.error('NIP harus 18 karakter.'); return; }
    setSaving(true);
    const payload = {
      ...form,
      pangkat_id: form.pangkat_id || undefined,
      golongan_id: form.golongan_id || undefined,
      unit_kerja_id: form.unit_kerja_id ? Number(form.unit_kerja_id) : undefined,
      periode_mulai: form.periode_mulai || undefined,
      periode_selesai: form.periode_selesai || undefined,
    };
    await onSave(payload, ttdFile ?? undefined);
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-panel modal-lg">
        <div className="modal-header">
          <span className="modal-title">{data ? 'Edit Penandatangan' : 'Tambah Penandatangan'}</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group md:col-span-2">
              <label className="form-label">Nama Lengkap <span className="required-mark">*</span></label>
              <input className="form-input" value={form.nama_lengkap} onChange={e => setForm(f => ({ ...f, nama_lengkap: e.target.value }))} placeholder="Nama lengkap beserta gelar" />
            </div>
            <div className="form-group">
              <label className="form-label">NIP <span className="required-mark">*</span></label>
              <input className="form-input font-mono" maxLength={18} value={form.nip} onChange={e => setForm(f => ({ ...f, nip: e.target.value.replace(/\D/g, '') }))} placeholder="18 digit NIP" />
              <span className="form-hint">{form.nip.length}/18 karakter</span>
            </div>
            <div className="form-group">
              <label className="form-label">Jabatan <span className="required-mark">*</span></label>
              <input className="form-input" value={form.jabatan} onChange={e => setForm(f => ({ ...f, jabatan: e.target.value }))} placeholder="Jabatan" />
            </div>
            <div className="form-group">
              <label className="form-label">Pangkat</label>
              <select className="form-select" value={form.pangkat_id} onChange={e => setForm(f => ({ ...f, pangkat_id: e.target.value ? Number(e.target.value) : '' }))}>
                <option value="">-- Pilih Pangkat --</option>
                {pangkats.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Golongan</label>
              <select className="form-select" value={form.golongan_id} onChange={e => setForm(f => ({ ...f, golongan_id: e.target.value ? Number(e.target.value) : '' }))}>
                <option value="">-- Pilih Golongan --</option>
                {golongans.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Periode Mulai</label>
              <input type="date" className="form-input" value={form.periode_mulai} onChange={e => setForm(f => ({ ...f, periode_mulai: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Periode Selesai</label>
              <input type="date" className="form-input" value={form.periode_selesai} onChange={e => setForm(f => ({ ...f, periode_selesai: e.target.value }))} />
            </div>
            <div className="form-group md:col-span-2">
              <label className="form-label">Jenis Dokumen yang Ditandatangani</label>
              <div className="flex gap-4 mt-1">
                {['SPT', 'SPPD'].map(j => (
                  <label key={j} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded" checked={form.jenis_dokumen.includes(j)} onChange={() => toggleJenis(j)} />
                    <span className="text-sm font-medium">{j}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="form-group md:col-span-2">
              <label className="form-label">Tanda Tangan Digital</label>
              <div
                className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-blue-300 transition-colors"
                onClick={() => ttdRef.current?.click()}
              >
                {ttdPreview
                  ? <img src={ttdPreview} alt="TTD" className="h-16 w-auto object-contain" style={{ mixBlendMode: 'multiply' }} />
                  : <Upload size={24} className="text-slate-400" />}
                <span className="text-xs text-slate-400">Unggah gambar TTD (PNG transparan direkomendasikan)</span>
              </div>
              <input ref={ttdRef} type="file" accept="image/*" className="hidden" onChange={e => {
                const f = e.target.files?.[0];
                if (f) { setTtdFile(f); setTtdPreview(URL.createObjectURL(f)); }
              }} />
            </div>
            <div className="form-group">
              <label className="form-label">Status Aktif</label>
              <button type="button" onClick={() => setForm(f => ({ ...f, status_aktif: !f.status_aktif }))}
                className={`flex items-center gap-2 text-sm font-semibold ${form.status_aktif ? 'text-emerald-600' : 'text-slate-400'}`}>
                {form.status_aktif ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                {form.status_aktif ? 'Aktif' : 'Nonaktif'}
              </button>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin" />} Simpan
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Mata Anggaran Modal ──────────────────────────────────────────────────────
interface MAModalProps {
  isOpen: boolean; onClose: () => void;
  data?: MataAnggaran | null;
  onSave: (v: Partial<MataAnggaran>) => Promise<void>;
}
const MAModal: React.FC<MAModalProps> = ({ isOpen, onClose, data, onSave }) => {
  const [form, setForm] = useState<Partial<MataAnggaran>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(data ?? { tahun: new Date().getFullYear(), is_active: true, pagu: 0 }); }, [data, isOpen]);
  if (!isOpen) return null;
  const handleSubmit = async () => {
    if (!form.kode || !form.nama) { toast.error('Kode dan Nama wajib diisi.'); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  };
  return (
    <div className="modal-backdrop">
      <div className="modal-panel modal-md">
        <div className="modal-header">
          <span className="modal-title">{data ? 'Edit Mata Anggaran' : 'Tambah Mata Anggaran'}</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Kode MA <span className="required-mark">*</span></label>
            <input className="form-input font-mono" value={form.kode ?? ''} onChange={e => setForm(f => ({ ...f, kode: e.target.value }))} placeholder="5.2.01.01.01.0001" />
          </div>
          <div className="form-group">
            <label className="form-label">Kode Rekening</label>
            <input className="form-input font-mono" value={form.kode_rekening ?? ''} onChange={e => setForm(f => ({ ...f, kode_rekening: e.target.value }))} />
          </div>
          <div className="form-group md:col-span-2">
            <label className="form-label">Nama <span className="required-mark">*</span></label>
            <input className="form-input" value={form.nama ?? ''} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} placeholder="Belanja Perjalanan Dinas Dalam Daerah" />
          </div>
          <div className="form-group">
            <label className="form-label">Tahun</label>
            <input type="number" className="form-input" value={form.tahun ?? ''} onChange={e => setForm(f => ({ ...f, tahun: Number(e.target.value) }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Pagu (Rp)</label>
            <input type="number" className="form-input" value={form.pagu ?? 0} onChange={e => setForm(f => ({ ...f, pagu: Number(e.target.value) }))} placeholder="0" />
          </div>
          <div className="form-group">
            <label className="form-label">Status Aktif</label>
            <button type="button" onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
              className={`flex items-center gap-2 text-sm font-semibold ${form.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
              {form.is_active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
              {form.is_active ? 'Aktif' : 'Nonaktif'}
            </button>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin" />} Simpan
          </button>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// SETTINGS PAGE
// ═════════════════════════════════════════════════════════════════════════════
type SettingsTab = 'institusi' | 'penomoran' | 'penandatangan' | 'mata_anggaran' | 'perjalanan';

const Settings: React.FC = () => {
  const { tenantId, hasRole } = useAuth();
  const qc = useQueryClient();
  const isAdmin = hasRole(['Admin']);
  const [activeTab, setActiveTab] = useState<SettingsTab>('institusi');

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: instansi, isLoading: loadingInstansi } = useQuery<Instansi | null>({
    queryKey: ['instansi-primary', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instansi')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('is_primary', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: penandatangans = [], isLoading: loadingTTD } = useQuery<Penandatangan[]>({
    queryKey: ['penandatangan', tenantId],
    queryFn: async () => {
      const { data } = await supabase.from('penandatangan').select('*, ref_pangkat(*), ref_golongan(*)').eq('tenant_id', tenantId!).order('nama_lengkap');
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const { data: settingPenomoran = [], isLoading: loadingPenomoran } = useQuery<SettingPenomoran[]>({
    queryKey: ['setting_penomoran', tenantId],
    queryFn: async () => {
      const { data } = await supabase.from('setting_penomoran').select('*').eq('tenant_id', tenantId!);
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const { data: mataAnggarans = [], isLoading: loadingMA } = useQuery<MataAnggaran[]>({
    queryKey: ['mata_anggaran', tenantId],
    queryFn: async () => {
      const { data } = await supabase.from('mata_anggaran').select('*').eq('tenant_id', tenantId!).order('tahun', { ascending: false });
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const { data: pangkats = [] } = useQuery<RefPangkat[]>({
    queryKey: ['ref_pangkat'],
    queryFn: async () => { const { data } = await supabase.from('ref_pangkat').select('*').order('urutan'); return data ?? []; },
  });

  const { data: golongans = [] } = useQuery<RefGolongan[]>({
    queryKey: ['ref_golongan'],
    queryFn: async () => { const { data } = await supabase.from('ref_golongan').select('*').order('urutan'); return data ?? []; },
  });

  const { data: tingkatPerjalanan = [] } = useQuery<RefTingkatPerjalanan[]>({
    queryKey: ['ref_tingkat_perjalanan', tenantId],
    queryFn: async () => { const { data } = await supabase.from('ref_tingkat_perjalanan').select('*'); return data ?? []; },
  });

  const { data: alatAngkut = [] } = useQuery<RefAlatAngkut[]>({
    queryKey: ['ref_alat_angkut', tenantId],
    queryFn: async () => { const { data } = await supabase.from('ref_alat_angkut').select('*'); return data ?? []; },
  });

  // ── Institusi State ───────────────────────────────────────────────────────
  const [instansiForm, setInstansiForm] = useState<Partial<Instansi>>({});
  useEffect(() => { if (instansi) setInstansiForm(instansi); }, [instansi]);

  const saveInstansiMut = useMutation({
    mutationFn: async (v: Partial<Instansi>) => {
      if (instansi?.id) {
        const { error } = await supabase.from('instansi').update(v).eq('id', instansi.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('instansi').insert({ ...v, tenant_id: tenantId, is_primary: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Data instansi berhasil disimpan.');
      qc.invalidateQueries({ queryKey: ['instansi-primary'] });
      qc.invalidateQueries({ queryKey: ['instansi'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadLogo = useCallback(async (field: 'logo_path' | 'logo_kabupaten_path', file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const path = `${tenantId}/${field}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
    if (error) { toast.error('Gagal mengunggah logo.'); return null; }
    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path);
    setInstansiForm(f => ({ ...f, [field]: publicUrl }));
    return publicUrl;
  }, [tenantId]);

  // ── Penomoran State ───────────────────────────────────────────────────────
  type PenomoranLocal = { format_pattern: string; digit_count: number; reset_annually: boolean; kode_organisasi: string; };
  const [penomoranLocal, setPenomoranLocal] = useState<Record<string, PenomoranLocal>>({});
  const [resetModal, setResetModal] = useState<{ open: boolean; jenis: 'SPT' | 'SPPD' }>({ open: false, jenis: 'SPT' });

  useEffect(() => {
    if (settingPenomoran.length) {
      const map: Record<string, PenomoranLocal> = {};
      settingPenomoran.forEach(s => {
        map[s.jenis_dokumen] = {
          format_pattern: s.format_pattern,
          digit_count: s.digit_count,
          reset_annually: s.reset_annually,
          kode_organisasi: s.kode_organisasi ?? '',
        };
      });
      setPenomoranLocal(map);
    }
  }, [settingPenomoran]);

  const savePenomoran = async (jenis: 'SPT' | 'SPPD') => {
    const local = penomoranLocal[jenis];
    if (!local) return;
    const existing = settingPenomoran.find(s => s.jenis_dokumen === jenis);
    if (existing) {
      const { error } = await supabase.from('setting_penomoran').update({ ...local }).eq('id', existing.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from('setting_penomoran').insert({ ...local, jenis_dokumen: jenis, tenant_id: tenantId, separator: '/', counter_current: 0, counter_year: new Date().getFullYear() });
      if (error) { toast.error(error.message); return; }
    }
    toast.success(`Pengaturan nomor ${jenis} berhasil disimpan.`);
    qc.invalidateQueries({ queryKey: ['setting_penomoran'] });
  };

  const resetCounter = async (jenis: 'SPT' | 'SPPD', _reason: string) => {
    const existing = settingPenomoran.find(s => s.jenis_dokumen === jenis);
    if (!existing) return;
    const { error } = await supabase.from('setting_penomoran').update({ counter_current: 0 }).eq('id', existing.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Counter ${jenis} berhasil direset.`);
    qc.invalidateQueries({ queryKey: ['setting_penomoran'] });
  };

  const PLACEHOLDERS = ['{num}', '{year}', '{month}', '{month_roman}', '{org}', '{jenis}'];

  const renderPenomoranCard = (jenis: 'SPT' | 'SPPD') => {
    const local = penomoranLocal[jenis] ?? { format_pattern: `{num}/{jenis}/{org}/{month_roman}/{year}`, digit_count: 3, reset_annually: true, kode_organisasi: '' };
    const existing = settingPenomoran.find(s => s.jenis_dokumen === jenis);
    const preview = buildPreview(local.format_pattern, local.digit_count, local.kode_organisasi, jenis);
    return (
      <div className="card" key={jenis}>
        <div className="card-header">
          <span className="font-bold text-slate-800">Penomoran {jenis}</span>
          <span className="badge badge-blue">{jenis}</span>
        </div>
        <div className="card-body space-y-4">
          <div className="form-group">
            <label className="form-label">Format Pattern</label>
            <input className="form-input font-mono" value={local.format_pattern}
              onChange={e => setPenomoranLocal(f => ({ ...f, [jenis]: { ...local, format_pattern: e.target.value } }))} />
            <div className="flex flex-wrap gap-1 mt-1">
              {PLACEHOLDERS.map(ph => (
                <button key={ph} type="button" className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-mono hover:bg-blue-100 hover:text-blue-700 transition-colors"
                  onClick={() => setPenomoranLocal(f => ({ ...f, [jenis]: { ...local, format_pattern: local.format_pattern + ph } }))}>
                  {ph}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">Digit Counter</label>
              <select className="form-select" value={local.digit_count}
                onChange={e => setPenomoranLocal(f => ({ ...f, [jenis]: { ...local, digit_count: Number(e.target.value) } }))}>
                {[2,3,4,5].map(d => <option key={d} value={d}>{d} digit</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Kode Organisasi</label>
              <input className="form-input font-mono" value={local.kode_organisasi}
                onChange={e => setPenomoranLocal(f => ({ ...f, [jenis]: { ...local, kode_organisasi: e.target.value } }))} placeholder="mis. BPPKAD" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Reset Tahunan</label>
            <button type="button" onClick={() => setPenomoranLocal(f => ({ ...f, [jenis]: { ...local, reset_annually: !local.reset_annually } }))}
              className={`flex items-center gap-2 text-sm font-semibold ${local.reset_annually ? 'text-emerald-600' : 'text-slate-400'}`}>
              {local.reset_annually ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
              {local.reset_annually ? 'Ya, reset tiap tahun' : 'Tidak direset'}
            </button>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Pratinjau Nomor:</p>
            <code className="doc-number text-base text-blue-700">{preview}</code>
            {existing && (
              <p className="text-xs text-slate-400 mt-1">Counter saat ini: <strong>{existing.counter_current}</strong></p>
            )}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm flex-1" onClick={() => savePenomoran(jenis)}>Simpan Pengaturan</button>
            {isAdmin && existing && (
              <button className="btn btn-danger btn-sm" onClick={() => setResetModal({ open: true, jenis })}><RefreshCw size={14} /></button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Penandatangan ──────────────────────────────────────────────────────────
  const [ttdModal, setTtdModal] = useState<{ open: boolean; data: Penandatangan | null }>({ open: false, data: null });
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const saveTTDMut = useMutation({
    mutationFn: async ({ v, file, id }: { v: Partial<Penandatangan>; file?: File; id?: number }) => {
      let ttd_digital_path = v.ttd_digital_path;
      if (file) {
        const ext = file.name.split('.').pop();
        const path = `${tenantId}/ttd_${Date.now()}.${ext}`;
        await supabase.storage.from('signatures').upload(path, file, { upsert: true });
        const { data: { publicUrl } } = supabase.storage.from('signatures').getPublicUrl(path);
        ttd_digital_path = publicUrl;
      }
      const payload = { ...v, ttd_digital_path, tenant_id: tenantId };
      if (id) {
        const { error } = await supabase.from('penandatangan').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('penandatangan').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success('Data penandatangan disimpan.'); qc.invalidateQueries({ queryKey: ['penandatangan'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTTDMut = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('penandatangan').update({ status_aktif: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Penandatangan dinonaktifkan.'); qc.invalidateQueries({ queryKey: ['penandatangan'] }); setDeleteConfirm(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Mata Anggaran ──────────────────────────────────────────────────────────
  const [maModal, setMaModal] = useState<{ open: boolean; data: MataAnggaran | null }>({ open: false, data: null });
  const [maDeleteConfirm, setMaDeleteConfirm] = useState<number | null>(null);
  const [maYear, setMaYear] = useState(new Date().getFullYear());

  const saveMAMut = useMutation({
    mutationFn: async (v: Partial<MataAnggaran>) => {
      if (v.id) {
        const { error } = await supabase.from('mata_anggaran').update(v).eq('id', v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('mata_anggaran').insert({ ...v, tenant_id: tenantId });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success('Mata anggaran disimpan.'); qc.invalidateQueries({ queryKey: ['mata_anggaran'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMAMut = useMutation({
    mutationFn: async (id: number) => { const { error } = await supabase.from('mata_anggaran').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { toast.success('Mata anggaran dihapus.'); qc.invalidateQueries({ queryKey: ['mata_anggaran'] }); setMaDeleteConfirm(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const importMA = useCallback(async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
    let count = 0;
    for (const row of rows) {
      const payload = { kode: String(row['kode'] ?? row['Kode'] ?? ''), nama: String(row['nama'] ?? row['Nama'] ?? ''), tahun: Number(row['tahun'] ?? row['Tahun'] ?? new Date().getFullYear()), pagu: Number(row['pagu'] ?? row['Pagu'] ?? 0), kode_rekening: String(row['kode_rekening'] ?? ''), is_active: true, tenant_id: tenantId };
      if (!payload.kode) continue;
      await supabase.from('mata_anggaran').upsert(payload, { onConflict: 'tenant_id,kode,tahun' });
      count++;
    }
    toast.success(`${count} mata anggaran diimpor.`);
    qc.invalidateQueries({ queryKey: ['mata_anggaran'] });
  }, [tenantId, qc]);

  // ── Referensi Perjalanan ───────────────────────────────────────────────────
  const [tingkatForm, setTingkatForm] = useState<Partial<RefTingkatPerjalanan>>({});
  const [alatForm, setAlatForm] = useState<Partial<RefAlatAngkut>>({});
  const [editTingkat, setEditTingkat] = useState<RefTingkatPerjalanan | null>(null);
  const [editAlat, setEditAlat] = useState<RefAlatAngkut | null>(null);

  const saveTingkatMut = useMutation({
    mutationFn: async (v: Partial<RefTingkatPerjalanan>) => {
      if (v.id) { const { error } = await supabase.from('ref_tingkat_perjalanan').update(v).eq('id', v.id); if (error) throw error; }
      else { const { error } = await supabase.from('ref_tingkat_perjalanan').insert({ ...v, tenant_id: tenantId, is_global: false }); if (error) throw error; }
    },
    onSuccess: () => { toast.success('Tersimpan.'); qc.invalidateQueries({ queryKey: ['ref_tingkat_perjalanan'] }); setTingkatForm({}); setEditTingkat(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveAlatMut = useMutation({
    mutationFn: async (v: Partial<RefAlatAngkut>) => {
      if (v.id) { const { error } = await supabase.from('ref_alat_angkut').update(v).eq('id', v.id); if (error) throw error; }
      else { const { error } = await supabase.from('ref_alat_angkut').insert({ ...v, tenant_id: tenantId, is_global: false }); if (error) throw error; }
    },
    onSuccess: () => { toast.success('Tersimpan.'); qc.invalidateQueries({ queryKey: ['ref_alat_angkut'] }); setAlatForm({}); setEditAlat(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'institusi', label: 'Institusi', icon: <Building2 size={15} /> },
    { id: 'penomoran', label: 'Penomoran', icon: <Hash size={15} /> },
    { id: 'penandatangan', label: 'Penandatangan', icon: <UserRound size={15} /> },
    { id: 'mata_anggaran', label: 'Mata Anggaran', icon: <DollarSign size={15} /> },
    { id: 'perjalanan', label: 'Perjalanan', icon: <Route size={15} /> },
  ];

  const filteredMA = mataAnggarans.filter(m => m.tahun === maYear);

  return (
    <div className="page-container">
      <div className="premium-header">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-slate-700 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-4 ring-white/50">
            <SettingsIcon size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Pengaturan</h1>
            <p className="max-w-md font-medium">Kelola konfigurasi instansi, penomoran, dan referensi sistem.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card mb-6">
        <div className="tab-list px-2 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button key={t.id} className={`tab-item flex items-center gap-1.5 ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: Institusi ─────────────────────────────────────────────────── */}
      {activeTab === 'institusi' && (
        <div className="space-y-6">
          {!instansi && !loadingInstansi && (
            <div className="alert alert-warning"><AlertTriangle size={16} /><span>Data instansi belum dikonfigurasi. Lengkapi formulir di bawah dan simpan.</span></div>
          )}
          {loadingInstansi ? (
            <div className="card card-body"><div className="space-y-3">{[...Array(6)].map((_,i) => <div key={i} className="skeleton h-8 w-full" />)}</div></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="card">
                  <div className="card-header"><span className="font-bold text-slate-800">Data Instansi</span></div>
                  <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-group md:col-span-2">
                      <label className="form-label">Nama Lengkap <span className="required-mark">*</span></label>
                      <input className="form-input" value={instansiForm.nama_lengkap ?? ''} onChange={e => setInstansiForm(f => ({ ...f, nama_lengkap: e.target.value }))} placeholder="Badan Pengelolaan Keuangan dan Aset Daerah" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Nama Singkat</label>
                      <input className="form-input" value={instansiForm.nama_singkat ?? ''} onChange={e => setInstansiForm(f => ({ ...f, nama_singkat: e.target.value }))} placeholder="BPPKAD" />
                    </div>
                    <div className="form-group text-blue-600">
                      <label className="form-label text-blue-600">Ibu Kota Kabupaten/Kota</label>
                      <input className="form-input border-blue-200 bg-blue-50/30" value={instansiForm.ibu_kota ?? ''} onChange={e => setInstansiForm(f => ({ ...f, ibu_kota: e.target.value }))} placeholder="Contoh: Burmeso" />
                      <p className="text-[10px] text-blue-500 mt-1 italic">Lokasi yang akan muncul sebagai tempat penetapan (Ditetapkan di...)</p>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Kabupaten/Kota</label>
                      <input className="form-input" value={instansiForm.kabupaten_kota ?? ''} onChange={e => setInstansiForm(f => ({ ...f, kabupaten_kota: e.target.value }))} placeholder="Contoh Utara" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Provinsi</label>
                      <input className="form-input" value={instansiForm.provinsi ?? ''} onChange={e => setInstansiForm(f => ({ ...f, provinsi: e.target.value }))} placeholder="Provinsi" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Kode Pos</label>
                      <input className="form-input" value={instansiForm.kode_pos ?? ''} onChange={e => setInstansiForm(f => ({ ...f, kode_pos: e.target.value }))} placeholder="12345" />
                    </div>
                    <div className="form-group md:col-span-2">
                      <label className="form-label">Alamat</label>
                      <textarea className="form-textarea" rows={2} value={instansiForm.alamat ?? ''} onChange={e => setInstansiForm(f => ({ ...f, alamat: e.target.value }))} placeholder="Jl. Contoh No. 1, Kecamatan Contoh" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Telepon</label>
                      <input className="form-input" value={instansiForm.telepon ?? ''} onChange={e => setInstansiForm(f => ({ ...f, telepon: e.target.value }))} placeholder="(0xxx) 12345" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input type="email" className="form-input" value={instansiForm.email ?? ''} onChange={e => setInstansiForm(f => ({ ...f, email: e.target.value }))} placeholder="contoh@pemda.go.id" />
                    </div>
                    <div className="form-group md:col-span-2">
                      <label className="form-label">Website</label>
                      <input className="form-input" value={instansiForm.website ?? ''} onChange={e => setInstansiForm(f => ({ ...f, website: e.target.value }))} placeholder="https://www.pemda.go.id" />
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="card-header"><span className="font-bold text-slate-800">Logo & Identitas Visual</span></div>
                  <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-6">
                    <LogoUpload label="Logo Instansi / SKPD" currentUrl={instansiForm.logo_path} onUpload={f => uploadLogo('logo_path', f)} />
                    <LogoUpload label="Logo Kabupaten/Kota" currentUrl={instansiForm.logo_kabupaten_path} onUpload={f => uploadLogo('logo_kabupaten_path', f)} />
                  </div>
                </div>

                {/* ── Kop Bupati ───────────────────────────────────────── */}
                <div className="card">
                  <div className="card-header">
                    <span className="text-lg">👑</span>
                    <span className="font-bold text-slate-800 ml-1.5">Konfigurasi Kop Bupati / Walikota</span>
                  </div>
                  <div className="card-body space-y-4">
                    <p className="text-xs text-slate-500">Digunakan saat SPT ditetapkan langsung oleh Bupati/Walikota. Jika dikosongkan, sistem akan menggunakan format default dari nama kabupaten/kota.</p>
                    <div className="form-group">
                      <label className="form-label text-xs">Jabatan Kepala Daerah</label>
                      <input
                        className="form-input"
                        value={instansiForm.jabatan_kepala_daerah ?? ''}
                        onChange={e => setInstansiForm(f => ({ ...f, jabatan_kepala_daerah: e.target.value }))}
                        placeholder="cth: BUPATI PEGUNUNGAN BINTANG"
                      />
                      <p className="form-hint">Teks ini tampil sebagai judul kop. Gunakan huruf kapital.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="form-group">
                        <label className="form-label text-xs">Alamat Kantor Bupati</label>
                        <textarea
                          className="form-textarea"
                          rows={2}
                          value={instansiForm.alamat_bupati ?? ''}
                          onChange={e => setInstansiForm(f => ({ ...f, alamat_bupati: e.target.value }))}
                          placeholder="Kosongkan jika sama dengan alamat instansi"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label text-xs">Telepon Kantor Bupati</label>
                        <input
                          className="form-input"
                          value={instansiForm.telepon_bupati ?? ''}
                          onChange={e => setInstansiForm(f => ({ ...f, telepon_bupati: e.target.value }))}
                          placeholder="Kosongkan jika sama"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Kop Sekretariat Daerah ───────────────────────────── */}
                <div className="card">
                  <div className="card-header">
                    <span className="text-lg">🏛️</span>
                    <span className="font-bold text-slate-800 ml-1.5">Konfigurasi Kop Sekretariat Daerah</span>
                  </div>
                  <div className="card-body space-y-4">
                    <p className="text-xs text-slate-500">Digunakan saat SPT ditetapkan atas nama Sekretaris Daerah. Format otomatis: "PEMERINTAH KABUPATEN X / SEKRETARIAT DAERAH".</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="form-group">
                        <label className="form-label text-xs">Alamat Sekretariat Daerah</label>
                        <textarea
                          className="form-textarea"
                          rows={2}
                          value={instansiForm.alamat_sekda ?? ''}
                          onChange={e => setInstansiForm(f => ({ ...f, alamat_sekda: e.target.value }))}
                          placeholder="Kosongkan jika sama dengan alamat instansi"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label text-xs">Telepon Sekretariat Daerah</label>
                        <input
                          className="form-input"
                          value={instansiForm.telepon_sekda ?? ''}
                          onChange={e => setInstansiForm(f => ({ ...f, telepon_sekda: e.target.value }))}
                          placeholder="Kosongkan jika sama"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Letterhead Preview */}
              <div className="space-y-4">
                <div className="card">
                  <div className="card-header"><Eye size={14} /><span className="font-bold text-slate-800 ml-1.5">Pratinjau Kop Surat</span></div>
                  <div className="card-body overflow-hidden">
                    <KopPreview instansi={instansiForm} />
                  </div>
                </div>
                <button className="btn btn-primary w-full" onClick={() => saveInstansiMut.mutate(instansiForm)} disabled={saveInstansiMut.isPending}>
                  {saveInstansiMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Simpan Data Instansi
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Penomoran ─────────────────────────────────────────────────── */}
      {activeTab === 'penomoran' && (
        <div>
          {loadingPenomoran ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{[0,1].map(i => <div key={i} className="card card-body"><div className="space-y-3">{[...Array(5)].map((_,j) => <div key={j} className="skeleton h-8 w-full" />)}</div></div>)}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderPenomoranCard('SPT')}
              {renderPenomoranCard('SPPD')}
            </div>
          )}
          <ResetCounterModal isOpen={resetModal.open} onClose={() => setResetModal(m => ({ ...m, open: false }))} jenis={resetModal.jenis} onConfirm={(r) => resetCounter(resetModal.jenis, r)} />
        </div>
      )}

      {/* ── TAB: Penandatangan ─────────────────────────────────────────────── */}
      {activeTab === 'penandatangan' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              {!penandatangans.some(p => p.status_aktif) && !loadingTTD && (
                <div className="alert alert-warning inline-flex"><AlertTriangle size={14} /><span>Belum ada penandatangan aktif. Dokumen tidak dapat diterbitkan.</span></div>
              )}
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setTtdModal({ open: true, data: null })}><Plus size={14} /> Tambah Penandatangan</button>
          </div>
          {loadingTTD ? (
            <div className="card card-body"><div className="space-y-3">{[...Array(4)].map((_,i) => <div key={i} className="skeleton h-12 w-full" />)}</div></div>
          ) : penandatangans.length === 0 ? (
            <div className="card"><div className="empty-state"><UserRound size={40} className="text-slate-300" /><p className="empty-state-title">Belum ada data penandatangan</p></div></div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr>
                  <th>Nama / NIP</th><th>Jabatan</th><th>Pangkat/Gol</th>
                  <th>Jenis Dok</th><th>Periode</th><th>Status</th><th>Aksi</th>
                </tr></thead>
                <tbody>
                  {penandatangans.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div className="font-semibold text-slate-800">{p.nama_lengkap}</div>
                        <div className="doc-number text-slate-400">{p.nip}</div>
                      </td>
                      <td className="text-sm">{p.jabatan}</td>
                      <td className="text-sm">{p.ref_pangkat?.nama}{p.ref_golongan ? ` / ${p.ref_golongan.nama}` : ''}</td>
                      <td>{p.jenis_dokumen?.map(j => <span key={j} className="badge badge-blue mr-1">{j}</span>)}</td>
                      <td className="text-xs text-slate-500">{p.periode_mulai ? `${p.periode_mulai} s/d ${p.periode_selesai ?? '—'}` : '—'}</td>
                      <td><span className={p.status_aktif ? 'badge badge-green' : 'badge badge-slate'}>{p.status_aktif ? 'Aktif' : 'Nonaktif'}</span></td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn btn-ghost btn-icon-sm" onClick={() => setTtdModal({ open: true, data: p })} title="Edit"><Edit2 size={14} /></button>
                          {p.status_aktif && <button className="btn btn-ghost btn-icon-sm text-rose-500" onClick={() => setDeleteConfirm(p.id)} title="Nonaktifkan"><Trash2 size={14} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <PenandatanganModal
            isOpen={ttdModal.open} onClose={() => setTtdModal({ open: false, data: null })}
            data={ttdModal.data} pangkats={pangkats} golongans={golongans}
            onSave={(v, file) => saveTTDMut.mutateAsync({ v, file, id: ttdModal.data?.id })}
          />
          {deleteConfirm !== null && (
            <div className="modal-backdrop">
              <div className="modal-panel modal-sm">
                <div className="modal-header"><span className="modal-title">Konfirmasi Nonaktifkan</span></div>
                <div className="modal-body"><p className="text-sm text-slate-600">Penandatangan ini akan dinonaktifkan. Lanjutkan?</p></div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Batal</button>
                  <button className="btn btn-danger" onClick={() => deleteTTDMut.mutate(deleteConfirm)} disabled={deleteTTDMut.isPending}>Nonaktifkan</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Mata Anggaran ─────────────────────────────────────────────── */}
      {activeTab === 'mata_anggaran' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="form-label mb-0">Tahun:</label>
              <select className="form-select w-32" value={maYear} onChange={e => setMaYear(Number(e.target.value))}>
                {[...Array(5)].map((_, i) => { const y = new Date().getFullYear() - i; return <option key={y} value={y}>{y}</option>; })}
              </select>
            </div>
            <div className="flex gap-2">
              <label className="btn btn-secondary btn-sm cursor-pointer">
                <FileSpreadsheet size={14} /> Import Excel
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importMA(f); }} />
              </label>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                const ws = XLSX.utils.json_to_sheet(filteredMA.map(m => ({ kode: m.kode, kode_rekening: m.kode_rekening, nama: m.nama, tahun: m.tahun, pagu: m.pagu })));
                const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Mata Anggaran');
                XLSX.writeFile(wb, `mata_anggaran_${maYear}.xlsx`);
              }}><Download size={14} /> Export</button>
              <button className="btn btn-primary btn-sm" onClick={() => setMaModal({ open: true, data: null })}><Plus size={14} /> Tambah</button>
            </div>
          </div>
          {loadingMA ? (
            <div className="card card-body space-y-3">{[...Array(5)].map((_,i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
          ) : filteredMA.length === 0 ? (
            <div className="card"><div className="empty-state"><DollarSign size={40} className="text-slate-300" /><p className="empty-state-title">Belum ada mata anggaran untuk tahun {maYear}</p></div></div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Kode</th><th>Kode Rekening</th><th>Nama</th><th>Tahun</th><th className="text-right">Pagu</th><th>Status</th><th>Aksi</th></tr></thead>
                <tbody>
                  {filteredMA.map(m => (
                    <tr key={m.id}>
                      <td><code className="doc-number">{m.kode}</code></td>
                      <td><code className="text-xs text-slate-500">{m.kode_rekening ?? '—'}</code></td>
                      <td className="text-sm">{m.nama}</td>
                      <td>{m.tahun}</td>
                      <td className="text-right font-mono text-sm">Rp {m.pagu.toLocaleString('id-ID')}</td>
                      <td><span className={m.is_active ? 'badge badge-green' : 'badge badge-slate'}>{m.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn btn-ghost btn-icon-sm" onClick={() => setMaModal({ open: true, data: m })}><Edit2 size={14} /></button>
                          <button className="btn btn-ghost btn-icon-sm text-rose-500" onClick={() => setMaDeleteConfirm(m.id)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <MAModal isOpen={maModal.open} onClose={() => setMaModal({ open: false, data: null })} data={maModal.data}
            onSave={(v) => saveMAMut.mutateAsync(v)} />
          {maDeleteConfirm !== null && (
            <div className="modal-backdrop">
              <div className="modal-panel modal-sm">
                <div className="modal-header"><span className="modal-title text-rose-600">Hapus Mata Anggaran</span></div>
                <div className="modal-body"><p className="text-sm text-slate-600">Apakah Anda yakin ingin menghapus mata anggaran ini?</p></div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setMaDeleteConfirm(null)}>Batal</button>
                  <button className="btn btn-danger" onClick={() => deleteMAMut.mutate(maDeleteConfirm)} disabled={deleteMAMut.isPending}>Hapus</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Perjalanan ────────────────────────────────────────────────── */}
      {activeTab === 'perjalanan' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tingkat Perjalanan */}
          <div className="card">
            <div className="card-header"><span className="font-bold text-slate-800">Tingkat Perjalanan</span><span className="badge badge-blue">{tingkatPerjalanan.length}</span></div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="form-group">
                  <label className="form-label">Kode</label>
                  <input className="form-input font-mono" value={editTingkat ? (tingkatForm.kode ?? editTingkat.kode) : (tingkatForm.kode ?? '')}
                    onChange={e => setTingkatForm(f => ({ ...f, kode: e.target.value }))} placeholder="A / B / C" />
                </div>
                <div className="form-group">
                  <label className="form-label">Deskripsi</label>
                  <input className="form-input" value={editTingkat ? (tingkatForm.deskripsi ?? editTingkat.deskripsi) : (tingkatForm.deskripsi ?? '')}
                    onChange={e => setTingkatForm(f => ({ ...f, deskripsi: e.target.value }))} placeholder="Tingkat A - Pejabat Eselon II" />
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-primary btn-sm" onClick={() => {
                  const data = editTingkat ? { ...editTingkat, ...tingkatForm } : tingkatForm;
                  saveTingkatMut.mutate(data);
                }}>
                  {editTingkat ? 'Update' : <><Plus size={12} /> Tambah</>}
                </button>
                {editTingkat && <button className="btn btn-secondary btn-sm" onClick={() => { setEditTingkat(null); setTingkatForm({}); }}>Batal</button>}
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Kode</th><th>Deskripsi</th><th>Aksi</th></tr></thead>
                  <tbody>
                    {tingkatPerjalanan.map(t => (
                      <tr key={t.id}>
                        <td><code className="badge badge-cyan">{t.kode}</code></td>
                        <td className="text-sm">{t.deskripsi}</td>
                        <td>
                          <button className="btn btn-ghost btn-icon-sm" onClick={() => { setEditTingkat(t); setTingkatForm({ kode: t.kode, deskripsi: t.deskripsi }); }} disabled={t.is_global}><Edit2 size={13} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Alat Angkut */}
          <div className="card">
            <div className="card-header"><span className="font-bold text-slate-800">Alat Angkut</span><span className="badge badge-blue">{alatAngkut.length}</span></div>
            <div className="card-body space-y-4">
              <div className="form-group">
                <label className="form-label">Nama Alat Angkut</label>
                <input className="form-input" value={editAlat ? (alatForm.nama ?? editAlat.nama) : (alatForm.nama ?? '')}
                  onChange={e => setAlatForm(f => ({ ...f, nama: e.target.value }))} placeholder="Kendaraan Dinas, Pesawat Udara, dll." />
              </div>
              <div className="flex gap-2">
                <button className="btn btn-primary btn-sm" onClick={() => {
                  const data = editAlat ? { ...editAlat, ...alatForm } : alatForm;
                  saveAlatMut.mutate(data);
                }}>
                  {editAlat ? 'Update' : <><Plus size={12} /> Tambah</>}
                </button>
                {editAlat && <button className="btn btn-secondary btn-sm" onClick={() => { setEditAlat(null); setAlatForm({}); }}>Batal</button>}
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Nama</th><th>Global</th><th>Aksi</th></tr></thead>
                  <tbody>
                    {alatAngkut.map(a => (
                      <tr key={a.id}>
                        <td className="text-sm">{a.nama}</td>
                        <td>{a.is_global ? <span className="badge badge-slate">Global</span> : <span className="badge badge-blue">Tenant</span>}</td>
                        <td>
                          <button className="btn btn-ghost btn-icon-sm" onClick={() => { setEditAlat(a); setAlatForm({ nama: a.nama }); }} disabled={a.is_global}><Edit2 size={13} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
