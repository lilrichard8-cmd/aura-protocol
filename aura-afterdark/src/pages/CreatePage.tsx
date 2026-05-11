import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Image, Video, Upload, Clock, Droplets, Eye, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Visibility = 'free' | 'bronze' | 'silver' | 'gold';

export default function CreatePage() {
  const navigate = useNavigate();
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('free');
  const [isPPV, setIsPPV] = useState(false);
  const [ppvPrice, setPpvPrice] = useState('');
  const [hasWatermark, setHasWatermark] = useState(true);
  const [isScheduled, setIsScheduled] = useState(false);

  const visibilityOptions: { value: Visibility; icon: string; label: string; sub: string }[] = [
    { value: 'free', icon: '🆓', label: 'Free', sub: 'Everyone can see' },
    { value: 'bronze', icon: '🥉', label: 'Bronze+', sub: '$5/mo and above' },
    { value: 'silver', icon: '🥈', label: 'Silver+', sub: '$15/mo and above' },
    { value: 'gold', icon: '🥇', label: 'Gold Only', sub: '$30/mo exclusive' },
  ];

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-aura-bg/90 backdrop-blur-md border-b border-aura-border/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-14 md:ml-64">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-aura-surface/50 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-aura-text" />
          </button>
          <h1 className="text-lg font-bold text-aura-text">New Post</h1>
          <Button size="sm" className="bg-aura-accent hover:bg-aura-accent-hover text-white font-semibold rounded-lg">
            Publish
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 pt-4 space-y-4 md:ml-64">
        {/* Media upload */}
        <div className="border-2 border-dashed border-aura-border rounded-2xl p-8 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-aura-surface/50 flex items-center justify-center">
            <Upload className="w-6 h-6 text-aura-text-secondary" />
          </div>
          <p className="text-sm text-aura-text font-medium">Upload Media</p>
          <p className="text-xs text-aura-text-secondary text-center">Photos, videos, or galleries</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="border-aura-border text-aura-text text-xs rounded-lg">
              <Image className="w-3 h-3 mr-1" /> Photo
            </Button>
            <Button variant="outline" size="sm" className="border-aura-border text-aura-text text-xs rounded-lg">
              <Video className="w-3 h-3 mr-1" /> Video
            </Button>
          </div>
        </div>

        {/* Caption */}
        <div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption..."
            className="w-full bg-aura-surface/30 text-aura-text text-sm rounded-xl p-4 h-24 resize-none placeholder:text-aura-text-secondary/50 border border-aura-border/50 focus:border-aura-accent/50 focus:outline-none"
          />
        </div>

        {/* Visibility */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-aura-text flex items-center gap-2">
            <Eye className="w-4 h-4" /> Content Visibility
          </label>
          <div className="grid grid-cols-2 gap-2">
            {visibilityOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setVisibility(opt.value)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  visibility === opt.value
                    ? 'border-aura-accent bg-aura-accent/10'
                    : 'border-aura-border bg-aura-surface/20 hover:border-aura-border/80'
                }`}
              >
                <span className="text-lg">{opt.icon}</span>
                <p className="text-sm font-medium text-aura-text mt-1">{opt.label}</p>
                <p className="text-[10px] text-aura-text-secondary">{opt.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* PPV Toggle */}
        <div className="bg-aura-surface/20 border border-aura-border/30 rounded-xl p-4 space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-aura-gold" />
              <span className="text-sm font-medium text-aura-text">Pay-Per-View (PPV)</span>
            </div>
            <button
              onClick={() => setIsPPV(!isPPV)}
              className={`w-11 h-6 rounded-full transition-colors ${isPPV ? 'bg-aura-accent' : 'bg-aura-border'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${isPPV ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
          </label>
          {isPPV && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={ppvPrice}
                onChange={(e) => setPpvPrice(e.target.value)}
                placeholder="Price in ORA"
                className="flex-1 bg-aura-surface/50 text-aura-text text-sm rounded-lg px-3 py-2 border border-aura-border/50 focus:border-aura-accent/50 focus:outline-none"
              />
              <span className="text-sm text-aura-gold font-medium">ORA</span>
            </div>
          )}
        </div>

        {/* Watermark Toggle */}
        <div className="bg-aura-surface/20 border border-aura-border/30 rounded-xl p-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-aura-text-secondary" />
              <div>
                <span className="text-sm font-medium text-aura-text">Auto Watermark</span>
                <p className="text-[11px] text-aura-text-secondary">Username + date overlay</p>
              </div>
            </div>
            <button
              onClick={() => setHasWatermark(!hasWatermark)}
              className={`w-11 h-6 rounded-full transition-colors ${hasWatermark ? 'bg-aura-accent' : 'bg-aura-border'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${hasWatermark ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
          </label>
        </div>

        {/* Schedule Toggle */}
        <div className="bg-aura-surface/20 border border-aura-border/30 rounded-xl p-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-aura-text-secondary" />
              <div>
                <span className="text-sm font-medium text-aura-text">Schedule Post</span>
                <p className="text-[11px] text-aura-text-secondary">Set a future publish time</p>
              </div>
            </div>
            <button
              onClick={() => setIsScheduled(!isScheduled)}
              className={`w-11 h-6 rounded-full transition-colors ${isScheduled ? 'bg-aura-accent' : 'bg-aura-border'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${isScheduled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
          </label>
        </div>

        {/* Arweave notice */}
        <div className="bg-aura-card/20 border border-aura-border/20 rounded-xl p-3">
          <p className="text-[11px] text-aura-text-secondary leading-relaxed text-center">
            Content will be permanently stored on Arweave. Once published, it cannot be deleted.
          </p>
        </div>
      </div>
    </div>
  );
}
