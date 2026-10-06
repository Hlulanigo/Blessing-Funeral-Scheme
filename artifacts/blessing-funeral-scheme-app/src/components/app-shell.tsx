import { Bell, BookOpen, Building2, ChevronDown, CircleDollarSign, FileText, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, UserRound, Users, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import type { AuthUser } from '@workspace/replit-auth-web';
import { getListActivityQueryKey, useListActivity } from '@workspace/api-client-react';
import { BrandMark } from '@/components/brand-mark';

const navItems = [
  { href: '/', label: 'Operations', icon: LayoutDashboard },
  { href: '/members', label: 'Members', icon: Users },
  { href: '/contributions', label: 'Contributions', icon: CircleDollarSign },
  { href: '/claims', label: 'Claims', icon: FileText },
  { href: '/branches', label: 'Branches', icon: Building2 },
];

export function AppShell({ children, user, logout }: { children: ReactNode; user: AuthUser; logout: () => void }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const activityQuery = useListActivity({ query: { queryKey: getListActivityQueryKey() } });
  const activities = activityQuery.data ?? [];
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Workspace user';
  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || displayName.slice(0, 2).toUpperCase();
  const profileLabel = user?.email ? 'Authenticated workspace user' : 'Workspace administrator';
  const sidebar = (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="flex items-center gap-3 px-3 mb-10">
         <BrandMark /><span className="brand-word">Blessing</span>
        {mobileOpen && <button data-testid="button-close-navigation" className="btn btn-ghost ml-auto p-1" onClick={() => setMobileOpen(false)}><X size={17} /></button>}
      </div>
      <div className="px-3 mb-3 eyebrow" style={{ color: 'hsl(var(--sidebar-foreground)/.45)' }}>Workspace</div>
      <nav className="space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} data-testid={`link-${label.toLowerCase()}`} className={`nav-link ${location === href || (href !== '/' && location.startsWith(href)) ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
            <Icon size={17} strokeWidth={1.8} /><span className="nav-copy">{label}</span>
          </Link>
        ))}
      </nav>
      <div className="px-3 mb-3 mt-9 eyebrow" style={{ color: 'hsl(var(--sidebar-foreground)/.45)' }}>Administration</div>
      <Link href="/staff" data-testid="link-staff" className={`nav-link ${location === '/staff' ? 'active' : ''}`} onClick={() => setMobileOpen(false)}><UserRound size={17} strokeWidth={1.8} /><span className="nav-copy">Staff</span></Link>
      <Link href="/settings" data-testid="link-settings" className={`nav-link ${location === '/settings' ? 'active' : ''}`} onClick={() => setMobileOpen(false)}><Settings size={17} strokeWidth={1.8} /><span className="nav-copy">Settings</span></Link>
      <div className="mt-auto pt-8 sidebar-note">
        <div className="rounded-xl border p-3" style={{ borderColor: 'hsl(var(--sidebar-border))', background: 'hsl(var(--sidebar-accent)/.65)' }}>
          <ShieldCheck size={17} style={{ color: 'hsl(var(--sidebar-primary))' }} />
          <div className="mt-3 text-xs font-semibold">Records protected</div>
          <div className="text-[10px] mt-1 leading-relaxed" style={{ color: 'hsl(var(--sidebar-foreground)/.55)' }}>Your workspace is secured and ready for today’s service.</div>
        </div>
      </div>
    </aside>
  );
  return (
    <div className="app-shell">
      <div className={`fixed inset-0 z-40 bg-black/30 ${mobileOpen ? 'block' : 'hidden'}`} onClick={() => setMobileOpen(false)} />
      <div className={`fixed inset-y-0 left-0 z-50 ${mobileOpen ? 'block' : 'hidden'}`}>{sidebar}</div>
      <div className="hidden md:block">{sidebar}</div>
      <div className="main-area">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <button data-testid="button-open-navigation" className="btn btn-ghost mobile-menu p-2" onClick={() => setMobileOpen(true)}><Menu size={19} /></button>
             <div className="md:hidden"><BrandMark /></div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground"><BookOpen size={14} /> Blessing Funeral Scheme <span className="text-border">/</span> <span className="text-foreground font-semibold">{location === '/' ? 'Operations' : location.slice(1).split('/')[0]}</span></div>
          </div>
          <div className="flex items-center gap-4">
             <div className="relative">
               <button
                 data-testid="button-notifications"
                 className="btn btn-ghost p-2 relative"
                 aria-label="Recent activity"
                 onClick={() => {
                   setNotificationsOpen((value) => !value);
                   setProfileOpen(false);
                 }}
               >
                 <Bell size={17} />
                 {activities.length > 0 && (
                   <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[hsl(var(--accent))] rounded-full" />
                 )}
               </button>
               {notificationsOpen && (
                 <div className="absolute right-0 top-11 w-72 card p-4 z-30">
                   <div className="flex items-center justify-between">
                     <div className="font-bold text-sm">Recent activity</div>
                     {activities.length > 0 && <span className="badge badge-pending">{activities.length}</span>}
                   </div>
                   {activityQuery.isLoading ? (
                     <div className="text-xs text-muted-foreground mt-3">Loading activity…</div>
                   ) : activities.length === 0 ? (
                     <div className="text-xs text-muted-foreground leading-relaxed mt-3">
                       No activity has been recorded yet.
                     </div>
                   ) : (
                     <div className="space-y-3 mt-3">
                       {activities.slice(0, 3).map((activity) => (
                         <div key={activity.id}>
                           <div className="text-xs font-semibold">{activity.title}</div>
                           <div className="text-[11px] text-muted-foreground mt-1">{activity.detail}</div>
                           <div className="text-[10px] text-muted-foreground mt-1">{activity.time}</div>
                         </div>
                       ))}
                     </div>
                   )}
                   <Link
                     href="/"
                     data-testid="link-notification-activity"
                     className="btn btn-secondary mt-3 w-full"
                     onClick={() => setNotificationsOpen(false)}
                   >
                     View dashboard
                   </Link>
                 </div>
               )}
             </div>
            <div className="h-7 w-px bg-border hidden sm:block" />
            <div className="relative"><button data-testid="button-profile-menu" className="flex items-center gap-2 text-left" onClick={() => { setProfileOpen((value) => !value); setNotificationsOpen(false); }}>
               {user?.profileImageUrl ? <img className="avatar avatar-image" src={user.profileImageUrl} alt="" /> : <div className="avatar">{initials}</div>}<div className="hidden sm:block"><div className="text-xs font-bold">{displayName}</div><div className="text-[10px] text-muted-foreground">{profileLabel}</div></div><ChevronDown size={14} className="text-muted-foreground" />
             </button>{profileOpen && <div className="absolute right-0 top-11 w-56 card p-2 z-30"><div className="px-2 py-2 border-b border-border mb-1"><div className="text-xs font-bold truncate">{displayName}</div><div className="text-[10px] text-muted-foreground mt-1 truncate">{user?.email ?? 'Signed in securely'}</div></div><Link href="/settings" data-testid="link-profile-settings" className="nav-link text-foreground" onClick={() => setProfileOpen(false)}><Settings size={15} /> Settings</Link><button data-testid="button-sign-out" className="nav-link w-full text-left text-muted-foreground" onClick={logout}><LogOut size={15} /> Log out</button></div>}</div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
