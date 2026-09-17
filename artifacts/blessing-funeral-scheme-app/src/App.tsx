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
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

function Router({ user, logout }: { user: AuthUser; logout: () => void }) {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <AppShell user={user} logout={logout}>
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/members" component={MembersPage} />
          <Route path="/members/:memberId" component={MemberProfilePage} />
          <Route path="/contributions" component={ContributionsPage} />
          <Route path="/claims" component={ClaimsPage} />
          <Route path="/branches" component={BranchesPage} />
          <Route path="/staff" component={StaffPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </AppShell>
    </RoutedErrorBoundary>
  );
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
        ) : auth.isAuthenticated ? (
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router user={auth.user!} logout={auth.logout} />
          </WouterRouter>
        ) : (
          <AuthScreen onLogin={auth.login} />
        )}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function AuthLoadingScreen() {
  return (
    <main className="auth-page" aria-busy="true" aria-label="Loading your secure workspace">
      <div className="auth-loading-card">
        <div className="brand-mark">B</div>
        <div>
          <div className="auth-loading-title">Preparing your workspace</div>
          <div className="auth-loading-copy">Checking your secure session…</div>
        </div>
      </div>
    </main>
  );
}

export default App;
