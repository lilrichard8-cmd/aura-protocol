/**
 * AdDetailPage — sponsored-content detail view.
 *
 * 2026-05-11 R15 — completely stripped. The previous 327-line version was
 * entirely hard-coded mock data: a fake "TechFlow Solutions Smart Home"
 * ad, three fabricated related-content posts ("Sarah Chen" / etc.), all
 * with invented like / comment / share counts and unsplash stock images.
 *
 * The protocol currently has no sponsored content (`adPosts = []` in
 * `src/data/mock.ts`), so AdCard never renders and this route is reached
 * only via stale deep links. We show a friendly empty-state and route
 * the user back to Explore.
 *
 * When ads launch for real (committee-approved sponsorships, on-chain
 * AdBid records), wire this view to read from `mockChain.adBids` (or
 * whatever final store ships) the same way BountyDetailPage reads from
 * `mockChain.bounties`.
 */

import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-bold">No sponsored content</h1>
      <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
        AURA doesn't run sponsored ads yet. When the community approves the
        first ad campaigns through governance, sponsored slots will appear in
        the feed and link here.
        {id && (
          <span className="block mt-2 text-[11px] text-muted-foreground/70">
            (Stale link: {id})
          </span>
        )}
      </p>
      <div className="flex items-center justify-center gap-2 pt-2">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
        </Button>
        <Button onClick={() => navigate('/explore')} className="bg-aura hover:bg-aura-dark text-white">
          <Compass className="w-4 h-4 mr-1.5" /> Browse Explore
        </Button>
      </div>
    </div>
  );
}
