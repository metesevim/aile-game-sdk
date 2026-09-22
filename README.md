# @aile/game-sdk

Aile uygulamasındaki oyunların ortak altyapısı: app ile köprü, oturum/skor akışı,
hazır leaderboard ve arkadaş panelleri.

```bash
npm install @aile/game-sdk
```

## Kullanım

```tsx
// app/layout veya oyun kökü
import { GameProvider } from "@aile/game-sdk/react";

<GameProvider apiUrl={process.env.NEXT_PUBLIC_API_URL!} gameId="sudoku">
  <Oyun />
</GameProvider>;
```

```tsx
import { useGameSession } from "@aile/game-sdk/react";
import { LeaderboardPanel, FriendsPanel } from "@aile/game-sdk/ui";

function Oyun() {
  const session = useGameSession();

  const basla = async () => {
    const s = await session.start({ difficulty: "orta" });
    // s.seed: bulmacayı bundan deterministik üret — sunucu da aynısını üretebilir.
  };

  const bitti = (puan: number) => session.submit(puan, { detail: "orta" });

  return <LeaderboardPanel />;
}
```

`session.start()` sunucuya ulaşamazsa `null` döner ve oyun yerel bir tohumla
çevrimdışı oynanır; `session.submit()` o durumda skoru kaydetmez ve
`session.error` ile bunu bildirir. Oyun oynanabilir kalır.

## Dışa verilenler

| Giriş | İçerik |
| --- | --- |
| `@aile/game-sdk` | `createGameClient`, `GameClient`, köprü fonksiyonları, tipler |
| `@aile/game-sdk/react` | `GameProvider`, `useProfile`, `useGameSession`, `useLeaderboard`, `useFriends` |
| `@aile/game-sdk/ui` | `LeaderboardPanel`, `FriendsPanel` |

Paneller Tailwind'e bağlı değil; temayı CSS değişkenleriyle geçersin:
`--aile-accent`, `--aile-bg`, `--aile-fg`, `--aile-muted`, `--aile-card`, `--aile-border`.

## Mobil app tarafı

`docs/react-native.md` — WebView bileşeni ve mesaj sözleşmesi.
