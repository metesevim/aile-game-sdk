/** Tüm oyunların paylaştığı tipler. oyun-api ile birebir aynı sözleşme. */

export type GameId = string;

export interface Profile {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  familyId: string | null;
}

export type LeaderboardScope = "global" | "friends" | "family";
export type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "alltime";

export interface LeaderboardRow {
  rank: number;
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  score: number;
  /** Oyuna özel gösterim metni: "2:14", "4 hamle", "zor" gibi. */
  detail: string | null;
  achievedAt: string;
  isMe: boolean;
}

export interface Leaderboard {
  gameId: GameId;
  scope: LeaderboardScope;
  period: LeaderboardPeriod;
  rows: LeaderboardRow[];
  /** Kullanıcı ilk 100'de değilse kendi satırı ayrıca döner. */
  me: LeaderboardRow | null;
  total: number;
}

export interface GameSession {
  sessionId: string;
  /** Deterministik bulmaca üretimi için sunucudan gelen tohum. */
  seed: string;
  startedAt: string;
  /** Sunucunun kabul edeceği en yüksek skor — istemci tarafı sanity check. */
  maxScore: number;
  config: Record<string, unknown>;
}

export interface SubmitScoreInput {
  sessionId: string;
  score: number;
  detail?: string;
  /** Doğrulama için hamle kaydı; sunucu tekrar oynatarak skoru teyit eder. */
  moves?: unknown[];
  meta?: Record<string, unknown>;
}

export interface SubmitScoreResult {
  accepted: boolean;
  reason?: string;
  score: number;
  personalBest: boolean;
  ranks: Partial<Record<LeaderboardScope, number>>;
}

export type FriendshipStatus = "none" | "pending_out" | "pending_in" | "friends" | "blocked";

export interface FriendSummary {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  status: FriendshipStatus;
  /** Bu oyundaki en iyi skoru — arkadaş listesinde karşılaştırma için. */
  bestScore?: number | null;
}

export interface FriendRequest {
  id: string;
  from: FriendSummary;
  createdAt: string;
}

export interface ApiError {
  error: string;
  message: string;
  status: number;
}
