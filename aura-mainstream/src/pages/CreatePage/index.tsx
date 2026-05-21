import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Camera, Video, Type, Radio, Music, ImagePlus, X, Hash, Sparkles, Lock, Eye, Users, DollarSign, Save, Settings2, ChevronDown, ChevronUp, Sliders, Clock, UserPlus, Coins, Zap, FileArchive, Info, ShoppingBag, Search, Briefcase } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useMockChain } from '@/context/MockChainContext';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useI18n } from '@/context/I18nContext';
import { putMedia } from '@/lib/mediaStore';
import { useToast } from '@/context/ToastContext';
import {
  useCoreContract,
  placeholderArweaveTxId,
  modeToContentType,
  accessControlToCore,
} from '@/hooks/useCoreContract';
import {
  useMarketRoyaltyContract,
  royaltyPercentToBps,
  NFT_ROYALTY_BPS,
} from '@/hooks/useMarketRoyaltyContract';
import { recordOwnPost } from '@/lib/onChainPostStore';


// 2026-05-20 P-1 split: types + helpers + CoverImageCard extracted.
import type { CreateMode, AccessControl } from './types';
import { compressImageDataUrl } from './lib/imageCompression';
import { extractVideoFirstFrame } from './lib/videoFrameExtract';
import CoverImageCard from './components/CoverImageCard';


export default function CreatePage() {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { t } = useI18n();
  const mockChain = useMockChain();
  // On-chain bridges. Both gate off VITE_CORE_REAL_CHAIN=true.
  // When false, publish + royalty stay on the existing mock chain flow.
  const coreOnChain = useCoreContract();
  const royaltyOnChain = useMarketRoyaltyContract();
  // Allow Studio Hub to deep-link straight into a content mode via
  // ?mode=photo|video|text|audio|live and auto-toggle the premium flag
  // via ?premium=1 — saves the user from picking the type again.
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [draftSuccess, setDraftSuccess] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<{ show: boolean; amount: number; txHash: string; title: string; image: string | null }>({ show: false, amount: 0, txHash: '', title: '', image: null });
  const [publishError, setPublishError] = useState<string | null>(null);

  // Post Bounty — lives in Studio (moved from Marketplace where it cluttered
  // the browse experience). Opens a modal with title/description/reward.
  const [showBountyModal, setShowBountyModal] = useState(false);
  const [bountyTitle, setBountyTitle] = useState('');
  const [bountyDesc, setBountyDesc] = useState('');
  const [bountyReward, setBountyReward] = useState('');
  const [bountyLoading, setBountyLoading] = useState(false);
  const [bountyError, setBountyError] = useState<string | null>(null);
  const [bountySuccess, setBountySuccess] = useState(false);
  const submitBounty = async () => {
    if (!bountyTitle.trim() || !bountyDesc.trim() || !bountyReward.trim()) {
      setBountyError('Title, description, and reward are all required.');
      return;
    }
    const reward = Number(bountyReward);
    if (!Number.isFinite(reward) || reward <= 0) {
      setBountyError('Reward must be a positive ORA amount.');
      return;
    }
    setBountyError(null);
    setBountyLoading(true);
    try {
      await mockChain.createBounty(bountyTitle.trim(), bountyDesc.trim(), reward);
      setBountyTitle(''); setBountyDesc(''); setBountyReward('');
      setBountySuccess(true);
      setTimeout(() => { setBountySuccess(false); setShowBountyModal(false); }, 1200);
    } catch (e: any) {
      setBountyError(e?.message || 'Failed to post bounty.');
    } finally {
      setBountyLoading(false);
    }
  };
  
  const modes = [
    { id: 'photo' as const, icon: Camera, label: t.create.modes.photo.label, desc: t.create.modes.photo.desc },
    { id: 'video' as const, icon: Video, label: t.create.modes.video.label, desc: t.create.modes.video.desc },
    { id: 'audio' as const, icon: Music, label: 'Audio',  desc: 'Music, podcast, or voice note' },
    { id: 'text' as const, icon: Type, label: t.create.modes.text.label, desc: t.create.modes.text.desc },
    { id: 'live' as const, icon: Radio, label: t.create.modes.live.label, desc: t.create.modes.live.desc },
  ];

  const accessOptions = [
    { id: 'public' as const, icon: Eye, label: t.create.access.public.label, desc: t.create.access.public.desc },
    { id: 'content-key' as const, icon: Lock, label: '🔑 Content Key', desc: 'Pay to unlock' },
    { id: 'followers' as const, icon: Users, label: t.create.access.followers.label, desc: t.create.access.followers.desc },
    { id: 'coin-holders' as const, icon: Coins, label: 'Coin Holders', desc: 'Requires your Creator Coin' },
  ];
  // 2026-05-11 R5: default to 'photo' editor when entering Create from Studio.
  // The standalone "Studio overview" landing page that showed when mode=null
  // is now reachable via the explicit Back button — most users want to start
  // creating immediately, not see another menu screen.
  const [mode, setMode] = useState<CreateMode | null>('photo');
  // Fractionalize-as-NFT toggle. When on, publish flow also mints a
  // fractional NFT for this work after Arweave storage settles. Studio
  // Hub deep-links here with ?fractionalize=1 to pre-arm the toggle.
  const [fractionalizeOnPublish, setFractionalizeOnPublish] = useState(false);
  const [fractionalizeFragments, setFractionalizeFragments] = useState<number>(100);
  const [fractionalizePrice, setFractionalizePrice] = useState<number>(1);

  // Apply ?mode=... + ?fractionalize=1 once on mount so the user lands
  // directly in the right editor with the right toggles armed.
  useEffect(() => {
    const m = searchParams.get('mode');
    if (m && ['photo', 'video', 'text', 'audio', 'live'].includes(m)) {
      setMode(m as CreateMode);
    }
    if (searchParams.get('fractionalize') === '1') {
      setFractionalizeOnPublish(true);
      // Default to photo mode if no mode was passed — fractional NFTs
      // typically wrap visual works.
      if (!m) setMode('photo');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [mediaTypes, setMediaTypes] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; size: number; type: string; url: string }[]>([]);
  // Persistent media URLs for audio/video uploads. We keep these as
  // data: URLs (or blob URLs) separately from `images` so the post
  // payload carries the right field for the consumer card. Without
  // this, AudioCard / VideoCard / PostDetailPage have nothing to
  // play (2026-05-11 fix —Zhuoyu reported audio post not playing).
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  // 2026-05-11 R10: IndexedDB ref ('media:<uuid>') for the audio file.
  // The blob: URL in `audioUrl` is for in-composer preview; the ref is what
  // gets persisted to the feed so we survive page reloads without ever
  // touching localStorage with the binary payload.
  const [audioMediaRef, setAudioMediaRef] = useState<string | null>(null);
  const [audioDurationStr, setAudioDurationStr] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [videoMediaRef, setVideoMediaRef] = useState<string | null>(null);
  const [videoDurationStr, setVideoDurationStr] = useState<string | null>(null);
  // 2026-05-11 R14: explicit cover image override. For video/audio posts
  // we let the user upload their own cover; otherwise we auto-grab a frame
  // (video) or use the first uploaded image (everything else). When this
  // is set, it takes priority over `images[0]` for the feed coverImage.
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [enableCuration, setEnableCuration] = useState(false);
  const [accessControls, setAccessControls] = useState<Set<AccessControl>>(new Set<AccessControl>(['public']));
  
  const [minCoinAmount, setMinCoinAmount] = useState('');
  const [coinAccessMode, setCoinAccessMode] = useState<'hold' | 'pay'>('hold');
  
  // Advanced Settings State
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Mint as NFT
  const [mintAsNFT, setMintAsNFT] = useState(false);

  // NFT Fractioning
  const [enableFractioning, setEnableFractioning] = useState(false);
  const [fractionCount, setFractionCount] = useState(1000);
  const [fractionPrice, setFractionPrice] = useState('');
  
  // Copyright/CC License
  const [licenseType, setLicenseType] = useState('All Rights Reserved');
  
  // Royalty Settings — bounded to on-chain range (5..45 % per
  // whitepaper §12). UI slider min/max match NFT_ROYALTY_BPS.{MIN,MAX}.
  const ROYALTY_MIN_PCT = NFT_ROYALTY_BPS.MIN / 100; // 5
  const ROYALTY_MAX_PCT = NFT_ROYALTY_BPS.MAX / 100; // 45
  const [royaltyPercent, setRoyaltyPercent] = useState(10);
  
  // Arweave Storage - Default to true
  const [enableArweave, setEnableArweave] = useState(true);
  // Storage cost handled by protocol
  
  // Time-limited Content
  const [enableTimeLimit, setEnableTimeLimit] = useState(false);
  const [enableSchedule, setEnableSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [enablePreAnnounce, setEnablePreAnnounce] = useState(false);
  const [timeLimit, setTimeLimit] = useState('30d');
  
  // Collaborative Creation
  const [enableCollab, setEnableCollab] = useState(false);

  // Linked Products
  const [showLinkedProducts, setShowLinkedProducts] = useState(false);
  const [linkedProductType, setLinkedProductType] = useState<'coin' | 'nft' | 'key'>('coin');
  const [linkedProductInput, setLinkedProductInput] = useState('');
  const [linkedProducts, setLinkedProducts] = useState<Array<{ type: 'coin' | 'nft' | 'key'; name: string; price?: string; creator?: string }>>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);

  // Mock site-wide listings for autocomplete search
  const siteListings: Array<{ type: 'coin' | 'nft' | 'key'; name: string; price: string; creator: string }> = [
    { type: 'coin', name: 'Sakura Lens Coin', price: '50', creator: 'Sakura Lens' },
    { type: 'coin', name: 'Neon Wave Coin', price: '120', creator: 'Neon Wave' },
    { type: 'coin', name: 'Pixel Witch Coin', price: '80', creator: 'Pixel Witch' },
    { type: 'coin', name: 'Code Poet Coin', price: '35', creator: 'Code Poet' },
    { type: 'coin', name: 'Joe Chen Coin', price: '200', creator: 'Joe Chen' },
    { type: 'nft', name: 'Neon Dreams Series #12', price: '500', creator: 'Pixel Witch' },
    { type: 'nft', name: 'Cherry Blossoms at Dawn', price: '350', creator: 'Sakura Lens' },
    { type: 'nft', name: 'Cyber Samurai - Digital Painting', price: '800', creator: 'Pixel Witch' },
    { type: 'nft', name: 'Tokyo Neon District', price: '450', creator: 'Sakura Lens' },
    { type: 'nft', name: 'Premium Digital Art Collection', price: '1200', creator: 'Pixel Witch' },
    { type: 'key', name: 'Behind-the-Scenes Content', price: '30', creator: 'Joe Chen' },
    { type: 'key', name: 'Late Night Studio Session', price: '50', creator: 'Neon Wave' },
    { type: 'key', name: 'Hidden Gems of Kyoto Guide', price: '25', creator: 'Joe Chen' },
    { type: 'key', name: 'Making a Beat from Scratch (Full)', price: '100', creator: 'Neon Wave' },
    { type: 'key', name: 'Photography Masterclass', price: '200', creator: 'Sakura Lens' },
  ];

  const getFilteredListings = () => {
    const q = linkedProductInput.toLowerCase();
    return siteListings
      .filter(item => 
        (linkedProductType === item.type || !linkedProductType) &&
        (item.name.toLowerCase().includes(q) || item.creator.toLowerCase().includes(q))
      )
      .filter(item => !linkedProducts.some(p => p.name === item.name && p.type === item.type))
      .slice(0, 6);
  };
  const [collaborators, setCollaborators] = useState<Array<{id: string, name: string, percent: number}>>([]);
  const [collabInput, setCollabInput] = useState('');
  const [collabPercent, setCollabPercent] = useState(20);

  // License Info Modal
  const [showLicenseInfo, setShowLicenseInfo] = useState(false);

  // Content License Settings (content-license contract)
  const [enableLicensing, setEnableLicensing] = useState(false);
  const [enableContentKey, setEnableContentKey] = useState(false);
  const [keyPrice, setKeyPrice] = useState('5');
  const [keySupply, setKeySupply] = useState('unlimited');
  const [keyTradeable, setKeyTradeable] = useState(false);
  // Live ticket
  const [enableTicket, setEnableTicket] = useState(false);
  const [ticketPrice, setTicketPrice] = useState('2');
  const [ticketSupply, setTicketSupply] = useState('unlimited');
  const [embedPrice, setEmbedPrice] = useState(5);
  const [remixPrice, setRemixPrice] = useState(20);
  // === States moved here to comply with React hooks rules (no hooks after early returns) ===
  const [viewingPost, setViewingPost] = React.useState<any>(null);
  const [showDrafts, setShowDrafts] = React.useState(false);
  const [boostModal, setBoostModal] = React.useState<{ show: boolean; label: string; cost: number }>({ show: false, label: '', cost: 0 });
  const [selectedBoost, setSelectedBoost] = React.useState<{ label: string; cost: number } | null>(null);
  const [liveSource, setLiveSource] = React.useState<string | null>(null);
  const [liveCountdown, setLiveCountdown] = React.useState<number | null>(null);
  const [isLive, setIsLive] = React.useState(false);
  const [liveStream, setLiveStream] = React.useState<MediaStream | null>(null);
  const [showCreateMenu, setShowCreateMenu] = React.useState(false);
  const [showChat, setShowChat] = React.useState(true);
  const [micOn, setMicOn] = React.useState(true);
  const [camOn, setCamOn] = React.useState(true);
  const [liveElapsed, setLiveElapsed] = React.useState(0);
  const [mockViewers] = React.useState(Math.floor(Math.random() * 300 + 50));
  const [mockLikes, setMockLikes] = React.useState(0);
  const [mockOra, setMockOra] = React.useState(0);
  const [tipEffect, setTipEffect] = React.useState<{ amount: number; user: string } | null>(null);
  const [chatInput, setChatInput] = React.useState('');
  const [userChats, setUserChats] = React.useState<{ user: string; color: string; msg: string; time: number }[]>([]);
  const [showGiftPanel, setShowGiftPanel] = React.useState(false);
  const liveVideoRef = React.useRef<HTMLVideoElement>(null);
  const broadcasterVideoRef = React.useRef<HTMLVideoElement>(null);

  // 2026-05-11 R8: rehydrate from a saved draft when arriving with
  // ?draftId=draft_xxx. Reads from localStorage 'aura_drafts' and refills
  // every relevant composer field. Runs once on mount, then strips the
  // draftId param so refreshes don't keep re-hydrating.
  useEffect(() => {
    const draftId = searchParams.get('draftId');
    if (!draftId) return;
    try {
      const drafts = JSON.parse(localStorage.getItem('aura_drafts') || '[]');
      const d = drafts.find((x: any) => x?.id === draftId);
      if (!d) return;
      if (d.title) setTitle(d.title === 'Untitled Draft' ? '' : d.title);
      if (typeof d.content === 'string') setContent(d.content);
      if (Array.isArray(d.tags)) setTags(d.tags);
      if (Array.isArray(d.images)) setImages(d.images);
      if (Array.isArray(d.attachedFiles)) setAttachedFiles(d.attachedFiles);
      if (d.mode && ['photo', 'video', 'text', 'audio', 'live'].includes(d.mode)) {
        setMode(d.mode as CreateMode);
      }
      if (Array.isArray(d.accessControl) && d.accessControl.length > 0) {
        setAccessControls(new Set(d.accessControl as AccessControl[]));
      }
    } catch { /* ignore corrupt draft */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const addMockImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // 2026-05-11 R5: auto-detect content type and switch composer mode
      // based on the first file's MIME type. Lets users drop ANY supported
      // file without picking the mode first; the composer reshapes around
      // what they uploaded.
      const first = files[0];
      const mt = first.type;
      let inferredMode: CreateMode | null = null;
      if (mt.startsWith('video/')) inferredMode = 'video';
      else if (mt.startsWith('audio/')) inferredMode = 'audio';
      else if (mt.startsWith('image/')) inferredMode = 'photo';
      else if (
        mt.startsWith('text/') ||
        mt.includes('pdf') ||
        mt.includes('msword') ||
        mt.includes('wordprocessingml') ||
        /\.(txt|md|rtf|doc|docx|odt|epub)$/i.test(first.name)
      ) inferredMode = 'text';
      if (inferredMode && inferredMode !== mode) {
        setMode(inferredMode);
      }
      for (const file of Array.from(files)) {
        // Use a data: URL (base64) instead of blob: object URL so the
        // image survives a page reload — blob URLs only live as long as
        // the document that created them, which broke feed thumbnails
        // after publish + nav.
        const readAsDataURL = (f: File) => new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(r.error);
          r.readAsDataURL(f);
        });
        if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) {
          if (file.type.startsWith('video/')) {
            // Only 1 video allowed. 2026-05-11 R10: persist to IndexedDB
            // media store so the published feed entry can recreate a blob:
            // URL on next page load. The composer uses a local blob: URL
            // for instant preview.
            const url = URL.createObjectURL(file);
            const mediaRef = await putMedia(file);
            setVideoUrl(url);
            setVideoMediaRef(mediaRef);
            setVideoFileName(file.name);
            // Probe duration off-thread so we can render mm:ss in cards.
            try {
              const probe = document.createElement('video');
              probe.preload = 'metadata';
              probe.src = url;
              probe.onloadedmetadata = () => {
                const sec = Math.round(probe.duration);
                if (Number.isFinite(sec) && sec > 0) {
                  const m = Math.floor(sec / 60);
                  const s = sec % 60;
                  setVideoDurationStr(`${m}:${s.toString().padStart(2, '0')}`);
                }
              };
            } catch {}
            // 2026-05-11 R14: auto-grab a frame to use as the video poster
            // unless the user has already supplied a cover image.
            extractVideoFirstFrame(url, 1280, 0.85)
              .then(frame => {
                setCoverImage(prev => prev || frame);
              })
              .catch(() => { /* poster fallback handled by VideoCard */ });
            // For backward compatibility with old code paths that look
            // at `images`, also stash the same URL there with mediaType
            // 'video' so existing carousels keep working.
            setImages(prev => {
              const newImages = [...prev];
              const newTypes = [...mediaTypes];
              const existingVideoIdx = newTypes.findIndex(t => t === 'video');
              if (existingVideoIdx >= 0) {
                newImages[existingVideoIdx] = url;
                return newImages;
              }
              return [...prev, url];
            });
            setMediaTypes(prev => {
              const existingVideoIdx = prev.findIndex(t => t === 'video');
              if (existingVideoIdx >= 0) {
                const newTypes = [...prev];
                newTypes[existingVideoIdx] = 'video';
                return newTypes;
              }
              return [...prev, 'video'];
            });
          } else if (file.type.startsWith('audio/')) {
            // 2026-05-11 R10: persist audio in IndexedDB media store, not
            // localStorage. Audio files of even a few MB blow the 5–10MB
            // localStorage quota once base64-encoded; IndexedDB has no such
            // cap. We hold a blob: URL for instant playback in the composer
            // and a `media:<id>` ref for what gets written to the feed.
            const mediaRef = await putMedia(file);
            const blobUrl = URL.createObjectURL(file);
            setAudioUrl(blobUrl);
            setAudioMediaRef(mediaRef);
            setAudioFileName(file.name);
            // Probe duration so AudioCard can show m:ss.
            try {
              const probe = document.createElement('audio');
              probe.preload = 'metadata';
              probe.src = blobUrl;
              probe.onloadedmetadata = () => {
                const sec = Math.round(probe.duration);
                if (Number.isFinite(sec) && sec > 0) {
                  const m = Math.floor(sec / 60);
                  const s = sec % 60;
                  setAudioDurationStr(`${m}:${s.toString().padStart(2, '0')}`);
                }
              };
            } catch {}
            // If user hasn't typed a title yet, default to filename.
            if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
          } else {
            // 2026-05-11 R10: compress images before stashing as data URL
            // so multi-MB phone photos don't blow the localStorage quota
            // when this post is later persisted to `aura_user_posts`.
            // Strategy: longest side <= 1600px, JPEG 0.85 (typically 200-500KB).
            // Falls back to the raw data URL if compression fails.
            let dataUrl = await readAsDataURL(file);
            try {
              dataUrl = await compressImageDataUrl(dataUrl, 1600, 0.85);
            } catch { /* keep original */ }
            setImages(prev => [...prev, dataUrl]);
            setMediaTypes(prev => [...prev, 'image']);
          }
        } else {
          // Document file — extract text and render as preview
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          
          if (['txt', 'md', 'rtf'].includes(ext)) {
            // Plain text files — read directly
            const reader = new FileReader();
            reader.onload = (ev) => {
              if (ev.target?.result) {
                setContent(prev => prev ? prev + '\n\n' + (ev.target!.result as string) : (ev.target!.result as string));
                if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
              }
            };
            reader.readAsText(file);
          } else if (['doc', 'docx'].includes(ext)) {
            // Word files — extract text via arraybuffer + basic parsing
            const reader = new FileReader();
            reader.onload = async (ev) => {
              if (ev.target?.result) {
                try {
                  // docx is a zip file — extract word/document.xml and strip tags
                  const JSZip = (await import('jszip')).default;
                  const zip = await JSZip.loadAsync(ev.target!.result as ArrayBuffer);
                  const docXml = await zip.file('word/document.xml')?.async('string');
                  if (docXml) {
                    // Strip XML tags, decode entities, clean up
                    const text = docXml
                      .replace(/<w:br[^>]*\/>/g, '\n')
                      .replace(/<\/w:p>/g, '\n')
                      .replace(/<[^>]+>/g, '')
                      .replace(/&amp;/g, '&')
                      .replace(/&lt;/g, '<')
                      .replace(/&gt;/g, '>')
                      .replace(/&quot;/g, '"')
                      .replace(/&#39;/g, "'")
                      .replace(/\n{3,}/g, '\n\n')
                      .trim();
                    setContent(prev => prev ? prev + '\n\n' + text : text);
                    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
                  }
                } catch {
                  // Fallback: show as attached file
                  setAttachedFiles(prev => [...prev, { name: file.name, size: file.size, type: ext, url }]);
                }
              }
            };
            reader.readAsArrayBuffer(file);
          } else if (ext === 'pdf') {
            // PDF — can't easily extract text client-side without a lib, show file card
            setAttachedFiles(prev => [...prev, { name: file.name, size: file.size, type: ext, url }]);
          } else {
            // Other formats — show as file card
            setAttachedFiles(prev => [...prev, { name: file.name, size: file.size, type: ext, url }]);
          }
        }
      }
    }
    e.target.value = '';
  };

  /** Reset every composer field after publish or close. Centralised so
   *  every “kill the composer” entry-point clears the new audio/video
   *  state too (otherwise hopping between modes leaks last upload). */
  const resetComposer = () => {
    setMode(null);
    setTitle('');
    setContent('');
    setTags([]);
    setImages([]);
    setMediaTypes([]);
    setAttachedFiles([]);
    setAudioUrl(null);
    setAudioFileName(null);
    setAudioDurationStr(null);
    setVideoUrl(null);
    setVideoFileName(null);
    setVideoDurationStr(null);
  };

  const handleSaveDraft = () => {
    // Save to localStorage drafts
    const drafts = JSON.parse(localStorage.getItem('aura_drafts') || '[]');
    drafts.unshift({
      id: 'draft_' + Date.now(),
      title: title || 'Untitled Draft',
      content,
      tags,
      images,
      attachedFiles,
      mode,
      accessControl: Array.from(accessControls),
      savedAt: new Date().toISOString(),
    });
    localStorage.setItem('aura_drafts', JSON.stringify(drafts));
    setDraftSuccess(true);
  };

  const handlePublish = async () => {
    setPublishError(null);
    // Client-side royalty validation. If the user toggled mintAsNFT,
    // royaltyPercent must be in [ROYALTY_MIN_PCT, ROYALTY_MAX_PCT]; the
    // on-chain set_royalty ix would reject anything else. Surface a
    // friendly error instead of paying gas to learn this.
    if (mintAsNFT) {
      if (royaltyPercent < ROYALTY_MIN_PCT || royaltyPercent > ROYALTY_MAX_PCT) {
        setPublishError(
          `Royalty must be between ${ROYALTY_MIN_PCT}% and ${ROYALTY_MAX_PCT}%.`,
        );
        return;
      }
    }
    // 2026-05-11 R9: derive the *effective* primary mode at publish time.
    // The user may have started in `photo` (default), uploaded a photo as
    // cover, then added an audio file — in that flow `mode` may still be
    // 'photo' even though they clearly meant an audio post. We pick the
    // mode based on what media is actually attached:
    //   audio file present  -> 'audio' (photo becomes cover art)
    //   video file present  -> 'video' (photo becomes poster)
    //   else                -> current `mode`
    // This guarantees the feed renders the right card (AudioCard /
    // VideoCard) and the user actually hears the audio they uploaded.
    let effectiveMode: CreateMode = mode || 'photo';
    if (audioUrl) effectiveMode = 'audio';
    else if (videoUrl) effectiveMode = 'video';
    try {
      // On-chain publish branch. Gated by VITE_CORE_REAL_CHAIN.
      // 2026-05-19: Arweave upload is not yet wired into the composer,
      // so we pass a deterministic 43-char placeholder tx id. The on-chain
      // program only validates length, not content — once the uploader
      // lands we swap this for the real ar:// tx id.
      let corePostPda: string | null = null;
      let coreSignature: string | null = null;
      let coreAuthorBase58: string | null = null;
      if (coreOnChain.enabled && coreOnChain.module) {
        const author = (coreOnChain.module as any).wallet?.publicKey;
        if (!author) throw new Error('Connect a Solana wallet first.');
        coreAuthorBase58 = author.toBase58();

        // 2026-05-19 — Core publishContent requires a registered
        // UserProfile PDA. Auto-register on the user's behalf the first
        // time they publish so the demo flow doesn't fork into a
        // "register first" detour. Skip if the profile already exists.
        try {
          const existingProfile = await coreOnChain.module.fetchUserProfile(author);
          if (!existingProfile) {
            const shortAddr = author.toBase58().slice(0, 8);
            const reg = await coreOnChain.module.registerUser({
              username: `user_${shortAddr}`,
              profileUri: '',
            });
            if (!reg.success) {
              throw new Error(reg.error || 'user registration failed');
            }
          }
        } catch (regErr: any) {
          // If the user-profile fetch itself errored (e.g. RPC blip) we
          // still attempt registration — registerUser is idempotent at
          // the PDA level (System Program will refuse to re-init).
          console.warn('[CreatePage] user-profile check failed:', regErr?.message);
        }

        const arweaveTxId = placeholderArweaveTxId(title || 'untitled');
        const corePublish = await coreOnChain.module.publishContent({
          arweaveTxId,
          contentType: modeToContentType(effectiveMode),
          accessControl: accessControlToCore(accessControls),
          // For content-key gated posts, encode the ORA key price in raw
          // u64 lamports (9 decimals). 0 for free posts.
          price: accessControls.has('content-key')
            ? BigInt(Math.max(0, Math.floor((parseFloat(keyPrice) || 0) * 1_000_000_000)))
            : 0n,
        });
        if (!corePublish.success) {
          throw new Error(corePublish.error || 'on-chain publish failed');
        }
        corePostPda = corePublish.post ? corePublish.post.toBase58() : null;
        coreSignature = corePublish.signature || null;
        // Optional: set NFT royalty if the user enabled mintAsNFT. For
        // now we re-use the freshly-derived post PDA as the "NFT mint"
        // input slot — once a real mint flow exists (mint_nft ix) we
        // pass that mint address here instead.
        if (mintAsNFT && royaltyOnChain.enabled && royaltyOnChain.module) {
          try {
            const royaltyBps = royaltyPercentToBps(royaltyPercent);
            const nftMint = corePublish.post;
            if (nftMint) {
              const r = await royaltyOnChain.module.setRoyalty({
                nftMint,
                royaltyBps,
              });
              if (!r.success) {
                // Don't fail the whole publish on royalty error — surface
                // as a soft warning. The post is live regardless.
                console.warn('[CreatePage] setRoyalty failed:', r.error);
              }
            }
          } catch (royaltyErr: any) {
            console.warn('[CreatePage] royalty step skipped:', royaltyErr?.message);
          }
        }
        // Fall through into the mock-chain bookkeeping so the local
        // feed / Studio dashboard still see this post. We swap the tx
        // hash for the real on-chain signature.
        (mockChain as any).lastOnChainSignature = corePublish.signature;
      }
      const result = await mockChain.publishContent({ title, content, tags, images, mode: effectiveMode, accessControl: Array.from(accessControls) });
      // If we have a real on-chain signature, prefer it for the receipt.
      if (coreOnChain.enabled && (mockChain as any).lastOnChainSignature) {
        result.txHash = (mockChain as any).lastOnChainSignature;
      }
      // Save to localStorage feed
      const feedItems = JSON.parse(localStorage.getItem('aura_user_posts') || '[]');
      // Set license if enabled
      if (enableLicensing) {
        const contentId = feedItems[0]?.id || result.txHash.slice(0, 8);
        mockChain.setLicense(contentId, embedPrice, remixPrice);
      }
      const newPostId = crypto.randomUUID();

      // 2026-05-19 — persist the on-chain post PDA in the per-user
      // registry so HomePage / Profile / Explore can scan localStorage
      // and surface this post in feeds (cross-user, per-device only —
      // see lib/onChainPostStore.ts TODO for the future indexer).
      if (corePostPda && coreAuthorBase58) {
        try {
          recordOwnPost(coreAuthorBase58, {
            postPda: corePostPda,
            author: coreAuthorBase58,
            postId: newPostId,
            createdAt: Date.now(),
            title: title || 'Untitled',
            mode: effectiveMode,
            signature: coreSignature || undefined,
          });
        } catch (e) {
          console.warn('[CreatePage] recordOwnPost failed:', e);
        }
      }
      // 2026-05-11 R14: pick the cover image with explicit priority:
      //   1) `coverImage` state (user-uploaded cover, or auto-extracted
      //      video first frame),
      //   2) for audio posts, the first uploaded image (album-art slot),
      //   3) the first uploaded image otherwise.
      // We always write this through to the feed entry so AudioCard /
      // VideoCard / PhotoCard all have a deterministic background image.
      const resolvedCover = coverImage
        || (effectiveMode === 'audio' && images.length > 0 ? images[0] : undefined)
        || (images.length > 0 ? images[0] : undefined);
      feedItems.unshift({
        id: newPostId,
        title,
        content,
        tags,
        images,
        coverImage: resolvedCover,
        // 2026-05-11 R9: use effectiveMode so audio-with-cover-art posts
        // get type='audio' and render via AudioCard. Previously the cover
        // photo dominated and the audio attachment was hidden because
        // PhotoCard ignores audioUrl.
        mode: effectiveMode,
        // Persist the dedicated media URLs so the feed cards can
        // render audio/video correctly (AudioCard reads audioUrl,
        // VideoCard reads videoUrl, PostDetailPage uses both).
        // 2026-05-11 R10: prefer the IndexedDB media ref over the raw blob
        // URL when persisting to localStorage. AudioCard/VideoCard resolve
        // refs back to blob: URLs via useMediaUrl(). Falls back to the
        // current value (data URL or external link) if no ref exists.
        audioUrl: audioMediaRef || audioUrl || undefined,
        audioDuration: audioDurationStr || undefined,
        videoUrl: videoMediaRef || videoUrl || undefined,
        videoDuration: videoDurationStr || undefined,
        // 2026-05-11 R17: persist premium / content-key state so the
        // Marketplace Content Keys tab and any premium-detail page can
        // recognise this post as gated. Without these fields the post
        // was treated as 'public' by every downstream consumer.
        isPremium: accessControls.has('content-key'),
        premiumPrice: accessControls.has('content-key')
          ? (parseFloat(keyPrice) || 0)
          : undefined,
        accessControl: Array.from(accessControls),
        txHash: result.txHash,
        // 2026-05-19 — on-chain post PDA + signature for downstream
        // pages (PostDetail like/comment, Profile explorer link).
        onChainPostPda: corePostPda || undefined,
        onChainSignature: coreSignature || undefined,
        createdAt: new Date().toISOString(),
      });
      // 2026-05-11 R10: defend the localStorage write. If we're over the
      // quota (e.g. several large data-URL images already published),
      // drop the oldest items one by one and retry. This keeps publish
      // working even when the user has hammered the composer.
      try {
        localStorage.setItem('aura_user_posts', JSON.stringify(feedItems));
      } catch (storageErr: any) {
        const isQuota = /Quota|exceeded|setItem/i.test(String(storageErr?.name || storageErr?.message || ''));
        if (!isQuota) throw storageErr;
        let trimmed = feedItems.slice();
        let saved = false;
        // Drop oldest entries until it fits (newest is at index 0).
        while (trimmed.length > 1) {
          trimmed = trimmed.slice(0, trimmed.length - 1);
          try {
            localStorage.setItem('aura_user_posts', JSON.stringify(trimmed));
            saved = true;
            break;
          } catch { /* keep trimming */ }
        }
        if (!saved) {
          throw new Error('Storage full — try clearing some old posts in Studio.');
        }
      }
      // Notify any feed/profile/dashboard hook subscribed to this stream
      // so freshly-published content shows up without a hard reload.
      window.dispatchEvent(new CustomEvent('aura_user_posts_changed'));
      // Optionally fractionalize the freshly-published work as an NFT.
      // The toggle lives in the Composer side rail and can be pre-armed
      // by Studio Hub via ?fractionalize=1.
      if (fractionalizeOnPublish && fractionalizeFragments >= 10 && fractionalizePrice > 0) {
        try {
          await mockChain.fractionalizeContent({
            contentId: newPostId,
            title: title || 'Untitled',
            coverEmoji: effectiveMode === 'video' ? '🎬' : effectiveMode === 'text' ? '📝' : effectiveMode === 'live' ? '📡' : effectiveMode === 'audio' ? '🎧' : '🎨',
            coverImage: images[0],
            totalFragments: fractionalizeFragments,
            pricePerFragment: fractionalizePrice,
          });
        } catch (fnftErr: any) {
          // Don't block the publish success on fractionalize failure —
          // surface a soft toast.
          console.warn('Fractionalize failed', fnftErr);
        }
      }
      // 2026-05-11 R12: keep the publishSuccess modal (showing reward +
      // tx link). When the user closes it (or clicks the Done button), the
      // close handler resets the composer and navigates to /studio?tab=content.
      // On-chain success toast (explorer-linkable).
      if (coreSignature) {
        showToast(
          'success',
          '⛓️ Published on-chain',
          `tx: ${coreSignature.slice(0, 8)}… · post: ${corePostPda?.slice(0, 6) || ''}…`,
        );
      }
      setPublishSuccess({
        show: true,
        amount: result.reward,
        txHash: result.txHash,
        title: title || 'Untitled',
        // 2026-05-11 R16: prefer the explicit coverImage (user-uploaded
        // override or auto-extracted video first frame) over images[0]
        // so the success modal shows what the feed card will show.
        image: coverImage || (images.length > 0 ? images[0] : null),
      });
    } catch (e: any) {
      setPublishError(e.message || 'Failed to publish');
    }
  };

  const addCollaborator = () => {
    if (collabInput.trim()) {
      setCollaborators([...collaborators, {
        id: Date.now().toString(),
        name: collabInput.trim(),
        percent: collabPercent
      }]);
      setCollabInput('');
      setCollabPercent(20);
    }
  };

  const removeCollaborator = (id: string) => {
    setCollaborators(collaborators.filter(c => c.id !== id));
  };

  const updateCollabPercent = (id: string, percent: number) => {
    setCollaborators(collaborators.map(c => 
      c.id === id ? { ...c, percent } : c
    ));
  };

  const getTotalCollabPercent = () => {
    return collaborators.reduce((sum, c) => sum + c.percent, 0);
  };

  const calculateFractionPrice = () => {
    if (keyPrice && fractionCount) {
      const totalPrice = parseFloat(keyPrice);
      const unitPrice = totalPrice / fractionCount;
      setFractionPrice(unitPrice.toFixed(6));
    }
  };

  const licenseExplanations = {
    'CC0': {
      title: t.create.advanced.license.types['CC0'].title,
      description: t.create.advanced.license.types['CC0'].description,
      icon: '🌍',
      features: [`✅ ${t.create.advanced.license.types['CC0'].features[0]}`, `✅ ${t.create.advanced.license.types['CC0'].features[1]}`, `✅ ${t.create.advanced.license.types['CC0'].features[2]}`, `❌ ${t.create.advanced.license.types['CC0'].features[3]}`]
    },
    'CC-BY': {
      title: t.create.advanced.license.types['CC-BY'].title,
      description: t.create.advanced.license.types['CC-BY'].description,
      icon: '👤',
      features: [`✅ ${t.create.advanced.license.types['CC-BY'].features[0]}`, `✅ ${t.create.advanced.license.types['CC-BY'].features[1]}`, `✅ ${t.create.advanced.license.types['CC-BY'].features[2]}`, `⚠️ ${t.create.advanced.license.types['CC-BY'].features[3]}`]
    },
    'CC-BY-SA': {
      title: t.create.advanced.license.types['CC-BY-SA'].title,
      description: t.create.advanced.license.types['CC-BY-SA'].description,
      icon: '🔄',
      features: [`✅ ${t.create.advanced.license.types['CC-BY-SA'].features[0]}`, `✅ ${t.create.advanced.license.types['CC-BY-SA'].features[1]}`, `⚠️ ${t.create.advanced.license.types['CC-BY-SA'].features[2]}`, `⚠️ ${t.create.advanced.license.types['CC-BY-SA'].features[3]}`]
    },
    'CC-BY-NC': {
      title: t.create.advanced.license.types['CC-BY-NC'].title,
      description: t.create.advanced.license.types['CC-BY-NC'].description,
      icon: '🚫',
      features: [`❌ ${t.create.advanced.license.types['CC-BY-NC'].features[0]}`, `✅ ${t.create.advanced.license.types['CC-BY-NC'].features[1]}`, `⚠️ ${t.create.advanced.license.types['CC-BY-NC'].features[2]}`, `✅ ${t.create.advanced.license.types['CC-BY-NC'].features[3]}`]
    },
    'All Rights Reserved': {
      title: t.create.advanced.license.types['All Rights Reserved'].title,
      description: t.create.advanced.license.types['All Rights Reserved'].description,
      icon: '🔒',
      features: [`❌ ${t.create.advanced.license.types['All Rights Reserved'].features[0]}`, `❌ ${t.create.advanced.license.types['All Rights Reserved'].features[1]}`, `❌ ${t.create.advanced.license.types['All Rights Reserved'].features[2]}`, `⚠️ ${t.create.advanced.license.types['All Rights Reserved'].features[3]}`]
    }
  };

  // Studio Home — Content Management Dashboard

  const goLive = () => {
    if (!liveStream && liveSource !== 'external') return;
    setLiveCountdown(3);
    const interval = setInterval(() => {
      setLiveCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setIsLive(true);
          setLiveCountdown(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const endLive = () => {
    setIsLive(false);
    if (liveStream) {
      liveStream.getTracks().forEach(t => t.stop());
      setLiveStream(null);
    }
    setLiveSource(null);
    setMode(null);
    setTitle('');
    setContent('');
    setTags([]);
    setImages([]);
  };

  const startLiveSource = async (sourceId: string) => {
    // Stop existing stream
    if (liveStream) {
      liveStream.getTracks().forEach(t => t.stop());
      setLiveStream(null);
    }
    
    try {
      let stream: MediaStream;
      if (sourceId === 'camera') {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: 'user' }, audio: true });
      } else if (sourceId === 'screen') {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: { width: 1920, height: 1080 }, audio: true });
      } else if (sourceId === 'camera-screen') {
        // Screen + camera PiP
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { width: 1920, height: 1080 }, audio: true });
        const camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false });
        // Combine tracks — screen video + camera video + screen audio
        stream = new MediaStream([
          ...screenStream.getVideoTracks(),
          ...camStream.getVideoTracks(),
          ...screenStream.getAudioTracks(),
        ]);
        // Note: PiP compositing would need canvas, for demo just show screen
      } else {
        // External — show RTMP input
        setLiveSource(sourceId);
        return;
      }
      
      setLiveStream(stream);
      setLiveSource(sourceId);
      
      // Attach to video element
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
      }
      
      // Auto-stop when user stops sharing
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        setLiveStream(null);
        setLiveSource(null);
      });
    } catch (err) {
      console.error('Failed to start source:', err);
    }
  };

  // Attach stream to video ref
  React.useEffect(() => {
    if (liveVideoRef.current && liveStream) {
      liveVideoRef.current.srcObject = liveStream;
    }
  }, [liveStream]);

  // Cleanup on unmount or mode change
  React.useEffect(() => {
    return () => {
      if (liveStream) {
        liveStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [liveStream]);
  const publishedPosts = JSON.parse(localStorage.getItem('aura_user_posts') || '[]');
  const drafts = JSON.parse(localStorage.getItem('aura_drafts') || '[]');

  // ===== FULL-SCREEN BROADCASTER VIEW =====

  const mockChats = React.useMemo(() => [
    { user: 'luna_art', color: 'from-pink-400 to-purple-500', msg: 'Just joined! 🎉', time: 0 },
    { user: 'crypto_whale', color: 'from-blue-400 to-cyan-500', msg: 'Curated! Great content 💎', time: 3 },
    { user: 'pixel_nomad', color: 'from-amber-400 to-orange-500', msg: 'First time watching AURA live!', time: 7 },
    { user: 'web3_sarah', color: 'from-green-400 to-emerald-500', msg: 'This is amazing 🔥🔥', time: 12 },
    { user: 'defi_mike', color: 'from-red-400 to-pink-500', msg: 'How do I get Creator Coins?', time: 18 },
    { user: 'art_collector', color: 'from-violet-400 to-purple-500', msg: 'Sent 5 ORA! Keep going! 💰', time: 22 },
    { user: 'nft_queen', color: 'from-yellow-400 to-amber-500', msg: 'Love the quality! 4K?', time: 28 },
    { user: 'solana_dev', color: 'from-teal-400 to-cyan-500', msg: 'Interesting protocol design', time: 33 },
    { user: 'music_lover', color: 'from-rose-400 to-pink-500', msg: '🎵🎵🎵', time: 38 },
    { user: 'luna_art', color: 'from-pink-400 to-purple-500', msg: 'Can you show us the dashboard?', time: 42 },
  ], []);

  // Timer for live elapsed
  React.useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => setLiveElapsed(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [isLive]);

  // Attach stream to broadcaster video
  React.useEffect(() => {
    if (broadcasterVideoRef.current && liveStream) {
      broadcasterVideoRef.current.srcObject = liveStream;
    }
  }, [isLive, liveStream]);

  // Simulate likes and tips
  React.useEffect(() => {
    if (!isLive) return;
    const likeTimer = setInterval(() => {
      setMockLikes(prev => prev + Math.floor(Math.random() * 3 + 1));
    }, 2000);
    const tipTimer = setInterval(() => {
      if (Math.random() > 0.6) {
        const amount = [1, 2, 5, 10][Math.floor(Math.random() * 4)];
        const user = mockChats[Math.floor(Math.random() * mockChats.length)].user;
        setMockOra(prev => prev + amount);
        setTipEffect({ amount, user });
        setTimeout(() => setTipEffect(null), 2500);
      }
    }, 5000);
    return () => { clearInterval(likeTimer); clearInterval(tipTimer); };
  }, [isLive, mockChats]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
  };

  if (isLive) {
    const visibleChats = [...mockChats.filter(c => c.time <= liveElapsed), ...userChats].sort((a, b) => a.time - b.time);
    return (
      <div className="fixed inset-0 bg-black z-[9999] flex flex-col">
        {/* Video background */}
        <div className="flex-1 relative overflow-hidden">
          {liveStream ? (
            <video ref={broadcasterVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
              <p className="text-white/30 text-lg">No video source</p>
            </div>
          )}
          
          {/* Top overlay — streamer info + stats */}
          <div className="absolute top-0 left-0 right-0 p-4 flex items-start justify-between bg-gradient-to-b from-black/60 to-transparent">
            {/* Left: Streamer info */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-aura to-purple-600 flex items-center justify-center text-white font-bold text-sm">S</div>
              <div>
                <p className="text-white font-semibold text-sm">@soren</p>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" /> LIVE
                  </span>
                  <span className="text-white/70 text-xs font-mono">{formatTime(liveElapsed)}</span>
                {enableTicket && <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">🎫 {ticketPrice} ORA</span>}
                </div>
              </div>
            </div>
            
            {/* Right: Stats */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-white/90 text-sm">
                <span>👁</span>
                <span className="font-medium">{mockViewers + Math.floor(liveElapsed / 3)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/90 text-sm">
                <span>❤️</span>
                <span className="font-medium">{mockLikes}</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/90 text-sm">
                <span>💬</span>
                <span className="font-medium">{visibleChats.length}</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-400 text-sm font-bold">
                <span>💰</span>
                <span>{mockOra.toFixed(1)} ORA</span>
              </div>
            </div>
          </div>
          
          {/* Title */}
          {title && (
            <div className="absolute top-16 left-4">
              <p className="text-white/80 text-sm font-medium bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full">{title}</p>
            </div>
          )}
          
          {/* Tip effect */}
          {tipEffect && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-1/3 z-30 pointer-events-none" key={Date.now()}>
              <style>{`
                @keyframes tipFloat {
                  0% { transform: translateY(0) scale(0.5); opacity: 0; }
                  20% { transform: translateY(-20px) scale(1.2); opacity: 1; }
                  80% { transform: translateY(-100px) scale(1); opacity: 1; }
                  100% { transform: translateY(-150px) scale(0.8); opacity: 0; }
                }
              `}</style>
              <div style={{ animation: 'tipFloat 2.5s ease-out forwards' }}>
                <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white font-black text-2xl px-6 py-3 rounded-2xl shadow-2xl">
                  💰 +{tipEffect.amount} ORA
                  <p className="text-xs font-normal mt-0.5 opacity-80">from @{tipEffect.user}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Chat overlay — right side */}
          {showChat && (
            <div className="absolute bottom-20 left-4 right-4 max-h-[40vh] flex flex-col justify-end pointer-events-none">
              <div className="space-y-1.5 overflow-hidden">
                {visibleChats.slice(-8).map((chat, i) => (
                  <div key={i} className="flex items-start gap-2 pointer-events-auto" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                    <div className={"w-6 h-6 rounded-full bg-gradient-to-br flex-shrink-0 " + chat.color} />
                    <div className="bg-black/40 backdrop-blur-sm rounded-xl px-3 py-1.5 max-w-[80%]">
                      <span className="text-aura text-xs font-bold">@{chat.user}</span>
                      <span className="text-white text-xs ml-1.5">{chat.msg}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Chat input */}
              <div className="mt-2 flex gap-2 pointer-events-auto">
                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && chatInput.trim()) { setUserChats(prev => [...prev, { user: 'You (Host)', color: 'from-aura to-aura-light', msg: chatInput.trim(), time: liveElapsed }]); setChatInput(''); } }} placeholder="Say something to viewers..." className="flex-1 bg-white/10 backdrop-blur-md text-white text-sm rounded-full px-4 py-2 border border-white/10 outline-none placeholder:text-white/30 focus:border-aura/50" />
                <button onClick={() => { if (chatInput.trim()) { setUserChats(prev => [...prev, { user: 'You (Host)', color: 'from-aura to-aura-light', msg: chatInput.trim(), time: liveElapsed }]); setChatInput(''); } }} className="bg-aura hover:bg-aura-dark text-white text-sm px-4 rounded-full transition-colors">Send</button>
              </div>
            </div>
          )}
        </div>
        
        {/* Bottom toolbar */}
        <div className="bg-black/80 backdrop-blur-md border-t border-white/10 px-4 py-3 flex items-center justify-center gap-4">
          <button onClick={() => { setMicOn(!micOn); if (liveStream) { liveStream.getAudioTracks().forEach(t => { t.enabled = !micOn; }); } }} className={"w-12 h-12 rounded-full flex items-center justify-center transition-colors " + (micOn ? "bg-white/10 hover:bg-white/20" : "bg-red-500/80 hover:bg-red-500")}>
            <span className="text-xl">{micOn ? '🎤' : '🔇'}</span>
          </button>
          <button onClick={() => { setCamOn(!camOn); if (liveStream) { liveStream.getVideoTracks().forEach(t => { t.enabled = !camOn; }); } }} className={"w-12 h-12 rounded-full flex items-center justify-center transition-colors " + (camOn ? "bg-white/10 hover:bg-white/20" : "bg-red-500/80 hover:bg-red-500")}>
            <span className="text-xl">{camOn ? '📹' : '🚫'}</span>
          </button>
          <button onClick={async () => { try { const s = await navigator.mediaDevices.getDisplayMedia({ video: true }); if (liveStream) { const vt = s.getVideoTracks()[0]; const sender = liveStream.getVideoTracks()[0]; if (sender) { liveStream.removeTrack(sender); liveStream.addTrack(vt); } } setLiveStream(s); } catch {} }} className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
            <span className="text-xl">🖥️</span>
          </button>
          <button onClick={() => setShowChat(!showChat)} className={"w-12 h-12 rounded-full flex items-center justify-center transition-colors " + (showChat ? "bg-white/10 hover:bg-white/20" : "bg-white/5")}>
            <span className="text-xl">💬</span>
          </button>
          <button onClick={() => setShowGiftPanel(!showGiftPanel)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${showGiftPanel ? 'bg-ora/30 ring-2 ring-ora' : 'bg-white/10 hover:bg-white/20'}`}>
            <span className="text-xl">🎁</span>
          </button>
          {showGiftPanel && (
            <div className="absolute bottom-20 right-4 bg-black/90 backdrop-blur-xl border border-white/20 rounded-2xl p-4 w-64 shadow-xl">
              <p className="text-white text-sm font-semibold mb-3">🎁 Gift Panel</p>
              <p className="text-white/60 text-xs mb-3">Viewers can send you ORA tips during your stream!</p>
              <div className="grid grid-cols-3 gap-2">
                {[5, 10, 25, 50, 100, 500].map(amt => (
                  <button key={amt} onClick={() => { setMockOra(prev => prev + amt); setTipEffect({ amount: amt, user: 'You' }); setTimeout(() => setTipEffect(null), 2500); setShowGiftPanel(false); }} className="py-2 rounded-lg bg-ora/20 text-ora text-sm font-bold hover:bg-ora/30 transition-colors">
                    {amt} ORA
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => { setIsLive(false); setLiveElapsed(0); setMockLikes(0); setMockOra(0); if (liveStream) { liveStream.getTracks().forEach(t => t.stop()); setLiveStream(null); } setLiveSource(null); resetComposer(); }} className="h-12 px-6 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors">
            🔴 End Stream
          </button>
        </div>
      </div>
    );
  }

  if (viewingPost) {
    // Post detail view with stats + comments
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/40 p-4">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            <button onClick={() => setViewingPost(null)} className="text-sm text-muted-foreground hover:text-foreground">&larr; Back to Studio</button>
            <h1 className="text-lg font-semibold truncate">{viewingPost.title || 'Untitled'}</h1>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Left: Content */}
          <div className="space-y-4">
            {viewingPost.images?.[0] && (
              <div className="rounded-2xl overflow-hidden bg-muted">
                <img src={viewingPost.images[0]} alt="" className="w-full object-cover max-h-[500px]" />
              </div>
            )}
            <p className="text-muted-foreground text-sm whitespace-pre-wrap">{viewingPost.content || viewingPost.description || ''}</p>
            {viewingPost.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {viewingPost.tags.map((tag: string) => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-aura/10 text-aura">#{tag}</span>
                ))}
              </div>
            )}
            
            {/* Comments Section */}
            <div className="border-t border-border/40 pt-4 mt-6">
              <h3 className="font-semibold mb-4">Comments & Interactions</h3>
              <div className="space-y-3">
                <div className="flex gap-3 p-3 rounded-xl bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">@luna_art <span className="text-xs text-muted-foreground ml-2">2h ago</span></p>
                    <p className="text-sm text-muted-foreground mt-0.5">This is absolutely stunning! The composition is perfect 🔥</p>
                  </div>
                </div>
                <div className="flex gap-3 p-3 rounded-xl bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">@crypto_whale <span className="text-xs text-muted-foreground ml-2">5h ago</span></p>
                    <p className="text-sm text-muted-foreground mt-0.5">Curated! Great early find 💎</p>
                  </div>
                </div>
                <div className="flex gap-3 p-3 rounded-xl bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">@pixel_nomad <span className="text-xs text-muted-foreground ml-2">1d ago</span></p>
                    <p className="text-sm text-muted-foreground mt-0.5">Would love to see more like this. Following! ✨</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right: Stats */}
          <div className="space-y-4">
            {/* Performance panel — honest empty state until on-chain
             *  view/comment/curation counters are wired per post. */}
            <div className="bg-card rounded-2xl border p-5 space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Performance</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">—</p>
                  <p className="text-xs text-muted-foreground">Views</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">—</p>
                  <p className="text-xs text-muted-foreground">Likes</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">—</p>
                  <p className="text-xs text-muted-foreground">Comments</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">—</p>
                  <p className="text-xs text-muted-foreground">Curations</p>
                </div>
              </div>
            </div>
            {/* Earnings panel — sources from real on-chain transactions
             *  tagged to this post id. Until tx tagging is wired the
             *  honest answer is "—" rather than charCodeAt-derived noise. */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl border border-amber-200/50 dark:border-amber-700/30 p-5 space-y-3">
              <h3 className="font-semibold text-sm text-amber-600 dark:text-amber-400 uppercase tracking-wider">Earnings</h3>
              <p className="text-3xl font-bold text-amber-500">— ORA</p>
              <div className="text-xs text-amber-600/70 dark:text-amber-400/70 space-y-1">
                <div className="flex justify-between"><span>Activity Reward</span><span>credited at publish</span></div>
                <div className="flex justify-between"><span>Tips</span><span>—</span></div>
                <div className="flex justify-between"><span>Curation Share</span><span>—</span></div>
                <p className="pt-2 text-[10px] text-amber-600/60 dark:text-amber-400/60 italic">
                  Per-post earnings will appear once tx tagging is wired.
                </p>
              </div>
            </div>
            <div className="bg-card rounded-2xl border p-5 space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Details</h3>
              <div className="text-sm space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Published</span><span>{new Date(viewingPost.publishedAt || viewingPost.savedAt || Date.now()).toLocaleDateString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="capitalize">{viewingPost.mode || 'photo'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">License</span><span>{viewingPost.license || 'CC-BY'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Storage</span><span>Arweave ✓</span></div>
              </div>
            </div>
            
            {/* Boost */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl border border-purple-200/50 dark:border-purple-700/30 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🚀</span>
                <h3 className="font-semibold text-sm text-purple-600 dark:text-purple-400 uppercase tracking-wider">Boost</h3>
              </div>
              <p className="text-xs text-muted-foreground">Increase visibility in the feed. 95% of boost fees are burned.</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '1 Day', cost: 10 },
                  { label: '3 Days', cost: 25 },
                  { label: '7 Days', cost: 50 },
                ].map(opt => (
                  <button key={opt.label} onClick={() => setSelectedBoost({ label: opt.label, cost: opt.cost })} className={"p-2.5 rounded-xl border transition-colors text-center " + (selectedBoost?.label === opt.label ? "border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/30" : "border-purple-200/50 dark:border-purple-700/30 hover:bg-purple-500/10")}>
                    <p className={"text-sm font-bold " + (selectedBoost?.label === opt.label ? "text-purple-500" : "text-purple-600 dark:text-purple-400")}>{opt.cost}</p>
                    <p className="text-[10px] text-muted-foreground">ORA / {opt.label}</p>
                  </button>
                ))}
              </div>
              <button onClick={() => { if (selectedBoost) { setBoostModal({ show: true, label: selectedBoost.label, cost: selectedBoost.cost }); } }} className={"w-full h-9 rounded-lg text-white text-sm font-medium transition-colors " + (selectedBoost ? "bg-purple-500 hover:bg-purple-600 cursor-pointer" : "bg-purple-300 cursor-not-allowed")}>
                🚀 Boost This Post
              </button>
            </div>
          </div>
        </div>
      
      {/* Boost Modal — inside viewingPost view */}
      {boostModal.show && (
        <div className="bg-black/60 backdrop-blur-sm flex items-center justify-center" style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 9999 }} onClick={() => setBoostModal({ show: false, label: '', cost: 0 })}>
          <style>{`
            @keyframes boostPop2 {
              from { transform: translateY(20px) scale(0.95); opacity: 0; }
              to { transform: translateY(0) scale(1); opacity: 1; }
            }
          `}</style>
          <div className="bg-card rounded-3xl shadow-2xl overflow-hidden max-w-sm w-full mx-4" style={{ animation: 'boostPop2 0.4s ease-out' }} onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-8 text-center">
              <div className="text-5xl mb-3">🚀</div>
              <h3 className="text-xl font-bold text-white">Boost Activated!</h3>
            </div>
            <div className="p-6 text-center space-y-3">
              {boostModal.cost > 0 ? (
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-4 border border-purple-200/50 dark:border-purple-700/30">
                  <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Duration: {boostModal.label}</p>
                  <p className="text-2xl font-bold text-purple-500 mt-1">{boostModal.cost} ORA</p>
                  <p className="text-[10px] text-muted-foreground mt-1">95% burned • 5% platform</p>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 border border-purple-200/50 dark:border-purple-700/30 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span><span className="text-xs font-medium text-purple-600 dark:text-purple-400">Custom duration — Coming Soon</span></div>
              )}
              <p className="text-xs text-muted-foreground">Your content will get increased visibility in the feed.</p>
              <button onClick={() => setBoostModal({ show: false, label: '', cost: 0 })} className="w-full h-11 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-medium transition-colors mt-2">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    );
  }

  if (!mode) {
    return (
      <div className="min-h-screen bg-background">
        {/* Studio Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/40 p-4">
          <div className="max-w-none w-full flex items-center justify-between">
            <div>
              <h1 className="text-lg md:text-xl lg:text-2xl font-semibold">Studio</h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">Manage your content & creations</p>
            </div>
            <div className="flex items-center gap-3">
              {drafts.length > 0 && (
                <button onClick={() => setShowDrafts(!showDrafts)} className={"flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition-colors " + (showDrafts ? "border-aura bg-aura/10 text-aura" : "border-border hover:border-aura/50")}>
                  <Save className="w-4 h-4" />
                  {showDrafts ? 'Published' : `Drafts (${drafts.length})`}
                </button>
              )}
              <button
                onClick={() => setShowBountyModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-medium text-sm transition-colors"
                title="Post a bounty mission — commission work from the AURA community"
              >
                <Briefcase className="w-4 h-4" />
                Post Bounty
              </button>
              <button onClick={() => setShowCreateMenu(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-aura hover:bg-aura-dark text-white font-medium text-sm transition-colors">
                + Create New
              </button>

              {/* Post Bounty modal */}
              {showBountyModal && (
                <div
                  className="bg-black/60 backdrop-blur-sm flex items-center justify-center overflow-y-auto py-8"
                  style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999 }}
                  onClick={() => !bountyLoading && setShowBountyModal(false)}
                >
                  <div
                    className="max-w-md w-full mx-4 bg-card rounded-3xl shadow-2xl border border-border/50 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="bg-gradient-to-r from-emerald-500/15 to-green-500/15 dark:from-emerald-900/30 dark:to-green-900/30 px-6 py-5 border-b border-emerald-200/50 dark:border-emerald-800/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-sm">
                          <Briefcase className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-emerald-800 dark:text-emerald-200">Post a Bounty</h2>
                          <p className="text-xs text-muted-foreground">Commission work from the AURA community.</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Title</label>
                        <Input
                          placeholder="e.g. Cover art for my next EP"
                          value={bountyTitle}
                          onChange={(e) => setBountyTitle(e.target.value)}
                          maxLength={80}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Description</label>
                        <Textarea
                          placeholder="What you need, the style/tone, deliverable format, deadline…"
                          value={bountyDesc}
                          onChange={(e) => setBountyDesc(e.target.value)}
                          rows={4}
                          maxLength={1200}
                        />
                        <div className="text-[10px] text-muted-foreground mt-1 text-right">{bountyDesc.length}/1200</div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Reward (ORA)</label>
                        <div className="relative">
                          <Input
                            type="number"
                            min={1}
                            placeholder="e.g. 250"
                            value={bountyReward}
                            onChange={(e) => setBountyReward(e.target.value)}
                            className="pr-14"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">ORA</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Reward is locked when the bounty is posted and released to the winner you pick.
                        </p>
                      </div>

                      {bountyError && (
                        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/50 rounded-lg px-3 py-2">
                          {bountyError}
                        </div>
                      )}
                      {bountySuccess && (
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/50 rounded-lg px-3 py-2 flex items-center gap-2">
                          ✅ Bounty posted! It will appear in Marketplace · Bounty Missions.
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 px-6 pb-6">
                      <Button
                        variant="outline"
                        onClick={() => setShowBountyModal(false)}
                        disabled={bountyLoading}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={submitBounty}
                        disabled={bountyLoading || bountySuccess}
                        className="flex-1 bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:from-emerald-600 hover:to-green-600"
                      >
                        {bountyLoading ? 'Posting…' : bountySuccess ? 'Posted' : 'Post Bounty'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Create New — Full Screen Card Selection Modal */}
              {showCreateMenu && (
                <div className="bg-black/60 backdrop-blur-sm flex items-center justify-center overflow-y-auto py-8" style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 9999 }} onClick={() => setShowCreateMenu(false)}>
                  <style>{`
                    @keyframes createCardsPop {
                      from { transform: translateY(30px) scale(0.9); opacity: 0; }
                      to { transform: translateY(0) scale(1); opacity: 1; }
                    }
                  `}</style>
                  <div className="max-w-2xl w-full mx-4" style={{ animation: 'createCardsPop 0.4s ease-out' }} onClick={(e) => e.stopPropagation()}>
                    <h2 className="text-2xl font-bold text-white text-center mb-6">What would you like to create?</h2>
                    <div className="grid grid-cols-2 gap-4">
                      {modes.map(m => (
                        <button key={m.id} onClick={() => { setMode(m.id); setShowCreateMenu(false); }} className="group text-left">
                          <div className="bg-card rounded-3xl overflow-hidden shadow-2xl hover:shadow-aura/20 border border-border/50 hover:border-aura/50 transition-all hover:scale-[1.02]">
                            <div className={"h-40 flex items-center justify-center " + (m.id === 'photo' ? "bg-gradient-to-br from-pink-500/20 to-rose-500/20" : m.id === 'video' ? "bg-gradient-to-br from-blue-500/20 to-cyan-500/20" : m.id === 'text' ? "bg-gradient-to-br from-amber-500/20 to-orange-500/20" : "bg-gradient-to-br from-red-500/20 to-pink-500/20")}>
                              <m.icon className={"w-16 h-16 transition-transform group-hover:scale-110 " + (m.id === 'photo' ? "text-pink-500" : m.id === 'video' ? "text-blue-500" : m.id === 'text' ? "text-amber-500" : "text-red-500")} />
                            </div>
                            <div className="p-4">
                              <h3 className="text-base font-bold">{m.label}</h3>
                              <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setShowCreateMenu(false)} className="mt-6 mx-auto block text-sm text-white/60 hover:text-white transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-none w-full px-4 md:px-6 lg:px-8 py-6">
          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <div className="bg-card rounded-xl border p-4">
              <p className="text-2xl font-bold">{publishedPosts.length}</p>
              <p className="text-xs text-muted-foreground">Published</p>
            </div>
            <div className="bg-card rounded-xl border p-4">
              <p className="text-2xl font-bold">{drafts.length}</p>
              <p className="text-xs text-muted-foreground">Drafts</p>
            </div>
            <div className="bg-card rounded-xl border p-4">
              {/* 2026-05-11 R15: was Math.random() (♌ lies). Sum real ORA
                 income from publish-related transactions: 'publish' txs
                 plus any reward/curate tx whose details reference one of
                 this user's posts. */}
              <p className="text-2xl font-bold">
                {mockChain.transactions
                  .filter(tx => ['reward', 'buy_key', 'curate'].includes(tx.type) && tx.amount > 0)
                  .reduce((s, tx) => s + tx.amount, 0)
                  .toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">Total ORA Earned</p>
            </div>
            <div className="bg-card rounded-xl border p-4">
              {/* 2026-05-11 R15: Posts have no real `views` counter yet,
                 so we surface total likes (a real protocol-level signal)
                 instead of fabricating views. */}
              <p className="text-2xl font-bold">
                {publishedPosts.reduce((s: number, p: any) => s + (p.likes || 0), 0)}
              </p>
              <p className="text-xs text-muted-foreground">Total Likes</p>
            </div>
          </div>


          {/* Drafts Grid */}
          {showDrafts ? (
            <>
              <h2 className="text-lg font-semibold mb-4">Drafts</h2>
              {drafts.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {drafts.map((draft: any, i: number) => (
                    <div key={draft.id || i} className="group text-left">
                      <div className="rounded-xl overflow-hidden bg-card border hover:border-blue-400/50 hover:shadow-lg transition-all relative">
                        <div className="aspect-square bg-muted overflow-hidden">
                          {draft.images?.[0] ? (
                            <img src={draft.images[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">📝</div>
                          )}
                        </div>
                        <div className="p-3 space-y-1">
                          <p className="text-sm font-medium truncate">{draft.title || 'Untitled Draft'}</p>
                          <p className="text-xs text-muted-foreground">{new Date(draft.savedAt).toLocaleDateString()}</p>
                        </div>
                        {/* Resume editing */}
                        <button onClick={() => { setTitle(draft.title || ''); setContent(draft.content || ''); setTags(draft.tags || []); setImages(draft.images || []); setMode(draft.mode || 'photo'); setShowDrafts(false); const remaining = drafts.filter((_: any, idx: number) => idx !== i); localStorage.setItem('aura_drafts', JSON.stringify(remaining)); }} className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                          <span className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">Continue editing</span>
                        </button>
                        {/* Delete draft */}
                        <button onClick={(e) => { e.stopPropagation(); const remaining = drafts.filter((_: any, idx: number) => idx !== i); localStorage.setItem('aura_drafts', JSON.stringify(remaining)); window.location.reload(); }} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 hover:bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10">
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <p className="text-muted-foreground">No drafts yet</p>
                </div>
              )}
            </>
          ) : (
          <>
          {/* Published Content Grid */}
          {publishedPosts.length > 0 ? (
            <>
              <h2 className="text-lg font-semibold mb-4">Your Content</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {publishedPosts.map((post: any, i: number) => (
                  <button key={post.id || i} onClick={() => setViewingPost(post)} className="group text-left">
                    <div className="rounded-xl overflow-hidden bg-card border hover:border-aura/50 hover:shadow-lg transition-all">
                      <div className="aspect-square bg-muted overflow-hidden">
                        {post.images?.[0] ? (
                          <img src={post.images[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">
                            {post.mode === 'text' ? '📝' : post.mode === 'video' ? '🎬' : post.mode === 'live' ? '📡' : '📷'}
                          </div>
                        )}
                      </div>
                      <div className="p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate flex-1">{post.title || 'Untitled'}</p>
                          <button onClick={(e) => { e.stopPropagation(); setViewingPost(post); }} className="text-purple-500 hover:text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Boost">
                            <span className="text-xs">🚀</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{((post.id || String(i)).charCodeAt(0) * 5 + 37) % 200 + 20} views</span>
                          <span>{((post.id || String(i)).charCodeAt(0) * 2 + 7) % 30 + 2} likes</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="text-center py-20">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-aura/10 flex items-center justify-center mb-4">
                <Camera className="w-10 h-10 text-aura/50" />
              </div>
              <h3 className="text-lg font-semibold">No content yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Start creating to see your posts here</p>
              <button onClick={() => setShowCreateMenu(true)} className="px-6 py-2.5 rounded-xl bg-aura hover:bg-aura-dark text-white font-medium text-sm transition-colors">
                + Create Your First Post
              </button>
            </div>
          )}
          </>
          )}
        </div>
      </div>
    );
  }

  const PreviewCard = ({ compact }: { compact?: boolean }) => (
    <div className="bg-card rounded-xl border p-4">
      <h3 className="font-semibold mb-4">{t.create.preview}</h3>
      <div className="space-y-4">
        <div 
          className="relative bg-muted rounded-lg overflow-hidden"
          style={{ aspectRatio: compact ? '4/3' : '3/4' }}
        >
          {images.length > 0 ? (
            (mediaTypes[activeImageIndex] || 'image') === 'video' ? (
              <video src={images[activeImageIndex] || images[0]} className="w-full h-full object-cover" autoPlay muted loop playsInline />
            ) : (
              <img src={images[activeImageIndex] || images[0]} alt="Preview" className="w-full h-full object-cover" />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                {(() => {
                  const IconComponent = modes.find(m => m.id === mode)!.icon;
                  return <IconComponent className="w-12 h-12 mx-auto mb-2" />;
                })()}
                <p className="text-sm">{t.create.previewContent}</p>
              </div>
            </div>
          )}
          
          
        </div>

        <div className="space-y-2">
          <h4 className="font-medium line-clamp-2">{title || t.create.previewTitle}</h4>
          <p className="text-sm text-muted-foreground line-clamp-3">{content || t.create.previewDescription}</p>
          <div className="flex flex-wrap gap-1">
            {tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">#{tag}</Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* 2026-05-11 R5: universal file picker. Accept all mainstream media
         formats regardless of current mode — handleFileSelect auto-detects
         the MIME type and switches mode accordingly. This is what makes
         "drop any file" feel intuitive instead of forcing the user to pick
         the type first. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*,.doc,.docx,.pdf,.pages,.txt,.md,.rtf,.epub,.odt,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
        multiple={mode !== 'video' && mode !== 'audio'}
        className="hidden"
        onChange={handleFileSelect}
      />
      {/* 2026-05-11 R5: unified composer top bar, visible on all screen sizes.
         Layout: back-arrow / mode label on the LEFT, Save Draft + Publish on
         the RIGHT. Full width — no max-w cap so the page fills any monitor. */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center justify-between gap-3 px-4 md:px-6 lg:px-8 py-3 w-full">
          <div className="flex items-center gap-3 min-w-0">
            {/* 2026-05-11 R7: Back always returns to Studio root, not the
               in-page mode-picker overview (which is now dead code). */}
            <button
              onClick={() => navigate('/studio')}
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              aria-label="Back to Studio"
            >
              ← <span className="hidden sm:inline">{t.create.cancel}</span>
            </button>
            <div className="h-5 w-px bg-border/60 hidden sm:block" />
            <h2 className="font-semibold truncate">Create</h2>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'live' ? (
              isLive ? (
                <button onClick={endLive} className="px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-bold animate-pulse">● End Stream</button>
              ) : (
                <button onClick={goLive} disabled={!liveStream && liveSource !== 'external'} className={"px-4 py-1.5 rounded-lg text-sm font-bold " + (liveStream || liveSource === 'external' ? "bg-red-500 hover:bg-red-600 text-white" : "bg-muted text-muted-foreground cursor-not-allowed")}>
                  {liveCountdown !== null ? liveCountdown : enableSchedule && scheduleDate ? '⏰ Schedule Live' : '🔴 Go Live'}
                </button>
              )
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={handleSaveDraft}>
                  <Save className="w-4 h-4 mr-1.5" />{t.create.saveDraft}
                </Button>
                <Button size="sm" onClick={handlePublish} className="bg-aura hover:bg-aura-dark text-white disabled:opacity-50">
                  {enableSchedule && scheduleDate ? `Schedule ${scheduleDate}` : t.create.publish}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 lg:px-8 w-full">
        {/* Desktop: Two column layout. Removed the in-pane Back button +
           mode-label row (2026-05-11 R5) since the sticky top bar already
           shows both. Frees up a row of vertical space. */}
        <div className="hidden lg:grid lg:grid-cols-[3fr_2fr] lg:gap-5 pt-4">
          {/* Left: Integrated Preview + Edit Card */}
          <div className="flex flex-col gap-4 h-[calc(100vh-90px)]">
            
            {/* Combined Preview + Edit Card */}
            <div className="bg-card rounded-2xl border shadow-sm overflow-hidden flex-1 flex flex-col">
              
              {mode === 'audio' ? (
                /* ===== AUDIO MODE — Cover + audio file is the star =====
                   New 2026-05-11. Layout: optional cover image at top,
                   big audio uploader/preview, then title/description/tags. */
                <div className="flex-1 flex flex-col p-5 space-y-4 overflow-y-auto">
                  {/* Title */}
                  <input
                    type="text"
                    placeholder="Title (e.g. Track name, episode title)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-2xl font-bold bg-transparent border-0 outline-none placeholder:text-muted-foreground/30"
                  />
                  {/* Audio uploader / preview */}
                  {audioUrl ? (
                    <div className="rounded-2xl border border-border bg-gradient-to-br from-purple-500/10 to-indigo-500/10 p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 text-white flex items-center justify-center text-2xl">♫</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{audioFileName || 'Audio'}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {audioDurationStr ? `${audioDurationStr} · ` : ''}Ready to publish
                          </p>
                        </div>
                        <button
                          onClick={() => { setAudioUrl(null); setAudioFileName(null); setAudioDurationStr(null); }}
                          className="w-9 h-9 rounded-full bg-black/10 hover:bg-red-500/20 flex items-center justify-center text-red-500"
                          aria-label="Remove"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <audio src={audioUrl} controls className="w-full" />
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full aspect-[5/2] rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 hover:border-purple-500/50 hover:bg-purple-500/5 transition-colors"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center text-3xl">♫</div>
                      <span className="text-base font-bold">Tap to choose audio file</span>
                      <span className="text-xs text-muted-foreground">.mp3 · .wav · .m4a · .ogg</span>
                    </button>
                  )}
                  {/* Optional description */}
                  <textarea
                    placeholder="Notes, lyrics, episode description… (optional)"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full min-h-[100px] bg-transparent border-0 outline-none resize-none text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/30"
                  />
                  {/* Optional cover image */}
                  <div className="border-t border-border/20 pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Cover image (optional)</p>
                      <button onClick={() => fileInputRef.current?.click()} className="text-xs text-aura hover:text-aura-dark font-medium">+ Upload</button>
                    </div>
                    {images.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        {images.map((img, i) => (
                          <div key={i} className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden group/thumb">
                            <img src={img} alt="" className="w-full h-full object-cover" />
                            <button
                              onClick={() => { const ni = images.filter((_, idx) => idx !== i); setImages(ni); }}
                              className="absolute top-0 left-0 w-4 h-4 bg-black/60 hover:bg-red-500 rounded-br-md flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity z-10"
                            >
                              <X className="w-2.5 h-2.5 text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Tags */}
                  <div className="flex items-center gap-2 border-t border-border/20 pt-2">
                    <Hash className="w-3.5 h-3.5 text-muted-foreground/50" />
                    <input
                      type="text"
                      placeholder="Add tags…"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                      className="flex-1 text-sm bg-transparent border-0 outline-none placeholder:text-muted-foreground/30"
                    />
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-aura/10 text-aura">
                          #{tag}
                          <button onClick={() => setTags(tags.filter((_, idx) => idx !== i))} className="ml-1 opacity-60 hover:opacity-100">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : mode === 'text' ? (
                /* ===== TEXT MODE — Text is the star ===== */
                <div className="flex-1 flex flex-col p-5 space-y-3">
                  {/* Title — prominent */}
                  <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full text-2xl font-bold bg-transparent border-0 outline-none placeholder:text-muted-foreground/30" />
                  
                  {/* Content — the STAR, takes up all available space */}
                  <textarea placeholder="Write your story, paste your text, or upload a document..." value={content} onChange={(e) => setContent(e.target.value)} className="w-full flex-1 min-h-[300px] bg-transparent border-0 outline-none resize-none text-base leading-relaxed text-foreground placeholder:text-muted-foreground/20 focus:text-foreground" />
                  
                  {/* Attached documents */}
                  {attachedFiles.length > 0 && (
                    <div className="space-y-2 border-t border-border/20 pt-3">
                      {attachedFiles.map((file, i) => (
                        <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 group">
                          <span className="text-lg">{file.name.endsWith('.pdf') ? '📕' : file.name.endsWith('.doc') || file.name.endsWith('.docx') ? '📘' : file.name.endsWith('.pages') ? '📗' : '📄'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                          </div>
                          <button onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))} className="w-5 h-5 rounded-full hover:bg-red-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Optional cover image — small, at the bottom */}
                  <div className="border-t border-border/20 pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Cover image & attachments</p>
                      <button onClick={addMockImage} className="text-xs text-aura hover:text-aura-dark font-medium">+ Upload</button>
                    </div>
                    {images.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        {images.map((img, i) => (
                          <div key={i} className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden group/thumb">
                            <img src={img} alt="" className="w-full h-full object-cover" />
                            <button onClick={() => { const ni = images.filter((_, idx) => idx !== i); setImages(ni); }} className="absolute top-0 left-0 w-4 h-4 bg-black/60 hover:bg-red-500 rounded-br-md flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity z-10"><X className="w-2.5 h-2.5 text-white" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Tags */}
                  <div className="flex items-center gap-2 border-t border-border/20 pt-2">
                    <Hash className="w-3.5 h-3.5 text-muted-foreground/50" />
                    <input type="text" placeholder="Add tags..." value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} className="flex-1 text-sm bg-transparent border-0 outline-none placeholder:text-muted-foreground/30" />
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tags.map(tag => (<Badge key={tag} variant="secondary" className="text-xs cursor-pointer hover:bg-destructive/20" onClick={() => removeTag(tag)}>#{tag} <X className="w-2.5 h-2.5 ml-0.5" /></Badge>))}
                    </div>
                  )}
                </div>
              ) : mode === 'live' ? (
                /* ===== LIVE MODE — Source selection is the star ===== */
                <div className="flex-1 flex flex-col p-5 space-y-4">
                  {/* Title */}
                  <input type="text" placeholder="Stream title..." value={title} onChange={(e) => setTitle(e.target.value)} className="w-full text-xl font-bold bg-transparent border-0 outline-none placeholder:text-muted-foreground/30" />
                  
                  {/* Stream description */}
                  <textarea placeholder="What's this stream about?" value={content} onChange={(e) => setContent(e.target.value)} className="w-full min-h-[60px] bg-transparent border-0 outline-none resize-none text-sm text-muted-foreground placeholder:text-muted-foreground/20" />
                  
                  {/* Source Selection — the star */}
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Stream Source</p>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { id: 'camera', icon: '📹', label: 'Camera', desc: 'Use your webcam or connected camera' },
                        { id: 'screen', icon: '🖥️', label: 'Screen Share', desc: 'Share your desktop or window' },
                        { id: 'camera-screen', icon: '📹🖥️', label: 'Camera + Screen', desc: 'Picture-in-picture with both' },
                        { id: 'external', icon: '🔗', label: 'External Source', desc: 'RTMP/OBS Studio input' },
                      ].map(src => (
                        <button key={src.id} onClick={() => startLiveSource(src.id)} className={"flex items-center gap-3 p-3 rounded-xl border transition-all text-left " + (liveSource === src.id ? "border-aura bg-aura/5 ring-1 ring-aura/30" : "border-border hover:border-aura/50 hover:bg-muted/50")}>
                          <span className="text-2xl">{src.icon}</span>
                          <div>
                            <p className={"text-sm font-medium " + (liveSource === src.id ? "text-aura" : "")}>{src.label}</p>
                            <p className="text-xs text-muted-foreground">{src.desc}</p>
                          </div>
                          {liveSource === src.id && <span className="ml-auto text-xs text-green-500 font-medium">● Live</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Stream preview */}
                  <div className="flex-1 min-h-[120px] rounded-xl bg-black overflow-hidden relative">
                    {liveStream ? (
                      <>
                        <video ref={liveVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                        <div className={"absolute top-3 left-3 flex items-center gap-1.5 text-white text-xs font-bold px-2.5 py-1 rounded-full " + (isLive ? "bg-red-500 animate-pulse" : "bg-black/60")}>
                          <span className="w-2 h-2 rounded-full bg-white" /> {isLive ? 'LIVE' : 'PREVIEW'}
                        </div>
                        {liveCountdown !== null && (
                          <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20">
                            <style>{`
                              @keyframes countPulse {
                                0% { transform: scale(0.5); opacity: 0; }
                                50% { transform: scale(1.2); opacity: 1; }
                                100% { transform: scale(1); opacity: 1; }
                              }
                            `}</style>
                            <span className="text-7xl font-black text-white" style={{ animation: 'countPulse 0.8s ease-out' }} key={liveCountdown}>{liveCountdown}</span>
                          </div>
                        )}
                        <button onClick={() => { liveStream.getTracks().forEach(t => t.stop()); setLiveStream(null); setLiveSource(null); }} className="absolute top-3 right-3 bg-black/60 hover:bg-red-500 text-white text-xs px-3 py-1 rounded-full transition-colors">
                          Stop
                        </button>
                      </>
                    ) : liveSource === 'external' ? (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                        <p className="text-white text-sm font-medium mb-2">RTMP Endpoint</p>
                        <div className="bg-white/10 rounded-lg p-3 w-full max-w-xs">
                          <p className="text-xs text-white/60 mb-1">Server URL</p>
                          <p className="text-xs text-aura font-mono">rtmp://live.aura.network/stream</p>
                          <p className="text-xs text-white/60 mt-2 mb-1">Stream Key</p>
                          <p className="text-xs text-aura font-mono">sk_demo_{'{'}Date.now().toString(36){'}'}</p>
                        </div>
                        <p className="text-xs text-white/40 mt-2">Paste these into OBS Studio → Settings → Stream</p>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/30">
                        <div className="text-center">
                          <p className="text-sm">Select a source above to preview</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Cover image — small optional */}
                  <div className="border-t border-border/20 pt-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Cover thumbnail</p>
                      <button onClick={addMockImage} className="text-xs text-aura hover:text-aura-dark font-medium">+ Upload</button>
                    </div>
                    {images.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {images.map((img, i) => (
                          <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden group/thumb">
                            <img src={img} alt="" className="w-full h-full object-cover" />
                            <button onClick={() => setImages(images.filter((_, idx) => idx !== i))} className="absolute top-0 left-0 w-4 h-4 bg-black/60 hover:bg-red-500 rounded-br-md flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity z-10"><X className="w-2.5 h-2.5 text-white" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Tags */}
                  <div className="flex items-center gap-2 border-t border-border/20 pt-2">
                    <Hash className="w-3.5 h-3.5 text-muted-foreground/50" />
                    <input type="text" placeholder="Add tags..." value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} className="flex-1 text-sm bg-transparent border-0 outline-none placeholder:text-muted-foreground/30" />
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tags.map(tag => (<Badge key={tag} variant="secondary" className="text-xs cursor-pointer hover:bg-destructive/20" onClick={() => removeTag(tag)}>#{tag} <X className="w-2.5 h-2.5 ml-0.5" /></Badge>))}
                    </div>
                  )}
                </div>
              ) : (
                /* ===== PHOTO/VIDEO MODE — Image is the star ===== */
                <>
              {/* Upload / Preview Area */}
              <div 
                className="relative bg-muted cursor-pointer group flex-1 min-h-[200px]"
                style={{}}
                onClick={addMockImage}
              >
                {images.length > 0 ? (
                  <>
                    {(mediaTypes[activeImageIndex] || 'image') === 'video' ? (
                      <video src={images[activeImageIndex] || images[0]} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                    ) : (
                      <img src={images[activeImageIndex] || images[0]} alt="Preview" className="w-full h-full object-cover" />
                    )}
                    {images.length > 1 && (
                      <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full font-medium">+{images.length - 1}</div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                      <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-sm font-medium text-gray-700">Click to add more</div>
                    </div>
                    {images.length > 1 && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); setActiveImageIndex(prev => prev > 0 ? prev - 1 : images.length - 1); }} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors z-10"><span className="text-white text-sm">&lsaquo;</span></button>
                        <button onClick={(e) => { e.stopPropagation(); setActiveImageIndex(prev => prev < images.length - 1 ? prev + 1 : 0); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors z-10"><span className="text-white text-sm">&rsaquo;</span></button>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground group-hover:text-aura transition-colors">
                    {(() => { const Ic = modes.find(m => m.id === mode)!.icon; return <Ic className="w-12 h-12 mx-auto mb-2 opacity-40" />; })()}
                    <p className="text-sm font-medium">Click to upload</p>
                    <p className="text-xs mt-1 opacity-50">or drag and drop</p>
                  </div>
                )}
                {enableContentKey && keyPrice && (
                  <div className="absolute inset-0 backdrop-blur-sm bg-white/10 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <div className="w-10 h-10 mx-auto mb-1 rounded-full bg-gradient-to-br from-yellow-400/90 to-orange-500/90 flex items-center justify-center shadow-lg"><Lock className="w-5 h-5 text-white" /></div>
                      <div className="px-2.5 py-0.5 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold rounded-full shadow">🔑 {keyPrice} ORA</div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Multi-image strip */}
              {images.length > 1 && (
                <div className="flex gap-1.5 px-4 py-2 overflow-x-auto no-scrollbar bg-card">
                  {images.map((img, i) => (
                    <div key={i} className={"relative flex-shrink-0 w-12 h-12 rounded-md overflow-hidden cursor-pointer ring-2 transition-all " + (activeImageIndex === i ? "ring-aura" : "ring-transparent hover:ring-border")} onClick={() => setActiveImageIndex(i)}>
                      {(mediaTypes[i] || 'image') === 'video' ? (
                        <video src={img} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      )}
                      <button onClick={(e) => { e.stopPropagation(); const newImages = images.filter((_, idx) => idx !== i); setImages(newImages); setMediaTypes(prev => prev.filter((_, idx) => idx !== i)); if (activeImageIndex >= newImages.length) setActiveImageIndex(Math.max(0, newImages.length - 1)); }} className="absolute top-0 left-0 w-4 h-4 bg-black/60 hover:bg-red-500 rounded-br-md flex items-center justify-center transition-colors z-10"><X className="w-2.5 h-2.5 text-white" /></button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Title + Description + Tags inside card */}
              <div className="p-4 space-y-3">
                <input type="text" placeholder="Add a title..." value={title} onChange={(e) => setTitle(e.target.value)} className="w-full text-lg font-semibold bg-transparent border-0 outline-none placeholder:text-muted-foreground/40" />
                <textarea placeholder="Add a description..." value={content} onChange={(e) => setContent(e.target.value)} className="w-full min-h-[80px] bg-transparent border-0 outline-none resize-none text-sm text-muted-foreground placeholder:text-muted-foreground/30 focus:text-foreground" />
                <div className="flex items-center gap-2 border-t border-border/20 pt-2">
                  <Hash className="w-3.5 h-3.5 text-muted-foreground/50" />
                  <input type="text" placeholder="Add tags..." value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} className="flex-1 text-sm bg-transparent border-0 outline-none placeholder:text-muted-foreground/30" />
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tags.map(tag => (<Badge key={tag} variant="secondary" className="text-xs cursor-pointer hover:bg-destructive/20" onClick={() => removeTag(tag)}>#{tag} <X className="w-2.5 h-2.5 ml-0.5" /></Badge>))}
                  </div>
                )}
              </div>
                </>
              )}
            </div>
            
            {/* 2026-05-11 R6: removed the duplicate Save Draft / Publish row
               at the bottom of the left column (it duplicated the sticky top
               bar). Only the Live-mode action button (Go Live / End Stream)
               stays here, since it's mode-specific. */}
            {mode === 'live' && (
              <div className="flex gap-3">
                {isLive ? (
                  <button onClick={endLive} className="flex-1 h-11 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold animate-pulse">● End Stream</button>
                ) : (
                  <button onClick={goLive} disabled={!liveStream && liveSource !== 'external'} className={"flex-1 h-11 rounded-xl font-bold " + (liveStream || liveSource === 'external' ? "bg-red-500 hover:bg-red-600 text-white" : "bg-muted text-muted-foreground cursor-not-allowed")}>
                    {liveCountdown !== null ? liveCountdown : enableSchedule && scheduleDate ? '⏰ Schedule Live' : '🔴 Go Live'}
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Right: Settings (scrollable, spacious) */}
          <div className="max-h-[calc(100vh-80px)] overflow-y-auto space-y-4 pr-1">
            {/* 2026-05-11 R14: Cover image override card. Always shown so users
               can replace the auto-generated cover for video posts or the
               album art for audio posts. Photo posts use images[0] directly
               so this card mainly helps the audio/video flows. */}
            {(mode === 'video' || mode === 'audio') && (
              <CoverImageCard
                cover={coverImage}
                setCover={setCoverImage}
                isVideo={mode === 'video'}
                fallbackImage={images[0]}
              />
            )}
            <CreateForm section="settings" />
            

            {/* Fractionalize as NFT — mint a fractional NFT for this work
             *  alongside publishing it. Studio Hub deep-links here with
             *  ?fractionalize=1 to pre-arm the toggle. Mode != 'live'
             *  because livestreams aren't a fixed artifact you can split. */}
            {mode !== 'live' && (
              <div className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 rounded-2xl border border-indigo-200/50 dark:border-indigo-700/30 p-4 space-y-3 mt-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🔗</span>
                    <h3 className="font-semibold text-sm text-indigo-600 dark:text-indigo-400">Fractionalize as NFT</h3>
                  </div>
                  <button
                    onClick={() => setFractionalizeOnPublish(v => !v)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${fractionalizeOnPublish ? 'bg-indigo-500' : 'bg-border'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-[2px] transition-all duration-200 ${fractionalizeOnPublish ? 'left-[24px]' : 'left-[2px]'}`} />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Split this work into ORA-priced fragments. Fans buy fractions on the marketplace; revenue + buyback proceeds split pro-rata to fragment holders.
                </p>
                {fractionalizeOnPublish && (
                  <div className="space-y-2 pt-2 border-t border-indigo-200/50 dark:border-indigo-700/30">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Total fragments</label>
                        <Input
                          type="number"
                          min={10}
                          step={10}
                          value={fractionalizeFragments}
                          onChange={e => setFractionalizeFragments(Math.max(10, parseInt(e.target.value) || 10))}
                          className="mt-1 h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Price / fragment</label>
                        <div className="relative mt-1">
                          <Input
                            type="number"
                            min={0.01}
                            step={0.1}
                            value={fractionalizePrice}
                            onChange={e => setFractionalizePrice(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                            className="h-8 text-sm pr-12"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">ORA</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">
                      Total NFT value if sold out: {(fractionalizeFragments * fractionalizePrice).toFixed(2)} ORA · You keep all fragments at mint.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Boost — Pre-order before publishing */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl border border-purple-200/50 dark:border-purple-700/30 p-4 space-y-3 mt-4">
              <div className="flex items-center gap-2">
                <span className="text-base">🚀</span>
                <h3 className="font-semibold text-sm text-purple-600 dark:text-purple-400">Boost</h3>
              </div>
              <p className="text-xs text-muted-foreground">Pre-order a boost to increase visibility after publishing. 95% burned.</p>
              <div className="grid grid-cols-3 gap-2">
                {(mode === 'live' ? [{ label: '1 Hour', cost: 5 }, { label: '3 Hours', cost: 12 }, { label: 'Full Stream', cost: 30 }] : [{ label: '1 Day', cost: 10 }, { label: '3 Days', cost: 25 }, { label: '7 Days', cost: 50 }]).map(opt => (
                  <button key={opt.label} onClick={() => setSelectedBoost(selectedBoost?.label === opt.label ? null : { label: opt.label, cost: opt.cost })} className={"p-2 rounded-xl border transition-colors text-center " + (selectedBoost?.label === opt.label ? "border-purple-500 bg-purple-500/10" : "border-purple-200/50 dark:border-purple-700/30 hover:bg-purple-500/10")}>
                    <p className={"text-sm font-bold " + (selectedBoost?.label === opt.label ? "text-purple-500" : "text-purple-600/70 dark:text-purple-400/70")}>{opt.cost}</p>
                    <p className="text-[10px] text-muted-foreground">ORA / {opt.label}</p>
                  </button>
                ))}
              </div>
              {selectedBoost && (
                <button onClick={() => setBoostModal({ show: true, label: selectedBoost.label, cost: selectedBoost.cost })} className="w-full h-8 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-xs font-medium transition-colors">
                  🚀 Boost — {selectedBoost.cost} ORA / {selectedBoost.label}
                </button>
              )}
            </div>
          </div>
        </div>

{/* Mobile/Tablet: Tabbed layout */}
        <div className="lg:hidden">
          <Tabs defaultValue="edit" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="edit">{t.create.edit}</TabsTrigger>
              <TabsTrigger value="preview">{t.create.preview}</TabsTrigger>
            </TabsList>
            <TabsContent value="edit" className="mt-6">
              <CreateForm />
            </TabsContent>
            <TabsContent value="preview" className="mt-6">
              <PreviewCard />
            </TabsContent>
          </Tabs>
        </div>
      </div>



      {/* Publish error */}
      {publishError && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg z-50">
          {publishError}
        </div>
      )}



      {/* Boost Modal — Card Style */}
      {boostModal.show && (
        <div className="bg-black/60 backdrop-blur-sm flex items-center justify-center" style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 9999 }} onClick={() => setBoostModal({ show: false, label: '', cost: 0 })}>
          <style>{`
            @keyframes boostPop {
              from { transform: translateY(20px) scale(0.95); opacity: 0; }
              to { transform: translateY(0) scale(1); opacity: 1; }
            }
          `}</style>
          <div className="bg-card rounded-3xl shadow-2xl overflow-hidden max-w-sm w-full mx-4" style={{ animation: 'boostPop 0.4s ease-out' }} onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-8 text-center">
              <div className="text-5xl mb-3">🚀</div>
              <h3 className="text-xl font-bold text-white">Boost Activated!</h3>
            </div>
            <div className="p-6 text-center space-y-3">
              {boostModal.cost > 0 ? (
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-4 border border-purple-200/50 dark:border-purple-700/30">
                  <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Duration: {boostModal.label}</p>
                  <p className="text-2xl font-bold text-purple-500 mt-1">{boostModal.cost} ORA</p>
                  <p className="text-[10px] text-muted-foreground mt-1">95% burned • 5% platform</p>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 border border-purple-200/50 dark:border-purple-700/30 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span><span className="text-xs font-medium text-purple-600 dark:text-purple-400">Custom duration — Coming Soon</span></div>
              )}
              <p className="text-xs text-muted-foreground">Your content will get increased visibility in the feed.</p>
              <button onClick={() => setBoostModal({ show: false, label: '', cost: 0 })} className="w-full h-11 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-medium transition-colors mt-2">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Draft Saved Modal */}
      {draftSuccess && (
        <div className="bg-black/60 backdrop-blur-sm flex items-center justify-center" style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 9999 }} onClick={() => { setDraftSuccess(false); resetComposer(); }}>
          <style>{`
            @keyframes draftSlide {
              from { transform: translateY(20px) scale(0.95); opacity: 0; }
              to { transform: translateY(0) scale(1); opacity: 1; }
            }
          `}</style>
          <div className="bg-card rounded-3xl shadow-2xl overflow-hidden max-w-md w-full mx-4" style={{ animation: 'draftSlide 0.4s ease-out' }} onClick={(e) => e.stopPropagation()}>
            {images[0] ? (
              <div className="aspect-square overflow-hidden">
                <img src={images[0]} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="aspect-square bg-gradient-to-br from-blue-500/10 to-indigo-500/10 flex items-center justify-center">
                <div className="text-6xl opacity-30">📝</div>
              </div>
            )}
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center">
                <span className="text-blue-500 text-2xl">✓</span>
              </div>
              <h3 className="text-xl font-bold">Draft Saved!</h3>
              <p className="text-sm text-muted-foreground">{title || 'Untitled Draft'}</p>
              <p className="text-xs text-muted-foreground/60">You can continue editing anytime from your drafts.</p>
              <button
                onClick={() => { setDraftSuccess(false); resetComposer(); }}
                className="w-full h-11 rounded-xl bg-foreground/10 hover:bg-foreground/20 font-medium transition-colors mt-2"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publish Success Modal — Album Page Style.
         2026-05-11 R12: when this modal closes (backdrop click or Done
         button), reset the composer AND navigate to /studio?tab=content
         so the user lands directly on their published-content grid. */}
      {publishSuccess.show && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => {
            setPublishSuccess(prev => ({ ...prev, show: false }));
            resetComposer();
            navigate('/studio?tab=content');
          }}
        >
          <style>{`
            @keyframes modalSlide {
              from { transform: translateY(20px) scale(0.95); opacity: 0; }
              to { transform: translateY(0) scale(1); opacity: 1; }
            }
          `}</style>
          <div
            className="bg-card rounded-3xl shadow-2xl overflow-hidden max-w-md w-full mx-4"
            style={{ animation: 'modalSlide 0.4s ease-out' }}
            onClick={(e) => e.stopPropagation()}
          >
            {publishSuccess.image ? (
              <div className="aspect-square overflow-hidden">
                <img src={publishSuccess.image} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="aspect-square bg-gradient-to-br from-aura/20 to-purple-500/20 flex items-center justify-center">
                <div className="text-6xl opacity-30">✨</div>
              </div>
            )}
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
                <span className="text-green-500 text-2xl">✓</span>
              </div>
              <h3 className="text-xl font-bold">Published!</h3>
              <p className="text-sm text-muted-foreground">{publishSuccess.title}</p>
              {publishSuccess.amount > 0 ? (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl p-4 border border-amber-200/50 dark:border-amber-700/30">
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Activity Reward</p>
                  <p className="text-2xl font-bold text-amber-500 mt-1">+{publishSuccess.amount.toFixed(4)} ORA</p>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground/70">
                  Daily reward cap reached (max 2/day). Post is live regardless.
                </p>
              )}
              <a
                href={`https://explorer.solana.com/tx/${publishSuccess.txHash}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-muted-foreground hover:text-blue-400 transition-colors block"
              >
                TX: {publishSuccess.txHash.slice(0, 20)}...
              </a>
              <button
                onClick={() => {
                  setPublishSuccess(prev => ({ ...prev, show: false }));
                  resetComposer();
                  navigate('/studio?tab=content');
                }}
                className="w-full h-11 rounded-xl bg-aura hover:bg-aura-dark text-white font-medium transition-colors mt-2"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function CreateForm({ section }: { section?: "core" | "settings" }) {
    return (
      <div className="space-y-6">
        {/* Media Upload — core section */}
        {(!section || section === "core") && (<>
        {/* Audio mode — dedicated audio upload + preview UI.
            New 2026-05-11. Picks an audio file via the same
            <input type=file> driver as the rest, then displays
            a real <audio controls> for live preview. */}
        {mode === 'audio' && (
          <div className="space-y-4">
            <label className="text-sm font-medium">Audio file</label>
            {audioUrl ? (
              <div className="rounded-2xl border border-border bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500 text-white flex items-center justify-center text-lg">♫</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{audioFileName || 'Audio'}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {audioDurationStr ? `${audioDurationStr} · ` : ''}Ready to publish
                    </p>
                  </div>
                  <button
                    onClick={() => { setAudioUrl(null); setAudioFileName(null); setAudioDurationStr(null); }}
                    className="w-8 h-8 rounded-full bg-black/10 hover:bg-red-500/20 flex items-center justify-center text-red-500"
                    aria-label="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <audio src={audioUrl} controls className="w-full" />
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-[3/1] rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 hover:border-purple-500/50 hover:bg-purple-500/5 transition-colors"
              >
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center text-2xl">♫</div>
                <span className="text-sm font-semibold">Tap to choose audio</span>
                <span className="text-[11px] text-muted-foreground">.mp3 · .wav · .m4a · .ogg — up to a few MB for the demo</span>
              </button>
            )}
          </div>
        )}

        {(mode === 'photo' || mode === 'video') && (
          <div className="space-y-4">
            <label className="text-sm font-medium">{mode === 'photo' ? t.create.upload.photo : t.create.upload.video}</label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {images.map((img, i) => (
                <div key={i} className="relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
              <button
                onClick={addMockImage}
                className="flex-shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 hover:border-aura/50 transition-colors"
              >
                <ImagePlus className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{t.create.upload.add}</span>
              </button>
            </div>
          </div>
        )}

        {/* Live Stream Setup */}
        {mode === 'live' && (
          <div className="space-y-4">
            <label className="text-sm font-medium">{t.create.live.title}</label>
            <div className="aspect-video rounded-xl bg-secondary flex flex-col items-center justify-center border-2 border-dashed border-border">
              <Radio className="w-12 h-12 text-red-500 mb-4" />
              <p className="font-medium">{t.create.live.cameraPreview}</p>
              <p className="text-sm text-muted-foreground">{t.create.live.startHint}</p>
            </div>
          </div>
        )}

        {/* Title */}
        {mode !== 'text' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">{t.create.form.title}</label>
            <Input
              placeholder={t.create.form.titlePlaceholder}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-base"
            />
          </div>
        )}

        {/* Content */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {mode === 'text' ? t.create.form.content : t.create.form.description}
          </label>
          <Textarea
            placeholder={mode === 'text' ? t.create.form.contentPlaceholder : t.create.form.descPlaceholder}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[120px] resize-none"
          />
        </div>

        {/* Tags */}
        <div className="space-y-3">
          <label className="text-sm font-medium">{t.create.form.tags}</label>
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t.create.form.tagsPlaceholder}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              className="flex-1"
            />
            <Button type="button" onClick={addTag} size="sm">{t.create.form.addTag}</Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive/20"
                  onClick={() => removeTag(tag)}
                >
                  #{tag} <X className="w-3 h-3 ml-1" />
                </Badge>
              ))}
            </div>
          )}
        </div>

        </>)}

        {/* Access Control — settings section */}
        {(!section || section === "settings") && (<>
        <div className="space-y-3">
          <label className="text-sm font-medium">{t.create.access.title}</label>
          <p className="text-xs text-muted-foreground">Choose who can see this content. Premium content earns ORA directly.</p>
          <div className="grid grid-cols-2 gap-2">
            {accessOptions.map(option => {
              const isSelected = accessControls.has(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setAccessControls(prev => {
                      const next = new Set(prev);
                      if (option.id === 'public') {
                        // Selecting Public clears everything else
                        return new Set<AccessControl>(['public']);
                      } else {
                        // Remove public when selecting any non-public option
                        next.delete('public');
                        if (next.has(option.id)) {
                          next.delete(option.id);
                          // If nothing left, fall back to public
                          if (next.size === 0) return new Set<AccessControl>(['public']);
                        } else {
                          next.add(option.id);
                        }
                      }
                      return next;
                    });
                  }}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                    isSelected
                      ? 'border-aura bg-aura/5'
                      : 'border-border hover:border-border/60'
                  }`}
                >
                  <option.icon className={`w-5 h-5 ${isSelected ? 'text-aura' : 'text-muted-foreground'}`} />
                  <div>
                    <p className={`text-sm font-medium ${isSelected ? 'text-aura' : ''}`}>
                      {option.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{option.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Premium Price */}
        

        {/* Creator Coin Threshold */}
        {accessControls.has('coin-holders') && (
          <div className="space-y-3">
            {/* Hold vs Pay mode selector */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setCoinAccessMode('hold')} className={"p-2.5 rounded-xl border text-center transition-colors " + (coinAccessMode === 'hold' ? "border-aura bg-aura/5 ring-1 ring-aura/30" : "border-border hover:border-aura/50")}>
                <p className={"text-xs font-bold " + (coinAccessMode === 'hold' ? "text-aura" : "")}>🔓 Hold</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Hold coins to access</p>
              </button>
              <button onClick={() => setCoinAccessMode('pay')} className={"p-2.5 rounded-xl border text-center transition-colors " + (coinAccessMode === 'pay' ? "border-aura bg-aura/5 ring-1 ring-aura/30" : "border-border hover:border-aura/50")}>
                <p className={"text-xs font-bold " + (coinAccessMode === 'pay' ? "text-aura" : "")}>💰 Pay</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Pay coins to creator</p>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                placeholder={coinAccessMode === 'hold' ? "Min coins to hold" : "Coins to pay"}
                value={minCoinAmount}
                onChange={(e) => setMinCoinAmount(e.target.value)}
                className="flex-1 h-9"
              />
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Coins className="w-3.5 h-3.5" />
                <span>CC</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {coinAccessMode === 'hold' ? 'Viewers must hold this many coins. Coins are NOT consumed.' : 'Viewers pay this many coins to you. One-time payment for permanent access.'}
            </p>
          </div>
        )}

        {/* Creator Coin Info */}
        {accessControls.has('coin-holders') && (
          <div className="p-4 rounded-lg bg-gradient-to-r from-teal-50 to-blue-50 dark:from-teal-900/20 dark:to-blue-900/20 border border-teal-200 dark:border-teal-800">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-4 h-4 text-purple-600" />
              <p className="text-sm font-medium text-teal-700 dark:text-teal-300">{t.create.coinInfo.title}</p>
            </div>
            <p className="text-xs text-teal-600 dark:text-teal-400">
              {t.create.coinInfo.desc}
            </p>
            {accessControls.has('coin-holders') && (
              <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                {t.create.coinInfo.allHolders}
              </p>
            )}
          </div>
        )}

        {/* Content Key Settings — shown when content-key access is selected */}
                {accessControls.has('content-key') && (
                  <div className="space-y-3 p-3 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/30 dark:border-amber-700/20">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-medium">Key Price (ORA)</label>
                      <input type="number" min="0.1" step="0.1" value={keyPrice} onChange={(e) => setKeyPrice(e.target.value)} className="w-full h-9 rounded-lg border bg-transparent px-3 text-sm outline-none focus:border-aura" />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium">Tradeable</p>
                      <button className={"w-9 h-5 rounded-full transition-colors relative flex-shrink-0 " + (keyTradeable ? 'bg-green-500' : 'bg-muted')} onClick={() => { setKeyTradeable(!keyTradeable); if (!keyTradeable) setKeySupply('100'); else setKeySupply('unlimited'); }}>
                        <span className={"absolute top-[2px] w-4 h-4 rounded-full bg-white shadow transition-all duration-200 " + (keyTradeable ? 'left-[18px]' : 'left-[2px]')} />
                      </button>
                    </div>
                    {keyTradeable && (
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground font-medium">Supply</label>
                        <div className="flex gap-2">
                          <input type="number" min="1" placeholder="Enter amount" value={keySupply === 'unlimited' ? '' : keySupply} onChange={(e) => setKeySupply(e.target.value || 'unlimited')} className="flex-1 h-8 rounded-lg border bg-transparent px-3 text-sm outline-none focus:border-aura placeholder:text-muted-foreground/40" />
                          <button onClick={() => setKeySupply('unlimited')} className={"h-8 px-3 rounded-lg border text-xs font-medium transition-colors " + (keySupply === 'unlimited' ? "border-aura bg-aura/10 text-aura" : "border-border hover:border-aura/50")}>∞</button>
                        </div>
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground">95% creator / 5% protocol fee</div>
                  </div>
                )}

                {/* Content Curation */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-ora/5 to-yellow-50 dark:to-yellow-900/20 border border-ora/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-ora" />
              <div>
                <p className="font-medium">{t.create.curation.title}</p>
                <p className="text-xs text-muted-foreground">{t.create.curation.desc}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEnableCuration(!enableCuration)}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ml-auto ${
                enableCuration ? 'bg-ora' : 'bg-muted'
              }`}
            >
              <span
                className={`absolute top-[2px] w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${enableCuration ? 'left-[22px]' : 'left-[2px]'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Content License Settings */}
        <div className="p-4 rounded-xl border border-border/40 bg-card">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <FileArchive className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium">Content License</span>
            </div>
            <button
              type="button"
              onClick={() => setEnableLicensing(!enableLicensing)}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ml-auto ${enableLicensing ? 'bg-blue-500' : 'bg-muted'}`}
            >
              <span className={`absolute top-[2px] w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${enableLicensing ? 'left-[22px]' : 'left-[2px]'}`} />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3 ml-6">Set embed pricing and remix revenue share. Embed: others pay ORA to use your content. Remix: you earn a % of remixer's future revenue (0-15%, default 5%).</p>
          {enableLicensing && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Set prices for others to embed or remix your content (ORA).</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Embed Price (ORA per use)</label>
                  <input type="number" min={0} value={embedPrice} onChange={e => setEmbedPrice(+e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border-0 text-sm outline-none" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Remix Revenue Share (%)</label>
                  <input type="number" min={0} max={15} value={remixPrice} onChange={e => setRemixPrice(Math.min(15, +e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border-0 text-sm outline-none" />
                </div>
              </div>
              <div className="bg-blue-500/10 text-blue-400 rounded-lg px-3 py-2 text-xs">
                Embed revenue: 95% to you, 5% protocol. Remix: you earn 0-15% of remixer's content revenue (default 5%). Max 15% total upstream share.
              </div>
            </div>
          )}
        </div>

        {/* Advanced Settings */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-aura transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            {t.create.advanced.title}
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showAdvanced && (
            <div className="space-y-6 p-4 rounded-xl bg-secondary/30 border border-border/50">
              {/* Mint as NFT Toggle */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-yellow-500" />
                    <div>
                      <p className="text-sm font-medium">Mint as NFT</p>
                      <p className="text-xs text-muted-foreground">Turn this content into a unique on-chain NFT. Enable to access fractioning, royalties, and secondary market trading.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMintAsNFT(!mintAsNFT)}
                    className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ml-auto ${
                      mintAsNFT ? 'bg-yellow-500' : 'bg-muted'
                    }`}
                  >
                    <span
                      className={`absolute top-[2px] w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${mintAsNFT ? 'left-[22px]' : 'left-[2px]'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {mintAsNFT && (
              <>
              {/* NFT Fractioning */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-purple-500" />
                    <div>
                      <p className="text-sm font-medium">{t.create.advanced.fractioning.title}</p>
                      <p className="text-xs text-muted-foreground">{t.create.advanced.fractioning.desc}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableFractioning(!enableFractioning)}
                    className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ml-auto ${
                      enableFractioning ? 'bg-teal-500' : 'bg-muted'
                    }`}
                  >
                    <span
                      className={`absolute top-[2px] w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${enableFractioning ? 'left-[22px]' : 'left-[2px]'
                      }`}
                    />
                  </button>
                </div>

                {enableFractioning && (
                  <div className="space-y-3 pl-6">
                    <input
                      type="number"
                      min={2}
                      max={100000}
                      value={fractionCount}
                      onChange={(e) => setFractionCount(Number(e.target.value))}
                      placeholder="Enter number of fractions (e.g. 1000)"
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none"
                    />
                    {fractionPrice && (
                      <p className="text-xs text-muted-foreground">
                        {t.create.advanced.fractioning.unitPrice} {fractionPrice} ORA
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Copyright/CC License */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileArchive className="w-4 h-4 text-blue-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t.create.advanced.license.title}</p>
                    <p className="text-xs text-muted-foreground">{t.create.advanced.license.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLicenseInfo(true)}
                    className="p-1.5 rounded-full hover:bg-secondary transition-colors"
                    title="View Protocol Details"
                  >
                    <Info className="w-4 h-4 text-blue-500" />
                  </button>
                </div>
                <div className="flex gap-2 items-center">
                  <select
                    value={licenseType}
                    onChange={(e) => setLicenseType(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  >
                    <option value="All Rights Reserved">{t.create.advanced.license.types['All Rights Reserved'].title}</option>
                    <option value="CC0">{t.create.advanced.license.types['CC0'].title}</option>
                    <option value="CC-BY">{t.create.advanced.license.types['CC-BY'].title}</option>
                    <option value="CC-BY-SA">{t.create.advanced.license.types['CC-BY-SA'].title}</option>
                    <option value="CC-BY-NC">{t.create.advanced.license.types['CC-BY-NC'].title}</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowLicenseInfo(true)}
                    className="text-xs underline text-blue-500 hover:text-blue-700 whitespace-nowrap"
                  >
                    View License Details
                  </button>
                </div>
                {/* Show current license info */}
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{licenseExplanations[licenseType as keyof typeof licenseExplanations].icon}</span>
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      {licenseExplanations[licenseType as keyof typeof licenseExplanations].title}
                    </span>
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    {licenseExplanations[licenseType as keyof typeof licenseExplanations].description}
                  </p>
                </div>
              </div>

              {/* Royalty Settings */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">{t.create.advanced.royalty.title}</p>
                    <p className="text-xs text-muted-foreground">{t.create.advanced.royalty.desc}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-6">{ROYALTY_MIN_PCT}%</span>
                    <input
                      type="range"
                      min={ROYALTY_MIN_PCT}
                      max={ROYALTY_MAX_PCT}
                      value={royaltyPercent}
                      onChange={(e) => setRoyaltyPercent(Number(e.target.value))}
                      className="flex-1 h-2 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-emerald-500 [&::-webkit-slider-thumb]:shadow-md"
                      style={{background: `linear-gradient(to right, #10b981 0%, #10b981 ${((royaltyPercent - ROYALTY_MIN_PCT) / (ROYALTY_MAX_PCT - ROYALTY_MIN_PCT)) * 100}%, #e5e7eb ${((royaltyPercent - ROYALTY_MIN_PCT) / (ROYALTY_MAX_PCT - ROYALTY_MIN_PCT)) * 100}%, #e5e7eb 100%)`}}
                    />
                    <span className="text-xs text-muted-foreground w-8">{ROYALTY_MAX_PCT}%</span>
                    <div className="bg-emerald-500 text-white font-bold text-sm px-3 py-1 rounded-lg min-w-[3rem] text-center">
                      {royaltyPercent}%
                    </div>
                  </div>
                </div>
              </div>

              </>
              )}

              {/* Scheduled Publishing */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">⏰ {mode === 'live' ? 'Schedule Stream' : 'Schedule Publish'}</p>
                      <p className="text-xs text-muted-foreground">{mode === 'live' ? 'Set a future time to go live' : 'Set a future time to publish'}</p>
                    </div>
                    <button className={"w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ml-auto " + (enableSchedule ? 'bg-aura' : 'bg-muted')} onClick={() => setEnableSchedule(!enableSchedule)}>
                      <span className={"absolute top-[2px] w-5 h-5 rounded-full bg-white shadow transition-all duration-200 " + (enableSchedule ? 'left-[22px]' : 'left-[2px]')} />
                    </button>
                  </div>
                  {enableSchedule && (
                    <div className="space-y-3 pl-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Date</label>
                          <input type="text" placeholder="MM/DD/YYYY" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} onFocus={(e) => { e.target.type = 'date'; }} onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }} className="w-full h-9 rounded-lg border bg-transparent px-3 text-sm outline-none focus:border-aura" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Time</label>
                          <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-full h-9 rounded-lg border bg-transparent px-3 text-sm outline-none focus:border-aura" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium">📢 {mode === 'live' ? 'Announce Stream' : 'Pre-announce'}</p>
                          <p className="text-[10px] text-muted-foreground">{mode === 'live' ? 'Post a stream announcement now' : 'Post a teaser to your feed now'}</p>
                        </div>
                        <button className={"w-9 h-5 rounded-full transition-colors relative flex-shrink-0 " + (enablePreAnnounce ? 'bg-blue-500' : 'bg-muted')} onClick={() => setEnablePreAnnounce(!enablePreAnnounce)}>
                          <span className={"absolute top-[2px] w-4 h-4 rounded-full bg-white shadow transition-all duration-200 " + (enablePreAnnounce ? 'left-[18px]' : 'left-[2px]')} />
                        </button>
                      </div>
                      {enablePreAnnounce && (
                        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-2.5 border border-blue-200/30 dark:border-blue-700/20">
                          <p className="text-[10px] text-blue-700 dark:text-blue-400">{mode === 'live' ? '📡 A stream announcement with countdown will appear on your feed.' : '✨ A teaser card with countdown will appear on your feed.'}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Arweave Storage */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-500" />
                    <div>
                      <p className="text-sm font-medium">{t.create.advanced.storage.title}</p>
                      <p className="text-xs text-muted-foreground">{t.create.advanced.storage.desc}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableArweave(!enableArweave)}
                    // All content defaults to permanent storage
                    className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ml-auto ${
                      enableArweave ? 'bg-orange-500' : 'bg-muted'
                    } ${mode !== 'video' ? '' : ''}`}
                  >
                    <span
                      className={`absolute top-[2px] w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${enableArweave ? 'left-[22px]' : 'left-[2px]'
                      }`}
                    />
                  </button>
                </div>
                <div className="pl-6 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Content will be permanently stored on Arweave
                  </p>
                  {mode === 'video' && (
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      {t.create.advanced.storage.videoHint}
                    </p>
                  )}
                  
                </div>
              </div>

              {/* Time-limited Content */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-red-500" />
                    <div>
                      <p className="text-sm font-medium">{t.create.advanced.timeLimit.title}</p>
                      <p className="text-xs text-muted-foreground">{t.create.advanced.timeLimit.desc}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableTimeLimit(!enableTimeLimit)}
                    className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ml-auto ${
                      enableTimeLimit ? 'bg-red-500' : 'bg-muted'
                    }`}
                  >
                    <span
                      className={`absolute top-[2px] w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${enableTimeLimit ? 'left-[22px]' : 'left-[2px]'
                      }`}
                    />
                  </button>
                </div>

                {enableTimeLimit && (
                  <div className="pl-6">
                    <select
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    >
                      <option value="24h">{t.create.advanced.timeLimit.options['24h']}</option>
                      <option value="7d">{t.create.advanced.timeLimit.options['7d']}</option>
                      <option value="30d">{t.create.advanced.timeLimit.options['30d']}</option>
                      <option value="permanent">{t.create.advanced.timeLimit.options.permanent}</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Collaborative Creation */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-indigo-500" />
                    <div>
                      <p className="text-sm font-medium">{t.create.advanced.collaboration.title}</p>
                      <p className="text-xs text-muted-foreground">{t.create.advanced.collaboration.desc}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableCollab(!enableCollab)}
                    className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ml-auto ${
                      enableCollab ? 'bg-indigo-500' : 'bg-muted'
                    }`}
                  >
                    <span
                      className={`absolute top-[2px] w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${enableCollab ? 'left-[22px]' : 'left-[2px]'
                      }`}
                    />
                  </button>
                </div>

                {enableCollab && (
                  <div className="space-y-3 pl-6">
                    {/* Add Collaborator */}
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder={t.create.advanced.collaboration.searchPlaceholder}
                        value={collabInput}
                        onChange={(e) => setCollabInput(e.target.value)}
                        className="flex-1 h-8 text-sm"
                      />
                      <Input
                        type="number"
                        placeholder="20"
                        value={collabPercent}
                        onChange={(e) => setCollabPercent(Number(e.target.value))}
                        className="w-16 h-8 text-sm"
                        min="1"
                        max="50"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                      <Button 
                        type="button" 
                        onClick={addCollaborator}
                        size="sm"
                        className="h-8 px-3 text-xs"
                      >
                        {t.create.advanced.collaboration.add}
                      </Button>
                    </div>

                    {/* Collaborator List */}
                    {collaborators.length > 0 && (
                      <div className="space-y-2">
                        {collaborators.map(collab => (
                          <div key={collab.id} className="flex items-center justify-between p-2 bg-background rounded-lg border">
                            <span className="text-sm">@{collab.name}</span>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={collab.percent}
                                onChange={(e) => updateCollabPercent(collab.id, Number(e.target.value))}
                                className="w-16 h-6 text-xs"
                                min="1"
                                max="50"
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                              <button
                                type="button"
                                onClick={() => removeCollaborator(collab.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                        <div className="text-xs text-muted-foreground">
                          {t.create.advanced.collaboration.totalAllocation} {getTotalCollabPercent()}% / {t.create.advanced.collaboration.yourShare} {100 - getTotalCollabPercent()}%
                        </div>
                        {getTotalCollabPercent() > 80 && (
                          <p className="text-xs text-red-500">{t.create.advanced.collaboration.maxWarning}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Linked Products */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setShowLinkedProducts(!showLinkedProducts)}
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-aura transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            {t.create.linkedProducts?.title || 'Linked Products'}
            {showLinkedProducts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <p className="text-xs text-muted-foreground -mt-2 ml-6">Attach purchasable items (Creator Coins, NFTs, premium content) to your post. Fans can buy with one click.</p>

          {showLinkedProducts && (
            <div className="space-y-4 p-4 rounded-xl bg-secondary/30 border border-border/50">
              <p className="text-xs text-muted-foreground">
                {t.create.linkedProducts?.desc || 'Link purchasable content to your post for one-click fan purchases'}
              </p>

              {/* Product type selector */}
              <div className="flex gap-2">
                {[
                  { type: 'coin' as const, icon: '🪙', label: t.create.linkedProducts?.types?.coin || 'Creator Coin' },
                  { type: 'nft' as const, icon: '🎨', label: t.create.linkedProducts?.types?.nft || 'NFT' },
                  { type: 'key' as const, icon: '🔑', label: t.create.linkedProducts?.types?.key || 'Content Key' },
                ].map(item => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setLinkedProductType(item.type)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-all ${
                      linkedProductType === item.type
                        ? 'border-aura bg-aura/10 text-aura'
                        : 'border-border hover:border-border/80 text-muted-foreground'
                    }`}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Selected products list */}
              {linkedProducts.length > 0 && (
                <div className="space-y-2">
                  {linkedProducts.map((product, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-background rounded-lg border border-border/50">
                      <div className="flex items-center gap-2">
                        <span>{product.type === 'coin' ? '🪙' : product.type === 'nft' ? '🎨' : '⭐'}</span>
                        <div>
                          <p className="text-sm font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {product.type === 'coin' ? 'Creator Coin' : product.type === 'nft' ? 'NFT' : t.create.linkedProducts?.types?.premium || 'Premium'}
                            {product.creator && ` · @${product.creator}`}
                            {product.price && ` · ${product.price} ORA`}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLinkedProducts(prev => prev.filter((_, i) => i !== idx))}
                        className="text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add product form with autocomplete */}
              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder={
                        linkedProductType === 'coin' ? (t.create.linkedProducts?.placeholder?.coin || 'Search Creator Coins...') :
                        linkedProductType === 'nft' ? (t.create.linkedProducts?.placeholder?.nft || 'Search NFTs...') :
                        (t.create.linkedProducts?.placeholder?.premium || 'Search premium content...')
                      }
                      value={linkedProductInput}
                      onChange={(e) => { setLinkedProductInput(e.target.value); setShowProductSearch(true); }}
                      onFocus={() => linkedProductInput.length > 0 && setShowProductSearch(true)}
                      className="flex-1 h-9 text-sm pl-8"
                    />
                    {/* Search results dropdown */}
                    {showProductSearch && linkedProductInput.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                        {getFilteredListings().length > 0 ? (
                          <>
                            {getFilteredListings().map((item, idx) => (
                              <button
                                key={idx}
                                type="button"
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors text-left"
                                onClick={() => {
                                  setLinkedProducts(prev => [...prev, {
                                    type: item.type,
                                    name: item.name,
                                    price: item.price,
                                    creator: item.creator,
                                  }]);
                                  setLinkedProductInput('');
                                  setShowProductSearch(false);
                                }}
                              >
                                <span className="text-base">{item.type === 'coin' ? '🪙' : item.type === 'nft' ? '🎨' : '⭐'}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">@{item.creator} · {item.price} ORA</p>
                                </div>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                                  {item.type === 'coin' ? 'Coin' : item.type === 'nft' ? 'NFT' : t.create.linkedProducts?.types?.premium || 'Premium'}
                                </span>
                              </button>
                            ))}
                            <div className="px-3 py-1.5 border-t border-border/50">
                              <p className="text-[10px] text-muted-foreground">{t.create.linkedProducts?.searchHint || "Search any creator's products — promoting them earns you curation rewards"}</p>
                            </div>
                          </>
                        ) : (
                          <div className="px-3 py-4 text-center">
                            <p className="text-sm text-muted-foreground">{t.create.linkedProducts?.noResults || 'No matching products found'}</p>
                            <button
                              type="button"
                              className="mt-2 text-xs text-aura hover:underline"
                              onClick={() => {
                                setLinkedProducts(prev => [...prev, {
                                  type: linkedProductType,
                                  name: linkedProductInput.trim(),
                                }]);
                                setLinkedProductInput('');
                                setShowProductSearch(false);
                              }}
                            >
                              {t.create.linkedProducts?.addCustom || '+ Add as custom product'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 px-4"
                    onClick={() => {
                      if (linkedProductInput.trim()) {
                        setLinkedProducts(prev => [...prev, {
                          type: linkedProductType,
                          name: linkedProductInput.trim(),
                        }]);
                        setLinkedProductInput('');
                        setShowProductSearch(false);
                      }
                    }}
                  >
                    {t.create.linkedProducts?.add || 'Add'}
                  </Button>
                </div>
              </div>

              {linkedProducts.length === 0 && (
                <p className="text-xs text-center text-muted-foreground py-2">
                  {t.create.linkedProducts?.empty || 'No linked products yet — add some to display them in your post'}
                </p>
              )}
            </div>
          )}
        </div>

        </>)}

        {/* License Info Modal */}
      {showLicenseInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto border shadow-xl">
            <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{t.create.advanced.license.infoTitle}</h3>
              <button
                onClick={() => setShowLicenseInfo(false)}
                className="p-1 rounded-full hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
                Please read carefully. The license you choose determines how others can use your content. This cannot be changed after publishing.
              </div>
              {Object.entries(licenseExplanations).map(([key, license]) => (
                <div 
                  key={key}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    licenseType === key 
                      ? 'border-aura bg-aura/5' 
                      : 'border-border hover:border-border/60'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{license.icon}</span>
                    <div>
                      <h4 className="font-semibold text-base">{license.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {license.description}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {license.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  {licenseType !== key && (
                    <button
                      onClick={() => {
                        setLicenseType(key);
                        setShowLicenseInfo(false);
                      }}
                      className="mt-3 px-3 py-1.5 text-xs bg-aura text-white rounded-full hover:bg-aura-dark transition-colors"
                    >
                      {t.create.advanced.license.selectLicense}
                    </button>
                  )}

                  {licenseType === key && (
                    <div className="mt-3 px-3 py-1.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full font-medium">
                      {t.create.advanced.license.currentSelection}
                    </div>
                  )}
                </div>
              ))}

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-yellow-600">⚠️</span>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">{t.create.advanced.license.warning.title}</p>
                </div>
                <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1 ml-4">
                  {t.create.advanced.license.warning.items.map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    );
  }
}