// Curation leaderboard empty-state card.
// Extracted from CurationPage.tsx 2026-05-20 P-1 split.
import { Coins, Plus, Trophy, Users, Wallet } from 'lucide-react';

export function LeaderboardEmptyState({ onCurateClick }: { onCurateClick: () => void }) {
  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-amber-200/40 dark:border-amber-800/40 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500/15 to-orange-500/15 px-6 py-5 border-b border-amber-200/40 dark:border-amber-800/40">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200">
                Your leaderboard is empty — for now.
              </h3>
              <p className="text-sm text-muted-foreground">
                Curate your first post to see live rankings + projected payouts here.
              </p>
            </div>
          </div>
        </div>

        {/* Rule diagram — mirrors whitepaper §8 (Curation and Content Discovery) verbatim */}
        <div className="p-6 space-y-5">
          {/* Step 1 — Daily reward pool */}
          <div>
            <div className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground mb-2">
              1. Daily reward pool
            </div>
            <div className="rounded-lg overflow-hidden border border-border/60">
              <div className="bg-secondary px-4 py-2 text-center font-bold text-sm">
                20,000 ORA · settled at 00:00 UTC daily
              </div>
              <div className="grid grid-cols-2 divide-x divide-border/60">
                <div className="px-4 py-3 bg-emerald-500/5">
                  <div className="text-[10px] uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-400">Curator Pool</div>
                  <div className="text-base font-bold inline-flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-500" /> 10,000 ORA
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Split by Curation Score share</div>
                </div>
                <div className="px-4 py-3 bg-amber-500/5">
                  <div className="text-[10px] uppercase tracking-wide font-semibold text-amber-700 dark:text-amber-400">Creator Pool</div>
                  <div className="text-base font-bold inline-flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-500" /> 10,000 ORA
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Split by curation-count share (cap 20%/post)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 — Curation Score & reward formula */}
          <div>
            <div className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground mb-2">
              2. How your reward is calculated
            </div>
            <div className="rounded-lg border border-border/60 bg-secondary/40 p-4 space-y-2">
              <p className="text-sm leading-relaxed text-foreground">
                <strong>Curation Score</strong> = Curator Rank Weight × Discovery Weight
              </p>
              <p className="text-sm leading-relaxed text-foreground">
                <strong>Your daily reward</strong> = (your total Curation Score ÷ sum of all curators’ scores) × 10,000 ORA
              </p>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Pool size is fixed, so multipliers redistribute <em>shares</em> rather than mint extra ORA. The maximum theoretical score is <strong className="text-foreground">25×</strong> (1st curator of a creator with &lt;100 followers); the minimum is <strong className="text-foreground">0.5×</strong> (501st-or-later curator on a creator with &gt;100k followers). Rank is per content and locked at the moment you curate — even content from years ago can mint a fresh 5× for whoever finds it first.
              </p>
            </div>
          </div>

          {/* Step 3 — Curator Rank Weight tiers (6 tiers per whitepaper §8.4.1) */}
          <div>
            <div className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground mb-2">
              3. Curator Rank Weight
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">
              Rank is your position among everyone who has ever curated this content — not how recently the content was published. A 5-year-old gem still pays the 1st discoverer the full 5×.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <TierCard tier="5×"   gradient="from-red-500 to-rose-600"      label="1st curator"     sub="First-discoverer bonus" />
              <TierCard tier="3×"   gradient="from-orange-500 to-amber-600"  label="2nd – 10th"      sub="Early consensus" />
              <TierCard tier="2×"   gradient="from-yellow-500 to-amber-500"  label="11th – 50th"     sub="Catching on" />
              <TierCard tier="1.5×" gradient="from-lime-500 to-emerald-500"  label="51st – 200th"    sub="Niche heat" />
              <TierCard tier="1.2×" gradient="from-emerald-500 to-teal-500"  label="201st – 500th"   sub="Riding the wave" />
              <TierCard tier="1×"   gradient="from-slate-500 to-zinc-600"    label="501st and beyond" sub="Standard rate" />
            </div>
          </div>

          {/* Step 4 — Discovery Weight tiers (5 tiers per whitepaper §8.4.2) */}
          <div>
            <div className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground mb-2">
              4. Discovery Weight
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <TierCard tier="5×"   gradient="from-fuchsia-500 to-pink-600"  label="<100 followers"        sub="Hidden gem" />
              <TierCard tier="3×"   gradient="from-violet-500 to-purple-600" label="100–1k followers"      sub="Up-and-coming" />
              <TierCard tier="1.5×" gradient="from-indigo-500 to-blue-600"   label="1k–10k followers"      sub="Growing" />
              <TierCard tier="1×"   gradient="from-blue-500 to-cyan-600"     label="10k–100k followers"    sub="Established" />
              <TierCard tier="0.5×" gradient="from-slate-500 to-zinc-600"    label=">100k followers"        sub="Mainstream" />
            </div>
          </div>

          {/* Step 5 — Why it's designed this way */}
          <div>
            <div className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground mb-2">
              Why it works this way
            </div>
            <div className="rounded-lg border border-border/60 bg-gradient-to-br from-amber-50/40 to-orange-50/40 dark:from-amber-900/10 dark:to-orange-900/10 p-4 space-y-3">
              <p className="text-sm leading-relaxed">
                The 20,000 ORA pool is <strong>fixed every day</strong> — the multipliers redistribute <em>shares</em>, they never print extra ORA. As more curators participate, the same pool divides into smaller slices, so being early or spotting hidden gems matters more, not less.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <div className="rounded-md bg-emerald-500/10 border border-emerald-200/40 dark:border-emerald-800/40 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide font-bold text-emerald-700 dark:text-emerald-400 mb-0.5">
                    Bootstrap phase
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    With low daily volume, even baseline curators clear the 1 ORA cost easily. This is when the protocol pays the most for the same work.
                  </p>
                </div>
                <div className="rounded-md bg-amber-500/10 border border-amber-200/40 dark:border-amber-800/40 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide font-bold text-amber-700 dark:text-amber-400 mb-0.5">
                    Growth phase
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    As volume rises, late-on-mainstream picks (0.5–1× score) start losing ORA. Only thoughtful curators remain profitable — natural anti-spam pressure.
                  </p>
                </div>
                <div className="rounded-md bg-fuchsia-500/10 border border-fuchsia-200/40 dark:border-fuchsia-800/40 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide font-bold text-fuchsia-700 dark:text-fuchsia-400 mb-0.5">
                    Mature phase
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Curation becomes a craft. Volume-based strategies fail; high-multiplier picks (early on undiscovered, up to 25×) keep capturing meaningful shares.
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground italic leading-relaxed pt-1">
                The mechanism deliberately rewards taste and timing over volume — indiscriminate curation becomes unprofitable by design, while genuine discovery becomes increasingly valuable as the network matures.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-border/40">
            <div className="text-xs text-muted-foreground">
              <Wallet className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />
              Each curation costs <strong className="text-foreground">1 ORA</strong>; you need <strong className="text-foreground">≥100 ORA</strong> on hand to participate.
            </div>
            <Button
              onClick={onCurateClick}
              className="flex-shrink-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600"
            >
              <Plus className="w-4 h-4 mr-1" /> Browse Latest
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LeaderboardEmptyState;
