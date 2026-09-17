import {
  Check,
  Edit3,
  Mail,
  MoreHorizontal,
  PauseCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListStaffQueryKey,
  getListBranchesQueryKey,
  useCreateStaff,
  useListBranches,
  useListStaff,
  useUpdateStaff,
} from '@workspace/api-client-react';
import type { Staff, StaffInput, StaffRole, StaffStatus } from '@workspace/api-client-react';
import { EmptyState, ErrorState, initials, LoadingRows, Modal, PageHeader, StatusBadge } from '@/components/ui';

type StaffFilters = {
  search?: string;
  status?: StaffStatus;
  role?: StaffRole;
};

const roles: { value: StaffRole; label: string; description: string }[] = [
  { value: 'administrator', label: 'Administrator', description: 'Full scheme access' },
  { value: 'manager', label: 'Manager', description: 'People and operations' },
  { value: 'coordinator', label: 'Coordinator', description: 'Branch administration' },
  { value: 'support', label: 'Support', description: 'Member assistance' },
];

const statuses: { value: StaffStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'invited', label: 'Invited' },
  { value: 'suspended', label: 'Suspended' },
];

function roleLabel(role: StaffRole) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function dateLabel(value: string | null) {
  if (!value) return 'Not yet active';
  return new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function mutationMessage(error: unknown) {
  if (!error) return '';
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: string }).message || 'Something went wrong. Please try again.');
  }
  return 'Something went wrong. Please try again.';
}

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StaffStatus | ''>('');
  const [role, setRole] = useState<StaffRole | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [menuStaffId, setMenuStaffId] = useState<string | null>(null);

  const params = useMemo<StaffFilters>(
    () => ({
      search: search.trim() || undefined,
      status: status || undefined,
      role: role || undefined,
    }),
    [role, search, status],
  );
  const staffQuery = useListStaff(params, { query: { queryKey: getListStaffQueryKey(params) } });
  const branchesQuery = useListBranches({ query: { queryKey: getListBranchesQueryKey() } });
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const staff = staffQuery.data ?? [];

  const activeCount = staff.filter((person) => person.status === 'active').length;
  const invitedCount = staff.filter((person) => person.status === 'invited').length;
  const suspendedCount = staff.filter((person) => person.status === 'suspended').length;

  const invalidateStaff = () => {
    queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
  };

  const openCreate = () => {
    setEditingStaff(null);
    setMenuStaffId(null);
    setFormOpen(true);
  };

  const openEdit = (person: Staff) => {
    setEditingStaff(person);
    setMenuStaffId(null);
    setFormOpen(true);
  };

  const updateStatus = (person: Staff) => {
    setMenuStaffId(null);
    updateStaff.mutate(
      { staffId: person.id, data: { status: person.status === 'suspended' ? 'active' : 'suspended' } },
      { onSuccess: invalidateStaff },
    );
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setRole('');
  };

  return (
    <div className="content-wrap page-enter" onClick={() => menuStaffId && setMenuStaffId(null)}>
      <PageHeader
        eyebrow="People and permissions"
        title="Staff directory"
        description="Keep the people behind every member conversation visible, current, and accountable."
        actions={
          <button data-testid="button-add-staff" className="btn btn-primary" onClick={openCreate}>
            <Plus size={15} />
            Add staff member
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-5 max-[560px]:grid-cols-1">
        <div className="card stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Active today</span>
            <span className="rounded-full p-2 bg-[hsl(152_27%_43%/.1)] text-[hsl(152_27%_33%)]"><Check size={15} /></span>
          </div>
          <div data-testid="text-active-staff-count" className="stat-value">{staffQuery.isLoading ? '—' : activeCount}</div>
          <div className="text-[11px] text-muted-foreground mt-2">Ready for scheme operations</div>
        </div>
        <div className="card stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Awaiting access</span>
            <span className="rounded-full p-2 bg-[hsl(38_53%_55%/.13)] text-[hsl(34_50%_35%)]"><Mail size={15} /></span>
          </div>
          <div data-testid="text-invited-staff-count" className="stat-value">{staffQuery.isLoading ? '—' : invitedCount}</div>
          <div className="text-[11px] text-muted-foreground mt-2">Invitations still open</div>
        </div>
        <div className="card stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Suspended</span>
            <span className="rounded-full p-2 bg-[hsl(4_58%_48%/.1)] text-[hsl(4_58%_40%)]"><PauseCircle size={15} /></span>
          </div>
          <div data-testid="text-suspended-staff-count" className="stat-value">{staffQuery.isLoading ? '—' : suspendedCount}</div>
          <div className="text-[11px] text-muted-foreground mt-2">Access currently paused</div>
        </div>
      </div>

      <div className="card p-3 mb-4 flex flex-col lg:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-3 text-muted-foreground" />
          <input
            data-testid="input-staff-search"
            className="input pl-9"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, or phone"
          />
        </div>
        <label className="sr-only" htmlFor="staff-status-filter">Filter by status</label>
        <select data-testid="select-staff-status" id="staff-status-filter" className="select lg:w-44" value={status} onChange={(event) => setStatus(event.target.value as StaffStatus | '')}>
          {statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <label className="sr-only" htmlFor="staff-role-filter">Filter by role</label>
        <select data-testid="select-staff-role" id="staff-role-filter" className="select lg:w-48" value={role} onChange={(event) => setRole(event.target.value as StaffRole | '')}>
          <option value="">All roles</option>
          {roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <button data-testid="button-clear-staff-filters" className="btn btn-secondary" onClick={clearFilters}>
          <RefreshCw size={14} />
          Reset
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="section-title">All staff</h2>
          <p data-testid="text-staff-result-count" className="section-subtitle">{staffQuery.isLoading ? 'Loading records…' : `${staff.length} ${staff.length === 1 ? 'person' : 'people'} shown`}</p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck size={14} className="text-[hsl(var(--accent))]" />
          Access is role-based
        </div>
      </div>

      <div className="card overflow-hidden">
        {staffQuery.isLoading ? <LoadingRows count={6} /> : staffQuery.isError ? <ErrorState onRetry={() => staffQuery.refetch()} /> : staff.length === 0 ? (
          <EmptyState
            title={search || status || role ? 'No staff match those filters' : 'No staff members yet'}
            description={search || status || role ? 'Try a different name, role, or access status.' : 'Add the first person who helps run the scheme.'}
            action={
              search || status || role
                ? <button data-testid="button-empty-clear-filters" className="btn btn-secondary" onClick={clearFilters}>Clear filters</button>
                : <button data-testid="button-empty-add-staff" className="btn btn-primary" onClick={openCreate}><Plus size={14} /> Add staff member</button>
            }
          />
        ) : (
          <>
            <div className="table-wrap hidden md:block">
              <table className="data-table">
                <thead>
                  <tr><th>Staff member</th><th>Role</th><th>Branch</th><th>Last active</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {staff.map((person) => <StaffRow key={person.id} person={person} menuOpen={menuStaffId === person.id} onMenu={() => setMenuStaffId(menuStaffId === person.id ? null : person.id)} onEdit={() => openEdit(person)} onToggleStatus={() => updateStatus(person)} updating={updateStaff.isPending && updateStaff.variables?.staffId === person.id} />)}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-border">
              {staff.map((person) => (
                <StaffCard key={person.id} person={person} menuOpen={menuStaffId === person.id} onMenu={() => setMenuStaffId(menuStaffId === person.id ? null : person.id)} onEdit={() => openEdit(person)} onToggleStatus={() => updateStatus(person)} updating={updateStaff.isPending && updateStaff.variables?.staffId === person.id} />
              ))}
            </div>
          </>
        )}
      </div>

      {updateStaff.isError && !formOpen && (
        <div data-testid="text-staff-update-error" className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {mutationMessage(updateStaff.error)}
        </div>
      )}

      {formOpen && (
        <StaffForm
          staff={editingStaff}
          branches={branchesQuery.data ?? []}
          pending={createStaff.isPending || updateStaff.isPending}
          error={createStaff.error || updateStaff.error}
          onClose={() => { if (!createStaff.isPending && !updateStaff.isPending) setFormOpen(false); }}
          onSubmit={(data, currentStatus) => {
            if (editingStaff) {
              updateStaff.mutate(
                { staffId: editingStaff.id, data: { ...data, status: currentStatus } },
                { onSuccess: () => { invalidateStaff(); setFormOpen(false); } },
              );
            } else {
              createStaff.mutate(
                { data },
                { onSuccess: () => { invalidateStaff(); setFormOpen(false); } },
              );
            }
          }}
        />
      )}
    </div>
  );
}

function StaffRow({ person, menuOpen, onMenu, onEdit, onToggleStatus, updating }: { person: Staff; menuOpen: boolean; onMenu: () => void; onEdit: () => void; onToggleStatus: () => void; updating: boolean }) {
  return (
    <tr data-testid={`row-staff-${person.id}`}>
      <td>
        <div className="flex items-center gap-3 min-w-[230px]">
          <div className="avatar">{initials(person.name)}</div>
          <div><div data-testid={`text-staff-name-${person.id}`} className="font-bold text-sm">{person.name}</div><div className="text-[11px] text-muted-foreground">{person.email} · {person.phone}</div></div>
        </div>
      </td>
      <td><span className="font-semibold text-sm">{roleLabel(person.role)}</span></td>
      <td><span className="text-sm">{person.branchName || 'Unassigned'}</span></td>
      <td><span className="text-sm">{dateLabel(person.lastActiveAt)}</span></td>
      <td><StatusBadge status={person.status} /></td>
      <td>
        <div className="relative flex justify-end" onClick={(event) => event.stopPropagation()}>
          <button data-testid={`button-staff-menu-${person.id}`} className="btn btn-ghost p-2" aria-label={`Actions for ${person.name}`} onClick={onMenu}><MoreHorizontal size={16} /></button>
          {menuOpen && <StaffMenu person={person} onEdit={onEdit} onToggleStatus={onToggleStatus} updating={updating} />}
        </div>
      </td>
    </tr>
  );
}

function StaffCard({ person, menuOpen, onMenu, onEdit, onToggleStatus, updating }: { person: Staff; menuOpen: boolean; onMenu: () => void; onEdit: () => void; onToggleStatus: () => void; updating: boolean }) {
  return (
    <div data-testid={`card-staff-${person.id}`} className="p-4" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="avatar">{initials(person.name)}</div>
          <div className="min-w-0"><div data-testid={`text-mobile-staff-name-${person.id}`} className="font-bold text-sm truncate">{person.name}</div><div className="text-[11px] text-muted-foreground truncate">{person.email}</div></div>
        </div>
        <div className="relative shrink-0">
          <button data-testid={`button-mobile-staff-menu-${person.id}`} className="btn btn-ghost p-2" aria-label={`Actions for ${person.name}`} onClick={onMenu}><MoreHorizontal size={16} /></button>
          {menuOpen && <StaffMenu person={person} onEdit={onEdit} onToggleStatus={onToggleStatus} updating={updating} />}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
        <div><div className="label mb-1">Role</div><span className="font-semibold">{roleLabel(person.role)}</span></div>
        <div><div className="label mb-1">Status</div><StatusBadge status={person.status} /></div>
        <div><div className="label mb-1">Branch</div><span>{person.branchName || 'Unassigned'}</span></div>
        <div><div className="label mb-1">Last active</div><span>{dateLabel(person.lastActiveAt)}</span></div>
      </div>
    </div>
  );
}

function StaffMenu({ person, onEdit, onToggleStatus, updating }: { person: Staff; onEdit: () => void; onToggleStatus: () => void; updating: boolean }) {
  return (
    <div className="absolute right-0 top-9 z-10 w-44 rounded-lg border border-border bg-card p-1 shadow-lg">
      <button data-testid={`button-edit-staff-${person.id}`} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold hover:bg-muted" onClick={onEdit}><Edit3 size={14} /> Edit details</button>
      <button data-testid={`button-toggle-staff-${person.id}`} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold hover:bg-muted disabled:opacity-50" onClick={onToggleStatus} disabled={updating}>
        {person.status === 'suspended' ? <><Check size={14} /> Reactivate access</> : <><PauseCircle size={14} /> Suspend access</>}
      </button>
    </div>
  );
}

function StaffForm({ staff, branches, pending, error, onClose, onSubmit }: { staff: Staff | null; branches: { id: string; name: string }[]; pending: boolean; error: unknown; onClose: () => void; onSubmit: (data: StaffInput, status: StaffStatus) => void }) {
  const [form, setForm] = useState<StaffInput>({
    name: staff?.name ?? '',
    email: staff?.email ?? '',
    phone: staff?.phone ?? '',
    role: staff?.role ?? 'support',
    branchId: staff?.branchId ?? null,
  });
  const [currentStatus, setCurrentStatus] = useState<StaffStatus>(staff?.status ?? 'active');
  const set = <K extends keyof StaffInput>(key: K, value: StaffInput[K]) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <Modal title={staff ? 'Edit staff member' : 'Add staff member'} description={staff ? 'Update contact details, role, or access.' : 'Create a record for someone joining the operations team.'} onClose={onClose}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit(form, currentStatus); }}>
        <div className="rounded-xl border border-border bg-secondary/45 p-3 flex items-center gap-3">
          <div className="avatar large"><UserRound size={21} /></div>
          <div><div className="font-semibold text-sm">{staff ? staff.name : 'New staff profile'}</div><div className="text-[11px] text-muted-foreground">{staff ? `Joined ${dateLabel(staff.joinedAt)}` : 'An invitation will be sent after saving'}</div></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label" htmlFor="staff-name">Full name</label><input data-testid="input-staff-name" id="staff-name" required minLength={2} className="input" value={form.name} onChange={(event) => set('name', event.target.value)} /></div>
          <div><label className="label" htmlFor="staff-phone">Phone</label><input data-testid="input-staff-phone" id="staff-phone" required minLength={5} className="input" value={form.phone} onChange={(event) => set('phone', event.target.value)} /></div>
        </div>
        <div><label className="label" htmlFor="staff-email">Work email</label><input data-testid="input-staff-email" id="staff-email" required type="email" className="input" value={form.email} onChange={(event) => set('email', event.target.value)} /></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="staff-role">Role</label>
            <select data-testid="select-form-staff-role" id="staff-role" className="select" value={form.role} onChange={(event) => set('role', event.target.value as StaffRole)}>
              {roles.map((item) => <option key={item.value} value={item.value}>{item.label} — {item.description}</option>)}
            </select>
          </div>
          <div><label className="label" htmlFor="staff-branch">Branch assignment</label><select data-testid="select-staff-branch" id="staff-branch" className="select" value={form.branchId ?? ''} onChange={(event) => set('branchId', event.target.value || null)}><option value="">All branches</option>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}</select></div>
        </div>
        {staff && <div><label className="label" htmlFor="staff-access-status">Access status</label><select data-testid="select-form-staff-status" id="staff-access-status" className="select" value={currentStatus} onChange={(event) => setCurrentStatus(event.target.value as StaffStatus)}><option value="active">Active</option><option value="invited">Invited</option><option value="suspended">Suspended</option></select></div>}
        {Boolean(error) && <div data-testid="text-staff-form-error" className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{mutationMessage(error)}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button data-testid="button-cancel-staff" type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button data-testid="button-submit-staff" type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : staff ? 'Save changes' : 'Create staff member'}</button>
        </div>
      </form>
    </Modal>
  );
}