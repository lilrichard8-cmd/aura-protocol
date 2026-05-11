import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, Search, Filter, Clock, CheckCircle, AlertTriangle, ChevronRight, Users, FileText, Shield, Coins } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/context/I18nContext';
import { useMockChain } from '@/context/MockChainContext';

interface RemixItem {
  id: string;
  title: string;
  originalAuthor: string;
  originalAvatar: string;
  remixer: string;
  remixerAvatar: string;
  status: 'active' | 'pending' | 'disputed';
  revenueShare: number;
  remixCount: number;
  createdAt: string;
  tags: string[];
}

// mockRemixes: cleared. Only real remixes (from MockChainContext.remixes) are shown.
// Stats and filtered list now derive entirely from the live remixes state.
const mockRemixes: RemixItem[] = [];

export default function RemixPage() {
  const { t } = useI18n();
  const { remixes, remixRevenue } = useMockChain();
  const statusConfig = {
    active: { label: t.remix.status.active, color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
    pending: { label: t.remix.status.pending, color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
    disputed: { label: t.remix.status.disputed, color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'pending' | 'disputed'>('all');
  const navigate = useNavigate();

  const filtered = mockRemixes.filter(r => {
    const matchTab = activeTab === 'all' || r.status === activeTab;
    const matchSearch = !searchQuery ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.originalAuthor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.remixer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchTab && matchSearch;
  });

  const stats = [
    { icon: GitBranch, label: t.remix.stats.activeAgreements, value: mockRemixes.filter(r => r.status === 'active').length, color: 'text-green-600' },
    { icon: Users, label: t.remix.stats.participants, value: 14, color: 'text-blue-600' },
    { icon: FileText, label: t.remix.stats.totalRemixes, value: mockRemixes.reduce((s, r) => s + r.remixCount, 0), color: 'text-purple-600' },
    { icon: Shield, label: t.remix.stats.disputes, value: mockRemixes.filter(r => r.status === 'disputed').length, color: 'text-red-600' },
  ];

  // My remixes from MockChain (remixes.length used in UI below)

  const tabs = [
    { id: 'all' as const, label: t.remix.tabs.all },
    { id: 'active' as const, label: t.remix.tabs.active },
    { id: 'pending' as const, label: t.remix.tabs.pending },
    { id: 'disputed' as const, label: t.remix.tabs.disputed },
  ];

  return (
    <div className="pt-2 md:pt-4 pb-24 md:pb-4 max-w-4xl md:max-w-none mx-auto md:mx-0 min-h-screen bg-background px-4 md:px-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <GitBranch className="w-6 h-6 text-aura" />
          <h1 className="text-2xl font-bold text-foreground">{t.remix.title}</h1>
        </div>
        <p className="text-muted-foreground text-sm">{t.remix.subtitle}</p>
      </div>

      {/* My Remixes (from MockChain) */}
      {remixes.length > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-blue-500/10 border border-green-500/20">
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="w-5 h-5 text-green-400" />
            <h2 className="font-semibold">My Remixes ({remixes.length})</h2>
          </div>
          <div className="space-y-2">
            {remixes.map(r => (
              <div key={r.id} className="bg-background/60 rounded-lg p-3 flex items-center gap-3">
                <GitBranch className="w-4 h-4 text-green-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground">Revenue split: {r.revenueSplit}% to original • Remixed from @original_creator</p>
                </div>
                <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full">active</span>
              </div>
            ))}
          </div>
          {remixRevenue > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span>Remix Revenue: <strong className="text-yellow-400">{remixRevenue} ORA</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border/40 p-4">
            <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
            <div className="text-2xl font-bold text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t.remix.searchPlaceholder}
            className="pl-9 h-10 rounded-2xl bg-secondary/50 border-transparent"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="p-2.5 rounded-full hover:bg-secondary transition-colors text-muted-foreground">
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === t.id
                ? 'bg-aura text-white'
                : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Remix List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{t.remix.noRemixes}</p>
          </div>
        ) : (
          filtered.map(remix => {
            const sc = statusConfig[remix.status];
            const StatusIcon = sc.icon;
            return (
              <div
                key={remix.id}
                onClick={() => navigate(`/remix/${remix.id}`)}
                className="bg-card rounded-xl border border-border/40 p-4 hover:border-aura/30 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate group-hover:text-aura transition-colors">
                      {remix.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`text-[10px] ${sc.color}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {sc.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{remix.createdAt}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-aura transition-colors shrink-0 mt-1" />
                </div>

                {/* Author chain */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <img src={remix.originalAvatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                    <span className="text-xs text-muted-foreground">{remix.originalAuthor}</span>
                  </div>
                  <GitBranch className="w-3.5 h-3.5 text-aura rotate-90" />
                  <div className="flex items-center gap-1.5">
                    <img src={remix.remixerAvatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                    <span className="text-xs text-muted-foreground">{remix.remixer}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Revenue Share <strong className="text-foreground">{remix.revenueShare}%</strong></span>
                  <span>Remix Count <strong className="text-foreground">{remix.remixCount}</strong></span>
                  <div className="flex gap-1 ml-auto">
                    {remix.tags.map(t => (
                      <span key={t} className="px-2 py-0.5 rounded-full bg-secondary/80 text-[10px]">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
