import { FC } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { WalletProvider } from './components/WalletProvider'
import { ToastProvider } from './components/Toast'
import { ThemeProvider } from './context/ThemeContext'
import { AuraProvider } from './contexts/AuraContext'
import { VersionSwitcher } from './components-v2/VersionSwitcher'
import { LandingV2 } from './pages-v2/LandingV2'
import { ExploreV2 } from './pages-v2/ExploreV2'
import { wrapV2 } from './components-v2/V2Wrapper'
import { BottomNav } from './components/BottomNav'
import { MessageButton } from './components/MessageButton'
import { RewardsButton } from './components/RewardsButton'
import { WalletInfo } from './components/WalletInfo'
import { Landing } from './pages/Landing'
import { Create } from './pages/Create'
import { ExploreNew } from './pages/ExploreNew'
import { MarketNew } from './pages/MarketNew'
import { Governance } from './pages/Governance'
import { Profile } from './pages/Profile'
import { PostDetail } from './pages/PostDetail'
import { MarketDetail } from './pages/MarketDetail'
import { Messages } from './pages/Messages'
import { Following } from './pages/Following'
import { ProposalDetail } from './pages/ProposalDetail'
import { CommitteeDetail } from './pages/CommitteeDetail'
import { PaidContentConfirm } from './pages/PaidContentConfirm'
import { CreateProposal } from './pages/CreateProposal'
import { Rewards } from './pages/Rewards'
import { Rankings } from './pages/Rankings'
import { Mining } from './pages/Mining'
import { CreatorMigration } from './pages/CreatorMigration'
import { UserProfile } from './pages/UserProfile'
import { Search } from './pages/Search'
import { Drafts } from './pages/Drafts'
import { MakeOffer } from './pages/MakeOffer'
import { OfferSuccess } from './pages/OfferSuccess'
import { CreatorCoin } from './pages/CreatorCoin'
import { CreatorCoinDetail } from './pages/CreatorCoinDetail'
import { CreateCreatorCoin } from './pages/CreateCreatorCoin'

const AppContent: FC = () => {
  const location = useLocation()
  const isLanding = location.pathname === '/'
  const isProfile = location.pathname === '/profile'
  const isMessages = location.pathname === '/messages'
  const isV2 = location.pathname.startsWith('/v2')

  return (
    <div className="min-h-screen bg-black text-white">
      <Routes>
        {/* V2 Routes */}
        <Route path="/v2" element={<LandingV2 />} />
        <Route path="/v2/explore" element={<ExploreV2 />} />
        <Route path="/v2/create" element={wrapV2(Create)({})} />
        <Route path="/v2/market" element={wrapV2(MarketNew)({})} />
        <Route path="/v2/profile" element={wrapV2(Profile)({})} />
        <Route path="/v2/post/:id" element={wrapV2(PostDetail)({})} />
        
        {/* V1 Routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/explore" element={<ExploreNew />} />
        <Route path="/create" element={<Create />} />
        <Route path="/market" element={<MarketNew />} />
        <Route path="/governance" element={<Governance />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/post/:id" element={<PostDetail />} />
        <Route path="/paid-confirm/:id" element={<PaidContentConfirm />} />
        <Route path="/market/:type/:id" element={<MarketDetail />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/following" element={<Following />} />
        <Route path="/proposal/:id" element={<ProposalDetail />} />
        <Route path="/committee/:id" element={<CommitteeDetail />} />
        <Route path="/create-proposal" element={<CreateProposal />} />
        <Route path="/rewards" element={<Rewards />} />
        <Route path="/rankings" element={<Rankings />} />
        <Route path="/mining" element={<Mining />} />
        <Route path="/creator-migration" element={<CreatorMigration />} />
        <Route path="/user/:username" element={<UserProfile />} />
        <Route path="/search" element={<Search />} />
        <Route path="/drafts" element={<Drafts />} />
        <Route path="/make-offer" element={<MakeOffer />} />
        <Route path="/offer-success" element={<OfferSuccess />} />
        <Route path="/creator-coin" element={<CreatorCoin />} />
        <Route path="/creator-coin/:id" element={<CreatorCoinDetail />} />
        <Route path="/create-creator-coin" element={<CreateCreatorCoin />} />
      </Routes>
      
      {/* V1 UI Elements (only show in V1) */}
      {!isV2 && (
        <>
          {/* Wallet Info - show on all pages except landing */}
          {!isLanding && <WalletInfo />}
          
          {/* Message button - show on all pages except landing, profile, and messages */}
          {!isLanding && !isProfile && !isMessages && <MessageButton unreadCount={2} />}
          
          {/* Rewards button - show on all pages except landing and rewards page */}
          {!isLanding && location.pathname !== '/rewards' && <RewardsButton />}
          
          {/* Only show bottom nav when not on landing page */}
          {!isLanding && <BottomNav />}
        </>
      )}
      
      {/* Version Switcher - show on all pages */}
      <VersionSwitcher />
    </div>
  )
}

const App: FC = () => {
  return (
    <WalletProvider>
      <AuraProvider network="devnet">
        <ToastProvider>
          <Router>
            <ThemeProvider>
              <AppContent />
            </ThemeProvider>
          </Router>
        </ToastProvider>
      </AuraProvider>
    </WalletProvider>
  )
}

export default App
