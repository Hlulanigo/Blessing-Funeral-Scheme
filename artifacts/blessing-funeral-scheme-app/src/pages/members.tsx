import { Search, SlidersHorizontal, UserPlus, ArrowUpRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { MemberStatus, getGetSettingsQueryKey, getListBranchesQueryKey, getListMembersQueryKey, useCreateMember, useGetSettings, useListBranches, useListMembers } from '@workspace/api-client-react';
import type { MemberInput } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { EmptyState, ErrorState, initials, Modal, PageHeader, StatusBadge, LoadingRows } from '@/components/ui';

export default function MembersPage({ canEditRecords }: { canEditRecords: boolean }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [branchId, setBranchId] = useState('');
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const params = useMemo(() => ({ search: search || undefined, status: (status || undefined) as MemberStatus | undefined, branchId: branchId || undefined }), [search, status, branchId]);
  const membersQuery = useListMembers(params, { query: { queryKey: getListMembersQueryKey(params) } });
  const branchesQuery = useListBranches(undefined, { query: { queryKey: getListBranchesQueryKey() } });
  const settingsQuery = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const createMember = useCreateMember();
  const members = membersQuery.data ?? [];
  return <div className="content-wrap page-enter">
    <PageHeader eyebrow="People and cover" title="Member directory" description="Find a record, check its cover, and keep every family detail current." actions={canEditRecords && <button data-testid="button-open-enrol-member" className="btn btn-primary" onClick={() => setOpen(true)}><UserPlus size={15} /> Enrol member</button>} />
    <div className="card p-3 mb-4 flex flex-col md:flex-row gap-2">
      <div className="relative flex-1"><Search size={15} className="absolute left-3 top-3 text-muted-foreground" /><input data-testid="input-member-search" className="input pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or member number" /></div>
      <select data-testid="select-member-status" className="select md:w-44" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="pending">Pending</option><option value="lapsed">Lapsed</option><option value="deceased">Deceased</option></select>
      <select data-testid="select-member-branch" className="select md:w-52" value={branchId} onChange={(e) => setBranchId(e.target.value)}><option value="">All branches</option>{(branchesQuery.data ?? []).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
      <button data-testid="button-member-filters" className="btn btn-secondary" onClick={() => { setStatus(''); setBranchId(''); }}><SlidersHorizontal size={15} /> Reset filters</button>
    </div>
    <div className="card overflow-hidden">
      {membersQuery.isLoading ? <LoadingRows /> : membersQuery.isError ? <ErrorState onRetry={() => membersQuery.refetch()} /> : members.length === 0 ? <EmptyState title="No members match those filters" description="Try a different name, branch, or status." action={<button data-testid="button-clear-member-filters" className="btn btn-secondary" onClick={() => { setSearch(''); setStatus(''); setBranchId(''); }}>Clear filters</button>} /> :
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Member</th><th>Branch</th><th>Plan</th><th>Monthly</th><th>Status</th><th>Next contribution</th><th /></tr></thead><tbody>{members.map((member) => <tr key={member.id} data-testid={`row-member-${member.id}`}><td><Link href={`/members/${member.id}`} data-testid={`link-member-${member.id}`} className="flex items-center gap-3 min-w-[220px]"><div className="avatar">{initials(member.name)}</div><div><div className="font-bold text-sm">{member.name}</div><div className="text-[11px] text-muted-foreground">{member.memberNumber}</div></div></Link></td><td><div className="font-semibold">{member.branchName}</div><div className="text-[11px] text-muted-foreground">{member.dependantsCount} dependants</div></td><td>{member.planName}</td><td className="font-bold">R {member.monthlyContribution.toFixed(0)}</td><td><StatusBadge status={member.status} /></td><td>{new Date(member.nextContributionDate).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })}</td><td><Link href={`/members/${member.id}`} data-testid={`link-open-member-${member.id}`} className="btn btn-ghost p-2"><ArrowUpRight size={15} /></Link></td></tr>)}</tbody></table></div>}
    </div>
    {canEditRecords && open && <MemberForm branches={branchesQuery.data ?? []} defaultPlanName={settingsQuery.data?.defaultPlanName ?? 'Family Cover'} pending={createMember.isPending} onClose={() => setOpen(false)} onSubmit={(data) => createMember.mutate({ data }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() }); setOpen(false); } })} />}
  </div>;
}

function MemberForm({ branches, defaultPlanName, pending, onClose, onSubmit }: { branches: { id: string; name: string }[]; defaultPlanName: string; pending: boolean; onClose: () => void; onSubmit: (data: MemberInput) => void }) {
  const [form, setForm] = useState<MemberInput>({ name: '', phone: '', email: '', address: '', idNumber: '', branchId: branches[0]?.id ?? '', planName: defaultPlanName });
  const set = (key: keyof MemberInput, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <Modal title="Enrol a member" description="Start with the details needed to protect the household." onClose={onClose}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit(form); }}><div className="grid sm:grid-cols-2 gap-3"><div><label className="label">Full name</label><input data-testid="input-member-name" required minLength={2} className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></div><div><label className="label">Phone</label><input data-testid="input-member-phone" required className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div><div><label className="label">Email</label><input data-testid="input-member-email" type="email" required className="input" value={form.email} onChange={(e) => set('email', e.target.value)} /></div><div><label className="label">ID number</label><input data-testid="input-member-id-number" required className="input" value={form.idNumber} onChange={(e) => set('idNumber', e.target.value)} /></div></div><div><label className="label">Address</label><input data-testid="input-member-address" required className="input" value={form.address} onChange={(e) => set('address', e.target.value)} /></div><div className="grid sm:grid-cols-2 gap-3"><div><label className="label">Branch</label><select data-testid="select-enrol-branch" className="select" value={form.branchId} onChange={(e) => set('branchId', e.target.value)}>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}</select></div><div><label className="label">Plan</label><select data-testid="select-enrol-plan" className="select" value={form.planName} onChange={(e) => set('planName', e.target.value)}>{!["Family Cover", "Individual Cover", "Premium Family Cover"].includes(defaultPlanName) && <option>{defaultPlanName}</option>}<option>Family Cover</option><option>Individual Cover</option><option>Premium Family Cover</option></select></div></div><div className="flex justify-end gap-2 pt-2"><button data-testid="button-cancel-enrol" type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button data-testid="button-submit-enrol" className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Create member'}</button></div></form></Modal>;
}
