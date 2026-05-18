/**
 * CoreModule — AURA Core on-chain operations.
 *
 * The `aura_core` program (programs/core/src/lib.rs) covers:
 *   - register_user(username, profile_uri)
 *   - publish_content(arweave_tx_id, content_type, access_control, price)
 *   - follow_user / unfollow_user
 *   - like_post / unlike_post
 *   - update_profile(new_profile_uri)
 *
 * This module wraps all seven instructions with real Anchor-compatible
 * discriminators (sha256("global:<snake_case>")[..8]) and hand-written
 * Borsh encoding — mirroring the style of MarketModule.
 *
 * Note: Reputation lives in a separate program (programs/reputation/);
 * `reputation.ts` is unrelated to this module.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import { WalletAdapter } from '@solana/wallet-adapter-base';
import { sha256 } from '@noble/hashes/sha256';

import { TransactionResult } from '../types';

// ────────────────────────────────────────────────────────────────────────
// Program-side constants — must match programs/core/src/lib.rs
// ────────────────────────────────────────────────────────────────────────

export const CORE_SEEDS = {
  USER: Buffer.from('user'),
  POST: Buffer.from('post'),
  FOLLOW: Buffer.from('follow'),
  LIKE: Buffer.from('like'),
} as const;

export const CORE_LIMITS = {
  USERNAME_MAX: 32,
  PROFILE_URI_MAX: 200,
  ARWEAVE_TX_ID_LEN: 43,
} as const;

// Content type enum — value indices must match Rust enum declaration order.
export enum ContentTypeCore {
  Text = 0,
  Image = 1,
  Video = 2,
  Audio = 3,
  Mixed = 4,
}

// Access-control enum — value indices must match Rust enum declaration order.
export enum AccessControlCore {
  Public = 0,
  PayToView = 1,
  BurnAfterReading = 2,
}

// ────────────────────────────────────────────────────────────────────────
// Anchor discriminator helpers
// ────────────────────────────────────────────────────────────────────────

export function ixDiscriminator(name: string): Buffer {
  const preimage = Buffer.from(`global:${name}`, 'utf8');
  return Buffer.from(sha256(preimage).slice(0, 8));
}

export function accountDiscriminator(name: string): Buffer {
  const preimage = Buffer.from(`account:${name}`, 'utf8');
  return Buffer.from(sha256(preimage).slice(0, 8));
}

// ────────────────────────────────────────────────────────────────────────
// Borsh primitives
// ────────────────────────────────────────────────────────────────────────

function u8(v: number): Buffer { const b = Buffer.alloc(1); b.writeUInt8(v, 0); return b; }
function u32LE(v: number): Buffer { const b = Buffer.alloc(4); b.writeUInt32LE(v, 0); return b; }
function u64LE(v: bigint | number): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(typeof v === 'bigint' ? v : BigInt(v), 0);
  return b;
}
function borshString(s: string): Buffer {
  const utf8 = Buffer.from(s, 'utf8');
  return Buffer.concat([u32LE(utf8.length), utf8]);
}

// ────────────────────────────────────────────────────────────────────────
// PDA helpers
// ────────────────────────────────────────────────────────────────────────

export interface CorePdas {
  userProfile(authority: PublicKey): PublicKey;
  post(author: PublicKey, postCount: number): PublicKey;
  followRecord(followerProfile: PublicKey, targetProfile: PublicKey): PublicKey;
  likeRecord(post: PublicKey, user: PublicKey): PublicKey;
}

function makePdas(programId: PublicKey): CorePdas {
  return {
    userProfile(authority) {
      const [pda] = PublicKey.findProgramAddressSync(
        [CORE_SEEDS.USER, authority.toBuffer()],
        programId
      );
      return pda;
    },
    post(author, postCount) {
      // Rust uses `&user_profile.post_count.to_le_bytes()` where post_count is u32 → 4 bytes LE.
      const idx = u32LE(postCount);
      const [pda] = PublicKey.findProgramAddressSync(
        [CORE_SEEDS.POST, author.toBuffer(), idx],
        programId
      );
      return pda;
    },
    followRecord(followerProfile, targetProfile) {
      const [pda] = PublicKey.findProgramAddressSync(
        [CORE_SEEDS.FOLLOW, followerProfile.toBuffer(), targetProfile.toBuffer()],
        programId
      );
      return pda;
    },
    likeRecord(post, user) {
      const [pda] = PublicKey.findProgramAddressSync(
        [CORE_SEEDS.LIKE, post.toBuffer(), user.toBuffer()],
        programId
      );
      return pda;
    },
  };
}

// ────────────────────────────────────────────────────────────────────────
// Public params
// ────────────────────────────────────────────────────────────────────────

export interface RegisterUserParams {
  username: string;
  profileUri: string;
}

export interface PublishContentCoreParams {
  arweaveTxId: string;       // exactly 43 chars
  contentType: ContentTypeCore;
  accessControl: AccessControlCore;
  price: bigint | number;    // u64 lamports / smallest unit
}

export interface UpdateProfileParams {
  newProfileUri: string;
}

// ────────────────────────────────────────────────────────────────────────
// Account types (parsed)
// ────────────────────────────────────────────────────────────────────────

export interface UserProfileOnChain {
  address: PublicKey;
  authority: PublicKey;
  username: string;
  profileUri: string;
  reputationScore: number;
  followerCount: number;
  followingCount: number;
  postCount: number;
  createdAt: number;
  bump: number;
}

export interface PostOnChain {
  address: PublicKey;
  author: PublicKey;
  arweaveTxId: string;
  contentType: ContentTypeCore;
  accessControl: AccessControlCore;
  price: bigint;
  likes: bigint;
  views: bigint;
  tipsReceived: bigint;
  createdAt: number;
  isActive: boolean;
  bump: number;
}

export interface FollowRecordOnChain {
  address: PublicKey;
  follower: PublicKey;
  target: PublicKey;
  createdAt: number;
  bump: number;
}

export interface LikeRecordOnChain {
  address: PublicKey;
  user: PublicKey;
  post: PublicKey;
  createdAt: number;
  bump: number;
}

// ────────────────────────────────────────────────────────────────────────
// CoreModule
// ────────────────────────────────────────────────────────────────────────

export class CoreModule {
  public readonly pdas: CorePdas;

  constructor(
    private connection: Connection,
    private wallet: WalletAdapter,
    private programId: PublicKey
  ) {
    this.pdas = makePdas(programId);
  }

  // ──────────────────────────────────────────────────────────────────
  // Read helpers
  // ──────────────────────────────────────────────────────────────────

  async fetchUserProfile(authority: PublicKey): Promise<UserProfileOnChain | null> {
    const pda = this.pdas.userProfile(authority);
    const acc = await this.connection.getAccountInfo(pda);
    if (!acc) return null;
    return parseUserProfile(pda, acc.data);
  }

  async fetchPost(postAddress: PublicKey): Promise<PostOnChain | null> {
    const acc = await this.connection.getAccountInfo(postAddress);
    if (!acc) return null;
    return parsePost(postAddress, acc.data);
  }

  async fetchFollowRecord(follower: PublicKey, target: PublicKey): Promise<FollowRecordOnChain | null> {
    const followerProfile = this.pdas.userProfile(follower);
    const targetProfile = this.pdas.userProfile(target);
    const pda = this.pdas.followRecord(followerProfile, targetProfile);
    const acc = await this.connection.getAccountInfo(pda);
    if (!acc) return null;
    return parseFollowRecord(pda, acc.data);
  }

  async fetchLikeRecord(post: PublicKey, user: PublicKey): Promise<LikeRecordOnChain | null> {
    const pda = this.pdas.likeRecord(post, user);
    const acc = await this.connection.getAccountInfo(pda);
    if (!acc) return null;
    return parseLikeRecord(pda, acc.data);
  }

  // ──────────────────────────────────────────────────────────────────
  // Write helpers
  // ──────────────────────────────────────────────────────────────────

  /** Register a new user profile (PDA seeded by ["user", authority]). */
  async registerUser(params: RegisterUserParams): Promise<TransactionResult & { userProfile?: PublicKey }> {
    const authority = this.requireWallet();

    if (params.username.length > CORE_LIMITS.USERNAME_MAX)
      return errRes(`username exceeds ${CORE_LIMITS.USERNAME_MAX} chars`);
    if (params.profileUri.length > CORE_LIMITS.PROFILE_URI_MAX)
      return errRes(`profileUri exceeds ${CORE_LIMITS.PROFILE_URI_MAX} chars`);

    const userProfile = this.pdas.userProfile(authority);

    const data = Buffer.concat([
      ixDiscriminator('register_user'),
      borshString(params.username),
      borshString(params.profileUri),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: userProfile, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });

    const res = await this.sendTx([ix]);
    return { ...res, userProfile };
  }

  /** Publish content under the caller's profile. Reads post_count to derive the next post PDA. */
  async publishContent(params: PublishContentCoreParams): Promise<TransactionResult & { post?: PublicKey }> {
    const author = this.requireWallet();

    if (params.arweaveTxId.length !== CORE_LIMITS.ARWEAVE_TX_ID_LEN)
      return errRes(`arweaveTxId must be exactly ${CORE_LIMITS.ARWEAVE_TX_ID_LEN} chars`);

    // Read post_count from on-chain user profile.
    const userProfile = this.pdas.userProfile(author);
    const profile = await this.fetchUserProfile(author);
    if (!profile) return errRes('user profile not found — register first');

    const postPda = this.pdas.post(author, profile.postCount);

    const data = Buffer.concat([
      ixDiscriminator('publish_content'),
      borshString(params.arweaveTxId),
      u8(params.contentType),
      u8(params.accessControl),
      u64LE(BigInt(params.price)),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: postPda, isSigner: false, isWritable: true },
        { pubkey: userProfile, isSigner: false, isWritable: true },
        { pubkey: author, isSigner: true, isWritable: true },
        // CHECK: must match user_profile.authority (== author for this flow).
        { pubkey: author, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });

    const res = await this.sendTx([ix]);
    return { ...res, post: postPda };
  }

  /** Follow another user. Creates a FollowRecord PDA for dedup. */
  async followUser(targetAuthority: PublicKey): Promise<TransactionResult & { followRecord?: PublicKey }> {
    const follower = this.requireWallet();
    if (follower.equals(targetAuthority)) return errRes('cannot follow self');

    const followerProfile = this.pdas.userProfile(follower);
    const targetProfile = this.pdas.userProfile(targetAuthority);
    const followRecord = this.pdas.followRecord(followerProfile, targetProfile);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: followerProfile, isSigner: false, isWritable: true },
        { pubkey: targetProfile, isSigner: false, isWritable: true },
        { pubkey: followRecord, isSigner: false, isWritable: true },
        { pubkey: follower, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('follow_user'),
    });

    const res = await this.sendTx([ix]);
    return { ...res, followRecord };
  }

  /** Unfollow a user. Closes the FollowRecord PDA (rent → caller). */
  async unfollowUser(targetAuthority: PublicKey): Promise<TransactionResult> {
    const follower = this.requireWallet();

    const followerProfile = this.pdas.userProfile(follower);
    const targetProfile = this.pdas.userProfile(targetAuthority);
    const followRecord = this.pdas.followRecord(followerProfile, targetProfile);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: followerProfile, isSigner: false, isWritable: true },
        { pubkey: targetProfile, isSigner: false, isWritable: true },
        { pubkey: followRecord, isSigner: false, isWritable: true },
        { pubkey: follower, isSigner: true, isWritable: true },
      ],
      data: ixDiscriminator('unfollow_user'),
    });

    return this.sendTx([ix]);
  }

  /** Like a post. Creates a LikeRecord PDA for dedup. */
  async likePost(post: PublicKey): Promise<TransactionResult & { likeRecord?: PublicKey }> {
    const user = this.requireWallet();
    const likeRecord = this.pdas.likeRecord(post, user);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: post, isSigner: false, isWritable: true },
        { pubkey: likeRecord, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('like_post'),
    });

    const res = await this.sendTx([ix]);
    return { ...res, likeRecord };
  }

  /** Unlike a post. Closes the LikeRecord (rent → caller). */
  async unlikePost(post: PublicKey): Promise<TransactionResult> {
    const user = this.requireWallet();
    const likeRecord = this.pdas.likeRecord(post, user);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: post, isSigner: false, isWritable: true },
        { pubkey: likeRecord, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: true },
      ],
      data: ixDiscriminator('unlike_post'),
    });

    return this.sendTx([ix]);
  }

  /** Update the caller's profile URI. */
  async updateProfile(params: UpdateProfileParams): Promise<TransactionResult> {
    const authority = this.requireWallet();
    if (params.newProfileUri.length > CORE_LIMITS.PROFILE_URI_MAX)
      return errRes(`profileUri exceeds ${CORE_LIMITS.PROFILE_URI_MAX} chars`);

    const userProfile = this.pdas.userProfile(authority);

    const data = Buffer.concat([
      ixDiscriminator('update_profile'),
      borshString(params.newProfileUri),
    ]);

    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: userProfile, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
      ],
      data,
    });

    return this.sendTx([ix]);
  }

  // ──────────────────────────────────────────────────────────────────
  // Internals
  // ──────────────────────────────────────────────────────────────────

  private requireWallet(): PublicKey {
    if (!this.wallet.publicKey) throw new Error('Wallet not connected');
    return this.wallet.publicKey;
  }

  private async sendTx(ixs: TransactionInstruction[]): Promise<TransactionResult> {
    try {
      const payer = this.requireWallet();
      const tx = new Transaction().add(...ixs);
      const { blockhash } = await this.connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = payer;
      const sig = await this.wallet.sendTransaction(tx, this.connection);
      await this.connection.confirmTransaction(sig);
      return { signature: sig, success: true };
    } catch (e) {
      return { signature: '', success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}

// ────────────────────────────────────────────────────────────────────────
// Account parsers (Borsh)
// ────────────────────────────────────────────────────────────────────────

export const USER_PROFILE_DISC = accountDiscriminator('UserProfile');
export const POST_DISC = accountDiscriminator('Post');
export const FOLLOW_RECORD_DISC = accountDiscriminator('FollowRecord');
export const LIKE_RECORD_DISC = accountDiscriminator('LikeRecord');

function readString(buf: Buffer, offset: number): { value: string; nextOffset: number } {
  const len = buf.readUInt32LE(offset);
  const start = offset + 4;
  const end = start + len;
  return { value: buf.slice(start, end).toString('utf8'), nextOffset: end };
}

function parseUserProfile(addr: PublicKey, data: Buffer): UserProfileOnChain {
  if (!data.slice(0, 8).equals(USER_PROFILE_DISC)) {
    throw new Error('Account is not a UserProfile');
  }
  let o = 8;
  const authority = new PublicKey(data.slice(o, o + 32)); o += 32;
  const usernameRes = readString(data, o); o = usernameRes.nextOffset;
  const profileUriRes = readString(data, o); o = profileUriRes.nextOffset;
  const reputationScore = data.readUInt32LE(o); o += 4;
  const followerCount = data.readUInt32LE(o); o += 4;
  const followingCount = data.readUInt32LE(o); o += 4;
  const postCount = data.readUInt32LE(o); o += 4;
  const createdAt = Number(data.readBigInt64LE(o)); o += 8;
  const bump = data.readUInt8(o); o += 1;

  return {
    address: addr,
    authority,
    username: usernameRes.value,
    profileUri: profileUriRes.value,
    reputationScore,
    followerCount,
    followingCount,
    postCount,
    createdAt,
    bump,
  };
}

function parsePost(addr: PublicKey, data: Buffer): PostOnChain {
  if (!data.slice(0, 8).equals(POST_DISC)) {
    throw new Error('Account is not a Post');
  }
  let o = 8;
  const author = new PublicKey(data.slice(o, o + 32)); o += 32;
  const arweaveRes = readString(data, o); o = arweaveRes.nextOffset;
  const contentType = data.readUInt8(o) as ContentTypeCore; o += 1;
  const accessControl = data.readUInt8(o) as AccessControlCore; o += 1;
  const price = data.readBigUInt64LE(o); o += 8;
  const likes = data.readBigUInt64LE(o); o += 8;
  const views = data.readBigUInt64LE(o); o += 8;
  const tipsReceived = data.readBigUInt64LE(o); o += 8;
  const createdAt = Number(data.readBigInt64LE(o)); o += 8;
  const isActive = data.readUInt8(o) !== 0; o += 1;
  const bump = data.readUInt8(o); o += 1;

  return {
    address: addr,
    author,
    arweaveTxId: arweaveRes.value,
    contentType,
    accessControl,
    price,
    likes,
    views,
    tipsReceived,
    createdAt,
    isActive,
    bump,
  };
}

function parseFollowRecord(addr: PublicKey, data: Buffer): FollowRecordOnChain {
  if (!data.slice(0, 8).equals(FOLLOW_RECORD_DISC)) {
    throw new Error('Account is not a FollowRecord');
  }
  let o = 8;
  const follower = new PublicKey(data.slice(o, o + 32)); o += 32;
  const target = new PublicKey(data.slice(o, o + 32)); o += 32;
  const createdAt = Number(data.readBigInt64LE(o)); o += 8;
  const bump = data.readUInt8(o); o += 1;
  return { address: addr, follower, target, createdAt, bump };
}

function parseLikeRecord(addr: PublicKey, data: Buffer): LikeRecordOnChain {
  if (!data.slice(0, 8).equals(LIKE_RECORD_DISC)) {
    throw new Error('Account is not a LikeRecord');
  }
  let o = 8;
  const user = new PublicKey(data.slice(o, o + 32)); o += 32;
  const post = new PublicKey(data.slice(o, o + 32)); o += 32;
  const createdAt = Number(data.readBigInt64LE(o)); o += 8;
  const bump = data.readUInt8(o); o += 1;
  return { address: addr, user, post, createdAt, bump };
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

function errRes(msg: string): TransactionResult {
  return { signature: '', success: false, error: msg };
}
