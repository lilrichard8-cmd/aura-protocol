// V2版本路由配置
import { wrapV2 } from './components-v2/V2Wrapper'

// 导入所有V1页面
import { Create } from './pages/Create'
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

// V2专属页面
import { LandingV2 } from './pages-v2/LandingV2'
import { ExploreV2 } from './pages-v2/ExploreV2'

// 用V2样式包装V1页面
const CreateV2 = wrapV2(Create)
const MarketV2 = wrapV2(MarketNew)
const GovernanceV2 = wrapV2(Governance)
const ProfileV2 = wrapV2(Profile)
const PostDetailV2 = wrapV2(PostDetail)
const MarketDetailV2 = wrapV2(MarketDetail)
const MessagesV2 = wrapV2(Messages)
const FollowingV2 = wrapV2(Following)
const ProposalDetailV2 = wrapV2(ProposalDetail)
const CommitteeDetailV2 = wrapV2(CommitteeDetail)
const PaidContentConfirmV2 = wrapV2(PaidContentConfirm)
const CreateProposalV2 = wrapV2(CreateProposal)
const RewardsV2 = wrapV2(Rewards)
const RankingsV2 = wrapV2(Rankings)
const MiningV2 = wrapV2(Mining)
const CreatorMigrationV2 = wrapV2(CreatorMigration)
const UserProfileV2 = wrapV2(UserProfile)
const SearchV2 = wrapV2(Search)
const DraftsV2 = wrapV2(Drafts)
const MakeOfferV2 = wrapV2(MakeOffer)
const OfferSuccessV2 = wrapV2(OfferSuccess)

// V2路由配置
export const v2RoutesConfig = [
  { path: "/v2", element: <LandingV2 /> },
  { path: "/v2/explore", element: <ExploreV2 /> },
  { path: "/v2/create", element: <CreateV2 /> },
  { path: "/v2/market", element: <MarketV2 /> },
  { path: "/v2/governance", element: <GovernanceV2 /> },
  { path: "/v2/profile", element: <ProfileV2 /> },
  { path: "/v2/post/:id", element: <PostDetailV2 /> },
  { path: "/v2/paid-confirm/:id", element: <PaidContentConfirmV2 /> },
  { path: "/v2/market/:type/:id", element: <MarketDetailV2 /> },
  { path: "/v2/messages", element: <MessagesV2 /> },
  { path: "/v2/following", element: <FollowingV2 /> },
  { path: "/v2/proposal/:id", element: <ProposalDetailV2 /> },
  { path: "/v2/committee/:id", element: <CommitteeDetailV2 /> },
  { path: "/v2/create-proposal", element: <CreateProposalV2 /> },
  { path: "/v2/rewards", element: <RewardsV2 /> },
  { path: "/v2/rankings", element: <RankingsV2 /> },
  { path: "/v2/mining", element: <MiningV2 /> },
  { path: "/v2/creator-migration", element: <CreatorMigrationV2 /> },
  { path: "/v2/user/:username", element: <UserProfileV2 /> },
  { path: "/v2/search", element: <SearchV2 /> },
  { path: "/v2/drafts", element: <DraftsV2 /> },
  { path: "/v2/make-offer", element: <MakeOfferV2 /> },
  { path: "/v2/offer-success", element: <OfferSuccessV2 /> },
]
