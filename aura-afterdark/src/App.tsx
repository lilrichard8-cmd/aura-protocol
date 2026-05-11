import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import Sidebar from '@/components/Sidebar';
import AgeGate from '@/pages/AgeGate';
import HomePage from '@/pages/HomePage';
import DiscoverPage from '@/pages/DiscoverPage';
import CreatePage from '@/pages/CreatePage';
import MessagesPage from '@/pages/MessagesPage';
import ProfilePage from '@/pages/ProfilePage';
import CreatorPage from '@/pages/CreatorPage';
import ContentDetail from '@/pages/ContentDetail';
import LivePage from '@/pages/LivePage';
import LiveLandingPage from '@/pages/LiveLandingPage';
import WalletPage from '@/pages/WalletPage';
import MarketplacePage from '@/pages/MarketplacePage';
import CurationPage from '@/pages/CurationPage';
import GovernancePage from '@/pages/GovernancePage';
import StakingPage from '@/pages/StakingPage';
import CreateCreatorCoin from '@/pages/CreateCreatorCoin';
import CreatorCoin from '@/pages/CreatorCoin';
import CreatorCoinDetail from '@/pages/CreatorCoinDetail';
import { CommitteeDetailPage } from '@/pages/CommitteeDetail';
import { CreateProposalPage } from '@/pages/CreateProposal';
import { ProposalDetailPage } from '@/pages/ProposalDetail';
import EmailAuth from '@/pages/EmailAuth';
import Following from '@/pages/Following';
import Incentives from '@/pages/Incentives';
import { MakeOfferPage } from '@/pages/MakeOffer';
import { OfferSuccessPage } from '@/pages/OfferSuccess';
import { PaidContentConfirmPage } from '@/pages/PaidContentConfirm';
import Rankings from '@/pages/Rankings';
import Rewards from '@/pages/Rewards';
import NotificationBell from '@/components/NotificationBell';
import NotificationsPage from '@/pages/NotificationsPage';
import CreatorDashboard from '@/pages/CreatorDashboard';
import SettingsPage from '@/pages/SettingsPage';
import LiveStreamPage from '@/pages/LiveStreamPage';
import LiveViewPage from '@/pages/LiveViewPage';
import ReportPage from '@/pages/ReportPage';
import SearchResultsPage from '@/pages/SearchResultsPage';

function App() {
  const [verified, setVerified] = useState(() => {
    return sessionStorage.getItem('aura-age-verified') === 'true';
  });

  useEffect(() => {
    if (verified) {
      sessionStorage.setItem('aura-age-verified', 'true');
    }
  }, [verified]);

  if (!verified) {
    return <AgeGate onVerified={() => setVerified(true)} />;
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-aura-bg text-aura-text">
        <div className="fixed top-4 right-6 z-50 md:hidden">
          <NotificationBell />
        </div>
        <Sidebar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<EmailAuth />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/curation" element={<CurationPage />} />
          <Route path="/governance" element={<GovernancePage />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/live" element={<LiveLandingPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/staking" element={<StakingPage />} />
          <Route path="/creator/:id" element={<CreatorPage />} />
          <Route path="/post/:id" element={<ContentDetail />} />
          <Route path="/paid-confirm/:id" element={<PaidContentConfirmPage />} />
          <Route path="/live/:id" element={<LivePage />} />
          <Route path="/following" element={<Following />} />
          <Route path="/proposal/:id" element={<ProposalDetailPage />} />
          <Route path="/committee/:id" element={<CommitteeDetailPage />} />
          <Route path="/create-proposal" element={<CreateProposalPage />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/incentives" element={<Incentives />} />
          <Route path="/rankings" element={<Rankings />} />
          <Route path="/make-offer" element={<MakeOfferPage />} />
          <Route path="/offer-success" element={<OfferSuccessPage />} />
          <Route path="/creator-coin" element={<CreatorCoin />} />
          <Route path="/creator-coin/:id" element={<CreatorCoinDetail />} />
          <Route path="/create-creator-coin" element={<CreateCreatorCoin />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/dashboard" element={<CreatorDashboard />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/live-browse" element={<LiveStreamPage />} />
          <Route path="/live-view/:id" element={<LiveViewPage />} />
          <Route path="/report/:contentId" element={<ReportPage />} />
          <Route path="/search/:query" element={<SearchResultsPage />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}

export default App;
