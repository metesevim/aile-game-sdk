import { resolveAppToken } from "./bridge.js";
import type {
  FriendRequest,
  FriendSummary,
  GameSession,
  Leaderboard,
  LeaderboardPeriod,
  LeaderboardScope,
  Profile,
  SubmitScoreInput,
  SubmitScoreResult,
} from "./types.js";

export class GameApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "GameApiError";
  }
}

export interface GameClientOptions {
  /** oyun-api kök adresi, ör. https://oyun-api.aile.app */
  apiUrl: string;
  /** Bu oyunun kimliği: "sudoku" | "kelimematik" | "tavla" */
  gameId: string;
}

interface HandshakeResponse {
  gameToken: string;
  expiresAt: string;
  profile: Profile;
}

export class GameClient {
  private gameToken: string | null = null;
  private tokenExpiresAt = 0;
  private profile: Profile | null = null;
  private inflightAuth: Promise<void> | null = null;

  constructor(private readonly opts: GameClientOptions) {}

  get gameId(): string {
    return this.opts.gameId;
  }

  /** Köprüden app token'ı alır, oyun token'ına çevirir. Idempotent. */
  async connect(): Promise<Profile> {
    if (this.profile && Date.now() < this.tokenExpiresAt - 30_000) return this.profile;
    if (!this.inflightAuth) {
      this.inflightAuth = this.doHandshake().finally(() => {
        this.inflightAuth = null;
      });
    }
    await this.inflightAuth;
    if (!this.profile) throw new GameApiError(401, "no_session", "Oturum açılamadı.");
    return this.profile;
  }

  private async doHandshake(): Promise<void> {
    const appToken = await resolveAppToken();
    if (!appToken) {
      throw new GameApiError(401, "no_app_token", "Uygulama oturumu bulunamadı.");
    }
    const res = await fetch(`${this.opts.apiUrl}/api/auth/handshake`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appToken, gameId: this.opts.gameId }),
    });
    const data = (await this.parse(res)) as HandshakeResponse;
    this.gameToken = data.gameToken;
    this.tokenExpiresAt = new Date(data.expiresAt).getTime();
    this.profile = data.profile;
  }

  private async parse(res: Response): Promise<unknown> {
    const text = await res.text();
    const body = text ? JSON.parse(text) : {};
    if (!res.ok) {
      throw new GameApiError(res.status, body.error ?? "http_error", body.message ?? res.statusText);
    }
    return body;
  }

  private async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    await this.connect();
    const res = await fetch(`${this.opts.apiUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.gameToken}`,
        ...(init.headers ?? {}),
      },
    });
    if (res.status === 401 && retry) {
      this.gameToken = null;
      this.profile = null;
      this.tokenExpiresAt = 0;
      return this.request<T>(path, init, false);
    }
    return (await this.parse(res)) as T;
  }

  me(): Promise<Profile> {
    return this.request<Profile>("/api/me");
  }

  /**
   * Oyun oturumu başlatır. Skor ancak açık bir oturumla gönderilebilir;
   * sunucu süreyi ve tohumu kaydettiği için uydurma skorlar elenir.
   */
  startSession(config: Record<string, unknown> = {}): Promise<GameSession> {
    return this.request<GameSession>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ gameId: this.opts.gameId, config }),
    });
  }

  submitScore(input: SubmitScoreInput): Promise<SubmitScoreResult> {
    return this.request<SubmitScoreResult>("/api/scores", {
      method: "POST",
      body: JSON.stringify({ gameId: this.opts.gameId, ...input }),
    });
  }

  leaderboard(
    scope: LeaderboardScope = "friends",
    period: LeaderboardPeriod = "weekly",
  ): Promise<Leaderboard> {
    const qs = new URLSearchParams({ gameId: this.opts.gameId, scope, period });
    return this.request<Leaderboard>(`/api/leaderboard?${qs}`);
  }

  friends(): Promise<FriendSummary[]> {
    const qs = new URLSearchParams({ gameId: this.opts.gameId });
    return this.request<FriendSummary[]>(`/api/friends?${qs}`);
  }

  friendRequests(): Promise<FriendRequest[]> {
    return this.request<FriendRequest[]>("/api/friends/requests");
  }

  searchUsers(query: string): Promise<FriendSummary[]> {
    return this.request<FriendSummary[]>(`/api/users/search?q=${encodeURIComponent(query)}`);
  }

  sendFriendRequest(userId: string): Promise<{ ok: true }> {
    return this.request("/api/friends/requests", {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  }

  respondFriendRequest(requestId: string, action: "accept" | "decline"): Promise<{ ok: true }> {
    return this.request(`/api/friends/requests/${requestId}`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
  }

  removeFriend(userId: string): Promise<{ ok: true }> {
    return this.request(`/api/friends/${userId}`, { method: "DELETE" });
  }
}

export function createGameClient(opts: GameClientOptions): GameClient {
  return new GameClient(opts);
}
