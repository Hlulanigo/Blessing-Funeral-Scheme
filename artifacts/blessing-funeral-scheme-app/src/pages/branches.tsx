import { Archive, ArrowUpRight, Building2, Edit3, MapPin, Plus, RotateCcw, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';
import { getGetDashboardSummaryQueryKey, getListBranchesQueryKey, useCreateBranch, useListBranches, useUpdateBranch } from '@workspace/api-client-react';
import type { Branch, BranchInput } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingRows, Modal, PageHeader } from '@/components/ui';

export default function BranchesPage({ canManageBranches }: { canManageBranches: boolean }) {
  const [open, setOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState<BranchInput>({ name: '', location: '' });
  const queryClient = useQueryClient();
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const branchParams = canManageBranches ? { includeInactive: true } : undefined;
  const branchesQuery = useListBranches(branchParams, { query: { queryKey: getListBranchesQueryKey(branchParams) } });
  const branches = branchesQuery.data ?? [];
  const activeBranches = branches.filter((branch) => branch.active);
  const totalMembers = activeBranches.reduce((sum, branch) => sum + branch.memberCount, 0);
  const avgRate = activeBranches.length ? activeBranches.reduce((sum, branch) => sum + branch.collectionRate, 0) / activeBranches.length : 0;
  const refreshBranches = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: getListBranchesQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getListBranchesQueryKey(branchParams) }),
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }),
  ]);
  const openCreate = () => {
    setEditingBranch(null);
    setForm({ name: '', location: '' });
    setOpen(true);
  };
  const submitBranch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingBranch) {
      updateBranch.mutate({ branchId: editingBranch.id, data: form }, { onSuccess: async () => { await refreshBranches(); setOpen(false); setEditingBranch(null); } });
    } else {
      createBranch.mutate({ data: form }, { onSuccess: async () => { await refreshBranches(); setForm({ name: '', location: '' }); setOpen(false); } });
    }
  };
  const toggleBranch = (branch: Branch) => updateBranch.mutate({ branchId: branch.id, data: { active: !branch.active } }, { onSuccess: refreshBranches });
  return <div className="content-wrap page-enter">
    <PageHeader eyebrow="The network behind the records" title="Branch coverage" description="See where members are supported and how consistently contributions are arriving." actions={<><Link href="/members" data-testid="link-branch-members" className="btn btn-secondary"><Users size={15} /> Browse members</Link>{canManageBranches && <button data-testid="button-add-branch" className="btn btn-primary" onClick={openCreate}><Plus size={15} /> Add branch</button>}</>} />
    {(createBranch.isError || updateBranch.isError) && <div role="alert" className="mb-4 text-sm text-destructive">{createBranch.error instanceof Error ? createBranch.error.message : updateBranch.error instanceof Error ? updateBranch.error.message : 'Could not save the branch. Please try again.'}</div>}
    <div className="grid md:grid-cols-3 gap-4 mb-5"><div className="card stat-card"><div className="stat-label">Active branches</div><div className="stat-value" data-testid="value-branch-count">{activeBranches.length}</div><div className="text-xs text-muted-foreground mt-2">Across the scheme</div></div><div className="card stat-card"><div className="stat-label">Members covered</div><div className="stat-value" data-testid="value-branch-members">{totalMembers}</div><div className="text-xs text-muted-foreground mt-2">People in active branches</div></div><div className="card stat-card"><div className="stat-label">Average collection</div><div className="stat-value" data-testid="value-branch-rate">{avgRate.toFixed(1)}%</div><div className="text-xs text-muted-foreground mt-2">This month</div></div></div>
    <div className="grid md:grid-cols-2 gap-5">{branchesQuery.isLoading ? <LoadingRows count={4} /> : branchesQuery.isError ? <div className="card md:col-span-2"><ErrorState onRetry={() => branchesQuery.refetch()} /></div> : branches.length === 0 ? <div className="card md:col-span-2"><EmptyState title="No branches configured" description="Branch coverage will appear here once locations are added." /></div> : branches.map((branch) => <section className={`card p-5 ${!branch.active ? 'opacity-70' : ''}`} key={branch.id} data-testid={`card-branch-${branch.id}`}><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-secondary grid place-items-center text-primary"><Building2 size={18} /></div><div><div className="font-bold">{branch.name}{!branch.active && <span className="badge badge-suspended ml-2">Inactive</span>}</div><div className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><MapPin size={12} /> {branch.location}</div></div></div>{canManageBranches ? <div className="flex gap-1"><button title="Edit branch" aria-label={`Edit ${branch.name}`} data-testid={`button-edit-branch-${branch.id}`} className="btn btn-ghost p-2" onClick={() => { setEditingBranch(branch); setForm({ name: branch.name, location: branch.location }); setOpen(true); }}><Edit3 size={15} /></button><button title={branch.active ? 'Deactivate branch' : 'Reactivate branch'} aria-label={`${branch.active ? 'Deactivate' : 'Reactivate'} ${branch.name}`} data-testid={`button-toggle-branch-${branch.id}`} className="btn btn-ghost p-2" onClick={() => toggleBranch(branch)} disabled={updateBranch.isPending}>{branch.active ? <Archive size={15} /> : <RotateCcw size={15} />}</button></div> : <Link href="/members" data-testid={`button-branch-menu-${branch.id}`} className="btn btn-ghost p-2"><ArrowUpRight size={15} /></Link>}</div><div className="grid grid-cols-2 gap-4 mt-6"><div><div className="text-[10px] text-muted-foreground uppercase tracking-wider">Members</div><div className="text-xl font-bold mt-1">{branch.memberCount}</div></div><div><div className="text-[10px] text-muted-foreground uppercase tracking-wider">Collection</div><div className="text-xl font-bold mt-1">{branch.collectionRate.toFixed(1)}%</div></div></div><div className="mini-bar mt-5"><span style={{ width: `${Math.min(branch.collectionRate, 100)}%` }} /></div><div className="flex justify-between mt-2 text-[11px] text-muted-foreground"><span>Monthly collection health</span><span>{branch.collectionRate >= 85 ? 'On track' : 'Follow-up needed'}</span></div></section>)}</div>
    {open && <Modal title={editingBranch ? 'Edit branch' : 'Add a branch'} description={editingBranch ? 'Update the branch details.' : 'Create a new location in the scheme.'} onClose={() => { setOpen(false); setEditingBranch(null); }}><form className="space-y-4" onSubmit={submitBranch}><div><label className="label" htmlFor="branch-name">Branch name</label><input id="branch-name" data-testid="input-branch-name" required minLength={2} className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></div><div><label className="label" htmlFor="branch-location">Location</label><input id="branch-location" data-testid="input-branch-location" required minLength={2} className="input" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} /></div><div className="flex justify-end gap-2"><button data-testid="button-cancel-branch" type="button" className="btn btn-secondary" onClick={() => { setOpen(false); setEditingBranch(null); }}>Cancel</button><button data-testid="button-submit-branch" className="btn btn-primary" disabled={createBranch.isPending || updateBranch.isPending}>{createBranch.isPending || updateBranch.isPending ? 'Saving...' : editingBranch ? 'Save branch' : 'Create branch'}</button></div></form></Modal>}
  </div>;
}
