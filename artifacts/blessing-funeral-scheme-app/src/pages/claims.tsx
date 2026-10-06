import { Check, Download, FilePlus2, Paperclip, Search, Upload, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ClaimStatus, getListClaimDocumentsQueryKey, getListClaimsQueryKey, getListMembersQueryKey, useCreateClaim, useListClaimDocuments, useListClaims, useListMembers, useUpdateClaim, useUploadClaimDocument } from '@workspace/api-client-react';
import type { Claim, ClaimDocumentInput, ClaimInput } from '@workspace/api-client-react';
import { EmptyState, ErrorState, formatCurrency, formatDate, LoadingRows, Modal, PageHeader, StatusBadge } from '@/components/ui';

const nextStatus: Record<string, ClaimStatus | undefined> = { submitted: 'reviewing', reviewing: 'approved', approved: 'paid' };
export default function ClaimsPage({ canSubmit, canReview }: { canSubmit: boolean; canReview: boolean }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [evidenceClaim, setEvidenceClaim] = useState<Claim | null>(null);
  const params = useMemo(() => ({ status: (status || undefined) as ClaimStatus | undefined, search: search || undefined }), [status, search]);
  const queryClient = useQueryClient();
  const claimsQuery = useListClaims(params, { query: { queryKey: getListClaimsQueryKey(params) } });
  const membersQuery = useListMembers(undefined, { query: { queryKey: getListMembersQueryKey() } });
  const createClaim = useCreateClaim();
  const updateClaim = useUpdateClaim();
  const claims = claimsQuery.data ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: getListClaimsQueryKey() });
  return <div className="content-wrap page-enter">
    <PageHeader eyebrow="Support when it matters" title="Claims queue" description="Move each request forward with care, clear notes, and a visible next step." actions={canSubmit && <button data-testid="button-open-submit-claim" className="btn btn-primary" onClick={() => setOpen(true)}><FilePlus2 size={15} /> Submit claim</button>} />
    <div className="card p-3 mb-4 flex flex-col md:flex-row gap-2"><div className="relative flex-1"><Search size={15} className="absolute left-3 top-3 text-muted-foreground" /><input data-testid="input-claim-search" className="input pl-9" placeholder="Search claim, member, or deceased name" value={search} onChange={(e) => setSearch(e.target.value)} /></div><select data-testid="select-claim-status" className="select md:w-48" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option value="submitted">Submitted</option><option value="reviewing">Reviewing</option><option value="approved">Approved</option><option value="paid">Paid</option><option value="declined">Declined</option></select></div>
    <div className="card overflow-hidden">{claimsQuery.isLoading ? <LoadingRows /> : claimsQuery.isError ? <ErrorState onRetry={() => claimsQuery.refetch()} /> : claims.length === 0 ? <EmptyState title="The claims queue is clear" description="New funeral assistance requests will appear here for review." action={canSubmit && <button data-testid="button-submit-empty-claim" className="btn btn-primary" onClick={() => setOpen(true)}><FilePlus2 size={14} /> Submit a claim</button>} /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Claim</th><th>Member</th><th>Deceased</th><th>Amount</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead><tbody>{claims.map((claim) => <tr key={claim.id} data-testid={`row-claim-${claim.id}`}><td><div className="font-bold">{claim.claimNumber}</div><div className="text-[11px] text-muted-foreground">{claim.relationship}</div></td><td>{claim.memberName}</td><td>{claim.deceasedName}</td><td className="font-bold">{formatCurrency(claim.amount)}</td><td>{formatDate(claim.submittedAt)}</td><td><StatusBadge status={claim.status} /></td><td><div className="flex items-center gap-2"><button data-testid={`button-claim-evidence-${claim.id}`} className="btn btn-ghost py-1.5" onClick={() => setEvidenceClaim(claim)}><Paperclip size={14} /> Evidence</button>{!canReview ? <span className="text-xs text-muted-foreground">Read only</span> : nextStatus[claim.status] ? <button data-testid={`button-progress-claim-${claim.id}`} className="btn btn-secondary py-1.5" disabled={updateClaim.isPending} onClick={() => updateClaim.mutate({ claimId: claim.id, data: { status: nextStatus[claim.status] } }, { onSuccess: refresh })}>{nextStatus[claim.status] === 'paid' ? <><Check size={13} /> Mark paid</> : <>Move to {nextStatus[claim.status]}</>}</button> : claim.status === 'declined' ? <span className="text-xs text-muted-foreground">Closed</span> : <button data-testid={`button-decline-claim-${claim.id}`} className="btn btn-danger py-1.5" onClick={() => updateClaim.mutate({ claimId: claim.id, data: { status: 'declined' } }, { onSuccess: refresh })}><XCircle size={13} /> Decline</button>}</div></td></tr>)}</tbody></table></div>}</div>
    {canSubmit && open && <ClaimForm members={membersQuery.data ?? []} pending={createClaim.isPending} onClose={() => setOpen(false)} onSubmit={(data) => createClaim.mutate({ data }, { onSuccess: () => { refresh(); setOpen(false); } })} />}
    {evidenceClaim && <ClaimEvidencePanel claim={evidenceClaim} canUpload={canSubmit} onClose={() => setEvidenceClaim(null)} />}
  </div>;
}

function ClaimEvidencePanel({ claim, canUpload, onClose }: { claim: Claim; canUpload: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const documentsQuery = useListClaimDocuments(claim.id, { query: { queryKey: getListClaimDocumentsQueryKey(claim.id) } });
  const uploadDocument = useUploadClaimDocument();
  const [fileError, setFileError] = useState('');
  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setFileError('Choose a PDF, JPEG, or PNG file up to 5 MB.');
      return;
    }
    setFileError('');
    const reader = new FileReader();
    reader.onerror = () => setFileError('Could not read the selected file.');
    reader.onload = () => {
      const dataBase64 = String(reader.result).split(',')[1] ?? '';
      const data: ClaimDocumentInput = { fileName: file.name, contentType: file.type as ClaimDocumentInput['contentType'], dataBase64 };
      uploadDocument.mutate({ claimId: claim.id, data }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListClaimDocumentsQueryKey(claim.id) }) });
    };
    reader.readAsDataURL(file);
  };
  return <Modal title={`Evidence for ${claim.claimNumber}`} description={`${claim.memberName} · ${claim.deceasedName}`} onClose={onClose}>
    <div className="space-y-4">
      {canUpload && <div><label className="btn btn-secondary" htmlFor="claim-evidence-file"><Upload size={14} /> {uploadDocument.isPending ? 'Uploading...' : 'Attach evidence'}</label><input id="claim-evidence-file" data-testid="input-claim-evidence" className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png" disabled={uploadDocument.isPending} onChange={handleFile} />{fileError && <p role="alert" className="text-xs text-destructive mt-2">{fileError}</p>}{uploadDocument.isError && <p role="alert" className="text-xs text-destructive mt-2">{uploadDocument.error instanceof Error ? uploadDocument.error.message : 'Upload failed.'}</p>}</div>}
      {documentsQuery.isLoading ? <LoadingRows count={2} /> : documentsQuery.isError ? <ErrorState onRetry={() => documentsQuery.refetch()} /> : documentsQuery.data?.length ? <div className="divide-y divide-border">{documentsQuery.data.map((document) => <div key={document.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><div className="truncate text-sm font-semibold">{document.fileName}</div><div className="text-xs text-muted-foreground">{(document.sizeBytes / (1024 * 1024)).toFixed(2)} MB · {formatDate(document.uploadedAt)}</div></div><a className="btn btn-ghost p-2" href={`/api/claims/${claim.id}/documents/${document.id}`} aria-label={`Download ${document.fileName}`}><Download size={15} /></a></div>)}</div> : <EmptyState title="No evidence attached" description="Uploaded claim documents will be listed here." />}
    </div>
  </Modal>;
}

function ClaimForm({ members, pending, onClose, onSubmit }: { members: { id: string; name: string; memberNumber: string }[]; pending: boolean; onClose: () => void; onSubmit: (data: ClaimInput) => void }) {
  const [form, setForm] = useState<ClaimInput>({ memberId: members[0]?.id ?? '', deceasedName: '', relationship: '', amount: 0, notes: '' });
  return <Modal title="Submit funeral assistance claim" description="Capture the facts clearly so review can move with dignity." onClose={onClose}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit(form); }}><div><label className="label">Member</label><select data-testid="select-claim-member" required className="select" value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })}>{members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.memberNumber}</option>)}</select></div><div className="grid sm:grid-cols-2 gap-3"><div><label className="label">Deceased name</label><input data-testid="input-claim-deceased-name" required className="input" value={form.deceasedName} onChange={(e) => setForm({ ...form, deceasedName: e.target.value })} /></div><div><label className="label">Relationship</label><input data-testid="input-claim-relationship" required className="input" placeholder="Parent, spouse, child" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} /></div><div><label className="label">Assistance amount</label><input data-testid="input-claim-amount" required type="number" min="0.01" step="0.01" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div></div><div><label className="label">Notes</label><textarea data-testid="textarea-claim-notes" required className="textarea" placeholder="Documents received, family contact, or review context" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div><div className="flex justify-end gap-2"><button data-testid="button-cancel-claim" type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button data-testid="button-save-claim" className="btn btn-primary" disabled={pending || !form.memberId}>{pending ? 'Submitting…' : 'Submit claim'}</button></div></form></Modal>;
}
