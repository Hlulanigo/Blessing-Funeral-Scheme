import { AlertCircle, Inbox, X } from 'lucide-react';
import type { ReactNode } from 'react';

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(amount);

export const formatDate = (value: string | null | undefined) =>
  value ? new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';

export const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

export function StatusBadge({ status }: { status: string }) {
  return <span data-testid={`status-${status}`} className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
      <div>
        <div className="eyebrow mb-2">{eyebrow}</div>
        <h1 className="display-heading text-3xl md:text-4xl">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ title, description, onClose, children }: { title: string; description?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="display-heading text-2xl">{title}</h2>
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
          <button data-testid="button-close-modal" type="button" className="btn btn-ghost p-2" onClick={onClose} aria-label="Close dialog"><X size={17} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function LoadingRows({ count = 5 }: { count?: number }) {
  return <div className="space-y-3 p-5">{Array.from({ length: count }).map((_, index) => <div key={index} className="skeleton h-12 w-full" />)}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Inbox size={21} /></div><div className="font-semibold text-foreground text-sm">{title}</div><p className="text-xs mt-1 max-w-xs mx-auto">{description}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return <div className="empty-state"><div className="empty-icon text-destructive"><AlertCircle size={21} /></div><div className="font-semibold text-foreground text-sm">We couldn’t load this view</div><p className="text-xs mt-1">Check the connection, then try again.</p><button data-testid="button-retry" className="btn btn-secondary mt-4" onClick={onRetry}>Try again</button></div>;
}
