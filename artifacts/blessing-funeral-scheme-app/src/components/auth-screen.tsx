import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';

export function AuthScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow-top" />
      <div className="auth-glow auth-glow-bottom" />

      <section className="auth-layout">
        <div className="auth-story">
          <div className="auth-brand">
            <BrandMark />
            <span className="brand-word">Blessing</span>
          </div>

          <div className="auth-story-copy">
            <div className="eyebrow auth-eyebrow">Funeral scheme operations</div>
            <h1>Careful records for the work that matters.</h1>
            <p>
              Keep members, contributions, claims, and branch teams in one
              calm, accountable workspace.
            </p>
          </div>

          <div className="auth-trust-list">
            <div className="auth-trust-item">
              <CheckCircle2 size={17} />
              <span>One secure workspace for your whole team</span>
            </div>
            <div className="auth-trust-item">
              <CheckCircle2 size={17} />
              <span>Access shaped around authorised staff</span>
            </div>
            <div className="auth-trust-item">
              <CheckCircle2 size={17} />
              <span>Clear activity history for every important change</span>
            </div>
          </div>
        </div>

        <div className="auth-panel card">
          <div className="auth-panel-icon">
            <LockKeyhole size={20} />
          </div>
          <div className="eyebrow">Welcome back</div>
          <h2>Sign in to Blessing</h2>
          <p className="auth-panel-copy">
            Use your existing account, or create one to request access to the
            operations workspace.
          </p>

          <button type="button" className="btn btn-primary auth-submit" onClick={onLogin}>
            <span>Log in or register</span>
            <ArrowRight size={16} />
          </button>

          <div className="auth-security-note">
            <ShieldCheck size={16} />
            <span>Your sign-in is handled securely. We never store your password here.</span>
          </div>

          <div className="auth-panel-footer">
            Need access for your team? Start by creating an account, then ask
            an administrator to assign your staff access.
          </div>
        </div>
      </section>
    </main>
  );
}