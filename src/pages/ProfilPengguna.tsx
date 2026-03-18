import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  User, Lock, Bell, Shield, Camera, Eye, EyeOff,
  Mail, Phone, Briefcase, AlertTriangle, X, CheckCircle2,
  Clock, Loader2, Globe,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { getInitials, formatDatetime } from '../lib/utils';
import type { AuditLog } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
const profileSchema = z.object({
  nama_lengkap: z.string().min(3, 'Nama minimal 3 karakter'),
  username: z.string().min(3, 'Username minimal 3 karakter').regex(/^[a-z0-9_]+$/, 'Hanya huruf kecil, angka, dan underscore').optional().or(z.literal('')),
  telepon: z.string().optional(),
});

const passwordSchema = z.object({
  new_pass: z.string().min(8, 'Password minimal 8 karakter'),
  confirm: z.string(),
}).refine(d => d.new_pass === d.confirm, { message: 'Password tidak cocok', path: ['confirm'] });

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  Admin: 'Administrator',
  Operator: 'Operator',
  Pejabat: 'Pejabat',
  Pegawai: 'Pegawai',
};
const ROLE_COLORS: Record<string, string> = {
  Admin: 'badge-blue',
  Operator: 'badge-green',
  Pejabat: 'badge-violet',
  Pegawai: 'badge-slate',
};

const TABS = [
  { id: 'profil', label: 'Profil', icon: User },
  { id: 'keamanan', label: 'Keamanan', icon: Lock },
  { id: 'preferensi', label: 'Preferensi', icon: Bell },
  { id: 'riwayat', label: 'Riwayat Login', icon: Clock },
  { id: 'bahaya', label: 'Danger Zone', icon: Shield, danger: true },
];

const TIMEZONES = [
  { value: 'WIB', label: 'WIB — Waktu Indonesia Barat (UTC+7)' },
  { value: 'WITA', label: 'WITA — Waktu Indonesia Tengah (UTC+8)' },
  { value: 'WIT', label: 'WIT — Waktu Indonesia Timur (UTC+9)' },
];

// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD STRENGTH
// ─────────────────────────────────────────────────────────────────────────────
function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Sangat Lemah', color: 'bg-rose-500' };
  if (score === 2) return { score, label: 'Lemah', color: 'bg-orange-400' };
  if (score === 3) return { score, label: 'Cukup', color: 'bg-amber-400' };
  if (score === 4) return { score, label: 'Kuat', color: 'bg-emerald-400' };
  return { score, label: 'Sangat Kuat', color: 'bg-emerald-600' };
}

// ─────────────────────────────────────────────────────────────────────────────
// AVATAR COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
interface AvatarProps {
  name: string | null | undefined;
  avatarUrl: string | null | undefined;
  size?: number;
}
function Avatar({ name, avatarUrl, size = 64 }: AvatarProps) {
  return (
    <div
      className="rounded-2xl flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: avatarUrl ? undefined : 'linear-gradient(135deg, #2563EB, #06B6D4)',
        fontSize: size / 3,
      }}
    >
      {avatarUrl
        ? <img src={avatarUrl} alt={name || ''} className="w-full h-full object-cover" />
        : getInitials(name)
      }
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM MODAL
// ─────────────────────────────────────────────────────────────────────────────
interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  danger?: boolean;
  isLoading?: boolean;
}
function ConfirmModal({ open, title, message, confirmLabel = 'Konfirmasi', onConfirm, onClose, danger, isLoading }: ConfirmModalProps) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title flex items-center gap-2">
            {danger && <AlertTriangle size={18} className="text-rose-500" />}
            {title}
          </h3>
          <button className="btn btn-ghost btn-icon-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <p className="text-sm text-slate-600">{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? <><Loader2 size={14} className="animate-spin" /> Memproses...</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfilPengguna() {
  const { profile, user, refreshProfile, tenantId } = useAuth();
  const [activeTab, setActiveTab] = useState('profil');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // ── Preferences state ────────────────────────────────────────────────────────
  const [prefs, setPrefs] = useState({
    notif_approval: true,
    notif_print: true,
    notif_reminder: false,
    timezone: 'WIB',
  });

  useEffect(() => {
    if (profile) {
      const saved = (profile as { preferences?: Record<string, unknown> }).preferences || {};
      setPrefs(prev => ({
        notif_approval: (saved.notif_approval as boolean) ?? prev.notif_approval,
        notif_print: (saved.notif_print as boolean) ?? prev.notif_print,
        notif_reminder: (saved.notif_reminder as boolean) ?? prev.notif_reminder,
        timezone: (saved.timezone as string) ?? prev.timezone,
      }));
    }
  }, [profile]);

  // ── Profile form ─────────────────────────────────────────────────────────────
  const { register: rProfile, handleSubmit: hProfile, formState: { errors: eProfile, isSubmitting: isSavingProfile } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nama_lengkap: profile?.nama_lengkap || '',
      username: profile?.username || '',
      telepon: (profile as { telepon?: string })?.telepon || '',
    },
  });

  // ── Password form ─────────────────────────────────────────────────────────────
  const { register: rPwd, handleSubmit: hPwd, reset: resetPwd, watch: watchPwd, formState: { errors: ePwd, isSubmitting: isSavingPwd } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });
  const newPassVal = watchPwd('new_pass') || '';
  const pwdStrength = getPasswordStrength(newPassVal);

  // ── Audit log (login history) ────────────────────────────────────────────────
  const { data: loginHistory = [], isLoading: isLoadingHistory } = useQuery<AuditLog[]>({
    queryKey: ['login-history', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('audit_log')
        .select('*')
        .eq('user_id', user.id)
        .eq('action', 'LOGIN')
        .order('created_at', { ascending: false })
        .limit(5);
      return (data || []) as AuditLog[];
    },
    enabled: !!user?.id && activeTab === 'riwayat',
  });

  // ── Avatar upload ─────────────────────────────────────────────────────────────
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Ukuran foto maksimal 2 MB'); return; }
    if (!file.type.startsWith('image/')) { toast.error('File harus berupa gambar'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setAvatarFile(file);
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile || !user?.id) return null;
    const ext = avatarFile.name.split('.').pop();
    const path = `avatars/${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  };

  // ── Save profile ──────────────────────────────────────────────────────────────
  const saveProfile = async (data: ProfileForm) => {
    if (!user?.id) return;
    try {
      let avatar_url = profile?.avatar_url;
      if (avatarFile) avatar_url = (await uploadAvatar()) || avatar_url;

      // Check username uniqueness if changed
      if (data.username && data.username !== profile?.username) {
        const { data: existing } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('username', data.username)
          .neq('id', user.id)
          .maybeSingle();
        if (existing) { toast.error('Username sudah digunakan'); return; }
      }

      const { error } = await supabase.from('user_profiles').update({
        nama_lengkap: data.nama_lengkap,
        username: data.username || null,
        telepon: data.telepon || null,
        avatar_url: avatar_url || null,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);

      if (error) throw error;
      setAvatarFile(null);
      await refreshProfile();
      toast.success('Profil berhasil diperbarui');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Gagal menyimpan profil');
    }
  };

  // ── Change password ───────────────────────────────────────────────────────────
  const changePassword = async (data: PasswordForm) => {
    const { error } = await supabase.auth.updateUser({ password: data.new_pass });
    if (error) { toast.error(error.message); return; }
    toast.success('Password berhasil diubah');
    resetPwd();
  };

  // ── Send reset email ──────────────────────────────────────────────────────────
  const sendResetEmail = async () => {
    if (!user?.email) return;
    setIsSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Link reset password telah dikirim ke email Anda');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Gagal mengirim email reset');
    } finally {
      setIsSendingReset(false);
    }
  };

  // ── Save preferences ──────────────────────────────────────────────────────────
  const savePreferences = async () => {
    if (!user?.id) return;
    try {
      const { error } = await supabase.from('user_profiles').update({
        preferences: prefs,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>).eq('id', user.id);
      if (error) throw error;
      toast.success('Preferensi disimpan');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Gagal menyimpan preferensi');
    }
  };

  // ── Deactivate account ────────────────────────────────────────────────────────
  const deactivateAccount = async () => {
    if (!user?.id || !tenantId) return;

    // Guard: cannot deactivate if only admin
    if (profile?.role === 'Admin') {
      const { data: admins } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('role', 'Admin')
        .eq('status_aktif', true);
      if ((admins || []).length <= 1) {
        toast.error('Tidak dapat menonaktifkan akun — Anda adalah satu-satunya admin');
        setShowDeactivateModal(false);
        return;
      }
    }

    setIsDeactivating(true);
    try {
      const { error } = await supabase.from('user_profiles').update({
        status_aktif: false,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);
      if (error) throw error;
      await supabase.auth.signOut();
      toast.success('Akun Anda telah dinonaktifkan');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Gagal menonaktifkan akun');
    } finally {
      setIsDeactivating(false);
      setShowDeactivateModal(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  const currentAvatarUrl = avatarPreview || profile?.avatar_url;

  return (
    <div className="page-container max-w-3xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Profil Pengguna</h1>
          <p className="page-subtitle">Kelola informasi akun dan preferensi Anda</p>
        </div>
      </div>

      {/* Profile banner card */}
      <div className="card mb-6">
        <div className="card-body flex items-center gap-5">
          <div className="relative">
            <Avatar name={profile?.nama_lengkap} avatarUrl={currentAvatarUrl} size={72} />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors shadow-md"
            >
              <Camera size={12} />
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg text-slate-900">{profile?.nama_lengkap}</p>
            {profile?.username && <p className="text-sm text-slate-400">@{profile.username}</p>}
            <p className="text-sm text-slate-500">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`badge ${ROLE_COLORS[profile?.role || ''] || 'badge-slate'}`}>
                {ROLE_LABELS[profile?.role || ''] || profile?.role}
              </span>
              {profile?.pegawai?.jabatan && (
                <span className="badge badge-slate">{profile.pegawai.jabatan}</span>
              )}
              {!profile?.status_aktif && <span className="badge badge-red">Tidak Aktif</span>}
            </div>
          </div>
          {avatarFile && (
            <div className="flex flex-col items-end gap-2">
              <p className="text-xs text-slate-500">Foto baru dipilih</p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}
              >
                <X size={12} /> Batalkan
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-list mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-item flex items-center gap-1.5 whitespace-nowrap ${activeTab === t.id ? 'active' : ''} ${t.danger && activeTab === t.id ? '!text-rose-600 !border-rose-500' : t.danger ? 'hover:!text-rose-500' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {/* ── TAB: PROFIL ── */}
          {activeTab === 'profil' && (
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold flex items-center gap-2"><User size={16} className="text-slate-400" /> Informasi Pribadi</h3>
              </div>
              <form className="card-body space-y-4" onSubmit={hProfile(saveProfile)}>
                {/* Avatar upload row */}
                {avatarFile && (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                      <img src={avatarPreview!} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-blue-800 truncate">{avatarFile.name}</p>
                      <p className="text-xs text-blue-600">Foto akan diunggah saat menyimpan</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 form-group">
                    <label className="form-label">Nama Lengkap <span className="required-mark">*</span></label>
                    <input className={`form-input ${eProfile.nama_lengkap ? 'is-error' : ''}`} placeholder="Nama Lengkap Anda" {...rProfile('nama_lengkap')} />
                    {eProfile.nama_lengkap && <p className="form-error">{eProfile.nama_lengkap.message}</p>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">@</span>
                      <input className={`form-input pl-7 ${eProfile.username ? 'is-error' : ''}`} placeholder="username" {...rProfile('username')} />
                    </div>
                    {eProfile.username && <p className="form-error">{eProfile.username.message}</p>}
                    <p className="form-hint">Huruf kecil, angka, underscore</p>
                  </div>

                  <div className="form-group">
                    <label className="form-label flex items-center gap-1.5"><Phone size={13} className="text-slate-400" /> Telepon</label>
                    <input className="form-input" placeholder="08xxxxxxxxxx" {...rProfile('telepon')} />
                  </div>

                  <div className="form-group">
                    <label className="form-label flex items-center gap-1.5"><Mail size={13} className="text-slate-400" /> Email</label>
                    <input className="form-input" value={user?.email || ''} disabled />
                    <p className="form-hint">Email tidak dapat diubah</p>
                  </div>

                  <div className="form-group">
                    <label className="form-label flex items-center gap-1.5"><Shield size={13} className="text-slate-400" /> Role</label>
                    <input className="form-input" value={ROLE_LABELS[profile?.role || ''] || '-'} disabled />
                  </div>

                  {profile?.pegawai && (
                    <div className="col-span-2 form-group">
                      <label className="form-label flex items-center gap-1.5"><Briefcase size={13} className="text-slate-400" /> Jabatan (dari data pegawai)</label>
                      <input className="form-input" value={profile.pegawai.jabatan} disabled />
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <button type="submit" className="btn btn-primary" disabled={isSavingProfile}>
                    {isSavingProfile ? <><Loader2 size={14} className="animate-spin" /> Menyimpan...</> : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── TAB: KEAMANAN ── */}
          {activeTab === 'keamanan' && (
            <div className="space-y-4">
              <div className="card">
                <div className="card-header">
                  <h3 className="font-semibold flex items-center gap-2"><Lock size={16} className="text-slate-400" /> Ubah Password</h3>
                </div>
                <form className="card-body space-y-4" onSubmit={hPwd(changePassword)}>
                  <div className="form-group">
                    <label className="form-label">Password Baru <span className="required-mark">*</span></label>
                    <div className="relative">
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        className={`form-input pr-10 ${ePwd.new_pass ? 'is-error' : ''}`}
                        placeholder="Minimal 8 karakter"
                        {...rPwd('new_pass')}
                      />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowNewPass(v => !v)}>
                        {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {ePwd.new_pass && <p className="form-error">{ePwd.new_pass.message}</p>}
                    {newPassVal && (
                      <div className="mt-2 space-y-1">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= pwdStrength.score ? pwdStrength.color : 'bg-slate-100'}`} />
                          ))}
                        </div>
                        <p className="text-xs text-slate-500">Kekuatan: <span className="font-semibold">{pwdStrength.label}</span></p>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Konfirmasi Password Baru <span className="required-mark">*</span></label>
                    <div className="relative">
                      <input
                        type={showConfirmPass ? 'text' : 'password'}
                        className={`form-input pr-10 ${ePwd.confirm ? 'is-error' : ''}`}
                        placeholder="Ulangi password baru"
                        {...rPwd('confirm')}
                      />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowConfirmPass(v => !v)}>
                        {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {ePwd.confirm && <p className="form-error">{ePwd.confirm.message}</p>}
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={isSavingPwd}>
                    {isSavingPwd ? <><Loader2 size={14} className="animate-spin" /> Memperbarui...</> : <><CheckCircle2 size={14} /> Ubah Password</>}
                  </button>
                </form>
              </div>

              {/* Send reset email alternative */}
              <div className="card">
                <div className="card-body flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Ubah via Email</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Kirim link reset password ke <span className="font-medium">{user?.email}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm flex-shrink-0"
                    onClick={sendResetEmail}
                    disabled={isSendingReset}
                  >
                    {isSendingReset ? <><Loader2 size={12} className="animate-spin" /> Mengirim...</> : <><Mail size={12} /> Kirim Link</>}
                  </button>
                </div>
              </div>

              {/* Last login info */}
              {profile?.last_active && (
                <div className="card">
                  <div className="card-body flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Clock size={16} className="text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Aktivitas Terakhir</p>
                      <p className="text-xs text-slate-500">{formatDatetime(profile.last_active)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: PREFERENSI ── */}
          {activeTab === 'preferensi' && (
            <div className="space-y-4">
              {/* Bahasa */}
              <div className="card">
                <div className="card-header">
                  <h3 className="font-semibold flex items-center gap-2"><Globe size={16} className="text-slate-400" /> Bahasa & Wilayah</h3>
                </div>
                <div className="card-body space-y-4">
                  <div className="flex items-center justify-between py-1">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Bahasa Tampilan</p>
                      <p className="text-xs text-slate-400">Bahasa yang digunakan pada antarmuka</p>
                    </div>
                    <span className="badge badge-slate text-xs">Bahasa Indonesia</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Zona Waktu</label>
                    <select
                      className="form-select"
                      value={prefs.timezone}
                      onChange={e => setPrefs(p => ({ ...p, timezone: e.target.value }))}
                    >
                      {TIMEZONES.map(tz => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Notifikasi */}
              <div className="card">
                <div className="card-header">
                  <h3 className="font-semibold flex items-center gap-2"><Bell size={16} className="text-slate-400" /> Notifikasi</h3>
                </div>
                <div className="card-body space-y-1">
                  {[
                    { key: 'notif_approval' as const, label: 'Persetujuan Dokumen', desc: 'Saat dokumen disetujui atau ditolak' },
                    { key: 'notif_print' as const, label: 'Dokumen Siap Cetak', desc: 'Saat PDF selesai dibuat' },
                    { key: 'notif_reminder' as const, label: 'Pengingat Draft', desc: 'Pengingat untuk draft yang belum diselesaikan' },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                        <p className="text-xs text-slate-400">{item.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPrefs(p => ({ ...p, [item.key]: !p[item.key] }))}
                        className={`w-11 h-6 rounded-full transition-colors duration-200 relative flex-shrink-0 ${prefs[item.key] ? 'bg-blue-600' : 'bg-slate-200'}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${prefs[item.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button type="button" className="btn btn-primary" onClick={savePreferences}>
                  Simpan Preferensi
                </button>
              </div>
            </div>
          )}

          {/* ── TAB: RIWAYAT LOGIN ── */}
          {activeTab === 'riwayat' && (
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold flex items-center gap-2"><Clock size={16} className="text-slate-400" /> Riwayat Login Terakhir</h3>
                <span className="badge badge-slate text-xs">5 login terakhir</span>
              </div>
              <div className="overflow-hidden">
                {isLoadingHistory ? (
                  <div className="card-body flex items-center justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-slate-300" />
                  </div>
                ) : loginHistory.length === 0 ? (
                  <div className="empty-state py-12">
                    <Clock size={32} className="text-slate-200 mb-3" />
                    <p className="empty-state-title">Belum ada riwayat login</p>
                    <p className="empty-state-desc">Data login akan muncul di sini</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {loginHistory.map((log, i) => (
                      <div key={log.id} className="px-6 py-3 flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${i === 0 ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                          <CheckCircle2 size={14} className={i === 0 ? 'text-emerald-600' : 'text-slate-400'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">
                            {i === 0 ? 'Login saat ini' : `Login ke-${i + 1}`}
                          </p>
                          <p className="text-xs text-slate-400">{formatDatetime(log.created_at)}</p>
                        </div>
                        {log.ip_address && (
                          <span className="text-xs text-slate-400 font-mono">{log.ip_address}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: DANGER ZONE ── */}
          {activeTab === 'bahaya' && (
            <div className="card border-2 border-rose-100">
              <div className="card-header border-rose-100">
                <h3 className="font-semibold flex items-center gap-2 text-rose-700">
                  <AlertTriangle size={16} className="text-rose-500" /> Danger Zone
                </h3>
              </div>
              <div className="card-body">
                <div className="flex items-start gap-4 p-4 bg-rose-50 rounded-xl border border-rose-100">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                    <Shield size={18} className="text-rose-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-rose-800">Nonaktifkan Akun</p>
                    <p className="text-xs text-rose-600 mt-1 leading-relaxed">
                      Akun Anda akan dinonaktifkan dan Anda tidak dapat masuk lagi.
                      Tindakan ini tidak dapat dibatalkan sendiri. Hubungi admin untuk mengaktifkan kembali.
                    </p>
                    {profile?.role === 'Admin' && (
                      <p className="text-xs text-amber-700 font-semibold mt-2 flex items-center gap-1">
                        <AlertTriangle size={12} />
                        Sebagai Admin, pastikan ada admin lain sebelum menonaktifkan akun.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm flex-shrink-0"
                    onClick={() => setShowDeactivateModal(true)}
                  >
                    Nonaktifkan
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Deactivate confirm modal */}
      <ConfirmModal
        open={showDeactivateModal}
        title="Nonaktifkan Akun"
        message={`Apakah Anda yakin ingin menonaktifkan akun "${profile?.nama_lengkap}"? Anda akan keluar secara otomatis dan tidak dapat masuk kembali tanpa bantuan admin.`}
        confirmLabel="Ya, Nonaktifkan"
        onConfirm={deactivateAccount}
        onClose={() => setShowDeactivateModal(false)}
        danger
        isLoading={isDeactivating}
      />
    </div>
  );
}
