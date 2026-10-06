import { Check, Database, LockKeyhole, Save, Server, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetSettingsQueryKey, getHealthCheckQueryKey, useGetSettings, useHealthCheck, useUpdateSettings } from '@workspace/api-client-react';
import type { SettingsUpdate } from '@workspace/api-client-react';
import { PageHeader } from '@/components/ui';

export default function SettingsPage() {
  const healthQuery = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey() } });
  const settingsQuery = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({ plan: 'Family Cover', monthly: '120', grace: '7', reminder: true, requireReview: true });
  useEffect(() => {
    if (!settingsQuery.data) return;
    setSettings({
      plan: settingsQuery.data.defaultPlanName,
      monthly: String(settingsQuery.data.monthlyContribution),
      grace: String(settingsQuery.data.gracePeriodDays),
      reminder: settingsQuery.data.contributionReminders,
      requireReview: settingsQuery.data.requireClaimReview,
    });
  }, [settingsQuery.data]);
  const save = () => {
    const data: SettingsUpdate = {
      defaultPlanName: settings.plan,
      monthlyContribution: Number(settings.monthly),
      gracePeriodDays: Number(settings.grace),
      contributionReminders: settings.reminder,
      requireClaimReview: settings.requireReview,
    };
    updateSettings.mutate({ data }, {
      onSuccess: (result) => {
        queryClient.setQueryData(getGetSettingsQueryKey(), result);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 2400);
      },
    });
  };
  const toggle = (key: 'reminder' | 'requireReview') => setSettings((current) => ({ ...current, [key]: !current[key] }));
  return <div className="content-wrap page-enter">
    <PageHeader eyebrow="Keep the scheme consistent" title="Operational settings" description="Set the defaults branch teams use when they enrol, collect, and review." actions={<button data-testid="button-save-settings" className="btn btn-primary" disabled={settingsQuery.isLoading || updateSettings.isPending} onClick={save}><Save size={15} /> {updateSettings.isPending ? 'Saving...' : saved ? 'Saved' : 'Save changes'}</button>} />
    {settingsQuery.isError && <div role="alert" className="mb-4 text-sm text-destructive">Could not load scheme settings. Refresh and try again.</div>}
    {updateSettings.isError && <div role="alert" className="mb-4 text-sm text-destructive">{updateSettings.error instanceof Error ? updateSettings.error.message : 'Could not save scheme settings.'}</div>}
    <div className="grid gap-5 lg:grid-cols-[1fr_.65fr]">
      <div className="space-y-5">
        <section className="card p-5"><div className="section-title">Scheme defaults</div><div className="section-subtitle mt-1 mb-5">Values that prefill new member and contribution records.</div><div className="grid sm:grid-cols-2 gap-4"><div><label className="label">Default plan</label><select data-testid="select-default-plan" className="select" value={settings.plan} onChange={(e) => setSettings({ ...settings, plan: e.target.value })}><option>Family Cover</option><option>Individual Cover</option><option>Premium Family Cover</option></select></div><div><label className="label">Monthly contribution (R)</label><input data-testid="input-default-contribution" className="input" type="number" value={settings.monthly} onChange={(e) => setSettings({ ...settings, monthly: e.target.value })} /></div><div><label className="label">Grace period (days)</label><input data-testid="input-grace-period" className="input" type="number" value={settings.grace} onChange={(e) => setSettings({ ...settings, grace: e.target.value })} /></div></div></section>
        <section className="card p-5"><div className="section-title">Workflow preferences</div><div className="section-subtitle mt-1 mb-5">Small guardrails that help teams work consistently.</div><div className="space-y-1"><SettingToggle testId="toggle-reminders" icon={Database} title="Overdue follow-up alerts" description="Show overdue contribution totals on the operations dashboard." enabled={settings.reminder} onClick={() => toggle('reminder')} /><SettingToggle testId="toggle-claim-review" icon={ShieldCheck} title="Require claim review" description="Start new claims in Reviewing before they can be approved or paid." enabled={settings.requireReview} onClick={() => toggle('requireReview')} /></div></section>
      </div>
      <div className="space-y-5"><section className="card p-5"><div className="section-title">Workspace health</div><div className="section-subtitle mt-1 mb-5">A quiet check that the operations workspace is connected.</div><div className="flex items-center gap-3 p-3 rounded-lg bg-muted/60"><div className={`w-9 h-9 rounded-full grid place-items-center ${healthQuery.isError ? 'bg-destructive/10 text-destructive' : 'bg-[hsl(var(--chart-3)/.12)] text-[hsl(var(--chart-3))]'}`}>{healthQuery.isLoading ? <Server size={16} /> : <Check size={17} />}</div><div><div className="font-bold text-sm">{healthQuery.isLoading ? 'Checking connection…' : healthQuery.isError ? 'Connection needs attention' : 'Operations API connected'}</div><div className="text-[11px] text-muted-foreground mt-1">{healthQuery.data?.status ?? 'Ready for secure record work'}</div></div></div></section><section className="card p-5"><div className="section-title">Privacy and access</div><div className="section-subtitle mt-1 mb-5">The operating principles behind member records.</div><div className="space-y-4"><div className="flex gap-3"><LockKeyhole size={16} className="text-[hsl(var(--accent))] mt-0.5" /><div><div className="text-sm font-bold">Records stay protected</div><div className="text-xs text-muted-foreground mt-1 leading-relaxed">Only authorised staff should access personal details, beneficiaries, and claims.</div></div></div><div className="flex gap-3"><ShieldCheck size={16} className="text-[hsl(var(--accent))] mt-0.5" /><div><div className="text-sm font-bold">Changes are traceable</div><div className="text-xs text-muted-foreground mt-1 leading-relaxed">Operational activity gives the team a shared history of important record updates.</div></div></div></div></section></div>
    </div>
  </div>;
}

function SettingToggle({ testId, icon: Icon, title, description, enabled, onClick }: { testId: string; icon: typeof Database; title: string; description: string; enabled: boolean; onClick: () => void }) {
  return <button data-testid={testId} className="w-full flex items-center justify-between gap-4 text-left p-3 rounded-lg hover:bg-muted/60 transition-colors" onClick={onClick}><div className="flex gap-3"><Icon size={16} className="text-primary mt-0.5" /><div><div className="text-sm font-bold">{title}</div><div className="text-xs text-muted-foreground mt-1 max-w-md leading-relaxed">{description}</div></div></div><span className={`w-9 h-5 rounded-full p-0.5 transition-colors ${enabled ? 'bg-primary' : 'bg-border'}`}><span className={`block w-4 h-4 rounded-full bg-card transition-transform ${enabled ? 'translate-x-4' : ''}`} /></span></button>;
}
