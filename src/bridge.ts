/**
 * Mobil app (React Native WebView) <-> oyun (web) köprüsü.
 *
 * Oyun WebView içinde açıldığında token'ı üç yoldan biriyle alır:
 *  1. URL hash'i:  #t=<appToken>   (hash sunucu loglarına düşmez, query'den güvenli)
 *  2. postMessage handshake: oyun "AILE_AUTH_REQUEST" gönderir, app token ile cevaplar
 *  3. localStorage (sadece yerel geliştirmede, NEXT_PUBLIC_DEV_TOKEN)
 */

export type NativeOutgoing =
  | { type: "AILE_AUTH_REQUEST" }
  | { type: "AILE_CLOSE" }
  | { type: "AILE_HAPTIC"; style: "light" | "medium" | "heavy" | "success" | "error" }
  | { type: "AILE_SHARE"; text: string; url?: string }
  | { type: "AILE_INVITE_FRIEND"; gameId: string }
  | { type: "AILE_GAME_OVER"; gameId: string; score: number }
  | { type: "AILE_READY"; gameId: string };

export type NativeIncoming =
  | { type: "AILE_AUTH_RESPONSE"; appToken: string }
  | { type: "AILE_PAUSE" }
  | { type: "AILE_RESUME" };

interface RNWebView {
  postMessage(data: string): void;
}

function rn(): RNWebView | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ReactNativeWebView?: RNWebView }).ReactNativeWebView ?? null;
}

export function isInsideApp(): boolean {
  return rn() !== null;
}

/** Native tarafa mesaj gönderir. App yoksa sessizce yutar (tarayıcıda geliştirme). */
export function sendToNative(msg: NativeOutgoing): void {
  rn()?.postMessage(JSON.stringify(msg));
}

export function onNativeMessage(handler: (msg: NativeIncoming) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: MessageEvent | Event) => {
    const raw = (event as MessageEvent).data;
    if (typeof raw !== "string") return;
    try {
      const parsed = JSON.parse(raw) as NativeIncoming;
      if (parsed && typeof parsed.type === "string" && parsed.type.startsWith("AILE_")) {
        handler(parsed);
      }
    } catch {
      /* oyunla ilgisi olmayan mesaj */
    }
  };
  // iOS WebView window'a, Android document'a gönderir.
  window.addEventListener("message", listener);
  document.addEventListener("message", listener as EventListener);
  return () => {
    window.removeEventListener("message", listener);
    document.removeEventListener("message", listener as EventListener);
  };
}

function tokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const fromHash = hash.get("t") ?? new URLSearchParams(window.location.search).get("t");
  if (!fromHash) return null;

  if (hash.get("t")) {
    // Token'ı adres çubuğunda bırakma.
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  // Tarayıcıda geliştirirken sayfa yenilendiğinde token kaybolmasın.
  // App içinde gerek yok: köprü token'ı her açılışta yeniden verir.
  if (!isInsideApp()) storeToken(fromHash);
  return fromHash;
}

const TOKEN_KEY = "aile.token";

/** Token'ı tarayıcıda saklar (demo girişi ve sayfa yenileme için). */
export function storeToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* depolama kapalı olabilir */
  }
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* depolama kapalı olabilir */
  }
}

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(TOKEN_KEY) ?? window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Token'ı köprüden çözer. App içinde değilsek saklanan token'a ya da dev token'a düşer. */
export async function resolveAppToken(timeoutMs = 3000): Promise<string | null> {
  const fromUrl = tokenFromUrl();
  if (fromUrl) return fromUrl;

  if (!isInsideApp()) {
    if (typeof window === "undefined") return null;
    // Next.js derleme sırasında process.env.NEXT_PUBLIC_* değerini sabite çevirir;
    // @types/node bağımlılığı olmadan okumak için globalThis üzerinden bakıyoruz.
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    let devToken: string | null = null;
    try {
      devToken = window.localStorage.getItem("aile.devToken");
    } catch {
      /* depolama kapalı */
    }
    return readStoredToken() ?? devToken ?? env?.NEXT_PUBLIC_DEV_TOKEN ?? null;
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      off();
      resolve(null);
    }, timeoutMs);
    const off = onNativeMessage((msg) => {
      if (msg.type === "AILE_AUTH_RESPONSE") {
        clearTimeout(timer);
        off();
        resolve(msg.appToken);
      }
    });
    sendToNative({ type: "AILE_AUTH_REQUEST" });
  });
}

export type HapticStyle = "light" | "medium" | "heavy" | "success" | "error";

export const haptic = (style: HapticStyle): void => sendToNative({ type: "AILE_HAPTIC", style });
