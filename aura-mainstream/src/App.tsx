import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';

// One-shot reset hook: visit /reset (or any URL with ?reset=1) to wipe ALL
// localStorage / sessionStorage and redirect to /auth. Useful for QA / first-
// time wallet flow testing without opening DevTools.
if (typeof window !== 'undefined') {
  const url = new URL(window.location.href);
  if (url.pathname === '/reset' || url.searchParams.has('reset')) {
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
    // Replace so the back button doesn't return to /reset.
    window.location.replace('/auth');
  }
}
import { ThemeProvider } from '@/context/ThemeContext';
import { SideNavProvider, useSideNav } from '@/context/SideNavContext';
import { ToastProvider } from '@/context/ToastContext';
import { BuyOraProvider } from '@/context/BuyOraContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import SideNav from '@/components/layout/SideNav';
import WelcomePage from '@/pages/WelcomePage';
import OnboardingPage from '@/pages/OnboardingPage';
import ProtocolPage from '@/pages/ProtocolPage';
import HomePage from '@/pages/HomePage';
import ExplorePage from '@/pages/ExplorePage';
import ExploreLeaderboardPage from '@/pages/ExploreLeaderboardPage';
import CreatePage from '@/pages/CreatePage';
import StudioHubPage from '@/pages/StudioHubPage';
import BountyCreatePage from '@/pages/BountyCreatePage';
import CoinStudioPage from '@/pages/CoinStudioPage';
import MessagesPage from '@/pages/MessagesPage';
import ProfilePage from '@/pages/ProfilePage';
import PostDetailPage from '@/pages/PostDetailPage';
import AdDetailPage from '@/pages/AdDetailPage';
// CommitteeDetailPage was retired 2026-05-09 — the master-detail
// CommitteesView covers everything the old page did, with consistent
// styling. The /governance/committee/:id URL is preserved (it still
// renders GovernancePage, which routes to CommitteesView and
// preselects the requested committee).
import ProposalDetailPage from '@/pages/ProposalDetailPage';
import MarketplacePage from '@/pages/MarketplacePage';
import CurationPage from '@/pages/CurationPage';
import GovernancePage from '@/pages/GovernancePage';
import WalletPage from '@/pages/WalletPage';
import BuyOraPage from '@/pages/BuyOraPage';
import PremiumContentPage from '@/pages/PremiumContentPage';
import BountyDetailPage from '@/pages/BountyDetailPage';
import CoinDetailPage from '@/pages/CoinDetailPage';
import PageErrorBoundary from '@/components/common/PageErrorBoundary';
import NftDetailPage from '@/pages/NftDetailPage';
import FractionDetailPage from '@/pages/FractionDetailPage';
import NotificationsPage from '@/pages/NotificationsPage';
import LivePage from '@/pages/LivePage';
import LiveStreamPage from '@/pages/LiveStreamPage';
import SettingsPage from '@/pages/SettingsPage';
import DashboardPage from '@/pages/DashboardPage';
import AuthPage from '@/pages/AuthPage';
import RemixPage from '@/pages/RemixPage';
import RemixDetailPage from '@/pages/RemixDetailPage';
import { I18nProvider } from '@/context/I18nContext';
import { MockChainProvider } from '@/context/MockChainContext';
import SupabaseFollowSync from '@/components/SupabaseFollowSync';
// 2026-05-11 R22: floating IrisChat removed; Iris now lives as a pinned
// thread inside the Messages page (Notifications → DM).
import InstallPWA from '@/components/common/InstallPWA';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { collapsed } = useSideNav();
  
  const hideNavOnMobile = location.pathname.startsWith('/post/') || location.pathname.startsWith('/chat/');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="hidden md:block">
        <SideNav />
      </div>
      <div className="block md:hidden">
        <Header />
      </div>
      <div className={`transition-all duration-300 ${
        collapsed ? 'md:ml-16' : 'md:ml-64'
      }`}>
        {children}
      </div>

      <InstallPWA />
      {!hideNavOnMobile && (
        <div className="block md:hidden">
          <BottomNav />
        </div>
      )}
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Welcome & Protocol Pages - Public */}
      <Route path="/" element={isAuthenticated ? <Navigate to="/feed" replace /> : <Navigate to="/auth" replace />} />
      <Route path="/protocol" element={<ProtocolPage />} />
      
      {/* Auth */}
      <Route path="/auth" element={isAuthenticated ? <Navigate to="/feed" replace /> : <AuthPage />} />
      {/* Onboarding is intentionally NOT gated by isAuthenticated: when AuthPage
          calls navigate('/onboarding') right after a wallet connect, React
          has not yet flushed the new user state, so a guard would bounce the
          user back to /auth. OnboardingPage validates the user itself. */}
      <Route path="/onboarding" element={<OnboardingPage />} />
      
      {/* Main App Routes - Protected */}
      <Route path="/feed" element={<RequireAuth><Layout><HomePage /></Layout></RequireAuth>} />
      <Route path="/explore" element={<RequireAuth><Layout><ExplorePage /></Layout></RequireAuth>} />
      <Route path="/explore/:category" element={<RequireAuth><Layout><ExploreLeaderboardPage /></Layout></RequireAuth>} />
      <Route path="/marketplace" element={<RequireAuth><Layout><MarketplacePage /></Layout></RequireAuth>} />
      <Route path="/curation" element={<RequireAuth><Layout><CurationPage /></Layout></RequireAuth>} />
      <Route path="/governance" element={<RequireAuth><Navigate to="/governance/active" replace /></RequireAuth>} />
      <Route path="/governance/active" element={<RequireAuth><Layout><GovernancePage /></Layout></RequireAuth>} />
      <Route path="/governance/completed" element={<RequireAuth><Layout><GovernancePage /></Layout></RequireAuth>} />
      <Route path="/governance/committees" element={<RequireAuth><Layout><GovernancePage /></Layout></RequireAuth>} />
      <Route path="/governance/create" element={<RequireAuth><Layout><GovernancePage /></Layout></RequireAuth>} />
      <Route path="/remix" element={<RequireAuth><Layout><RemixPage /></Layout></RequireAuth>} />
      <Route path="/remix/:id" element={<RequireAuth><Layout><RemixDetailPage /></Layout></RequireAuth>} />
      <Route path="/create" element={<RequireAuth><Layout><CreatePage /></Layout></RequireAuth>} />
      {/* /studio is now the launchpad hub for all create / propose / launch actions.
          /create remains the dedicated content-publishing flow (Photo / Video / Text / Audio / Live). */}
      <Route path="/studio" element={<RequireAuth><Layout><StudioHubPage /></Layout></RequireAuth>} />
      {/* 2026-05-11 R13: Post Bounty is now a full page (was a modal in
         StudioHub). Mirrors /governance/create's two-column layout. */}
      <Route path="/studio/create-bounty" element={<RequireAuth><Layout><BountyCreatePage /></Layout></RequireAuth>} />
      {/* Canonical path is /creator-coin (renamed 2026-05-10 — “Coin Studio”
          was technically opaque). Old /coin-studio still resolves so any
          deep-linked notifications/transaction history don't 404. */}
      <Route path="/creator-coin" element={<RequireAuth><Layout><CoinStudioPage /></Layout></RequireAuth>} />
      <Route path="/coin-studio" element={<Navigate to="/creator-coin" replace />} />
      <Route path="/messages" element={<RequireAuth><Layout><PageErrorBoundary><MessagesPage /></PageErrorBoundary></Layout></RequireAuth>} />
      <Route path="/wallet" element={<RequireAuth><Layout><WalletPage /></Layout></RequireAuth>} />
      <Route path="/buy-ora" element={<RequireAuth><Layout><BuyOraPage /></Layout></RequireAuth>} />
      {/* /redemptions retired 2026-05-09 — the full redemption queue lives
          inside Creator Coin now. Redirect old links there. */}
      <Route path="/redemptions" element={<Navigate to="/creator-coin" replace />} />
      <Route path="/profile" element={<RequireAuth><Layout><ProfilePage /></Layout></RequireAuth>} />
      {/* Public profile by username — used by follow notifications, mentions, etc. */}
      <Route path="/u/:username" element={<RequireAuth><Layout><ProfilePage /></Layout></RequireAuth>} />
      <Route path="/post/:id" element={<RequireAuth><Layout><PageErrorBoundary><PostDetailPage /></PageErrorBoundary></Layout></RequireAuth>} />
      <Route path="/ad/:id" element={<RequireAuth><Layout><AdDetailPage /></Layout></RequireAuth>} />
      <Route path="/governance/committee/:id" element={<RequireAuth><Layout><GovernancePage /></Layout></RequireAuth>} />
      <Route path="/governance/proposal/:id" element={<RequireAuth><Layout><ProposalDetailPage /></Layout></RequireAuth>} />
      <Route path="/premium/:id" element={<RequireAuth><Layout><PremiumContentPage /></Layout></RequireAuth>} />
      <Route path="/marketplace/bounty/:id" element={<RequireAuth><Layout><BountyDetailPage /></Layout></RequireAuth>} />
      <Route path="/marketplace/coin/:id" element={<RequireAuth><Layout><PageErrorBoundary><CoinDetailPage /></PageErrorBoundary></Layout></RequireAuth>} />
      <Route path="/marketplace/nft/:id" element={<RequireAuth><Layout><NftDetailPage /></Layout></RequireAuth>} />
      <Route path="/marketplace/fraction/:id" element={<RequireAuth><Layout><FractionDetailPage /></Layout></RequireAuth>} />
      {/* P1 Routes */}
      <Route path="/notifications" element={<RequireAuth><Layout><NotificationsPage /></Layout></RequireAuth>} />
      <Route path="/notifications/:category" element={<RequireAuth><Layout><NotificationsPage /></Layout></RequireAuth>} />
      <Route path="/live" element={<RequireAuth><Layout><LivePage /></Layout></RequireAuth>} />
      <Route path="/live/:id" element={<RequireAuth><Layout><LiveStreamPage /></Layout></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><Layout><SettingsPage /></Layout></RequireAuth>} />
      <Route path="/dashboard" element={<RequireAuth><Layout><DashboardPage /></Layout></RequireAuth>} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <MockChainProvider>
            <SupabaseFollowSync />
            <AuthProvider>
              <SideNavProvider>
                <BrowserRouter>
                  {/* BuyOraProvider must be inside the Router so the dialog can
                     access navigate() and useSearchParams, and inside Mock/Toast
                     so it can read balances and surface success toasts. */}
                  <BuyOraProvider>
                    <AppRoutes />
                  </BuyOraProvider>
                </BrowserRouter>
              </SideNavProvider>
            </AuthProvider>
          </MockChainProvider>
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
