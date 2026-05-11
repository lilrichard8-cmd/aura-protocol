import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, GitBranch, CheckCircle, Clock, AlertTriangle, ExternalLink, Copy, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
interface ChainNode {
  id: string;
  title: string;
  author: string;
  avatar: string;
  date: string;
  revenueShare: number;
}

// mockChains: cleared. Real remix lineage is built from MockChainContext.remixes
// when the platform records on-chain remix events. RemixDetailPage now shows
// a graceful empty state when accessed directly with no real remix record.
const mockChains: Record<string, { status: 'active' | 'pending' | 'disputed'; terms: string; chain: ChainNode[] }> = {};

const statusConfig = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  disputed: { label: 'Disputed', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
};

export default function RemixDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const data = mockChains[id || ''];

  // Empty state: when no real remix lineage exists for this id, render a graceful empty page.
  if (!data) {
    return (
      <div className="pt-2 md:pt-4 pb-24 md:pb-4 max-w-3xl mx-auto min-h-screen bg-background px-4 md:px-6">
        <button onClick={() => navigate('/remix')} className="flex items-center gap-1 text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Remix List
        </button>
        <div className="text-center py-24 text-muted-foreground">
          <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No remix lineage to display yet.</p>
          <p className="text-xs mt-1">Remix chains appear here once creators publish remixes on AURA.</p>
        </div>
      </div>
    );
  }

  const sc = statusConfig[data.status];
  const StatusIcon = sc.icon;

  return (
    <div className="pt-2 md:pt-4 pb-24 md:pb-4 max-w-3xl mx-auto min-h-screen bg-background px-4 md:px-6">
      {/* Back */}
      <button onClick={() => navigate('/remix')} className="flex items-center gap-1 text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Remix List
      </button>

      {/* Header */}
      <div className="bg-card rounded-xl border border-border/40 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground mb-2">Remix Agreement Details</h1>
            <Badge variant="outline" className={sc.color}>
              <StatusIcon className="w-3 h-3 mr-1" /> {sc.label}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-lg gap-1.5">
              <Copy className="w-3.5 h-3.5" /> Copy Link
            </Button>
            <Button variant="outline" size="sm" className="rounded-lg gap-1.5">
              <Share2 className="w-3.5 h-3.5" /> Share
            </Button>
          </div>
        </div>

        {/* Terms */}
        <div className="bg-secondary/30 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">📜 Remix Terms</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{data.terms}</p>
        </div>

        {/* On-chain link mock */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>On-chain Record:</span>
          <button className="flex items-center gap-1 text-aura hover:underline">
            0x7a3f...e92b <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Lineage Tree Visualization */}
      <div className="bg-card rounded-xl border border-border/40 p-6 mb-6">
        <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-aura" /> Remix Chain Lineage
        </h2>

        <div className="relative">
          {data.chain.map((node, i) => (
            <div key={node.id} className="flex items-start gap-4 relative">
              {/* Vertical line */}
              {i < data.chain.length - 1 && (
                <div className="absolute left-[19px] top-10 w-0.5 h-[calc(100%-8px)] bg-gradient-to-b from-aura/40 to-aura/10" />
              )}

              {/* Node dot */}
              <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                i === 0
                  ? 'bg-gradient-to-br from-aura to-ora text-white'
                  : 'bg-aura/10 border-2 border-aura/30 text-aura'
              }`}>
                {i === 0 ? (
                  <svg width="16" height="16" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="6" fill="currentColor" /></svg>
                ) : (
                  <GitBranch className="w-4 h-4" />
                )}
              </div>

              {/* Content */}
              <div className={`flex-1 pb-8 ${i === data.chain.length - 1 ? 'pb-0' : ''}`}>
                <div className="bg-secondary/30 rounded-lg p-3 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    {/* No username on ChainNode — keep as plain img until
                       the remix data model carries a profile handle. */}
                    <img src={node.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                    <span className="text-sm font-medium text-foreground">{node.author}</span>
                    {i === 0 && <Badge variant="outline" className="text-[10px] bg-aura/10 text-aura border-aura/20">Original</Badge>}
                  </div>
                  <p className="text-sm text-foreground/80">{node.title}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{node.date}</span>
                    <span>Revenue Share {node.revenueShare}%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions for pending/disputed */}
      {data.status === 'pending' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-yellow-800 mb-2">⏳ Pending Approval</h3>
          <p className="text-xs text-yellow-700 mb-3">The original creator needs to approve this Remix request</p>
          <div className="flex gap-2">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white rounded-lg">Approve</Button>
            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 rounded-lg">Reject</Button>
          </div>
        </div>
      )}

      {data.status === 'disputed' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-red-800 mb-2">⚠️ Dispute in Progress</h3>
          <p className="text-xs text-red-700 mb-3">This Remix agreement is under dispute and has been submitted to the AURA governance committee for arbitration</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="rounded-lg">View Arbitration Details</Button>
            <Button size="sm" variant="outline" className="rounded-lg">Submit Evidence</Button>
          </div>
        </div>
      )}
    </div>
  );
}
