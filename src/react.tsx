"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createGameClient, GameApiError, type GameClient } from "./client.js";
import type {
  FriendRequest,
  FriendSummary,
  Leaderboard,
  LeaderboardPeriod,
  LeaderboardScope,
  Profile,
} from "./types.js";

const Ctx = createContext<GameClient | null>(null);

export function GameProvider({
  apiUrl,
  gameId,
  children,
}: {
  apiUrl: string;
  gameId: string;
  children: ReactNode;
}) {
  const client = useMemo(() => createGameClient({ apiUrl, gameId }), [apiUrl, gameId]);
  return <Ctx.Provider value={client}>{children}</Ctx.Provider>;
}

export function useGameClient(): GameClient {
  const client = useContext(Ctx);
  if (!client) throw new Error("useGameClient, <GameProvider> içinde kullanılmalı.");
  return client;
}

type AsyncState<T> = { data: T | null; loading: boolean; error: string | null };

function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef
      .current()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((err: unknown) => {
        if (!alive) return;
        const message = err instanceof GameApiError ? err.message : "Bağlantı kurulamadı.";
        setState({ data: null, loading: false, error: message });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { ...state, reload: useCallback(() => setNonce((n) => n + 1), []) };
}

/** Oturumu açar ve profili döner. Oyun açılışında bir kez çağır. */
export function useProfile() {
  const client = useGameClient();
  return useAsync<Profile>(() => client.connect(), [client]);
}

export interface AuthState {
  profile: Profile | null;
  loading: boolean;
  /** Token yok: kullanıcıya demo giriş ekranı gösterilmeli. */
  needsLogin: boolean;
  /** Sunucuya ulaşılamadı gibi gerçek hatalar. */
  error: string | null;
  loginDemo: (name: string) => Promise<void>;
  signOut: () => void;
}

/**
 * Oturum durumunu yönetir. App içinde token köprüden gelir; tarayıcıda token
 * yoksa `needsLogin` true olur ve oyun demo giriş ekranını gösterir.
 */
export function useAuth(): AuthState {
  const client = useGameClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await client.connect());
      setNeedsLogin(false);
    } catch (err) {
      setProfile(null);
      if (err instanceof GameApiError && (err.code === "no_app_token" || err.status === 401)) {
        setNeedsLogin(true);
      } else {
        setError(err instanceof GameApiError ? err.message : "Sunucuya ulaşılamadı.");
      }
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const loginDemo = useCallback(
    async (name: string) => {
      setLoading(true);
      setError(null);
      try {
        setProfile(await client.demoLogin(name));
        setNeedsLogin(false);
      } catch (err) {
        setError(err instanceof GameApiError ? err.message : "Giriş yapılamadı.");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  const signOut = useCallback(() => {
    client.signOut();
    setProfile(null);
    setNeedsLogin(true);
  }, [client]);

  return { profile, loading, needsLogin, error, loginDemo, signOut };
}

export function useLeaderboard(scope: LeaderboardScope, period: LeaderboardPeriod) {
  const client = useGameClient();
  return useAsync<Leaderboard>(() => client.leaderboard(scope, period), [client, scope, period]);
}

export function useFriends() {
  const client = useGameClient();
  return useAsync<FriendSummary[]>(() => client.friends(), [client]);
}

export function useFriendRequests() {
  const client = useGameClient();
  return useAsync<FriendRequest[]>(() => client.friendRequests(), [client]);
}

/**
 * Oyun oturumu yaşam döngüsü: başlat -> oyna -> skoru gönder.
 * Oyunlar sadece bunu kullanır, fetch detayına girmez.
 */
export function useGameSession() {
  const client = useGameClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [seed, setSeed] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<Awaited<ReturnType<GameClient["submitScore"]>> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(
    async (config: Record<string, unknown> = {}) => {
      setError(null);
      setLastResult(null);
      try {
        const session = await client.startSession(config);
        setSessionId(session.sessionId);
        setSeed(session.seed);
        return session;
      } catch (err) {
        setError(err instanceof GameApiError ? err.message : "Oyun başlatılamadı.");
        // Çevrimdışıyken de oynanabilsin: yerel tohumla devam et.
        const offlineSeed = Math.random().toString(36).slice(2);
        setSessionId(null);
        setSeed(offlineSeed);
        return null;
      }
    },
    [client],
  );

  const submit = useCallback(
    async (score: number, extra: { detail?: string; moves?: unknown[]; meta?: Record<string, unknown> } = {}) => {
      if (!sessionId) {
        setError("Çevrimdışı oynandı, skor kaydedilmedi.");
        return null;
      }
      setSubmitting(true);
      setError(null);
      try {
        const result = await client.submitScore({ sessionId, score, ...extra });
        setLastResult(result);
        return result;
      } catch (err) {
        setError(err instanceof GameApiError ? err.message : "Skor gönderilemedi.");
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [client, sessionId],
  );

  return { sessionId, seed, start, submit, submitting, lastResult, error, online: sessionId !== null };
}
