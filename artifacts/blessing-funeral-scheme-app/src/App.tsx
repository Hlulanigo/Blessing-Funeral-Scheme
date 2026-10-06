import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAuth, type AuthUser } from '@workspace/replit-auth-web';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthScreen } from '@/components/auth-screen';
import { AppShell } from '@/components/app-shell';
import DashboardPage from '@/pages/dashboard';
import MembersPage from '@/pages/members';
import MemberProfilePage from '@/pages/member-profile';
import ContributionsPage from '@/pages/contributions';
import ClaimsPage from '@/pages/claims';
import BranchesPage from '@/pages/branches';
import StaffPage from '@/pages/staff';
import SettingsPage from '@/pages/settings';
import NotFound from '@/pages/not-found';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { BrandMark } from '@/components/brand-mark';
import { hasRoleCapability } from '@workspace/api-zod';

const queryClient = new QueryClient();

function Router({ user, logout }: { user: AuthUser; logout: () => void }) {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <AppShell user={user} logout={logout}>
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/members" component={() => hasRoleCapability(user.role ?? '', 'viewMembers') ? <MembersPage canEditRecords={hasRoleCapability(user.role ?? '', 'editMembers')} /> : <RestrictedPage />} />
          <Route path="/members/:memberId" component={() => hasRoleCapability(user.role ?? '', 'viewMembers') ? <MemberProfilePage canEditRecords={hasRoleCapability(user.role ?? '', 'editMembers')} /> : <RestrictedPage />} />
          <Route path="/contributions" component={() => hasRoleCapability(user.role ?? '', 'viewContributions') ? <ContributionsPage canRecord={hasRoleCapability(user.role ?? '', 'recordContributions')} /> : <RestrictedPage />} />
          <Route path="/claims" component={() => hasRoleCapability(user.role ?? '', 'viewClaims') ? <ClaimsPage canSubmit={hasRoleCapability(user.role ?? '', 'submitClaims')} canReview={hasRoleCapability(user.role ?? '', 'reviewClaims')} /> : <RestrictedPage />} />
          <Route path="/branches" component={() => hasRoleCapability(user.role ?? '', 'viewBranches') ? <BranchesPage canManageBranches={hasRoleCapability(user.role ?? '', 'manageBranches')} /> : <RestrictedPage />} />
          <Route path="/staff" component={hasRoleCapability(user.role ?? '', 'manageStaff') ? StaffPage : RestrictedPage} />
          <Route path="/settings" component={hasRoleCapability(user.role ?? '', 'manageSettings') ? SettingsPage : RestrictedPage} />
          <Route component={NotFound} />
        </Switch>
      </AppShell>
    </RoutedErrorBoundary>
  );
}

function RestrictedPage() {
  return <div className="content-wrap page-enter"><div className="section-title">Access restricted</div><p className="section-subtitle mt-2">Your staff role does not include access to this area.</p><Link href="/" className="btn btn-secondary mt-4">Return to operations</Link></div>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  const auth = useAuth();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {auth.isLoading ? (
          <AuthLoadingScreen />
        ) : auth.user?.role ? (
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router user={auth.user!} logout={auth.logout} />
          </WouterRouter>
        ) : auth.isAuthenticated ? (
          <WorkspaceAccessUnavailable logout={auth.logout} />
        ) : (
          <AuthScreen onLogin={auth.login} />
        )}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function WorkspaceAccessUnavailable({ logout }: { logout: () => void }) {
  return <main className="auth-page"><div className="auth-loading-card"><BrandMark /><div><div className="auth-loading-title">Workspace access unavailable</div><p className="auth-loading-copy">This account does not have an active staff role. Contact an administrator for access.</p><button data-testid="button-sign-out-unassigned" className="btn btn-secondary mt-4" onClick={logout}>Sign out</button></div></div></main>;
}

function AuthLoadingScreen() {
  return (
    <main className="auth-page" aria-busy="true" aria-label="Loading your secure workspace">
      <div className="auth-loading-card">
        <BrandMark />
        <div>
          <div className="auth-loading-title">Preparing your workspace</div>
          <div className="auth-loading-copy">Checking your secure session…</div>
        </div>
      </div>
    </main>
  );
}

export default App;
