import { useState } from 'react';
import { X, Copy, Check, ExternalLink } from 'lucide-react';

interface ShareModalProps {
  contentUrl: string;
  contentTitle: string;
  onClose: () => void;
}

const shareOptions = [
  {
    id: 'twitter',
    name: 'Twitter',
    icon: '𝕏',
    color: 'bg-black hover:bg-gray-800',
    action: (url: string, title: string) => 
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: '📱',
    color: 'bg-blue-500 hover:bg-blue-600',
    action: (url: string, title: string) => 
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: '🎮',
    color: 'bg-indigo-500 hover:bg-indigo-600',
    action: (url: string, title: string) => 
      `https://discord.com/channels/@me` // Discord doesn't have direct sharing URL
  },
  {
    id: 'reddit',
    name: 'Reddit',
    icon: '🤖',
    color: 'bg-orange-500 hover:bg-orange-600',
    action: (url: string, title: string) => 
      `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`
  },
];

export default function ShareModal({ contentUrl, contentTitle, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  
  const fullUrl = `https://aura-afterdark.com${contentUrl}`;
  const embedCode = `<iframe src="${fullUrl}/embed" width="400" height="300" frameborder="0"></iframe>`;
  
  const copyToClipboard = async (text: string, setCopyState: (state: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState(true);
      setTimeout(() => setCopyState(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  const handleShareClick = (option: typeof shareOptions[0]) => {
    const shareUrl = option.action(fullUrl, contentTitle);
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-aura-card rounded-lg border border-aura-border max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-aura-border">
          <h2 className="text-xl font-bold">Share Content</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-aura-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Social Media Sharing */}
          <div>
            <h3 className="font-medium mb-3">Share on social media</h3>
            <div className="grid grid-cols-2 gap-3">
              {shareOptions.map(option => (
                <button
                  key={option.id}
                  onClick={() => handleShareClick(option)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-white transition-colors ${option.color}`}
                >
                  <span className="text-lg">{option.icon}</span>
                  <span className="font-medium">{option.name}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Copy Link */}
          <div>
            <h3 className="font-medium mb-3">Copy link</h3>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={fullUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-aura-surface border border-aura-border rounded-lg text-sm"
              />
              <button
                onClick={() => copyToClipboard(fullUrl, setCopied)}
                className="px-4 py-2 bg-aura-accent hover:bg-aura-accent-hover text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Embed Code */}
          <div>
            <h3 className="font-medium mb-3">Embed code</h3>
            <div className="space-y-3">
              <textarea
                value={embedCode}
                readOnly
                rows={3}
                className="w-full px-3 py-2 bg-aura-surface border border-aura-border rounded-lg text-sm resize-none"
              />
              <button
                onClick={() => copyToClipboard(embedCode, setEmbedCopied)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-aura-surface hover:bg-aura-surface/80 border border-aura-border rounded-lg transition-colors"
              >
                {embedCopied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Embed Code Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Embed Code
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* QR Code Section */}
          <div>
            <h3 className="font-medium mb-3">QR Code</h3>
            <div className="flex items-center justify-center p-6 bg-white rounded-lg">
              {/* Mock QR Code */}
              <div className="w-32 h-32 bg-gradient-to-br from-black via-gray-800 to-black rounded-lg flex items-center justify-center">
                <div className="grid grid-cols-8 gap-1 p-2">
                  {Array.from({ length: 64 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 h-1 ${
                        Math.random() > 0.5 ? 'bg-white' : 'bg-black'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-aura-text-secondary text-center mt-2">
              Scan to view on mobile
            </p>
          </div>
          
          {/* Preview Link */}
          <div className="bg-aura-surface p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-aura-accent/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <ExternalLink className="w-6 h-6 text-aura-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium mb-1 line-clamp-1">{contentTitle}</h4>
                <p className="text-sm text-aura-text-secondary mb-2 line-clamp-2">
                  Exclusive content on AURA After Dark - where creators express themselves freely.
                </p>
                <p className="text-xs text-aura-text-secondary font-mono">{fullUrl}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}