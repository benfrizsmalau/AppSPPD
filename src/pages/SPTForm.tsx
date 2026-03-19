// =================================================================
// SiSPPD v2.1 — SPT Form (Module 04) — Create & Edit
// =================================================================
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  useForm,
  useFieldArray,
  Controller,
  type SubmitHandler,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft,
  Save,
  CheckCircle,
  Plus,
  Trash2,
  GripVertical,
  AlertTriangle,
  Users,
  FileText,
  Target,
  Pen,
  Search,
  X,
  Loader2,
  Clock,
  Info,
  ChevronRight,
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type {
  SPT,
  Instansi,
  Penandatangan,
  Pegawai,
  MataAnggaran,
  DasarPerintah,
  JenisDasarPerintah,
  KopSurat,
} from '../types';

// =================================================================
// ZOD SCHEMA
// =================================================================
const dasarPerintahSchema = z.object({
  id: z.string(),
  jenis: z.enum(['surat', 'lisan', 'lainnya']),
  // nomor & tanggal hanya wajib saat jenis = 'surat'
  nomor: z.string().optional(),
  tanggal: z.string().optional(),
  perihal: z.string().min(1, 'Perihal / keterangan wajib diisi'),
}).superRefine((val, ctx) => {
  if (val.jenis === 'surat') {
    if (!val.nomor || val.nomor.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nomor'], message: 'Nomor surat wajib diisi' });
    }
    if (!val.tanggal || val.tanggal.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tanggal'], message: 'Tanggal surat wajib diisi' });
    }
  }
});

const sptSchema = z.object({
  tanggal_penetapan: z.string().min(1, 'Tanggal penetapan wajib diisi'),
  tempat_penetapan: z.string().min(1, 'Tempat penetapan wajib diisi'),
  kop_surat: z.enum(['skpd', 'bupati', 'sekda']),
  instansi_id: z.number({ message: 'Pilih instansi' }).positive('Pilih instansi'),
  penandatangan_id: z.number({ message: 'Pilih penandatangan' }).positive('Pilih penandatangan'),
  dasar_perintah: z
    .array(dasarPerintahSchema)
    .min(1, 'Minimal 1 dasar perintah diperlukan'),
  tujuan_kegiatan: z
    .array(z.string().min(1, 'Tujuan tidak boleh kosong'))
    .min(1, 'Minimal 1 tujuan kegiatan diperlukan'),
  lama_kegiatan: z
    .number({ message: 'Masukkan angka' })
    .int()
    .min(1, 'Minimal 1 hari')
    .max(365, 'Maksimal 365 hari'),
  pembebanan_anggaran: z.string().optional(),
  mata_anggaran_id: z.number().optional(),
  catatan: z.string().optional(),
  pegawai_ids: z
    .array(z.number())
    .min(1, 'Pilih minimal 1 pegawai')
    .max(10, 'Maksimal 10 pegawai'),
});

type SPTFormData = z.infer<typeof sptSchema>;

// =================================================================
// STEPPER
// =================================================================
type Step = 1 | 2 | 3;

const STEPS = [
  { step: 1 as Step, label: 'Identitas', icon: <FileText size={14} /> },
  { step: 2 as Step, label: 'Dasar & Tujuan', icon: <Target size={14} /> },
  { step: 3 as Step, label: 'Pelaksana', icon: <Users size={14} /> },
];

interface StepperProps {
  current: Step;
  completedSteps: Set<Step>;
  onChange: (s: Step) => void;
}

const Stepper: React.FC<StepperProps> = ({ current, completedSteps, onChange }) => (
  <div className="flex items-center justify-between gap-4 mb-10 bg-slate-50/50 p-2 rounded-2xl border border-slate-100/50">
    {STEPS.map((s, i) => {
      const done = completedSteps.has(s.step);
      const active = current === s.step;
      return (
        <React.Fragment key={s.step}>
          <button
            type="button"
            className={`flex-1 flex items-center gap-3 p-3 rounded-xl transition-all ${active ? 'bg-white shadow-md ring-1 ring-blue-500/10' : 'hover:bg-white/50'}`}
            onClick={() => onChange(s.step)}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-all duration-300 ${done ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : active ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-slate-200 text-slate-500'}`}>
              {done ? <CheckCircle size={16} /> : s.step}
            </div>
            <div className="text-left hidden md:block">
              <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 ${active ? 'text-blue-600' : 'text-slate-400'}`}>Tahap {s.step}</p>
              <p className={`text-sm font-bold leading-none ${active ? 'text-slate-900' : 'text-slate-500'}`}>{s.label}</p>
            </div>
          </button>
          {i < STEPS.length - 1 && (
            <ChevronRight size={16} className="text-slate-300" />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// =================================================================
// SORTABLE DASAR PERINTAH ITEM
// =================================================================
interface SortableDasarProps {
  item: DasarPerintah & { id: string };
  index: number;
  register: any;
  setValue: any;
  onRemove: (index: number) => void;
  errors?: any;
  canRemove: boolean;
  currentJenis: JenisDasarPerintah;
}

const JENIS_OPTIONS: { value: JenisDasarPerintah; label: string; desc: string; color: string }[] = [
  { value: 'surat',   label: 'Surat Resmi',     desc: 'Ada nomor & tanggal surat', color: 'bg-blue-50 border-blue-300 text-blue-700' },
  { value: 'lisan',   label: 'Perintah Lisan',  desc: 'Tanpa dokumen tertulis',     color: 'bg-amber-50 border-amber-300 text-amber-700' },
  { value: 'lainnya', label: 'Lainnya',          desc: 'Instruksi / disposisi dll',  color: 'bg-slate-50 border-slate-300 text-slate-600' },
];

const SortableDasarItem: React.FC<SortableDasarProps> = ({
  item, index, register, setValue, onRemove, errors, canRemove, currentJenis
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const namePrefix = `dasar_perintah.${index}` as const;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200"
    >
      <button
        type="button"
        className="drag-handle self-start mt-2 flex-shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>

      <div className="flex-1 space-y-2">
        {/* ── Pilih Jenis ── */}
        <div className="flex gap-2 flex-wrap">
          {JENIS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setValue(`${namePrefix}.jenis`, opt.value, { shouldDirty: true })}
              title={opt.desc}
              className={`px-3 py-1 rounded-lg border text-xs font-semibold transition-all ${
                currentJenis === opt.value
                  ? opt.color + ' ring-2 ring-offset-1 ring-current'
                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* ── Fields kondisional ── */}
        {currentJenis === 'surat' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="form-group">
              <label className="form-label text-xs">Nomor Surat <span className="required-mark">*</span></label>
              <input
                className={`form-input text-sm ${errors?.nomor ? 'is-error' : ''}`}
                placeholder="cth. 800/123/DINAS/2025"
                {...register(`${namePrefix}.nomor`)}
              />
              {errors?.nomor && <p className="form-error text-[10px]">{errors.nomor.message}</p>}
            </div>
            <div className="form-group">
              <label className="form-label text-xs">Tanggal <span className="required-mark">*</span></label>
              <input
                type="date"
                className={`form-input text-sm ${errors?.tanggal ? 'is-error' : ''}`}
                {...register(`${namePrefix}.tanggal`)}
              />
              {errors?.tanggal && <p className="form-error text-[10px]">{errors.tanggal.message}</p>}
            </div>
            <div className="form-group">
              <label className="form-label text-xs">Perihal <span className="required-mark">*</span></label>
              <input
                className={`form-input text-sm ${errors?.perihal ? 'is-error' : ''}`}
                placeholder="Perihal surat"
                {...register(`${namePrefix}.perihal`)}
              />
              {errors?.perihal && <p className="form-error text-[10px]">{errors.perihal.message}</p>}
            </div>
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label text-xs">
              {currentJenis === 'lisan' ? 'Keterangan Perintah Lisan' : 'Keterangan'}{' '}
              <span className="required-mark">*</span>
            </label>
            <input
              className={`form-input text-sm ${errors?.perihal ? 'is-error' : ''}`}
              placeholder={
                currentJenis === 'lisan'
                  ? 'cth. Perintah lisan Kepala Dinas pada rapat tanggal ...'
                  : 'cth. Disposisi Sekretaris Daerah No. ...'
              }
              {...register(`${namePrefix}.perihal`)}
            />
            {errors?.perihal && <p className="form-error text-[10px]">{errors.perihal.message}</p>}
          </div>
        )}
      </div>

      {canRemove && (
        <button
          type="button"
          className="btn btn-ghost btn-sm text-rose-400 hover:text-rose-600 hover:bg-rose-50 flex-shrink-0 self-start mt-6"
          onClick={() => onRemove(index)}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
};

// =================================================================
// SORTABLE PEGAWAI ITEM
// =================================================================
interface SortablePegawaiItemProps {
  pegawai: Pegawai;
  urutan: number;
  dragId: string;
  onRemove: () => void;
  hasWarning?: boolean;
}

const SortablePegawaiItem: React.FC<SortablePegawaiItemProps> = ({
  pegawai, urutan, dragId, onRemove, hasWarning,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dragId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm"
    >
      <button type="button" className="drag-handle flex-shrink-0" {...attributes} {...listeners}>
        <GripVertical size={15} />
      </button>

      <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold
                      flex items-center justify-center flex-shrink-0">
        {urutan}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{pegawai.nama_lengkap}</p>
        <p className="text-xs text-slate-400 truncate">
          {pegawai.nip} · {pegawai.jabatan}
        </p>
      </div>

      {hasWarning && (
        <div title="Pegawai ini memiliki SPT dalam 7 hari terakhir">
          <AlertTriangle size={14} className="text-amber-500" />
        </div>
      )}

      <button
        type="button"
        className="btn btn-ghost btn-sm p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50"
        onClick={onRemove}
      >
        <X size={14} />
      </button>
    </div>
  );
};

// =================================================================
// SPT PREVIEW PANEL
// =================================================================
interface PreviewPanelProps {
  formValues: SPTFormData;
  instansi?: Instansi;
  penandatangan?: Penandatangan;
  selectedPegawai: Pegawai[];
}

const SPTPreviewPanel: React.FC<PreviewPanelProps> = ({
  formValues, instansi, penandatangan, selectedPegawai,
}) => {
  const today = formValues.tanggal_penetapan
    ? format(new Date(formValues.tanggal_penetapan), 'dd MMMM yyyy', { locale: localeID })
    : 'DD Bulan YYYY';

  return (
    <div className="preview-panel text-xs leading-relaxed overflow-y-auto max-h-[calc(100vh-200px)]">
      {/* KOP */}
      <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
        {formValues.kop_surat === 'bupati' ? (
          <p className="font-bold text-sm uppercase tracking-wide">
            {instansi?.jabatan_kepala_daerah || `BUPATI ${instansi?.kabupaten_kota?.toUpperCase() || ''}`}
          </p>
        ) : formValues.kop_surat === 'sekda' ? (
          <>
            <p className="font-bold text-[10px] uppercase tracking-wider mb-0.5">
              PEMERINTAH {instansi?.kabupaten_kota ? `KABUPATEN ${instansi.kabupaten_kota.toUpperCase()}` : ''}
            </p>
            <p className="font-bold text-sm uppercase tracking-wide">SEKRETARIAT DAERAH</p>
          </>
        ) : (
          <p className="font-bold text-sm uppercase tracking-wide">
            {instansi?.nama_lengkap ?? 'NAMA INSTANSI'}
          </p>
        )}
        <p className="text-[10px] text-slate-500 mt-1">
          {formValues.kop_surat === 'bupati' ? (instansi?.alamat_bupati || instansi?.alamat) :
           formValues.kop_surat === 'sekda' ? (instansi?.alamat_sekda || instansi?.alamat) :
           instansi?.alamat || 'Alamat Instansi'}
        </p>
      </div>

      {/* Title */}
      <div className="text-center mb-4">
        <p className="font-bold text-sm uppercase tracking-widest">SURAT PERINTAH TUGAS</p>
        <p className="text-[11px] text-slate-500 mt-1">
          Nomor: {formValues.tanggal_penetapan
            ? `DRAFT-${formValues.tanggal_penetapan.replace(/-/g, '')}`
            : 'DRAFT-________'}
        </p>
      </div>

      {/* Dasar Perintah */}
      {formValues.dasar_perintah?.length > 0 && (
        <div className="mb-3">
          <p className="font-semibold mb-1">Dasar:</p>
          <ol className="list-decimal list-outside ml-6 space-y-1 text-slate-600">
            {formValues.dasar_perintah.map((d, i) => (
              <li key={i}>
                {d.jenis === 'surat' ? (
                  <>
                    {d.nomor} tanggal {d.tanggal ? format(new Date(d.tanggal), 'dd MMM yyyy', { locale: localeID }) : '—'} tentang {d.perihal}
                  </>
                ) : (
                  <>{d.perihal}</>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Memerintahkan */}
      <div className="mb-3">
        <p className="font-semibold">Memerintahkan:</p>
        {selectedPegawai.length === 0 ? (
          <p className="text-slate-400 italic">— Pilih pegawai pelaksana —</p>
        ) : (
          <table className="w-full text-[11px] mt-1">
            <tbody>
              {selectedPegawai.map((p, i) => (
                <tr key={p.id} className="border-b border-dashed border-slate-200 last:border-0">
                  <td className="py-2 w-6 align-top font-bold text-slate-400">{i + 1}.</td>
                  <td className="py-2 align-top">
                    <p className="font-bold text-slate-900 leading-tight uppercase tracking-tight mb-1">{p.nama_lengkap}</p>
                    <div className="space-y-0.5 text-[10px] text-slate-500 font-medium">
                      <p>NIP. {p.nip}</p>
                      {p.ref_pangkat?.nama && (
                        <p>{p.ref_pangkat.nama}{p.ref_golongan?.nama ? ` (${p.ref_golongan.nama})` : ''}</p>
                      )}
                      <p className="text-blue-600 font-semibold uppercase">{p.jabatan}</p>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Tujuan */}
      {formValues.tujuan_kegiatan?.length > 0 && (
        <div className="mb-3">
          <p className="font-semibold mb-1">Untuk:</p>
          <ol className="list-decimal list-outside ml-6 space-y-1 text-slate-600">
            {formValues.tujuan_kegiatan.map((t, i) => t && <li key={i}>{t}</li>)}
          </ol>
        </div>
      )}

      {/* Lama */}
      <div className="mb-3">
        <p><span className="font-semibold">Lama kegiatan:</span>{' '}
          <span className="text-slate-600">{formValues.lama_kegiatan ?? 1} hari</span>
        </p>
      </div>

      {/* Pembebanan */}
      {formValues.pembebanan_anggaran && (
        <div className="mb-3">
          <p><span className="font-semibold">Pembebanan anggaran:</span>{' '}
            <span className="text-slate-600">{formValues.pembebanan_anggaran}</span>
          </p>
        </div>
      )}

      {/* TTD */}
      <div className="mt-8 flex justify-end">
        <div className="w-64 font-medium text-slate-700 text-center">
          <p className="mb-0.5">Ditetapkan di {formValues.tempat_penetapan || '____________'}</p>
          <p className="mb-6">Pada tanggal {today}</p>
          
          <p className="font-bold text-slate-900 leading-tight uppercase tracking-tight mb-16 underline-offset-4">
            {penandatangan?.jabatan ?? 'JABATAN PENANDATANGAN'}
          </p>
          
          <div className="space-y-0.5">
            <p className="font-bold text-slate-900 uppercase tracking-tight underline italic">
              {penandatangan?.nama_lengkap ?? 'NAMA PENANDATANGAN'}
            </p>
            {penandatangan?.ref_pangkat?.nama && (
              <p className="text-[11px] text-slate-500">
                {penandatangan.ref_pangkat.nama} {penandatangan.ref_golongan?.nama ? ` / ${penandatangan.ref_golongan.nama}` : ''}
              </p>
            )}
            <p className="text-[11px] text-slate-400 font-mono">
              NIP. {penandatangan?.nip ?? '___________________'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// =================================================================
// MAIN SPTForm COMPONENT
// =================================================================
const SPTForm: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  // const [searchParams] = useSearchParams(); // reserved for future use
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set());
  const [pegawaiSearch, setPegawaiSearch] = useState('');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');

  // ── Lookups ──────────────────────────────────────────────────
  const { data: instansiList = [] } = useQuery<Instansi[]>({
    queryKey: ['instansi', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('instansi')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('is_primary', { ascending: false });
      if (error) throw error;
      return data as Instansi[];
    },
    enabled: !!tenantId,
    staleTime: 300_000,
  });

  const { data: penandatanganList = [] } = useQuery<Penandatangan[]>({
    queryKey: ['penandatangan', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('penandatangan')
        .select('*, ref_pangkat:ref_pangkat(nama), ref_golongan:ref_golongan(nama)')
        .eq('tenant_id', tenantId)
        .eq('status_aktif', true)
        .order('nama_lengkap');
      if (error) throw error;
      return data as Penandatangan[];
    },
    enabled: !!tenantId,
    staleTime: 300_000,
  });

  const { data: pegawaiList = [] } = useQuery<Pegawai[]>({
    queryKey: ['pegawai-aktif', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('pegawai')
        .select('*, ref_pangkat:ref_pangkat(nama), ref_golongan:ref_golongan(nama)')
        .eq('tenant_id', tenantId)
        .eq('status_aktif', true)
        .order('nama_lengkap');
      if (error) throw error;
      return data as Pegawai[];
    },
    enabled: !!tenantId,
    staleTime: 300_000,
  });

  const { data: mataAnggaranList = [] } = useQuery<MataAnggaran[]>({
    queryKey: ['mata-anggaran', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('mata_anggaran')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('kode');
      if (error) throw error;
      return data as MataAnggaran[];
    },
    enabled: !!tenantId,
    staleTime: 300_000,
  });

  // ── Existing SPT (edit mode) ────────────────────────────────
  const { data: existingSPT, isLoading: existingLoading } = useQuery<SPT | null>({
    queryKey: ['spt-edit', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('spt')
        .select('*, spt_pegawai:spt_pegawai(id, pegawai_id, urutan)')
        .eq('id', Number(id))
        .single();
      if (error) throw error;
      return data as SPT;
    },
    enabled: !!id,
    staleTime: 0,
  });

  // ── Recent SPT check for employee warnings ───────────────────
  const { data: recentSPTByPegawai = {} } = useQuery<Record<number, boolean>>({
    queryKey: ['recent-spt-pegawai', tenantId],
    queryFn: async () => {
      if (!tenantId) return {};
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const { data, error } = await supabase
        .from('spt_pegawai')
        .select('pegawai_id, spt:spt(created_at, tenant_id)')
        .gte('spt.created_at', cutoff.toISOString())
        .eq('spt.tenant_id', tenantId);
      if (error) return {};
      const map: Record<number, boolean> = {};
      (data ?? []).forEach((r: { pegawai_id: number }) => { map[r.pegawai_id] = true; });
      return map;
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  // ── Form Setup ───────────────────────────────────────────────
  const defaultValues: SPTFormData = {
    tanggal_penetapan: new Date().toISOString().split('T')[0],
    tempat_penetapan: '',
    kop_surat: 'skpd' as KopSurat,
    instansi_id: 0,
    penandatangan_id: 0,
    dasar_perintah: [{ id: crypto.randomUUID(), jenis: 'surat' as JenisDasarPerintah, nomor: '', tanggal: '', perihal: '' }],
    tujuan_kegiatan: [''],
    lama_kegiatan: 1,
    pembebanan_anggaran: '',
    mata_anggaran_id: undefined,
    catatan: '',
    pegawai_ids: [],
  };

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    trigger,
    formState: { errors, isDirty },
  } = useForm<SPTFormData>({
    resolver: zodResolver(sptSchema),
    defaultValues,
    mode: 'onChange',
  });

  const { fields: dasarFields, append: appendDasar, remove: removeDasar, move: moveDasar } =
    useFieldArray({ control, name: 'dasar_perintah' });

  const watchedValues = watch();

  // ── Redirect if read-only status ────────────────────────────
  useEffect(() => {
    if (existingSPT) {
      const readOnly: Array<SPT['status']> = ['Final', 'Completed', 'Cancelled'];
      if (readOnly.includes(existingSPT.status)) {
        navigate(`/spt/${existingSPT.id}`, { replace: true });
        return;
      }

      // Populate form
      const pegawaiIds = (existingSPT.spt_pegawai ?? [])
        .sort((a, b) => a.urutan - b.urutan)
        .map(sp => sp.pegawai_id);

      const dasarPerintah: DasarPerintah[] = Array.isArray(existingSPT.dasar_perintah)
        ? existingSPT.dasar_perintah.map(d => ({
            id: (d as DasarPerintah).id ?? crypto.randomUUID(),
            jenis: (d as DasarPerintah).jenis ?? 'surat',
            nomor: (d as DasarPerintah).nomor ?? '',
            tanggal: (d as DasarPerintah).tanggal ?? '',
            perihal: (d as DasarPerintah).perihal ?? '',
          }))
        : [{ id: crypto.randomUUID(), jenis: 'surat' as JenisDasarPerintah, nomor: '', tanggal: '', perihal: '' }];

      reset({
        tanggal_penetapan: existingSPT.tanggal_penetapan,
        tempat_penetapan: existingSPT.tempat_penetapan,
        kop_surat: (existingSPT.kop_surat ?? 'skpd') as KopSurat,
        instansi_id: existingSPT.instansi_id ?? 0,
        penandatangan_id: existingSPT.penandatangan_id ?? 0,
        dasar_perintah: dasarPerintah,
        tujuan_kegiatan: existingSPT.tujuan_kegiatan ?? [''],
        lama_kegiatan: existingSPT.lama_kegiatan ?? 1,
        pembebanan_anggaran: existingSPT.pembebanan_anggaran ?? '',
        mata_anggaran_id: existingSPT.mata_anggaran_id,
        catatan: existingSPT.catatan ?? '',
        pegawai_ids: pegawaiIds,
      });
    }
  }, [existingSPT, reset, navigate]);

  // Auto-populate instansi default
  useEffect(() => {
    if (!isEdit && instansiList.length > 0 && !watchedValues.instansi_id) {
      const primary = instansiList.find(i => i.is_primary) ?? instansiList[0];
      if (primary) setValue('instansi_id', primary.id);
    }
  }, [instansiList, isEdit, watchedValues.instansi_id, setValue]);

  // Auto-populate tempat penetapan
  useEffect(() => {
    const instansi = instansiList.find(i => i.id === watchedValues.instansi_id);
    if (instansi) {
      const defaultValue = instansi.ibu_kota || instansi.kabupaten_kota || '';
      const currentVal = (watchedValues.tempat_penetapan || '').trim().toLowerCase();
      const countyVal = (instansi.kabupaten_kota || '').trim().toLowerCase();
      
      // Force change ONLY if currently empty or matches the old county name (case-insensitive)
      if (!currentVal || currentVal === countyVal) {
        if (watchedValues.tempat_penetapan !== defaultValue) {
          setValue('tempat_penetapan', defaultValue);
        }
      }
    }
  }, [watchedValues.instansi_id, instansiList, setValue]);

  // ── Auto-Save every 30s ──────────────────────────────────────
  const performAutoSave = useCallback(async () => {
    if (!tenantId) return;
    const vals = getValues();
    const valStr = JSON.stringify(vals);
    if (valStr === lastSavedRef.current) return; // no change

    setAutoSaveStatus('saving');
    try {
      const payload = buildPayload(vals, tenantId, 'Draft');
      if (isEdit && id) {
        await supabase.from('spt').update(payload).eq('id', Number(id));
      } else {
        const { data } = await supabase.from('spt').insert(payload).select('id').single();
        if (data?.id) {
          // save pegawai relations for new draft
          await upsertSPTPegawai(data.id, vals.pegawai_ids);
        }
      }
      lastSavedRef.current = valStr;
      setAutoSaveStatus('saved');
    } catch {
      setAutoSaveStatus('unsaved');
    }
  }, [tenantId, isEdit, id, getValues]);

  useEffect(() => {
    if (!isDirty) return;
    setAutoSaveStatus('unsaved');
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(performAutoSave, 30_000);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [watchedValues, isDirty, performAutoSave]);

  // ── Mutations ────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async ({ data, status }: { data: SPTFormData; status: 'Draft' | 'Final' }) => {
      if (!tenantId) throw new Error('No tenant');

      if (status === 'Final') {
        // Get next document number
        const { data: numData, error: numError } = await supabase.rpc(
          'get_next_document_number',
          { p_tenant_id: tenantId, p_jenis: 'SPT' }
        );
        if (numError) throw new Error('Gagal mendapatkan nomor dokumen: ' + numError.message);

        const payload = buildPayload(data, tenantId, 'Final');
        payload.nomor_spt = numData as string;
        payload.finalized_at = new Date().toISOString();

        if (isEdit && id) {
          const { error } = await supabase.from('spt').update(payload).eq('id', Number(id));
          if (error) throw error;
          await upsertSPTPegawai(Number(id), data.pegawai_ids);
          return Number(id);
        } else {
          const { data: inserted, error } = await supabase
            .from('spt').insert(payload).select('id').single();
          if (error) throw error;
          await upsertSPTPegawai(inserted.id, data.pegawai_ids);
          return inserted.id as number;
        }
      } else {
        const payload = buildPayload(data, tenantId, 'Draft');
        if (isEdit && id) {
          const { error } = await supabase.from('spt').update(payload).eq('id', Number(id));
          if (error) throw error;
          await upsertSPTPegawai(Number(id), data.pegawai_ids);
          return Number(id);
        } else {
          const { data: inserted, error } = await supabase
            .from('spt').insert(payload).select('id').single();
          if (error) throw error;
          await upsertSPTPegawai(inserted.id, data.pegawai_ids);
          return inserted.id as number;
        }
      }
    },
    onSuccess: (sptId, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['spt-list'] });
      queryClient.invalidateQueries({ queryKey: ['spt-status-counts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      lastSavedRef.current = JSON.stringify(getValues());
      setAutoSaveStatus('saved');
      if (status === 'Final') {
        toast.success('SPT berhasil difinalisasi!');
        navigate(`/spt/${sptId}`);
      } else {
        toast.success('Draft SPT berhasil disimpan.');
      }
    },
    onError: (e: Error) => {
      toast.error(`Gagal menyimpan: ${e.message}`);
    },
  });

  const handleSaveDraft: SubmitHandler<SPTFormData> = (data) => {
    saveMutation.mutate({ data, status: 'Draft' });
  };

  const handleFinalize: SubmitHandler<SPTFormData> = async (data) => {
    // Business rule: signer must have periode_selesai > tanggal_penetapan
    const signer = penandatanganList.find(p => p.id === data.penandatangan_id);
    if (signer?.periode_selesai) {
      const signerEnd = new Date(signer.periode_selesai);
      const penetapan = new Date(data.tanggal_penetapan);
      if (signerEnd < penetapan) {
        toast.error('Periode penandatangan sudah berakhir sebelum tanggal penetapan.');
        return;
      }
    }
    saveMutation.mutate({ data, status: 'Final' });
  };

  // ── Drag & Drop for dasar_perintah ──────────────────────────
  const dasSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDasarDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = dasarFields.findIndex(f => f.id === active.id);
      const newIdx = dasarFields.findIndex(f => f.id === over.id);
      if (oldIdx !== -1 && newIdx !== -1) moveDasar(oldIdx, newIdx);
    }
  };

  // ── Pegawai drag & drop ──────────────────────────────────────
  const pegawaiSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const pegawaiIds = watchedValues.pegawai_ids ?? [];
  const selectedPegawai = pegawaiIds
    .map(pid => pegawaiList.find(p => p.id === pid))
    .filter(Boolean) as Pegawai[];

  const handlePegawaiDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = pegawaiIds.indexOf(Number(active.id));
      const newIdx = pegawaiIds.indexOf(Number(over.id));
      if (oldIdx !== -1 && newIdx !== -1) {
        setValue('pegawai_ids', arrayMove(pegawaiIds, oldIdx, newIdx), { shouldDirty: true });
      }
    }
  };

  const handleAddPegawai = (pid: number) => {
    if (pegawaiIds.length >= 10) {
      toast.warning('Maksimal 10 pegawai per SPT.');
      return;
    }
    if (!pegawaiIds.includes(pid)) {
      setValue('pegawai_ids', [...pegawaiIds, pid], { shouldDirty: true });
    }
  };

  const handleRemovePegawai = (pid: number) => {
    setValue('pegawai_ids', pegawaiIds.filter(id => id !== pid), { shouldDirty: true });
  };

  // ── Tujuan kegiatan helpers ──────────────────────────────────
  const tujuanValues = watchedValues.tujuan_kegiatan ?? [''];

  const handleAddTujuan = () => {
    setValue('tujuan_kegiatan', [...tujuanValues, ''], { shouldDirty: true });
  };

  const handleUpdateTujuan = (idx: number, val: string) => {
    const next = [...tujuanValues];
    next[idx] = val;
    setValue('tujuan_kegiatan', next, { shouldDirty: true });
  };

  const handleRemoveTujuan = (idx: number) => {
    const next = tujuanValues.filter((_, i) => i !== idx);
    setValue('tujuan_kegiatan', next.length ? next : [''], { shouldDirty: true });
  };

  // ── Dasar perintah helpers ──────────────────────────────────

  // ── Step validation ──────────────────────────────────────────
  const validateAndGoNext = async () => {
    let fields: Array<keyof SPTFormData> = [];
    if (currentStep === 1) fields = ['tanggal_penetapan', 'tempat_penetapan', 'instansi_id', 'penandatangan_id'];
    if (currentStep === 2) fields = ['dasar_perintah', 'tujuan_kegiatan', 'lama_kegiatan'];
    if (currentStep === 3) fields = ['pegawai_ids'];

    const ok = await trigger(fields);
    if (ok) {
      setCompletedSteps(prev => new Set([...prev, currentStep]));
      if (currentStep < 3) setCurrentStep(s => (s + 1) as Step);
    }
  };

  // ── Derived values ───────────────────────────────────────────
  const selectedInstansi = (instansiList ?? []).find(i => i.id === watchedValues.instansi_id);
  const selectedPenandatangan = (penandatanganList ?? []).find(
    p => p.id === watchedValues.penandatangan_id
  );

  // Filter penandatangan to SPT-compatible only
  const sptPenandatangan = (penandatanganList ?? []).filter(
    p => !p.jenis_dokumen || p.jenis_dokumen.includes('SPT')
  );

  // Max date: 30 days from today
  const maxTanggal = format(addDays(new Date(), 30), 'yyyy-MM-dd');

  // Pegawai search results
  const searchedPegawai = pegawaiList.filter(p => {
    if (pegawaiIds.includes(p.id)) return false;
    const q = pegawaiSearch.toLowerCase();
    return (
      p.nama_lengkap.toLowerCase().includes(q) ||
      p.nip.includes(q) ||
      p.jabatan.toLowerCase().includes(q)
    );
  }).slice(0, 8);

  if (existingLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="page-enter max-w-screen-xl mx-auto pt-8 px-4 pb-12">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="premium-header mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="btn bg-white/80 hover:bg-white text-slate-600 w-12 h-12 rounded-2xl shadow-sm border border-slate-200/50 flex items-center justify-center transition-all active:scale-95"
              onClick={() => navigate('/spt')}
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                <Link to="/spt" className="hover:text-blue-500 transition-colors">Surat Perintah Tugas</Link>
                <ChevronRight size={10} className="text-slate-300" />
                <span className="text-blue-500">{isEdit ? `Dokumen #${id}` : 'Proses Baru'}</span>
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                {isEdit ? 'Edit Surat Perintah Tugas' : 'Buat Surat Perintah Tugas'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end mr-2 hidden sm:flex">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {autoSaveStatus === 'saving' ? (
                  <><Loader2 size={10} className="animate-spin text-blue-400" /> Menyimpan...</>
                ) : autoSaveStatus === 'saved' ? (
                  <><CheckCircle size={10} className="text-emerald-500" /> Tersimpan Otomatis</>
                ) : (
                  <><Clock size={10} className="text-amber-500" /> Belum Disimpan</>
                )}
              </div>
              <p className="text-[9px] text-slate-300 mt-0.5">Sinkronisasi Real-time Aktif</p>
            </div>
            
            <button
              type="button"
              className="btn btn-secondary px-6"
              onClick={handleSubmit(handleSaveDraft)}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending && saveMutation.variables?.status === 'Draft'
                ? <Loader2 size={16} className="animate-spin" />
                : <Save size={16} />
              }
              Draft
            </button>
            <button
              type="button"
              className="btn btn-primary px-8 shadow-blue-500/25"
              onClick={handleSubmit(handleFinalize)}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending && saveMutation.variables?.status === 'Final'
                ? <Loader2 size={16} className="animate-spin" />
                : <CheckCircle size={16} />
              }
              Finalisasi
            </button>
          </div>
        </div>
      </div>

      {/* ── Two-panel layout ─────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-start">

        {/* ── Left: Form ────────────────────────────────────── */}
        <div>
          <Stepper
            current={currentStep}
            completedSteps={completedSteps}
            onChange={setCurrentStep}
          />

          {/* Step 1 — Identitas */}
          {currentStep === 1 && (
            <div className="card card-body space-y-5 fade-in">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FileText size={17} className="text-blue-500" /> Identitas Dokumen
              </h2>

              {/* ── Kop Surat Selector ────────────────────────────── */}
              <div className="form-group">
                <label className="form-label">
                  Kop Surat <span className="required-mark">*</span>
                </label>
                <p className="form-hint mb-2">Pilih sesuai pejabat yang menandatangani SPT.</p>
                <Controller
                  control={control}
                  name="kop_surat"
                  render={({ field }) => (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {([
                        {
                          value: 'skpd' as KopSurat,
                          icon: '🏢',
                          title: 'Kop SKPD',
                          desc: 'Dinas / Badan / Kantor — ditandatangani Kepala SKPD',
                          color: 'border-blue-400 bg-blue-50 ring-blue-400',
                          inactive: 'border-slate-200 hover:border-blue-200 hover:bg-blue-50/50',
                        },
                        {
                          value: 'bupati' as KopSurat,
                          icon: '👑',
                          title: 'Kop Bupati / Walikota',
                          desc: 'Ditetapkan langsung oleh Bupati / Walikota',
                          color: 'border-amber-400 bg-amber-50 ring-amber-400',
                          inactive: 'border-slate-200 hover:border-amber-200 hover:bg-amber-50/50',
                        },
                        {
                          value: 'sekda' as KopSurat,
                          icon: '🏛️',
                          title: 'Kop Sekretariat Daerah',
                          desc: 'Atas nama Sekretaris Daerah',
                          color: 'border-violet-400 bg-violet-50 ring-violet-400',
                          inactive: 'border-slate-200 hover:border-violet-200 hover:bg-violet-50/50',
                        },
                      ] as const).map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => field.onChange(opt.value)}
                          className={`text-left p-4 rounded-xl border-2 transition-all ${
                            field.value === opt.value
                              ? opt.color + ' ring-2 ring-offset-2'
                              : opt.inactive + ' bg-white'
                          }`}
                        >
                          <div className="text-2xl mb-1">{opt.icon}</div>
                          <p className="text-sm font-bold text-slate-800">{opt.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-snug">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  )}
                />
                {/* Info box — muncul saat kop bukan SKPD dan instansi belum dikonfigurasi */}
                {watch('kop_surat') !== 'skpd' && (() => {
                  const sel = instansiList.find(i => i.id === watch('instansi_id'));
                  const needsConfig = watch('kop_surat') === 'bupati'
                    ? !sel?.jabatan_kepala_daerah
                    : !sel?.alamat_sekda && !sel?.telepon_sekda;
                  return needsConfig ? (
                    <div className="alert alert-warning mt-2 text-xs">
                      ⚠️ Konfigurasi kop {watch('kop_surat') === 'bupati' ? 'Bupati' : 'Sekda'} belum diatur.{' '}
                      <a href="/settings" className="underline font-semibold">Lengkapi di Pengaturan → Institusi</a>
                    </div>
                  ) : null;
                })()}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">
                    Tanggal Penetapan <span className="required-mark">*</span>
                  </label>
                  <input
                    type="date"
                    className={`form-input ${errors.tanggal_penetapan ? 'is-error' : ''}`}
                    max={maxTanggal}
                    {...register('tanggal_penetapan')}
                  />
                  {errors.tanggal_penetapan && (
                    <p className="form-error"><AlertTriangle size={12} />{errors.tanggal_penetapan.message}</p>
                  )}
                  <p className="form-hint">Maksimal 30 hari ke depan dari hari ini.</p>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Tempat Penetapan <span className="required-mark">*</span>
                  </label>
                  <input
                    type="text"
                    className={`form-input ${errors.tempat_penetapan ? 'is-error' : ''}`}
                    placeholder="Contoh: Kota Bandung"
                    {...register('tempat_penetapan')}
                  />
                  {errors.tempat_penetapan && (
                    <p className="form-error"><AlertTriangle size={12} />{errors.tempat_penetapan.message}</p>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Instansi <span className="required-mark">*</span>
                </label>
                <Controller
                  control={control}
                  name="instansi_id"
                  render={({ field }) => (
                    <select
                      className={`form-select ${errors.instansi_id ? 'is-error' : ''}`}
                      value={field.value || ''}
                      onChange={e => field.onChange(Number(e.target.value))}
                    >
                      <option value="">— Pilih Instansi —</option>
                      {instansiList.map(i => (
                        <option key={i.id} value={i.id}>{i.nama_lengkap}</option>
                      ))}
                    </select>
                  )}
                />
                {errors.instansi_id && (
                  <p className="form-error"><AlertTriangle size={12} />{errors.instansi_id.message}</p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">
                  Penandatangan <span className="required-mark">*</span>
                </label>
                <Controller
                  control={control}
                  name="penandatangan_id"
                  render={({ field }) => (
                    <select
                      className={`form-select ${errors.penandatangan_id ? 'is-error' : ''}`}
                      value={field.value || ''}
                      onChange={e => field.onChange(Number(e.target.value))}
                    >
                      <option value="">— Pilih Penandatangan —</option>
                      {sptPenandatangan.map(p => {
                        const expired = p.periode_selesai
                          ? new Date(p.periode_selesai) < new Date()
                          : false;
                        return (
                          <option key={p.id} value={p.id} disabled={expired}>
                            {p.nama_lengkap} — {p.jabatan}
                            {expired ? ' (Periode berakhir)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  )}
                />
                {errors.penandatangan_id && (
                  <p className="form-error"><AlertTriangle size={12} />{errors.penandatangan_id.message}</p>
                )}
                {selectedPenandatangan?.periode_selesai && (
                  <p className="form-hint">
                    Periode aktif hingga{' '}
                    {format(new Date(selectedPenandatangan.periode_selesai), 'dd MMM yyyy', { locale: localeID })}
                  </p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button type="button" className="btn btn-primary" onClick={validateAndGoNext}>
                  Lanjut <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Dasar & Tujuan */}
          {currentStep === 2 && (
            <div className="space-y-5 fade-in">
              {/* Dasar Perintah */}
              <div className="card card-body">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
                  <Pen size={17} className="text-blue-500" /> Dasar Perintah
                </h2>
                {errors.dasar_perintah && typeof errors.dasar_perintah?.message === 'string' && (
                  <p className="form-error mb-3">
                    <AlertTriangle size={12} />{errors.dasar_perintah.message}
                  </p>
                )}

                <DndContext
                  sensors={dasSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDasarDragEnd}
                >
                  <SortableContext
                    items={dasarFields.map(f => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {dasarFields.map((field, idx) => (
                        <SortableDasarItem
                          key={field.id}
                          item={field}
                          index={idx}
                          register={register}
                          setValue={setValue}
                          onRemove={idx2 => removeDasar(idx2)}
                          errors={errors.dasar_perintah?.[idx]}
                          canRemove={dasarFields.length > 1}
                          currentJenis={watchedValues.dasar_perintah?.[idx]?.jenis || 'surat'}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                <button
                  type="button"
                  className="w-full mt-3 py-2.5 border-2 border-dashed border-slate-200 rounded-xl
                             text-sm font-semibold text-slate-400 hover:border-blue-400 hover:text-blue-500
                             hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                  onClick={() => appendDasar({ id: crypto.randomUUID(), jenis: 'surat' as JenisDasarPerintah, nomor: '', tanggal: '', perihal: '' })}
                >
                  <Plus size={15} /> Tambah Dasar Perintah
                </button>
              </div>

              {/* Tujuan Kegiatan */}
              <div className="card card-body">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
                  <Target size={17} className="text-blue-500" /> Tujuan Kegiatan
                </h2>
                {errors.tujuan_kegiatan?.message && (
                  <p className="form-error mb-3">
                    <AlertTriangle size={12} />{errors.tujuan_kegiatan.message as string}
                  </p>
                )}

                <div className="space-y-2">
                  {tujuanValues.map((t, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold
                                      flex items-center justify-center flex-shrink-0 mt-3">
                        {idx + 1}
                      </div>
                      <textarea
                        className={`form-textarea flex-1 text-sm ${
                          Array.isArray(errors.tujuan_kegiatan) && errors.tujuan_kegiatan[idx]
                            ? 'is-error' : ''
                        }`}
                        rows={2}
                        placeholder="Contoh: Melaksanakan koordinasi teknis pengelolaan keuangan daerah…"
                        value={t}
                        onChange={e => handleUpdateTujuan(idx, e.target.value)}
                      />
                      {tujuanValues.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm p-1.5 text-rose-400 hover:bg-rose-50 mt-1.5"
                          onClick={() => handleRemoveTujuan(idx)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="w-full mt-3 py-2.5 border-2 border-dashed border-slate-200 rounded-xl
                             text-sm font-semibold text-slate-400 hover:border-blue-400 hover:text-blue-500
                             hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                  onClick={handleAddTujuan}
                >
                  <Plus size={15} /> Tambah Tujuan
                </button>
              </div>

              {/* Lama & Anggaran */}
              <div className="card card-body">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">
                      Lama Kegiatan (hari) <span className="required-mark">*</span>
                    </label>
                    <input
                      type="number"
                      className={`form-input ${errors.lama_kegiatan ? 'is-error' : ''}`}
                      min={1}
                      max={365}
                      {...register('lama_kegiatan', { valueAsNumber: true })}
                    />
                    {errors.lama_kegiatan && (
                      <p className="form-error">
                        <AlertTriangle size={12} />{errors.lama_kegiatan.message}
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Pembebanan Anggaran</label>
                    {mataAnggaranList.length > 0 ? (
                      <Controller
                        control={control}
                        name="mata_anggaran_id"
                        render={({ field }) => (
                          <select
                            className="form-select"
                            value={field.value ?? ''}
                            onChange={e => {
                              const val = e.target.value ? Number(e.target.value) : undefined;
                              field.onChange(val);
                              const ma = mataAnggaranList.find(m => m.id === val);
                              if (ma) setValue('pembebanan_anggaran', `${ma.kode} — ${ma.nama}`);
                            }}
                          >
                            <option value="">— Pilih atau isi manual —</option>
                            {mataAnggaranList.map(ma => (
                              <option key={ma.id} value={ma.id}>
                                {ma.kode} — {ma.nama}
                              </option>
                            ))}
                          </select>
                        )}
                      />
                    ) : (
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Contoh: APBD TA 2025"
                        {...register('pembebanan_anggaran')}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button type="button" className="btn btn-secondary" onClick={() => setCurrentStep(1)}>
                  <ArrowLeft size={15} /> Kembali
                </button>
                <button type="button" className="btn btn-primary" onClick={validateAndGoNext}>
                  Lanjut <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Pelaksana */}
          {currentStep === 3 && (
            <div className="space-y-5 fade-in">
              <div className="card card-body">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Users size={17} className="text-blue-500" /> Pegawai Pelaksana
                  </h2>
                  <span className={`badge ${pegawaiIds.length >= 10 ? 'badge-red' : 'badge-blue'}`}>
                    {pegawaiIds.length}/10
                  </span>
                </div>

                {errors.pegawai_ids && (
                  <div className="alert alert-warning mb-4">
                    <AlertTriangle size={16} className="flex-shrink-0" />
                    <span>{errors.pegawai_ids.message}</span>
                  </div>
                )}

                {/* Pegawai search */}
                <div className="search-wrap mb-3">
                  <Search size={15} className="search-icon" />
                  <input
                    type="text"
                    className="search-input text-sm"
                    placeholder="Cari nama, NIP, atau jabatan…"
                    value={pegawaiSearch}
                    onChange={e => setPegawaiSearch(e.target.value)}
                    disabled={pegawaiIds.length >= 10}
                  />
                  {pegawaiSearch && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      onClick={() => setPegawaiSearch('')}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Search results */}
                {pegawaiSearch && searchedPegawai.length > 0 && (
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 mb-3 bg-white shadow-sm">
                    {searchedPegawai.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-blue-50 transition-colors first:rounded-t-xl last:rounded-b-xl"
                        onClick={() => { handleAddPegawai(p.id); setPegawaiSearch(''); }}
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-xs font-bold
                                        flex items-center justify-center flex-shrink-0">
                          {p.nama_lengkap.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{p.nama_lengkap}</p>
                          <p className="text-xs text-slate-400 truncate">
                            NIP {p.nip} · {p.jabatan}
                            {p.ref_pangkat && ` · ${p.ref_pangkat.nama}`}
                            {p.ref_golongan && `/${p.ref_golongan.nama}`}
                          </p>
                        </div>
                        <Plus size={16} className="text-blue-500 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
                {pegawaiSearch && searchedPegawai.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-3 mb-3">Tidak ada pegawai ditemukan.</p>
                )}

                {/* Selected pegawai list — sortable */}
                {pegawaiIds.length === 0 ? (
                  <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
                    <Users size={32} className="mx-auto text-slate-200 mb-2" />
                    <p className="text-sm text-slate-400">Belum ada pegawai dipilih.</p>
                    <p className="text-xs text-slate-400 mt-1">Cari dan tambahkan pegawai di atas.</p>
                  </div>
                ) : (
                  <DndContext
                    sensors={pegawaiSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handlePegawaiDragEnd}
                  >
                    <SortableContext
                      items={pegawaiIds.map(id => String(id))}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {selectedPegawai.map((p, idx) => (
                          <SortablePegawaiItem
                            key={p.id}
                            dragId={String(p.id)}
                            pegawai={p}
                            urutan={idx + 1}
                            onRemove={() => handleRemovePegawai(p.id)}
                            hasWarning={recentSPTByPegawai[p.id]}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}

                {pegawaiIds.some(id => recentSPTByPegawai[id]) && (
                  <div className="alert alert-warning mt-3">
                    <AlertTriangle size={15} className="flex-shrink-0" />
                    <span className="text-xs">
                      Beberapa pegawai memiliki SPT dalam 7 hari terakhir. Pastikan tidak ada penugasan bertumpuk.
                    </span>
                  </div>
                )}
              </div>

              {/* Catatan */}
              <div className="card card-body">
                <div className="form-group">
                  <label className="form-label flex items-center gap-1.5">
                    <Info size={14} className="text-slate-400" /> Catatan Internal
                  </label>
                  <textarea
                    className="form-textarea text-sm"
                    rows={3}
                    placeholder="Catatan internal (tidak dicetak pada dokumen)…"
                    {...register('catatan')}
                  />
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button type="button" className="btn btn-secondary" onClick={() => setCurrentStep(2)}>
                  <ArrowLeft size={15} /> Kembali
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleSubmit(handleSaveDraft)}
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending && saveMutation.variables?.status === 'Draft'
                      ? <Loader2 size={15} className="animate-spin" />
                      : <Save size={15} />
                    }
                    Simpan Draft
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSubmit(handleFinalize)}
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending && saveMutation.variables?.status === 'Final'
                      ? <Loader2 size={15} className="animate-spin" />
                      : <CheckCircle size={15} />
                    }
                    Finalisasi SPT
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Preview Panel ─────────────────────────── */}
        <div className="sticky top-6">
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-slate-400" />
                <span className="text-sm font-bold text-slate-700">Pratinjau Dokumen</span>
              </div>
              <span className="badge badge-yellow text-[10px]">DRAFT</span>
            </div>
            <div className="card-body p-0">
              <SPTPreviewPanel
                formValues={watchedValues as SPTFormData}
                instansi={selectedInstansi}
                penandatangan={selectedPenandatangan}
                selectedPegawai={selectedPegawai}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =================================================================
// HELPERS
// =================================================================
function buildPayload(
  data: SPTFormData,
  tenantId: string,
  status: 'Draft' | 'Final'
): Record<string, unknown> {
  return {
    tenant_id: tenantId,
    tanggal_penetapan: data.tanggal_penetapan,
    tempat_penetapan: data.tempat_penetapan,
    kop_surat: data.kop_surat,
    instansi_id: data.instansi_id || null,
    penandatangan_id: data.penandatangan_id || null,
    dasar_perintah: data.dasar_perintah,
    tujuan_kegiatan: data.tujuan_kegiatan.filter(t => t.trim()),
    lama_kegiatan: data.lama_kegiatan,
    pembebanan_anggaran: data.pembebanan_anggaran || null,
    mata_anggaran_id: data.mata_anggaran_id || null,
    catatan: data.catatan || null,
    status,
    updated_at: new Date().toISOString(),
  };
}

async function upsertSPTPegawai(sptId: number, pegawaiIds: number[]): Promise<void> {
  // Delete old entries
  await supabase.from('spt_pegawai').delete().eq('spt_id', sptId);
  if (pegawaiIds.length === 0) return;

  const rows = pegawaiIds.map((pid, idx) => ({
    spt_id: sptId,
    pegawai_id: pid,
    urutan: idx + 1,
  }));
  const { error } = await supabase.from('spt_pegawai').insert(rows);
  if (error) throw error;
}

export default SPTForm;
