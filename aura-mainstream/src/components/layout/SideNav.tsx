import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Search, 
  Vote,
  User, 
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  Monitor,

  Bell,
  Eye,
  ShoppingCart,
  Palette,
  UserCircle,
  Wallet,
  BarChart3,
  Settings,
  Plus,
  Gift,
  Coins as CoinsIcon,
  Activity,
  Archive,
  Users as UsersIcon,
  FilePlus,
  MessageSquare,
  MessageCircle,
  Heart,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSideNav } from '@/context/SideNavContext';
import { useTheme } from '@/context/ThemeContext';
import { useI18n } from '@/context/I18nContext';
import { useMockChain } from '@/context/MockChainContext';
import { useAuth } from '@/context/AuthContext';
import { useDmUnread } from '@/hooks/useDmUnread';

export default function SideNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { collapsed, setCollapsed } = useSideNav();
  const { isDark, mode, setMode } = useTheme();
  const { t } = useI18n();
  const { user: sideNavUser } = useAuth();

  // Expanded state — accordion mode (only one section open at a time).
  // Section ids: 'explore' | 'notifications' | 'governance' | 'profile' | null.
  // Initialized below from the current URL so that landing on a sub-page
  // (e.g. /governance/committees) opens the matching section automatically.

  // Real unread notification count — sourced from mockChain.
  // Aggregates the same three notification streams the NotificationsPage
  // displays, so the sidebar badge and the page contents stay consistent:
  //   • coinTradeNotifications  (your CC was bought / sold)
  //   • redemptionNotifications (someone redeemed a benefit / delivery flow)
  // Local in-app notifications (likes, follows, comments) currently seed to
  // an empty array; they'd be added here once a real notifications service
  // is wired up.
  const mockChain = useMockChain();
  const myWallet = mockChain.connected
    ? (mockChain.publicKey || mockChain.walletAddress)
    : null;
  const unreadDms = useDmUnread(myWallet);
  // Per-category unread counts — mirror the rules in NotificationsPage's
  // CATEGORIES.match(...) so the SideNav badges stay perfectly in sync
  // with the right-pane page.
  //   coins      ← coinTradeNotifications (any type)
  //   curation   ← redemptionNotifications + inAppNotifications.type='curation_reward'
  //   replies    ← inAppNotifications.type='comment'
  //   likes      ← inAppNotifications.type='like'
  //   follows    ← inAppNotifications.type='follow'
  //   governance ← inAppNotifications.type='governance'
  //   messages   ← (DM stream, not yet wired into the SideNav)
  const unreadCoins = mockChain.coinTradeNotifications.filter(n => !n.isRead).length;
  const unreadRedemptions = (mockChain.redemptionNotifications || []).filter(n => !n.isRead).length;
  const inAppUnread = (mockChain.inAppNotifications || []).filter(n => !n.isRead);
  const unreadByCategory = {
    coins: unreadCoins,
    curation: unreadRedemptions + inAppUnread.filter(n => n.type === 'curation_reward').length,
    replies: inAppUnread.filter(n => n.type === 'comment').length,
    likes: inAppUnread.filter(n => n.type === 'like').length,
    follows: inAppUnread.filter(n => n.type === 'follow').length,
    governance: inAppUnread.filter(n => n.type === 'governance').length,
    messages: unreadDms, // DM stream count from useDmUnread — drives both the SideNav DM entry badge and the notifications sub-item.
  } as const;
  const unreadNotifications =
    mockChain.coinTradeNotifications.filter(n => !n.isRead).length +
    (mockChain.redemptionNotifications || []).filter(n => !n.isRead).length +
    (mockChain.inAppNotifications || []).filter(n => !n.isRead).length +
    unreadDms;

  // Check if on Explore sub-page (Live filter lives inside /explore now)
  const isExploreSubPage = ['/explore', '/marketplace', '/curation'].includes(location.pathname);
  // Check if on Governance sub-page (4 sub-routes)
  const isGovernanceSubPage = location.pathname.startsWith('/governance');
  // Check if on Notifications sub-page (7 category sub-routes)
  const isNotificationsSubPage = location.pathname.startsWith('/notifications');
  // Check if on Profile sub-page
  const isProfileSubPage = ['/profile', '/wallet', '/dashboard', '/settings'].includes(location.pathname);

  type ExpandedSection = 'explore' | 'notifications' | 'governance' | 'profile' | null;
  const sectionForPath = (): ExpandedSection => {
    if (isExploreSubPage) return 'explore';
    if (isNotificationsSubPage) return 'notifications';
    if (isGovernanceSubPage) return 'governance';
    if (isProfileSubPage) return 'profile';
    return null;
  };
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(sectionForPath());

  const exploreExpanded = expandedSection === 'explore';
  const notificationsExpanded = expandedSection === 'notifications';
  const governanceExpanded = expandedSection === 'governance';
  const profileExpanded = expandedSection === 'profile';

  // Toggle handler used by every expandable top-level item. Click on the
  // currently-open section closes it; click on any other section closes
  // the previous one and opens the new one (accordion behavior).
  const toggleSection = (s: Exclude<ExpandedSection, null>) =>
    setExpandedSection(prev => (prev === s ? null : s));

  // Auto-open the section whose sub-page the user just navigated to.
  // Critical: also closes any section that no longer matches the URL,
  // so manually opening Explore then navigating to /governance via the
  // top-level click closes Explore and opens Governance in lock-step.
  useEffect(() => {
    const target = sectionForPath();
    if (target !== null) setExpandedSection(target);
    // If we're not on a sub-page (e.g. /, /feed) we leave the user's
    // last manual choice alone — collapsing on every nav would be jarring.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Explore sub-items — Live is filtered inside /explore so we don't expose a
  // separate top-level Live route in the sidebar.
  const exploreSubItems = [
    { path: '/explore', icon: Eye, label: t.nav.explore },
    { path: '/marketplace', icon: ShoppingCart, label: t.nav.marketplace },
    { path: '/curation', icon: Palette, label: t.nav.curation },
  ];

  // Profile sub-items
  const profileSubItems = [
    { path: '/profile', icon: UserCircle, label: t.profile.profile },
    { path: '/wallet', icon: Wallet, label: t.profile.wallet },
    { path: '/creator-coin', icon: CoinsIcon, label: 'Creator Coin' },
    { path: '/dashboard', icon: BarChart3, label: t.profile.dashboard },
    { path: '/settings', icon: Settings, label: t.profile.settings },
  ];

  // Governance sub-items — Committees first so clicking the top-level
  // Governance label lands users on the committees overview (per
  // whitepaper §13.2 the committees are the entry point of governance).
  const governanceSubItems = [
    { path: '/governance/committees', icon: UsersIcon, label: t.governance.tabs.committees },
    { path: '/governance/active',     icon: Activity, label: t.governance.tabs.active },
    { path: '/governance/completed',  icon: Archive,  label: t.governance.tabs.completed },
    { path: '/governance/create',     icon: FilePlus, label: t.governance.tabs.create },
  ];

  // Notifications sub-items — 7 categories (mirrors the in-page rail in
  // NotificationsPage). Slugs match CATEGORY_BY_SLUG over there.
  // Each sub-item carries a `badge` (unread count for that category) so
  // the second-level navigation surfaces the same red dot as the top-level.
  const notificationsSubItems = [
    { path: '/notifications/messages',   icon: MessageSquare, label: t.notifications?.directMessages ?? 'Direct messages',  badge: unreadByCategory.messages },
    { path: '/notifications/replies',    icon: MessageCircle, label: t.notifications?.replies ?? 'Replies',                  badge: unreadByCategory.replies },
    { path: '/notifications/likes',      icon: Heart,         label: t.notifications?.likes ?? 'Likes',                      badge: unreadByCategory.likes },
    { path: '/notifications/follows',    icon: UserPlus,      label: t.notifications?.newFollowers ?? 'New followers',       badge: unreadByCategory.follows },
    { path: '/notifications/curation',   icon: Gift,          label: t.notifications?.curationRewards ?? 'Curation rewards', badge: unreadByCategory.curation },
    { path: '/notifications/coins',      icon: CoinsIcon,     label: t.notifications?.coinActivity ?? 'Coin activity',       badge: unreadByCategory.coins },
    { path: '/notifications/governance', icon: Vote,          label: t.notifications?.governance ?? 'Governance',            badge: unreadByCategory.governance },
  ];

  // Main navigation
  const mainNavItems = [
    { path: '/', icon: Home, label: t.nav.home },
    { 
      path: null, 
      icon: Search, 
      label: t.nav.explore,
      expandable: true,
      expanded: exploreExpanded,
      onExpand: () => toggleSection('explore'),
      subItems: exploreSubItems
    },
    {
      // Direct messages — surfaces the DM stream from MessagesPage. Previously
      // only reachable via BottomNav on mobile, which made the feature look
      // unimplemented on desktop / iPad even though Supabase wiring was live.
      path: '/messages',
      icon: MessageSquare,
      label: t.nav.messages ?? 'Messages',
      badge: unreadByCategory.messages > 0 ? unreadByCategory.messages : undefined,
    },
    {
      path: null,
      icon: Bell,
      label: t.nav.notifications,
      badge: unreadNotifications > 0 ? unreadNotifications : undefined,
      expandable: true,
      expanded: notificationsExpanded,
      onExpand: () => toggleSection('notifications'),
      subItems: notificationsSubItems,
    },
    {
      path: null,
      icon: Vote,
      label: t.nav.governance,
      expandable: true,
      expanded: governanceExpanded,
      onExpand: () => toggleSection('governance'),
      subItems: governanceSubItems,
    },
    { 
      path: null, 
      icon: User, 
      label: t.nav.profile,
      expandable: true,
      expanded: profileExpanded,
      onExpand: () => toggleSection('profile'),
      subItems: profileSubItems
    },
  ];



  const cycleTheme = () => {
    const modes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const idx = modes.indexOf(mode);
    setMode(modes[(idx + 1) % modes.length]);
  };

  const ThemeIcon = mode === 'system' ? Monitor : isDark ? Moon : Sun;
  const themeLabel = mode === 'system' ? t.theme.system : isDark ? t.theme.dark : t.theme.light;

  return (
    <nav className={cn(
      "fixed left-0 top-0 h-full bg-card/95 backdrop-blur-xl border-r border-border/40 z-40 transition-all duration-300 shadow-lg",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="flex flex-col h-full">
        {/* Logo and collapse button */}
        <div className="flex items-center justify-between p-4 border-b border-border/40">
          {!collapsed && (
            <div className="flex items-center gap-2">
              {/* AURA brand logo — transparent PNG dropped in 2026-05-10.
                  Source: aura_logo_transparent.png (1024×1024 RGBA). */}
              <img
                src="/aura-logo.png"
                alt="AURA"
                width={32}
                height={32}
                className="w-8 h-8 object-contain"
              />
              <span className="text-lg font-bold bg-gradient-to-r from-aura to-ora bg-clip-text text-transparent">
                AURA
              </span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation items */}
        <div className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="space-y-1">
            {mainNavItems.map(({ path, icon: Icon, label, badge, expandable, expanded, onExpand, subItems }, index) => {
              const isActive = path && location.pathname === path;
              const hasActiveSubItem = subItems?.some(subItem => location.pathname === subItem.path);
              
              return (
                <div key={index}>
                  <button
                    onClick={() => {
                      if (expandable) {
                        // Top-level expandable click (Explore / Governance / Profile):
                        //   1. Always navigate to a sub-page so the click feels actionable.
                        //   2. Prefer the currently-active sub-item; otherwise jump to the
                        //      first sub-item (the canonical "home" of that section).
                        //   3. Ensure the section is expanded so the user sees siblings.
                        const firstSubPath = subItems?.[0]?.path;
                        const activeSubPath = subItems?.find(s => location.pathname === s.path)?.path;
                        const target = activeSubPath ?? firstSubPath;
                        if (target && location.pathname !== target) {
                          navigate(target);
                        }
                        if (!expanded) onExpand?.();
                      } else if (path) {
                        navigate(path);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group text-left",
                      isActive || hasActiveSubItem
                        ? "bg-gradient-to-r from-aura/10 to-ora/10 text-aura border border-aura/20" 
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    )}
                    title={collapsed ? label : undefined}
                  >
                    <div className="relative">
                      <Icon 
                        className={cn(
                          "w-5 h-5 transition-all duration-300",
                          isActive || hasActiveSubItem
                            ? "text-aura" 
                            : "text-muted-foreground group-hover:text-foreground"
                        )}
                        strokeWidth={isActive || hasActiveSubItem ? 2.5 : 2}
                      />
                      {/* Notification badge */}
                      {badge && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </div>
                    {!collapsed && (
                      <span className={cn(
                        "font-medium transition-colors duration-300 flex-1",
                        isActive || hasActiveSubItem ? "text-aura" : "text-muted-foreground group-hover:text-foreground"
                      )}>
                        {label}
                      </span>
                    )}
                    {expandable && !collapsed && (
                      <div className="ml-auto">
                        {expanded ? 
                          <ChevronUp className="w-4 h-4" /> : 
                          <ChevronDown className="w-4 h-4" />
                        }
                      </div>
                    )}
                    {(isActive || hasActiveSubItem) && !collapsed && !expandable && (
                      <div className="ml-auto w-2 h-2 rounded-full bg-gradient-to-r from-aura to-ora" />
                    )}
                  </button>
                  
                  {/* Sub-menu items */}
                  {expandable && expanded && !collapsed && subItems && (
                    <div className="ml-6 mt-1 space-y-1">
                      {subItems.map((sub: any) => {
                        const subPath = sub.path;
                        const SubIcon = sub.icon;
                        const subLabel = sub.label;
                        const subBadge: number | undefined = sub.badge;
                        const isSubActive = location.pathname === subPath;
                        const showBadge = typeof subBadge === 'number' && subBadge > 0;

                        return (
                          <button
                            key={subPath}
                            onClick={() => navigate(subPath)}
                            className={cn(
                              "w-full flex items-center gap-3 p-2 pl-3 rounded-lg transition-all duration-300 group text-left text-sm",
                              isSubActive
                                ? "bg-gradient-to-r from-aura/10 to-ora/10 text-aura border border-aura/20"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                            )}
                          >
                            <SubIcon
                              className={cn(
                                "w-4 h-4 transition-all duration-300",
                                isSubActive
                                  ? "text-aura"
                                  : "text-muted-foreground group-hover:text-foreground"
                              )}
                              strokeWidth={isSubActive ? 2.5 : 2}
                            />
                            <span className={cn(
                              "font-medium transition-colors duration-300 flex-1",
                              isSubActive ? "text-aura" : "text-muted-foreground group-hover:text-foreground"
                            )}>
                              {subLabel}
                            </span>
                            {showBadge && (
                              <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-[10px] font-black text-white tabular-nums leading-none">
                                {subBadge > 99 ? '99+' : subBadge}
                              </span>
                            )}
                            {!showBadge && isSubActive && (
                              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gradient-to-r from-aura to-ora" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Studio button — launchpad for all create / propose / launch actions.
              The dedicated content-publishing flow lives at /create; the Studio
              hub at /studio also exposes Bounty / Coin / DAO / Election entries. */}
          <div className="pt-4">
            <button
              onClick={() => navigate('/studio')}
              className={cn(
                "w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-gradient-to-r from-aura to-ora text-white font-medium transition-all duration-300 hover:shadow-lg hover:scale-105",
                collapsed ? "p-3" : "px-4 py-3"
              )}
              title={collapsed ? t.nav.create : undefined}
            >
              <Plus className="w-5 h-5" />
              {!collapsed && <span>{t.nav.create}</span>}
            </button>
          </div>
        </div>

        {/* Theme & Language toggles */}
        <div className="px-3 space-y-1">
          <button
            onClick={cycleTheme}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-300"
            title={collapsed ? themeLabel : undefined}
          >
            <ThemeIcon className="w-5 h-5" />
            {!collapsed && <span className="text-sm font-medium">{themeLabel}</span>}
          </button>
          {/* Language auto-detected from system settings */}
        </div>

        {/* User info area (no longer a popover menu, since the Profile page contains everything) */}
        <div className="p-4 border-t border-border/40">
          <div 
            className={cn(
              "flex items-center gap-3 p-2 rounded-lg",
              collapsed && "justify-center"
            )}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-aura/40 via-ora/40 to-aura/40 p-0.5 shrink-0">
              <img 
                src={sideNavUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80"} 
                alt="Profile" 
                className="w-full h-full rounded-full object-cover" 
              />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{sideNavUser?.displayName || 'Aura Creator'}</div>
                <div className="text-xs text-muted-foreground">@{sideNavUser?.username || 'aura_creator'}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}