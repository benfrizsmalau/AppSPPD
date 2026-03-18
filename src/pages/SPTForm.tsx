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
} from '../types';

// =================================================================
// ZOD SCHEMA
// =================================================================
const dasarPerintahSchema = z.object({
  id: z.string(),
  nomor: z.string().min(1, 'Nomor dasar wajib diisi'),
  tanggal: z.string().min(1, 'Tanggal dasar wajib diisi'),
  perihal: z.string().min(1, 'Perihal wajib diisi'),
});

const sptSchema = z.object({
  tanggal_penetapan: z.string().min(1, 'Tanggal penetapan wajib diisi'),
  tempat_penetapan: z.string().min(1, 'Tempat penetapan wajib diisi'),
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
  <div className="stepper mb-8">
    {STEPS.map((s, i) => {
      const done = completedSteps.has(s.step);
      const active = current === s.step;
      return (
        <React.Fragment key={s.step}>
          <button
            type="button"
            className="flex items-center gap-2 group"
            onClick={() => onChange(s.step)}
          >
            <div className={`step-dot ${done ? 'done' : active ? 'active' : 'todo'}`}>
              {done ? <CheckCircle size={14} /> : s.step}
            </div>
            <span className={`text-xs font-semibold hidden sm:block transition-colors
              ${active ? 'text-blue-600' : done ? 'text-emerald-600' : 'text-slate-400'}`}>
              {s.label}
            </span>
          </button>
          {i < STEPS.length - 1 && (
            <div className={`step-line ${done ? 'done' : ''}`} />
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
  item: DasarPerintah & { _id: string };
  index: number;
  onUpdate: (index: number, field: keyof DasarPerintah, val: string) => void;
  onRemove: (index: number) => void;
  errors?: Partial<Record<keyof DasarPerintah, { message?: string }>>;
  canRemove: boolean;
}

const SortableDasarItem: React.FC<SortableDasarProps> = ({
  item, index, onUpdate, onRemove, errors, canRemove,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item._id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

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

      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="form-group">
          <label className="form-label text-xs">Nomor <span className="required-mark">*</span></label>
          <input
            className={`form-input text-sm ${errors?.nomor ? 'is-error' : ''}`}
            placeholder="Nomor surat"
            value={item.nomor}
            onChange={e => onUpdate(index, 'nomor', e.target.value)}
          />
          {errors?.nomor && <p className="form-error">{errors.nomor.message}</p>}
        </div>
        <div className="form-group">
          <label className="form-label text-xs">Tanggal <span className="required-mark">*</span></label>
          <input
            type="date"
            className={`form-input text-sm ${errors?.tanggal ? 'is-error' : ''}`}
            value={item.tanggal}
            onChange={e => onUpdate(index, 'tanggal', e.target.value)}
          />
          {errors?.tanggal && <p className="form-error">{errors.tanggal.message}</p>}
        </div>
        <div className="form-group">
          <label className="form-label text-xs">Perihal <span className="required-mark">*</span></label>
          <input
            className={`form-input text-sm ${errors?.perihal ? 'is-error' : ''}`}
            placeholder="Perihal surat"
            value={item.perihal}
            onChange={e => onUpdate(index, 'perihal', e.target.value)}
          />
          {errors?.perihal && <p className="form-error">{errors.perihal.message}</p>}
        </div>
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
        <p className="font-bold text-sm uppercase tracking-wide">
          {instansi?.nama_lengkap ?? 'NAMA INSTANSI'}
        </p>
        <p className="text-[11px] text-slate-500">{instansi?.alamat ?? 'Alamat Instansi'}</p>
        {instansi?.telepon && <p className="text-[11px] text-slate-500">Telp. {instansi.telepon}</p>}
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
          <ol className="list-decimal list-inside space-y-0.5 text-slate-600">
            {formValues.dasar_perintah.map((d, i) => (
              <li key={i}>
                {d.nomor} tanggal {d.tanggal ? format(new Date(d.tanggal), 'dd MMM yyyy', { locale: localeID }) : '—'} tentang {d.perihal}
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
                  <td className="py-0.5 w-6">{i + 1}.</td>
                  <td className="py-0.5 font-semibold">{p.nama_lengkap}</td>
                  <td className="py-0.5 text-slate-500">{p.jabatan}</td>
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
          <ol className="list-decimal list-inside space-y-0.5 text-slate-600">
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
      <div className="mt-6 text-right">
        <p>Ditetapkan di {formValues.tempat_penetapan || '____________'}</p>
        <p>Pada tanggal {today}</p>
        <div className="h-16" />
        <p className="font-semibold">{penandatangan?.nama_lengkap ?? '____________________'}</p>
        <p className="text-slate-500">{penandatangan?.jabatan ?? 'Jabatan Penandatangan'}</p>
        {penandatangan?.nip && <p className="text-slate-400">NIP. {penandatangan.nip}</p>}
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
    instansi_id: 0,
    penandatangan_id: 0,
    dasar_perintah: [{ id: crypto.randomUUID(), nomor: '', tanggal: '', perihal: '' }],
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
            nomor: (d as DasarPerintah).nomor ?? '',
            tanggal: (d as DasarPerintah).tanggal ?? '',
            perihal: (d as DasarPerintah).perihal ?? '',
          }))
        : [{ id: crypto.randomUUID(), nomor: '', tanggal: '', perihal: '' }];

      reset({
        tanggal_penetapan: existingSPT.tanggal_penetapan,
        tempat_penetapan: existingSPT.tempat_penetapan,
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
    if (!isEdit && !watchedValues.tempat_penetapan) {
      const instansi = instansiList.find(i => i.id === watchedValues.instansi_id);
      if (instansi?.kabupaten_kota) setValue('tempat_penetapan', instansi.kabupaten_kota);
    }
  }, [watchedValues.instansi_id, instansiList, isEdit, watchedValues.tempat_penetapan, setValue]);

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
  const handleUpdateDasar = (idx: number, field: keyof DasarPerintah, val: string) => {
    const current = getValues('dasar_perintah');
    const next = [...current];
    next[idx] = { ...next[idx], [field]: val };
    setValue('dasar_perintah', next, { shouldDirty: true });
  };

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
  const selectedInstansi = instansiList.find(i => i.id === watchedValues.instansi_id);
  const selectedPenandatangan = penandatanganList.find(
    p => p.id === watchedValues.penandatangan_id
  );

  // Filter penandatangan to SPT-compatible only
  const sptPenandatangan = penandatanganList.filter(
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
    <div className="page-enter max-w-screen-xl mx-auto">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-6">
        <button
          type="button"
          className="btn btn-secondary btn-sm p-2"
          onClick={() => navigate('/spt')}
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-0.5">
            <Link to="/spt" className="hover:text-blue-600">SPT</Link>
            <ChevronRight size={12} />
            <span className="text-slate-600">{isEdit ? `Edit SPT #${id}` : 'Buat SPT Baru'}</span>
          </div>
          <h1 className="page-title">{isEdit ? 'Edit Surat Perintah Tugas' : 'Buat Surat Perintah Tugas'}</h1>
        </div>

        {/* Auto-save indicator */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          {autoSaveStatus === 'saving' && (
            <>
              <Loader2 size={12} className="animate-spin text-blue-400" />
              <span>Menyimpan…</span>
            </>
          )}
          {autoSaveStatus === 'saved' && isDirty && (
            <>
              <CheckCircle size={12} className="text-emerald-400" />
              <span className="text-emerald-500">Tersimpan otomatis</span>
            </>
          )}
          {autoSaveStatus === 'unsaved' && (
            <>
              <Clock size={12} className="text-amber-400" />
              <span className="text-amber-500">Belum disimpan</span>
            </>
          )}
        </div>

        {/* Action buttons */}
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
            Finalisasi
          </button>
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
                          item={{ ...field, _id: field.id }}
                          index={idx}
                          onUpdate={handleUpdateDasar}
                          onRemove={idx2 => removeDasar(idx2)}
                          errors={errors.dasar_perintah?.[idx] as Record<keyof DasarPerintah, { message?: string }> | undefined}
                          canRemove={dasarFields.length > 1}
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
                  onClick={() => appendDasar({ id: crypto.randomUUID(), nomor: '', tanggal: '', perihal: '' })}
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
