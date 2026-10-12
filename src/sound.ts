/**
 * Ses efektleri — Web Audio ile anında sentezlenir.
 *
 * Barındırılacak dosya, lisans ya da ön yükleme yok; üç oyun da aynı ses dilini
 * konuşur. AudioContext ilk kullanıcı dokunuşunda açılır (iOS WebView bunu şart
 * koşar), app arka plana geçince ya da AILE_PAUSE gelince askıya alınır.
 *
 *   import { sound } from "@aile/game-sdk/sound";
 *   sound.play("dice");
 *   sound.play("reveal", { pitch: i * 2 }); // harf harf yükselen açılış
 */

import { onNativeMessage } from "./bridge.js";

export type SoundName =
  /** Genel arayüz düğmesi. */
  | "tap"
  /** Ekran klavyesinde harf / rakam tuşu. */
  | "key"
  /** Silme, geri alma. */
  | "erase"
  /** Hücre ya da taş seçimi. */
  | "select"
  /** Sudoku: hücreye rakam yerleştirme. */
  | "place"
  /** Kelimematik: harf kutusunun açılması. `pitch` ile sırayla yükselt. */
  | "reveal"
  /** Tavla: zar atma. */
  | "dice"
  /** Tavla: taş hareketi. */
  | "move"
  /** Tavla: rakip taşı kırma. */
  | "hit"
  /** Tavla: taş toplama. */
  | "bearOff"
  /** Geçersiz hamle / yanlış cevap. */
  | "error"
  /** Doğru kelime, tamamlanan satır/kutu. */
  | "success"
  /** Sıra sende. */
  | "turn"
  /** Süre azalırken tik. */
  | "tick"
  | "win"
  | "lose";

export interface PlayOptions {
  /** 0..1, varsayılan 1. Genel ses seviyesiyle çarpılır. */
  volume?: number;
  /** Yarım ton cinsinden kaydırma (melodik seslerde). */
  pitch?: number;
}

const MUTE_KEY = "aile:sound-muted";
/** Aynı ses bu süreden sık tetiklenirse yutulur (çift olay, hızlı tekrar). */
const MIN_GAP_MS = 25;

type Listener = () => void;

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    /* gizli sekme vb. — tercih sadece bu oturumda geçerli */
  }
}

const semis = (n: number) => Math.pow(2, n / 12);

export class SoundPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private last = new Map<SoundName, number>();
  private listeners = new Set<Listener>();
  private installed = false;
  private _muted = false;
  private _volume = 0.7;

  constructor() {
    if (typeof window === "undefined") return;
    this._muted = readFlag(MUTE_KEY);
    this.install();
  }

  get muted(): boolean {
    return this._muted;
  }

  get volume(): number {
    return this._volume;
  }

  setMuted(muted: boolean): void {
    if (muted === this._muted) return;
    this._muted = muted;
    writeFlag(MUTE_KEY, muted);
    this.emit();
  }

  toggleMuted(): void {
    this.setMuted(!this._muted);
  }

  setVolume(v: number): void {
    this._volume = Math.min(1, Math.max(0, v));
    if (this.master) this.master.gain.value = this._volume;
    this.emit();
  }

  /** Durum değişince (sessiz, ses seviyesi) çağrılır. */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  play(name: SoundName, opts: PlayOptions = {}): void {
    if (typeof window === "undefined") return;

    const now = performance.now();
    if (now - (this.last.get(name) ?? -Infinity) < MIN_GAP_MS) return;
    this.last.set(name, now);

    if (this._muted) return;
    const ctx = this.context();
    if (!ctx || !this.master) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});

    const v = Math.min(1, Math.max(0, opts.volume ?? 1));
    const p = semis(opts.pitch ?? 0);
    const t = ctx.currentTime + 0.005;
    RECIPES[name](this.kit(ctx, this.master, v), t, p);
  }

  // ---------------------------------------------------------------------------

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      // iOS 17+: "playback" oturumu sesi telefonun sessiz modundan bağımsız kılar;
      // aksi halde sessiz anahtarı açıkken Web Audio hiç ses çıkarmaz.
      const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
      if (session) session.type = "playback";
      const ctx = new Ctor();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      const master = ctx.createGain();
      master.gain.value = this._volume;
      master.connect(comp).connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
    } catch {
      return null;
    }
    return this.ctx;
  }

  /**
   * iOS/Safari AudioContext'i ancak bir kullanıcı hareketinin içinde açar.
   * İlk dokunuşta bağlamı oluşturup sessiz bir tampon çalarak kilidi kaldırırız.
   */
  private install(): void {
    if (this.installed) return;
    this.installed = true;

    const unlock = () => {
      if (this._muted) return;
      const ctx = this.context();
      if (!ctx) return;
      if (ctx.state === "suspended") void ctx.resume().catch(() => {});
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
      if (ctx.state === "running") {
        for (const ev of UNLOCK_EVENTS) window.removeEventListener(ev, unlock, true);
      }
    };
    for (const ev of UNLOCK_EVENTS) window.addEventListener(ev, unlock, true);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) void this.ctx?.suspend().catch(() => {});
      else if (this.ctx?.state === "suspended") void this.ctx.resume().catch(() => {});
    });

    onNativeMessage((msg) => {
      if (msg.type === "AILE_PAUSE") void this.ctx?.suspend().catch(() => {});
      if (msg.type === "AILE_RESUME") void this.ctx?.resume().catch(() => {});
    });
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noise) return this.noise;
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
    return buf;
  }

  private kit(ctx: AudioContext, out: AudioNode, vol: number): Kit {
    const noise = this.noiseBuffer(ctx);

    const tone: Kit["tone"] = (t, { freq, to, dur, type = "sine", gain = 0.3, attack = 0.004 }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain * vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    };

    const burst: Kit["burst"] = (t, { dur, freq, q = 1, type = "bandpass", gain = 0.3 }) => {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain * vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(out);
      // Her seferinde tamponun farklı yerinden başla ki aynı ses tekrar etmesin.
      src.start(t, Math.random() * (noise.duration - dur - 0.01), dur + 0.01);
    };

    return { tone, burst };
  }
}

/**
 * Tarayıcılar sesi yalnızca "kullanıcı etkinleştirmesi" sayılan olaylarda açar.
 * iOS Safari dokunmada touchstart/pointerdown'ı saymaz, parmak kalkınca (touchend,
 * click) sayar; hepsini dinleyip hangisi önce işe yararsa onu kullanıyoruz.
 */
const UNLOCK_EVENTS = ["pointerdown", "touchstart", "touchend", "pointerup", "click", "keydown"] as const;

interface Kit {
  tone(
    t: number,
    o: { freq: number; to?: number; dur: number; type?: OscillatorType; gain?: number; attack?: number },
  ): void;
  burst(
    t: number,
    o: { dur: number; freq: number; q?: number; type?: BiquadFilterType; gain?: number },
  ): void;
}

type Recipe = (k: Kit, t: number, p: number) => void;

/** Ahşap tahta üstüne taş: alçak tok vuruş + kısa tıkırtı. */
const thock = (k: Kit, t: number, gain: number, freq = 170) => {
  k.tone(t, { freq, to: freq * 0.55, dur: 0.11, gain, attack: 0.002 });
  k.burst(t, { dur: 0.03, freq: 2400, q: 1.5, gain: gain * 0.5 });
};

const notes = (k: Kit, t: number, freqs: number[], step: number, dur: number, gain: number, type: OscillatorType = "triangle") =>
  freqs.forEach((f, i) => k.tone(t + i * step, { freq: f, dur, gain, type }));

const RECIPES: Record<SoundName, Recipe> = {
  tap: (k, t, p) => k.tone(t, { freq: 620 * p, to: 520 * p, dur: 0.06, gain: 0.16 }),

  key: (k, t, p) => {
    k.burst(t, { dur: 0.025, freq: 3200, q: 0.8, type: "highpass", gain: 0.18 });
    k.tone(t, { freq: 900 * p, dur: 0.035, gain: 0.07, type: "square" });
  },

  erase: (k, t) => k.tone(t, { freq: 520, to: 240, dur: 0.1, gain: 0.14, type: "triangle" }),

  select: (k, t, p) => k.tone(t, { freq: 880 * p, to: 990 * p, dur: 0.07, gain: 0.12 }),

  place: (k, t, p) => {
    k.tone(t, { freq: 660 * p, dur: 0.14, gain: 0.2, type: "triangle", attack: 0.002 });
    k.tone(t, { freq: 1320 * p, dur: 0.06, gain: 0.05 });
  },

  reveal: (k, t, p) => {
    k.burst(t, { dur: 0.05, freq: 1800 * p, q: 3, gain: 0.12 });
    k.tone(t, { freq: 440 * p, to: 470 * p, dur: 0.12, gain: 0.14, type: "triangle" });
  },

  dice: (k, t) => {
    // Fincanda çalkalama, ardından tahtaya düşüp seken iki zar.
    let at = t;
    for (let i = 0; i < 9; i++) {
      at += 0.03 + Math.random() * 0.045;
      const fade = 1 - i / 12;
      k.burst(at, { dur: 0.025, freq: 1800 + Math.random() * 2200, q: 4, gain: 0.32 * fade });
      if (i % 3 === 2) k.tone(at, { freq: 260 + Math.random() * 120, dur: 0.05, gain: 0.12 * fade });
    }
    k.burst(at + 0.06, { dur: 0.04, freq: 1400, q: 2, gain: 0.25 });
    k.tone(at + 0.06, { freq: 210, to: 140, dur: 0.08, gain: 0.2 });
  },

  move: (k, t) => thock(k, t, 0.38),

  hit: (k, t) => {
    thock(k, t, 0.5, 200);
    k.burst(t + 0.01, { dur: 0.06, freq: 3000, q: 2, gain: 0.3 });
    thock(k, t + 0.09, 0.25, 140);
  },

  bearOff: (k, t) => {
    thock(k, t, 0.3, 190);
    k.tone(t + 0.05, { freq: 784, to: 1046, dur: 0.12, gain: 0.1 });
  },

  error: (k, t) => {
    k.tone(t, { freq: 196, dur: 0.11, gain: 0.12, type: "square" });
    k.tone(t + 0.12, { freq: 165, dur: 0.16, gain: 0.12, type: "square" });
  },

  success: (k, t, p) => notes(k, t, [523, 659, 784].map((f) => f * p), 0.07, 0.18, 0.16),

  turn: (k, t) => {
    k.tone(t, { freq: 880, dur: 0.22, gain: 0.13 });
    k.tone(t + 0.11, { freq: 1175, dur: 0.3, gain: 0.13 });
  },

  tick: (k, t, p) => k.tone(t, { freq: 1500 * p, dur: 0.025, gain: 0.08, type: "square" }),

  win: (k, t) => {
    notes(k, t, [523, 659, 784, 1046], 0.09, 0.25, 0.16);
    notes(k, t + 0.36, [784, 1046, 1318], 0, 0.7, 0.1, "sine");
  },

  lose: (k, t) => notes(k, t, [392, 330, 262], 0.16, 0.3, 0.14),
};

/** Paylaşılan tek oynatıcı — tüm oyun aynı AudioContext'i kullanır. */
export const sound = new SoundPlayer();

/**
 * Sayfadaki tüm düğmelere otomatik "tap" sesi ekler (event delegation).
 * Bir düğmeyi kapatmak için `data-sound="off"`, farklı ses için `data-sound="key"`.
 * Öznitelik bir kapsayıcıya da konabilir: `<div data-sound="off">` içindeki hiçbir düğme ses çalmaz.
 * Oyun kendi sesini çalan düğmelere `data-sound="off"` koymalı ki iki ses üst üste binmesin.
 */
export function installButtonSounds(root: Document | HTMLElement = document): () => void {
  const handler = (event: Event) => {
    const target = event.target as Element | null;
    const el = target?.closest?.("button, [role='button'], [data-sound]");
    if (!el || (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
    const attr = el.closest("[data-sound]")?.getAttribute("data-sound");
    if (attr === "off") return;
    const name = (attr && attr in RECIPES ? attr : "tap") as SoundName;
    sound.play(name);
  };
  root.addEventListener("pointerdown", handler, true);
  return () => root.removeEventListener("pointerdown", handler, true);
}
