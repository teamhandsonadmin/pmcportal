'use client';

import { useState, useTransition, useMemo } from 'react';
import { createUser, updateUserRole, updateUserStatus, deleteUser } from '@/app/actions/users';

/* ── Types ───────────────────────────────────────────────── */
type Role   = 'admin' | 'senior_site_engineer' | 'site_engineer';
type Status = 'active' | 'invited' | 'disabled';

export interface UserRow {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: Role;
  status: Status;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/* ── Config ──────────────────────────────────────────────── */
const ROLE_CFG: Record<Role, { label: string; bg: string; color: string; avatarBg: string }> = {
  admin:                { label: 'Admin',                bg: '#111111', color: '#ffffff', avatarBg: '#111111' },
  senior_site_engineer: { label: 'Sr. Site Engineer',   bg: '#eef2ff', color: '#4338ca', avatarBg: '#6366f1' },
  site_engineer:        { label: 'Site Engineer',        bg: '#f9fafb', color: '#374151', avatarBg: '#6b7280' },
};
const STATUS_CFG: Record<Status, { label: string; bg: string; color: string; dot: string }> = {
  active:   { label: 'Active',   bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
  invited:  { label: 'Invited',  bg: '#fffbeb', color: '#d97706', dot: '#fbbf24' },
  disabled: { label: 'Disabled', bg: '#f9fafb', color: '#6b7280', dot: '#9ca3af' },
};

/* ── Helpers ─────────────────────────────────────────────── */
function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
function fmtDate(d: Date | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtRelative(d: Date | null) {
  if (!d) return 'Never';
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days}d ago`;
  return fmtDate(d);
}

/* ── Avatar ──────────────────────────────────────────────── */
function Avatar({ name, role, size = 36 }: { name: string; role: Role; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.33, backgroundColor: ROLE_CFG[role].avatarBg }}
    >
      {initials(name)}
    </div>
  );
}

/* ── Role badge ──────────────────────────────────────────── */
function RoleBadge({ role }: { role: Role }) {
  const c = ROLE_CFG[role];
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

/* ── Status badge ────────────────────────────────────────── */
function StatusBadge({ status }: { status: Status }) {
  const c = STATUS_CFG[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: c.bg, color: c.color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.dot }} />
      {c.label}
    </span>
  );
}

/* ── Action dropdown ─────────────────────────────────────── */
function ActionMenu({ user, onView, onEdit, onChangeRole, onToggleStatus, onDelete }: {
  user: UserRow;
  onView: () => void;
  onEdit: () => void;
  onChangeRole: (role: Role) => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-30 w-48 bg-white rounded-xl border border-gray-200 shadow-lg py-1 overflow-hidden" onMouseDown={(e) => e.preventDefault()}>
          <button onClick={() => { onView(); setOpen(false); }}  className="w-full text-left px-4 py-2.5 text-[12.5px] text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            View Details
          </button>
          <button onClick={() => { onEdit(); setOpen(false); }}  className="w-full text-left px-4 py-2.5 text-[12.5px] text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit User
          </button>
          <div className="my-1 h-px bg-gray-100" />
          <div className="px-3 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Change Role</p>
            {(['admin', 'senior_site_engineer', 'site_engineer'] as Role[])
              .filter((r) => r !== user.role)
              .map((r) => (
                <button key={r} onClick={() => { onChangeRole(r); setOpen(false); }}
                  className="w-full text-left px-2 py-1.5 text-[12px] text-gray-700 hover:bg-gray-50 rounded-md flex items-center gap-2 transition-colors">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ROLE_CFG[r].avatarBg }} />
                  {ROLE_CFG[r].label}
                </button>
              ))
            }
          </div>
          <div className="my-1 h-px bg-gray-100" />
          <button onClick={() => { onToggleStatus(); setOpen(false); }}
            className={`w-full text-left px-4 py-2.5 text-[12.5px] flex items-center gap-2.5 transition-colors ${user.status === 'disabled' ? 'text-green-700 hover:bg-green-50' : 'text-amber-700 hover:bg-amber-50'}`}>
            {user.status === 'disabled'
              ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>Enable Access</>
              : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg>Disable Access</>
            }
          </button>
          <button onClick={() => { onDelete(); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-[12.5px] text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            Delete User
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Add User Modal ──────────────────────────────────────── */
function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (user: UserRow) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startPending] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;
    setError(null);
    startPending(async () => {
      const res = await createUser(null, fd);
      if (res.success) {
        const newUser: UserRow = {
          id:        res.userId,
          fullName:  fd.get('fullName') as string,
          email:     fd.get('email') as string,
          phone:     (fd.get('phone') as string) || null,
          role:      fd.get('role') as Role,
          status:    'invited',
          isActive:  false,
          lastLogin: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        onCreated(newUser);
        onClose();
        form.reset();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[480px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-[16px] font-bold text-gray-900">Add New User</h2>
            <p className="text-[12.5px] text-gray-500 mt-0.5">Invite someone to the system. They'll be marked as Invited.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-[12.5px] text-red-700">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Full Name <span className="text-red-500">*</span></label>
            <input name="fullName" required placeholder="e.g. John Smith"
              className="w-full h-10 px-3.5 rounded-lg border border-gray-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition-all bg-gray-50 hover:bg-white" />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Email Address <span className="text-red-500">*</span></label>
            <input name="email" type="email" required placeholder="john@company.com"
              className="w-full h-10 px-3.5 rounded-lg border border-gray-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition-all bg-gray-50 hover:bg-white" />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Phone Number</label>
            <input name="phone" type="tel" placeholder="+1 (555) 000-0000"
              className="w-full h-10 px-3.5 rounded-lg border border-gray-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition-all bg-gray-50 hover:bg-white" />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Role <span className="text-red-500">*</span></label>
            <select name="role" required
              className="w-full h-10 px-3.5 rounded-lg border border-gray-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition-all bg-gray-50 hover:bg-white appearance-none cursor-pointer">
              <option value="">Select a role…</option>
              <option value="senior_site_engineer">Senior Site Engineer</option>
              <option value="site_engineer">Site Engineer</option>
            </select>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button type="submit" disabled={pending}
              className="flex-1 h-10 bg-gray-900 hover:bg-black text-white text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-50">
              {pending ? 'Creating…' : 'Create User'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 h-10 border border-gray-200 text-gray-700 text-[13px] font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Confirm Dialog ──────────────────────────────────────── */
function ConfirmDialog({ title, description, confirmLabel, variant, onConfirm, onCancel }: {
  title: string; description: string; confirmLabel: string;
  variant: 'danger' | 'warning';
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden">
        <div className="px-6 pt-6 pb-5">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${variant === 'danger' ? 'bg-red-50' : 'bg-amber-50'}`}>
            {variant === 'danger'
              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            }
          </div>
          <h3 className="text-[15px] font-bold text-gray-900 mb-1.5">{title}</h3>
          <p className="text-[13px] text-gray-500 leading-relaxed">{description}</p>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onConfirm}
            className={`flex-1 h-9 rounded-lg text-[13px] font-semibold text-white transition-colors ${variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
            {confirmLabel}
          </button>
          <button onClick={onCancel}
            className="flex-1 h-9 border border-gray-200 rounded-lg text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── User Details Drawer ─────────────────────────────────── */
function UserDrawer({ user, onClose, onEdit }: { user: UserRow; onClose: () => void; onEdit: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="flex-1" />
      <div
        className="w-full max-w-[420px] h-full bg-white border-l border-gray-200 shadow-2xl overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-[14px] font-bold text-gray-900">User Details</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="flex-1 px-6 py-6 space-y-6">
          {/* Profile block */}
          <div className="flex items-center gap-4">
            <Avatar name={user.fullName} role={user.role} size={52} />
            <div>
              <h3 className="text-[16px] font-bold text-gray-900">{user.fullName}</h3>
              <p className="text-[13px] text-gray-500">{user.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <RoleBadge role={user.role} />
                <StatusBadge status={user.status} />
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Details */}
          <div>
            <h4 className="text-[10.5px] font-bold uppercase tracking-widest text-gray-400 mb-4">Account Information</h4>
            <div className="space-y-3.5">
              {[
                { label: 'Full Name',    value: user.fullName },
                { label: 'Email',        value: user.email },
                { label: 'Phone',        value: user.phone ?? '—' },
                { label: 'Created',      value: fmtDate(user.createdAt) },
                { label: 'Last Login',   value: fmtRelative(user.lastLogin) },
                { label: 'Last Updated', value: fmtDate(user.updatedAt) },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-3">
                  <span className="text-[12px] text-gray-400 flex-shrink-0">{item.label}</span>
                  <span className="text-[12.5px] font-medium text-gray-800 text-right break-all">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Activity placeholder */}
          <div>
            <h4 className="text-[10.5px] font-bold uppercase tracking-widest text-gray-400 mb-4">Recent Activity</h4>
            <div className="space-y-3">
              {[
                { icon: '🔐', text: 'Account created',        time: fmtDate(user.createdAt) },
                { icon: '📧', text: 'Invitation sent',         time: fmtDate(user.createdAt) },
                { icon: '⚙️', text: `Role set to ${ROLE_CFG[user.role].label}`, time: fmtDate(user.createdAt) },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-base leading-none mt-0.5 flex-shrink-0">{item.icon}</span>
                  <div>
                    <p className="text-[12.5px] text-gray-700">{item.text}</p>
                    <p className="text-[11px] text-gray-400">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Stats */}
          <div>
            <h4 className="text-[10.5px] font-bold uppercase tracking-widest text-gray-400 mb-4">Stats</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Assigned Tasks', value: '—' },
                { label: 'Works Access',   value: '—' },
                { label: 'Login Count',    value: '—' },
                { label: 'Actions',        value: '—' },
              ].map((s) => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-[22px] font-bold text-gray-900">{s.value}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
          <button onClick={onEdit}
            className="flex-1 h-9 bg-gray-900 hover:bg-black text-white text-[13px] font-medium rounded-lg transition-colors">
            Edit User
          </button>
          <button onClick={onClose}
            className="flex-1 h-9 border border-gray-200 text-gray-700 text-[13px] font-medium rounded-lg hover:bg-gray-50 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────── */
interface Props {
  initialUsers: UserRow[];
}

type Confirm = { type: 'delete' | 'disable' | 'enable'; user: UserRow } | null;

export function AccessManagement({ initialUsers }: Props) {
  const [users, setUsers]           = useState<UserRow[]>(initialUsers);
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [addOpen, setAddOpen]       = useState(false);
  const [drawer, setDrawer]         = useState<UserRow | null>(null);
  const [confirm, setConfirm]       = useState<Confirm>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase();
      const matchSearch = !q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchRole   = roleFilter === 'all' || u.role === roleFilter;
      const matchStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  /* Summary stats */
  const stats = {
    total:   users.length,
    active:  users.filter((u) => u.status === 'active').length,
    senior:  users.filter((u) => u.role === 'senior_site_engineer').length,
    site:    users.filter((u) => u.role === 'site_engineer').length,
    invited: users.filter((u) => u.status === 'invited').length,
  };

  function handleRoleChange(userId: string, role: Role) {
    startTransition(async () => {
      await updateUserRole(userId, role);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role } : u));
    });
  }

  function handleStatusToggle(user: UserRow) {
    if (user.status === 'disabled') {
      setConfirm({ type: 'enable', user });
    } else {
      setConfirm({ type: 'disable', user });
    }
  }

  function executeConfirm() {
    if (!confirm) return;
    if (confirm.type === 'delete') {
      startTransition(async () => {
        await deleteUser(confirm.user.id);
        setUsers((prev) => prev.filter((u) => u.id !== confirm.user.id));
        if (drawer?.id === confirm.user.id) setDrawer(null);
      });
    } else {
      const newStatus: Status = confirm.type === 'enable' ? 'active' : 'disabled';
      startTransition(async () => {
        await updateUserStatus(confirm.user.id, newStatus);
        setUsers((prev) => prev.map((u) => u.id === confirm.user.id ? { ...u, status: newStatus, isActive: newStatus === 'active' } : u));
      });
    }
    setConfirm(null);
  }

  const STAT_CARDS = [
    { label: 'Total Users',         value: stats.total,   icon: '👥', color: '#111111' },
    { label: 'Active Users',         value: stats.active,  icon: '✅', color: '#16a34a' },
    { label: 'Sr. Site Engineers',   value: stats.senior,  icon: '🏗️', color: '#6366f1' },
    { label: 'Site Engineers',       value: stats.site,    icon: '🔧', color: '#6b7280' },
    { label: 'Pending Invites',      value: stats.invited, icon: '📨', color: '#d97706' },
  ];

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Access Management</h1>
          <p className="text-[13.5px] text-gray-500 mt-1">Manage users, roles, and system access permissions.</p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-black text-white text-[13px] font-semibold rounded-xl transition-colors shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          Add User
        </button>
      </div>

      {/* ── Summary cards ────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-4">
        {STAT_CARDS.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xl">{card.icon}</span>
            </div>
            <div className="text-[30px] font-bold leading-none" style={{ color: card.color }}>{card.value}</div>
            <div className="text-[11.5px] text-gray-500 mt-1.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* ── Table card ───────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100">
          {/* Search */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 h-9 flex-1 max-w-xs">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 flex-shrink-0">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-[13px] bg-transparent outline-none text-gray-700 placeholder:text-gray-400"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as Role | 'all')}
              className="h-9 px-3 text-[12.5px] border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/20 cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="senior_site_engineer">Sr. Site Engineer</option>
              <option value="site_engineer">Site Engineer</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as Status | 'all')}
              className="h-9 px-3 text-[12.5px] border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/20 cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="disabled">Disabled</option>
            </select>
            {(search || roleFilter !== 'all' || statusFilter !== 'all') && (
              <button
                onClick={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all'); }}
                className="h-9 px-3 text-[12px] border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          <div className="text-[12px] text-gray-400 flex-shrink-0">
            {filtered.length} of {users.length} users
          </div>
        </div>

        {/* Column headers */}
        <div className="grid px-5 py-3 bg-gray-50 border-b border-gray-100 text-[10.5px] font-bold uppercase tracking-widest text-gray-400"
          style={{ gridTemplateColumns: '2fr 1.2fr 100px 120px 120px 80px' }}>
          <span>Name</span>
          <span>Role</span>
          <span>Status</span>
          <span>Created</span>
          <span>Last Login</span>
          <span className="text-right">Actions</span>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <p className="text-[14px] font-semibold text-gray-700 mb-1">
              {users.length === 0 ? 'No users yet' : 'No users match your search'}
            </p>
            <p className="text-[12.5px] text-gray-400 mb-5 max-w-xs">
              {users.length === 0
                ? 'Add your first user to get started with access management.'
                : 'Try adjusting your search or filter criteria.'}
            </p>
            {users.length === 0 && (
              <button onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-[12.5px] font-medium rounded-lg hover:bg-black transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                Add First User
              </button>
            )}
          </div>
        ) : (
          <div className={`divide-y divide-gray-50 ${isPending ? 'opacity-60 pointer-events-none' : ''}`}>
            {filtered.map((user) => (
              <div
                key={user.id}
                className="grid items-center px-5 py-3.5 hover:bg-gray-50/60 transition-colors group"
                style={{ gridTemplateColumns: '2fr 1.2fr 100px 120px 120px 80px' }}
              >
                {/* Name + Email */}
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={user.fullName} role={user.role} size={36} />
                  <div className="min-w-0">
                    <button
                      onClick={() => setDrawer(user)}
                      className="text-[13.5px] font-semibold text-gray-900 hover:text-gray-600 transition-colors truncate block text-left"
                    >
                      {user.fullName}
                    </button>
                    <div className="text-[12px] text-gray-400 truncate">{user.email}</div>
                    {user.phone && <div className="text-[11px] text-gray-400">{user.phone}</div>}
                  </div>
                </div>

                {/* Role */}
                <div><RoleBadge role={user.role} /></div>

                {/* Status */}
                <div><StatusBadge status={user.status} /></div>

                {/* Created */}
                <div className="text-[12px] text-gray-500 font-mono">{fmtDate(user.createdAt)}</div>

                {/* Last Login */}
                <div className="text-[12px] text-gray-500">{fmtRelative(user.lastLogin)}</div>

                {/* Actions */}
                <div className="flex justify-end">
                  <ActionMenu
                    user={user}
                    onView={() => setDrawer(user)}
                    onEdit={() => setDrawer(user)}
                    onChangeRole={(role) => handleRoleChange(user.id, role)}
                    onToggleStatus={() => handleStatusToggle(user)}
                    onDelete={() => setConfirm({ type: 'delete', user })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modals / Drawers / Dialogs ────────────────────── */}
      {addOpen && (
        <AddUserModal
          onClose={() => setAddOpen(false)}
          onCreated={(newUser) => setUsers((prev) => [newUser, ...prev])}
        />
      )}

      {drawer && (
        <UserDrawer
          user={drawer}
          onClose={() => setDrawer(null)}
          onEdit={() => setDrawer(drawer)}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={
            confirm.type === 'delete'  ? `Delete ${confirm.user.fullName}?` :
            confirm.type === 'disable' ? `Disable ${confirm.user.fullName}?` :
            `Enable ${confirm.user.fullName}?`
          }
          description={
            confirm.type === 'delete'  ? 'This will permanently remove the user and cannot be undone.' :
            confirm.type === 'disable' ? 'This user will lose access to the system immediately.' :
            'This user will regain access to the system.'
          }
          confirmLabel={confirm.type === 'delete' ? 'Delete User' : confirm.type === 'disable' ? 'Disable Access' : 'Enable Access'}
          variant={confirm.type === 'delete' ? 'danger' : 'warning'}
          onConfirm={executeConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
