import { ArrowRight, CalendarClock, CheckCircle2, CircleAlert, Clock3, Plus, ShieldCheck, TrendingUp, UserPlus } from 'lucide-react';
import { Link } from 'wouter';
import { useGetDashboardSummary, useListActivity } from '@workspace/api-client-react';
import { useAuth } from '@workspace/replit-auth-web';
import { getGetDashboardSummaryQueryKey, getListActivityQueryKey } from '@workspace/api-client-react';
import { EmptyState, ErrorState, formatCurrency, formatDate, LoadingRows, PageHeader, StatusBadge } from '@/components/ui';

export default function DashboardPage() {
  const auth = useAuth();
  const summaryQuery = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const activityQuery = useListActivity({ query: { queryKey: getListActivityQueryKey() } });
  const summary = summaryQuery.data;
  const activities = activityQuery.data ?? [];
  const loading = summaryQuery.isLoading || activityQuery.isLoading;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = auth.user?.firstName || auth.user?.email?.split('@')[0] || 'there';
  const today = new Intl.DateTimeFormat('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  return (
    <div className="content-wrap page-enter">
      <PageHeader eyebrow={today} title={`${greeting}, ${firstName}.`} description="A calm view of the work that keeps every family covered." actions={<><Link href="/members" data-testid="link-dashboard-members" className="btn btn-secondary"><UserPlus size={15} /> Enrol member</Link><Link href="/claims" data-testid="link-dashboard-claims" className="btn btn-primary"><Plus size={15} /> New claim</Link></>} />
      {loading ? <div className="grid gap-4 md:grid-cols-4 stat-grid">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card stat-card skeleton" />)}</div> : summaryQuery.isError ? <div className="card"><ErrorState onRetry={() => { summaryQuery.refetch(); activityQuery.refetch(); }} /></div> : (
        <>
          <div className="grid gap-4 md:grid-cols-4 stat-grid">
             <div className="card stat-card"><div className="flex items-center justify-between"><span className="stat-label">Active members</span><ShieldCheck size={16} className="text-[hsl(var(--chart-3))]" /></div><div className="stat-value" data-testid="value-active-members">{summary?.activeMembers ?? 0}</div><div className="text-[11px] text-muted-foreground mt-2">Live count from member records</div></div>
            <div className="card stat-card"><div className="flex items-center justify-between"><span className="stat-label">Collected this month</span><TrendingUp size={16} className="text-[hsl(var(--accent))]" /></div><div className="stat-value" data-testid="value-contributions">{formatCurrency(summary?.contributionsThisMonth ?? 0)}</div><div className="text-[11px] text-muted-foreground mt-2">Across {summary?.branches?.length ?? 0} branches</div></div>
            <div className="card stat-card"><div className="flex items-center justify-between"><span className="stat-label">Overdue contributions</span><CircleAlert size={16} className="text-destructive" /></div><div className="stat-value" data-testid="value-overdue">{summary?.overdueContributions ?? 0}</div><Link href="/contributions" data-testid="link-dashboard-overdue" className="text-[11px] text-destructive font-bold mt-2 inline-flex items-center gap-1">Review ledger <ArrowRight size={12} /></Link></div>
            <div className="card stat-card"><div className="flex items-center justify-between"><span className="stat-label">Open claims</span><Clock3 size={16} className="text-[hsl(var(--accent))]" /></div><div className="stat-value" data-testid="value-open-claims">{summary?.openClaims ?? 0}</div><div className="text-[11px] text-muted-foreground mt-2"><span className="font-bold text-foreground">{summary?.approvedClaims ?? 0}</span> approved for payment</div></div>
          </div>
          <div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr] mt-5">
            <section className="card p-5">
              <div className="flex items-start justify-between gap-4 mb-5"><div><div className="section-title">Branch collection pulse</div><div className="section-subtitle mt-1">A quick read on contributions landing this month.</div></div><Link href="/branches" data-testid="link-view-branches" className="btn btn-ghost">All branches <ArrowRight size={14} /></Link></div>
              <div className="space-y-5">{(summary?.branches ?? []).slice(0, 4).map((branch) => <div key={branch.id} data-testid={`row-dashboard-branch-${branch.id}`}><div className="flex items-center justify-between mb-2"><div><div className="text-sm font-bold">{branch.name}</div><div className="text-[11px] text-muted-foreground">{branch.memberCount} members · {branch.location}</div></div><div className="text-sm font-bold">{branch.collectionRate.toFixed(1)}%</div></div><div className="mini-bar"><span style={{ width: `${Math.min(branch.collectionRate, 100)}%` }} /></div></div>)}{!(summary?.branches?.length) && <EmptyState title="No branch data yet" description="Branch collection performance will appear here." />}</div>
            </section>
            <section className="card p-5">
              <div className="flex items-start justify-between gap-4 mb-5"><div><div className="section-title">Claims by stage</div><div className="section-subtitle mt-1">Where support requests need attention.</div></div><Link href="/claims" data-testid="link-view-claims" className="btn btn-ghost">Queue <ArrowRight size={14} /></Link></div>
              <div className="space-y-4">{(summary?.claimBreakdown ?? []).map((item) => <div key={item.status} className="flex items-center justify-between"><div className="flex items-center gap-2"><StatusBadge status={item.status} /></div><span className="text-sm font-bold">{item.count}</span></div>)}{!(summary?.claimBreakdown?.length) && <EmptyState title="No open claims" description="The queue is clear for now." />}</div>
              <div className="mt-6 pt-4 border-t border-border flex items-center gap-2 text-xs text-muted-foreground"><CalendarClock size={14} /> Updated a few moments ago</div>
            </section>
          </div>
          <section className="card p-5 mt-5">
            <div className="flex items-start justify-between mb-4"><div><div className="section-title">Recent activity</div><div className="section-subtitle mt-1">A shared trail of the latest record changes.</div></div><button data-testid="button-refresh-activity" className="btn btn-ghost" onClick={() => activityQuery.refetch()}>Refresh</button></div>
            {activityQuery.isError ? <ErrorState onRetry={() => activityQuery.refetch()} /> : activities.length === 0 ? <EmptyState title="No activity to show" description="Record changes will appear here as the team works." /> : <div className="space-y-5">{activities.slice(0, 6).map((activity) => <div className="activity-line" key={activity.id} data-testid={`activity-${activity.id}`}><span className="activity-dot" /><div className="flex flex-wrap justify-between gap-2"><div><div className="text-sm font-bold">{activity.title}</div><div className="text-xs text-muted-foreground mt-1">{activity.detail}</div></div><div className="text-[11px] text-muted-foreground">{activity.time}</div></div></div>)}</div>}
          </section>
        </>
      )}
    </div>
  );
}
