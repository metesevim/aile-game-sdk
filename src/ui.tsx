"use client";

/**
 * Hazır leaderboard + arkadaş panelleri.
 * Tailwind'e bağlı değiller; tema CSS değişkenleriyle geçilir:
 *   --aile-accent, --aile-bg, --aile-fg, --aile-muted, --aile-card, --aile-border
 */

import { useState, type CSSProperties } from "react";
import { useFriendRequests, useFriends, useGameClient, useLeaderboard } from "./react.js";
import type { LeaderboardPeriod, LeaderboardScope } from "./types.js";

const T = {
  accent: "var(--aile-accent, #6BBE8E)",
  bg: "var(--aile-bg, #F6F7F9)",
  fg: "var(--aile-fg, #14181F)",
  muted: "var(--aile-muted, #7A8290)",
  card: "var(--aile-card, #FFFFFF)",
  border: "var(--aile-border, rgba(0,0,0,0.08))",
};

const SCOPES: { key: LeaderboardScope; label: string }[] = [
  { key: "friends", label: "Arkadaşlar" },
  { key: "family", label: "Aile" },
  { key: "global", label: "Herkes" },
];

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "daily", label: "Bugün" },
  { key: "weekly", label: "Bu hafta" },
  { key: "alltime", label: "Tüm zamanlar" },
];

function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        padding: 4,
        background: T.bg,
        borderRadius: 12,
        border: `1px solid ${T.border}`,
      }}
    >
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 9,
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            color: value === o.key ? "#fff" : T.muted,
            background: value === o.key ? T.accent : "transparent",
            transition: "background 140ms ease, color 140ms ease",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Avatar({ url, name, size = 34 }: { url: string | null; name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase("tr-TR");
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} style={{ borderRadius: size, objectFit: "cover" }} />
  ) : (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: size,
        background: T.bg,
        border: `1px solid ${T.border}`,
        display: "grid",
        placeItems: "center",
        fontSize: size * 0.36,
        fontWeight: 700,
        color: T.muted,
      }}
    >
      {initials}
    </div>
  );
}

const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null);

export function LeaderboardPanel({
  defaultScope = "friends",
  defaultPeriod = "weekly",
  /** Skorun nasıl gösterileceği — ör. süre için "2:14". */
  formatScore = (n: number) => n.toLocaleString("tr-TR"),
}: {
  defaultScope?: LeaderboardScope;
  defaultPeriod?: LeaderboardPeriod;
  formatScore?: (score: number) => string;
}) {
  const [scope, setScope] = useState<LeaderboardScope>(defaultScope);
  const [period, setPeriod] = useState<LeaderboardPeriod>(defaultPeriod);
  const { data, loading, error, reload } = useLeaderboard(scope, period);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, color: T.fg }}>
      <Segmented options={SCOPES} value={scope} onChange={setScope} />
      <Segmented options={PERIODS} value={period} onChange={setPeriod} />

      {loading && <p style={{ color: T.muted, fontSize: 14, textAlign: "center", padding: 24 }}>Yükleniyor…</p>}

      {error && (
        <div style={{ textAlign: "center", padding: 20 }}>
          <p style={{ color: T.muted, fontSize: 14, margin: "0 0 10px" }}>{error}</p>
          <button
            onClick={reload}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: `1px solid ${T.border}`,
              background: T.card,
              color: T.fg,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Tekrar dene
          </button>
        </div>
      )}

      {data && data.rows.length === 0 && (
        <p style={{ color: T.muted, fontSize: 14, textAlign: "center", padding: 24, lineHeight: 1.5 }}>
          Burada henüz kimse yok.
          <br />
          Arkadaş ekleyip ilk skoru sen yaz.
        </p>
      )}

      {data && data.rows.length > 0 && (
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {data.rows.map((row) => (
            <li
              key={row.userId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 14,
                background: row.isMe ? `color-mix(in srgb, ${T.accent} 14%, ${T.card})` : T.card,
                border: `1px solid ${row.isMe ? T.accent : T.border}`,
              }}
            >
              <span style={{ width: 26, textAlign: "center", fontWeight: 700, color: T.muted, fontSize: 14 }}>
                {medal(row.rank) ?? row.rank}
              </span>
              <Avatar url={row.avatarUrl} name={row.displayName} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.displayName}
                  {row.isMe && <span style={{ color: T.accent, fontSize: 12, marginLeft: 6 }}>sen</span>}
                </div>
                {row.detail && <div style={{ color: T.muted, fontSize: 12 }}>{row.detail}</div>}
              </div>
              <strong style={{ fontVariantNumeric: "tabular-nums", fontSize: 15 }}>{formatScore(row.score)}</strong>
            </li>
          ))}
        </ol>
      )}

      {data?.me && !data.rows.some((r) => r.isMe) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 14,
            background: `color-mix(in srgb, ${T.accent} 14%, ${T.card})`,
            border: `1px solid ${T.accent}`,
          }}
        >
          <span style={{ width: 26, textAlign: "center", fontWeight: 700, color: T.muted, fontSize: 14 }}>
            {data.me.rank}
          </span>
          <Avatar url={data.me.avatarUrl} name={data.me.displayName} />
          <div style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>Sen</div>
          <strong style={{ fontVariantNumeric: "tabular-nums", fontSize: 15 }}>{formatScore(data.me.score)}</strong>
        </div>
      )}
    </div>
  );
}

export function FriendsPanel({
  /** Arkadaşın en iyi skorunu gösterme biçimi — süre oyunlarında "2:14" gibi. */
  formatScore = (n: number) => n.toLocaleString("tr-TR"),
}: {
  formatScore?: (score: number) => string;
} = {}) {
  const client = useGameClient();
  const friends = useFriends();
  const requests = useFriendRequests();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof client.searchUsers>>>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const search = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) return setResults([]);
    try {
      setResults(await client.searchUsers(q.trim()));
    } catch {
      setResults([]);
    }
  };

  const act = async (id: string, fn: () => Promise<unknown>, message: string) => {
    setBusy(id);
    try {
      await fn();
      setNotice(message);
      friends.reload();
      requests.reload();
      if (query.trim().length >= 2) await search(query);
    } catch {
      setNotice("İşlem tamamlanamadı.");
    } finally {
      setBusy(null);
    }
  };

  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 14,
    background: T.card,
    border: `1px solid ${T.border}`,
  };

  const btn = (primary = true): CSSProperties => ({
    padding: "7px 14px",
    borderRadius: 10,
    border: primary ? "none" : `1px solid ${T.border}`,
    background: primary ? T.accent : "transparent",
    color: primary ? "#fff" : T.muted,
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, color: T.fg }}>
      <div>
        <input
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Kullanıcı adı veya isim ara"
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: `1px solid ${T.border}`,
            background: T.card,
            color: T.fg,
            fontSize: 15,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {notice && <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>{notice}</p>}

      {results.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h3 style={{ fontSize: 13, color: T.muted, margin: 0, fontWeight: 600 }}>Sonuçlar</h3>
          {results.map((u) => (
            <div key={u.id} style={rowStyle}>
              <Avatar url={u.avatarUrl} name={u.displayName} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{u.displayName}</div>
                <div style={{ color: T.muted, fontSize: 12 }}>@{u.username}</div>
              </div>
              {u.status === "friends" && <span style={{ color: T.muted, fontSize: 13 }}>Arkadaş</span>}
              {u.status === "pending_out" && <span style={{ color: T.muted, fontSize: 13 }}>İstek gönderildi</span>}
              {u.status === "pending_in" && (
                <button
                  disabled={busy === u.id}
                  style={btn()}
                  onClick={() =>
                    act(u.id, async () => {
                      const req = (await client.friendRequests()).find((r) => r.from.id === u.id);
                      if (req) await client.respondFriendRequest(req.id, "accept");
                    }, "Arkadaş eklendi.")
                  }
                >
                  Kabul et
                </button>
              )}
              {u.status === "none" && (
                <button
                  disabled={busy === u.id}
                  style={btn()}
                  onClick={() => act(u.id, () => client.sendFriendRequest(u.id), "İstek gönderildi.")}
                >
                  Ekle
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {(requests.data?.length ?? 0) > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h3 style={{ fontSize: 13, color: T.muted, margin: 0, fontWeight: 600 }}>
            Gelen istekler ({requests.data!.length})
          </h3>
          {requests.data!.map((r) => (
            <div key={r.id} style={rowStyle}>
              <Avatar url={r.from.avatarUrl} name={r.from.displayName} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{r.from.displayName}</div>
                <div style={{ color: T.muted, fontSize: 12 }}>@{r.from.username}</div>
              </div>
              <button
                disabled={busy === r.id}
                style={btn()}
                onClick={() => act(r.id, () => client.respondFriendRequest(r.id, "accept"), "Arkadaş eklendi.")}
              >
                Kabul
              </button>
              <button
                disabled={busy === r.id}
                style={btn(false)}
                onClick={() => act(r.id, () => client.respondFriendRequest(r.id, "decline"), "İstek reddedildi.")}
              >
                Yok
              </button>
            </div>
          ))}
        </section>
      )}

      <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h3 style={{ fontSize: 13, color: T.muted, margin: 0, fontWeight: 600 }}>
          Arkadaşlar {friends.data ? `(${friends.data.length})` : ""}
        </h3>
        {friends.loading && <p style={{ color: T.muted, fontSize: 14 }}>Yükleniyor…</p>}
        {friends.data?.length === 0 && (
          <p style={{ color: T.muted, fontSize: 14, margin: 0, lineHeight: 1.5 }}>
            Henüz arkadaşın yok. Yukarıdan arayıp ekleyebilirsin.
          </p>
        )}
        {friends.data?.map((f) => (
          <div key={f.id} style={rowStyle}>
            <Avatar url={f.avatarUrl} name={f.displayName} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{f.displayName}</div>
              <div style={{ color: T.muted, fontSize: 12 }}>
                {f.bestScore != null ? `En iyi: ${formatScore(f.bestScore)}` : `@${f.username}`}
              </div>
            </div>
            <button
              disabled={busy === f.id}
              style={btn(false)}
              onClick={() => act(f.id, () => client.removeFriend(f.id), "Arkadaşlıktan çıkarıldı.")}
            >
              Çıkar
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
