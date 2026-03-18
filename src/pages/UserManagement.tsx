// =================================================================
// SiSPPD v2.1 — User Management (Module 19)
// =================================================================
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import {
  UserCog,
  UserPlus,
  Mail,
  X,
  Check,
  ShieldCheck,
  Users,
  AlertTriangle,
  KeyRound,
  Search,
  ChevronDown,
} from 'lucide-react';
import { formatDate, getInitials } from '../lib/utils';
import { toast } from 'sonner';
import type { UserProfile, UserRole } from '../types';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

// ─── Constants ────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  Admin: 'Administrator',
  Operator: 'Operator',
  Pejabat: 'Pejabat',
  Pegawai: 'Pegawai',
};

const ROLE_COLORS: Record<UserRole, string> = {
  Admin: 'badge-blue',
  Operator: 'badge-green',
  Pejabat: 'badge-violet',
  Pegawai: 'badge-slate',
};

const ROLE_AVATAR_COLORS: Record<UserRole, { bg: string; text: string }> = {
  Admin: { bg: 'bg-blue-100', text: 'text-blue-700' },
  Operator: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  Pejabat: { bg: 'bg-violet-100', text: 'text-violet-700' },
  Pegawai: { bg: 'bg-slate-100', text: 'text-slate-600' },
};

// ─── Helpers ──────────────────────────────────────────────────────

function relativeTime(dateStr?: string): string {
  if (!dateStr) return 'Belum pernah';
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true, locale: localeID });
  } catch {
    return '-';
  }
}

function randomPassword(len = 12): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── Stats Row ────────────────────────────────────────────────────

interface StatsRowProps {
  users: UserProfile[];
  loading: boolean;
}

function StatsRow({ users, loading }: StatsRowProps) {
  const active = users.filter(u => u.status_aktif).length;
  const inactive = users.length - active;
  const roleCounts = useMemo(() => {
    const counts: Partial<Record<UserRole, number>> = {};
    users.forEach(u => { counts[u.role] = (counts[u.role] ?? 0) + 1; });
    return counts;
  }, [users]);

  const items = [
    {
      label: 'Total Pengguna',
      value: users.length,
      icon: <Users size={18} className="text-slate-600" />,
      bg: 'bg-slate-100',
    },
    {
      label: 'Pengguna Aktif',
      value: active,
      icon: <Check size={18} className="text-emerald-600" />,
      bg: 'bg-emerald-50',
    },
    {
      label: 'Tidak Aktif',
      value: inactive,
      icon: <X size={18} className="text-rose-500" />,
      bg: 'bg-rose-50',
    },
    {
      label: 'Administrator',
      value: roleCounts['Admin'] ?? 0,
      icon: <ShieldCheck size={18} className="text-blue-600" />,
      bg: 'bg-blue-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {items.map(item => (
        <div key={item.label} className="card p-4 flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.bg}`}>
            {item.icon}
          </div>
          <div>
            {loading ? (
              <div className="skeleton h-6 w-10 rounded mb-1" />
            ) : (
              <p className="text-2xl font-bold text-slate-900">{item.value}</p>
            )}
            <p className="text-xs text-slate-500">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Role breakdown mini bar ───────────────────────────────────────

function RoleBreakdown({ users }: { users: UserProfile[] }) {
  const roles: UserRole[] = ['Admin', 'Operator', 'Pejabat', 'Pegawai'];
  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {roles.map(r => {
        const count = users.filter(u => u.role === r).length;
        if (count === 0) return null;
        return (
          <span key={r} className={`badge ${ROLE_COLORS[r]}`}>
            {ROLE_LABELS[r]}: {count}
          </span>
        );
      })}
    </div>
  );
}

// ─── Invite Modal ──────────────────────────────────────────────────

interface InviteModalProps {
  tenantId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

function InviteModal({ tenantId, onClose, onSuccess }: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [nama, setNama] = useState('');
  const [role, setRole] = useState<UserRole>('Operator');
  const [loading, setLoading] = useState(false);
  const [tempPass, setTempPass] = useState('');

  const handleSubmit = async () => {
    if (!email.trim() || !nama.trim()) {
      toast.error('Email dan nama lengkap wajib diisi');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Format email tidak valid');
      return;
    }
    setLoading(true);
    try {
      const password = randomPassword();
      setTempPass(password);

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            nama_lengkap: nama.trim(),
            tenant_id: tenantId,
            role,
          },
        },
      });

      if (error) throw error;

      toast.success(`Akun berhasil dibuat untuk ${email}. Kirimkan password sementara kepada pengguna.`);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat akun';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title flex items-center gap-2">
            <UserPlus size={18} className="text-blue-600" />
            Undang Pengguna Baru
          </h2>
          <button className="btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body space-y-4">
          {tempPass ? (
            <div className="alert alert-success">
              <Check size={18} className="flex-shrink-0" />
              <div>
                <p className="font-semibold mb-1">Akun berhasil dibuat!</p>
                <p className="text-sm mb-2">Salin dan kirimkan password sementara ini kepada pengguna secara aman:</p>
                <div className="flex items-center gap-2 bg-white border border-emerald-200 rounded-lg px-3 py-2">
                  <code className="font-mono text-sm text-slate-800 flex-1 select-all">{tempPass}</code>
                </div>
                <p className="text-xs mt-2 text-emerald-700">Pengguna sebaiknya mengganti password setelah login pertama.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="alert alert-info">
                <Mail size={16} className="flex-shrink-0 mt-0.5" />
                <p className="text-sm">
                  Akun baru akan dibuat dengan password sementara yang dapat Anda bagikan kepada pengguna.
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">
                  Nama Lengkap <span className="required-mark">*</span>
                </label>
                <input
                  className="form-input"
                  value={nama}
                  onChange={e => setNama(e.target.value)}
                  placeholder="Nama lengkap pengguna baru"
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  Email <span className="required-mark">*</span>
                </label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@instansi.go.id"
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  Role <span className="required-mark">*</span>
                </label>
                <select
                  className="form-select"
                  value={role}
                  onChange={e => setRole(e.target.value as UserRole)}
                >
                  {Object.entries(ROLE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                <p className="form-hint">
                  {role === 'Admin'
                    ? 'Akses penuh — dapat mengelola semua data dan pengguna.'
                    : role === 'Operator'
                    ? 'Dapat membuat dan mengelola SPT/SPPD.'
                    : role === 'Pejabat'
                    ? 'Dapat menyetujui dan menandatangani dokumen.'
                    : 'Akses terbatas — hanya melihat dokumen terkait dirinya.'}
                </p>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            {tempPass ? 'Tutup' : 'Batal'}
          </button>
          {!tempPass && (
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Membuat...
                </>
              ) : (
                <>
                  <UserPlus size={14} />
                  Buat Akun
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Edit Role Modal ───────────────────────────────────────────────

interface EditRoleModalProps {
  user: UserProfile;
  onClose: () => void;
  onConfirm: (role: UserRole) => void;
  loading: boolean;
}

function EditRoleModal({ user, onClose, onConfirm, loading }: EditRoleModalProps) {
  const [role, setRole] = useState<UserRole>(user.role);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title flex items-center gap-2">
            <ShieldCheck size={18} className="text-blue-600" />
            Ubah Role
          </h2>
          <button className="btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body space-y-4">
          <p className="text-sm text-slate-600">
            Mengubah role untuk: <span className="font-semibold">{user.nama_lengkap}</span>
          </p>
          <div className="form-group">
            <label className="form-label">Role Baru</label>
            <select
              className="form-select"
              value={role}
              onChange={e => setRole(e.target.value as UserRole)}
            >
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          {role !== user.role && (
            <div className="alert alert-warning">
              <AlertTriangle size={16} className="flex-shrink-0" />
              <p className="text-sm">
                Role akan diubah dari <strong>{ROLE_LABELS[user.role]}</strong> menjadi <strong>{ROLE_LABELS[role]}</strong>.
                Perubahan ini segera berlaku saat pengguna login berikutnya.
              </p>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button
            className="btn btn-primary"
            disabled={loading || role === user.role}
            onClick={() => onConfirm(role)}
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Check size={14} />
            )}
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Deactivate Confirm Modal ─────────────────────────────────────

interface DeactivateModalProps {
  user: UserProfile;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

function DeactivateModal({ user, onClose, onConfirm, loading }: DeactivateModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title flex items-center gap-2 text-rose-600">
            <AlertTriangle size={18} />
            Nonaktifkan Pengguna
          </h2>
          <button className="btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="alert alert-danger mb-4">
            <AlertTriangle size={16} className="flex-shrink-0" />
            <p className="text-sm">
              Apakah Anda yakin menonaktifkan <strong>{user.nama_lengkap}</strong>?
              Mereka tidak akan bisa login sampai diaktifkan kembali.
            </p>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <X size={14} />
            )}
            Nonaktifkan
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────

export default function UserManagement() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  // Modal states
  const [showInvite, setShowInvite] = useState(false);
  const [editRoleUser, setEditRoleUser] = useState<UserProfile | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<UserProfile | null>(null);

  // Filter state
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | ''>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // ── Data query ───────────────────────────────────────────────────
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['user_profiles', tenantId],
    queryFn: async () => {
      let q = supabase
        .from('user_profiles')
        .select('*')
        .order('nama_lengkap');
      if (tenantId) {
        q = q.eq('tenant_id', tenantId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as UserProfile[];
    },
    enabled: !!tenantId,
  });

  // ── Filtered list ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return users.filter(u => {
      if (search && !u.nama_lengkap.toLowerCase().includes(search.toLowerCase())
        && !(u.username ?? '').toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (filterRole && u.role !== filterRole) return false;
      if (filterStatus === 'active' && !u.status_aktif) return false;
      if (filterStatus === 'inactive' && u.status_aktif) return false;
      return true;
    });
  }, [users, search, filterRole, filterStatus]);

  // ── Mutations ────────────────────────────────────────────────────
  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: boolean }) => {
      const { error } = await supabase
        .from('user_profiles')
        .update({ status_aktif: status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast.success(status ? 'Pengguna berhasil diaktifkan' : 'Pengguna berhasil dinonaktifkan');
      queryClient.invalidateQueries({ queryKey: ['user_profiles'] });
      setDeactivateUser(null);
    },
    onError: () => toast.error('Gagal memperbarui status'),
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Role berhasil diperbarui');
      queryClient.invalidateQueries({ queryKey: ['user_profiles'] });
      setEditRoleUser(null);
    },
    onError: () => toast.error('Gagal memperbarui role'),
  });

  const resetPassword = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success('Email reset password telah dikirim'),
    onError: () => toast.error('Gagal mengirim email reset password'),
  });

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <UserCog size={22} className="text-blue-600" />
            Manajemen Pengguna
          </h1>
          <p className="page-subtitle">Kelola akses dan role pengguna sistem</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowInvite(true)}>
          <UserPlus size={16} />
          Undang Pengguna
        </button>
      </div>

      {/* Stats */}
      <StatsRow users={users} loading={isLoading} />

      {/* Role Breakdown */}
      {!isLoading && users.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-slate-500 font-medium">Distribusi role:</span>
          <RoleBreakdown users={users} />
        </div>
      )}

      {/* Filter bar */}
      <div className="card mb-6">
        <div className="card-body flex flex-wrap gap-3 items-end">
          <div className="search-wrap flex-1 min-w-48">
            <Search size={14} className="search-icon" />
            <input
              className="search-input"
              placeholder="Cari nama atau username..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="form-select w-40"
            value={filterRole}
            onChange={e => setFilterRole(e.target.value as UserRole | '')}
          >
            <option value="">Semua Role</option>
            {Object.entries(ROLE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <div className="flex gap-1">
            {(['all', 'active', 'inactive'] as const).map(s => (
              <button
                key={s}
                className={`chip ${filterStatus === s ? 'active' : ''}`}
                onClick={() => setFilterStatus(s)}
              >
                {s === 'all' ? 'Semua' : s === 'active' ? 'Aktif' : 'Nonaktif'}
              </button>
            ))}
          </div>
          {(search || filterRole || filterStatus !== 'all') && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setSearch(''); setFilterRole(''); setFilterStatus('all'); }}
            >
              <X size={14} /> Hapus Filter
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Pengguna</th>
              <th>Role</th>
              <th>Status</th>
              <th>Terakhir Aktif</th>
              <th>Bergabung</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={6}>
                    <div className="skeleton h-5 rounded w-full" />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state py-12">
                    <Users size={32} className="text-slate-300 mb-3" />
                    <p className="empty-state-title">Tidak ada pengguna ditemukan</p>
                    <p className="empty-state-desc">
                      {search || filterRole || filterStatus !== 'all'
                        ? 'Coba ubah atau hapus filter pencarian.'
                        : 'Belum ada pengguna terdaftar.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map(u => {
                const avatarColors = ROLE_AVATAR_COLORS[u.role];
                return (
                  <tr key={u.id}>
                    {/* Pengguna */}
                    <td>
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColors.bg} ${avatarColors.text}`}
                        >
                          {getInitials(u.nama_lengkap)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-slate-900">{u.nama_lengkap}</p>
                          <p className="text-xs text-slate-400">{u.username ?? '—'}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td>
                      <span className={`badge ${ROLE_COLORS[u.role]}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>

                    {/* Status */}
                    <td>
                      <span className={`badge ${u.status_aktif ? 'badge-green' : 'badge-red'}`}>
                        {u.status_aktif ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>

                    {/* Terakhir aktif */}
                    <td className="text-xs text-slate-500">
                      {relativeTime(u.last_active)}
                    </td>

                    {/* Bergabung */}
                    <td className="text-xs text-slate-500">
                      {formatDate(u.created_at)}
                    </td>

                    {/* Aksi */}
                    <td>
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit Role */}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setEditRoleUser(u)}
                          title="Ubah Role"
                        >
                          <ShieldCheck size={13} />
                          Role
                          <ChevronDown size={11} />
                        </button>

                        {/* Reset Password */}
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => resetPassword.mutate(u.username ?? '')}
                          disabled={!u.username || resetPassword.isPending}
                          title="Reset Password"
                        >
                          <KeyRound size={13} />
                        </button>

                        {/* Activate / Deactivate */}
                        {u.status_aktif ? (
                          <button
                            className="btn btn-sm btn-secondary text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                            onClick={() => setDeactivateUser(u)}
                            title="Nonaktifkan"
                          >
                            <X size={13} />
                            Nonaktifkan
                          </button>
                        ) : (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => toggleStatus.mutate({ id: u.id, status: true })}
                            disabled={toggleStatus.isPending}
                            title="Aktifkan"
                          >
                            <Check size={13} />
                            Aktifkan
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer summary */}
      {!isLoading && filtered.length > 0 && (
        <p className="text-sm text-slate-500 mt-4">
          Menampilkan {filtered.length} dari {users.length} pengguna
        </p>
      )}

      {/* Modals */}
      {showInvite && (
        <InviteModal
          tenantId={tenantId}
          onClose={() => setShowInvite(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['user_profiles'] });
            setShowInvite(false);
          }}
        />
      )}

      {editRoleUser && (
        <EditRoleModal
          user={editRoleUser}
          onClose={() => setEditRoleUser(null)}
          onConfirm={role => updateRole.mutate({ id: editRoleUser.id, role })}
          loading={updateRole.isPending}
        />
      )}

      {deactivateUser && (
        <DeactivateModal
          user={deactivateUser}
          onClose={() => setDeactivateUser(null)}
          onConfirm={() => toggleStatus.mutate({ id: deactivateUser.id, status: false })}
          loading={toggleStatus.isPending}
        />
      )}
    </div>
  );
}
