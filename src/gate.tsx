"use client";

/**
 * Oturum kapısı: app içinde token köprüden gelir ve doğrudan oyuna geçilir.
 * Tarayıcıda token yoksa demo giriş ekranı gösterilir.
 */

import { useState, type ReactNode } from "react";
import { useAuth } from "./react.js";

const T = {
  accent: "var(--aile-accent, #6BBE8E)",
  fg: "var(--aile-fg, #14181F)",
  muted: "var(--aile-muted, #7A8290)",
  card: "var(--aile-card, #FFFFFF)",
  border: "var(--aile-border, rgba(0,0,0,0.08))",
};

export function AuthGate({
  /** Oyunun adı — giriş ekranında başlık olarak kullanılır. */
  gameName,
  children,
}: {
  gameName: string;
  children: ReactNode;
}) {
  const { profile, loading, needsLogin, error, loginDemo } = useAuth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (profile) return <>{children}</>;

  const wrap = (inner: ReactNode) => (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "60vh",
        padding: 24,
        color: T.fg,
      }}
    >
      <div style={{ width: "100%", maxWidth: 340, textAlign: "center" }}>{inner}</div>
    </div>
  );

  if (loading && !needsLogin) {
    return wrap(<p style={{ color: T.muted }}>Yükleniyor…</p>);
  }

  if (error && !needsLogin) {
    return wrap(
      <>
        <p style={{ color: T.muted, lineHeight: 1.6 }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "12px 20px",
            borderRadius: 12,
            border: `1px solid ${T.border}`,
            background: T.card,
            color: T.fg,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Tekrar dene
        </button>
      </>,
    );
  }

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || busy) return;
    setBusy(true);
    try {
      await loginDemo(trimmed);
    } catch {
      /* hata useAuth içinde gösteriliyor */
    } finally {
      setBusy(false);
    }
  };

  return wrap(
    <>
      <h2 style={{ fontSize: 20, margin: "0 0 6px" }}>{gameName}</h2>
      <p style={{ color: T.muted, fontSize: 14, margin: "0 0 20px", lineHeight: 1.6 }}>
        Skorun sıralamaya yazılsın diye bir ad seç.
      </p>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void submit()}
        placeholder="Adın"
        maxLength={30}
        autoFocus
        style={{
          width: "100%",
          padding: "13px 15px",
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          background: T.card,
          color: T.fg,
          fontSize: 16,
          outline: "none",
          boxSizing: "border-box",
          textAlign: "center",
        }}
      />

      <button
        onClick={() => void submit()}
        disabled={name.trim().length < 2 || busy}
        style={{
          width: "100%",
          marginTop: 10,
          padding: "13px 20px",
          borderRadius: 12,
          border: "none",
          background: T.accent,
          color: "#fff",
          fontSize: 16,
          fontWeight: 600,
          cursor: "pointer",
          opacity: name.trim().length < 2 || busy ? 0.5 : 1,
        }}
      >
        {busy ? "Giriliyor…" : "Başla"}
      </button>

      {error && <p style={{ color: T.muted, fontSize: 13, marginTop: 12 }}>{error}</p>}

      <p style={{ color: T.muted, fontSize: 12, marginTop: 22, lineHeight: 1.6 }}>
        Bu bir demo. Her giriş yeni bir oyuncu oluşturur; skorlar ve arkadaşlıklar
        gerçekten kaydedilir. Arkadaşını eklemek için Arkadaşlar sekmesinden adını ara.
      </p>
    </>,
  );
}
