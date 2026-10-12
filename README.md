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
| `@aile/game-sdk/react` | `GameProvider`, `useProfile`, `useGameSession`, `useLeaderboard`, `useFriends`, `useSound` |
| `@aile/game-sdk/ui` | `LeaderboardPanel`, `FriendsPanel`, `SoundToggle` |
| `@aile/game-sdk/sound` | `sound`, `SoundPlayer`, `installButtonSounds` |

## Ses efektleri

Sesler Web Audio ile anında sentezlenir: dosya yok, ön yükleme yok, üç oyunda aynı ses dili.
`GameProvider` varsayılan olarak tüm düğmelere hafif bir "tap" sesi ekler; oyuna özgü anları
oyun kendisi çalar.

```tsx
import { sound } from "@aile/game-sdk/sound";
import { useSound } from "@aile/game-sdk/react";
import { SoundToggle } from "@aile/game-sdk/ui";

sound.play("dice");
sound.play("reveal", { pitch: i * 2 }); // harf harf yükselen açılış

<SoundToggle />; // üst bara sessize alma düğmesi
```

Kendi sesini çalan düğmeye `data-sound="off"` koy ki "tap" ile üst üste binmesin; farklı ses için
`data-sound="key"`. Otomatik düğme sesini tamamen kapatmak: `<GameProvider buttonSounds={false}>`.

`data-sound` bir kapsayıcıya da konabilir: `<div data-sound="off">` içindeki düğmeler (ör. tahta
haneleri) ses çalmaz. Titreşim sesten bağımsızdır, oyun `haptic()` ile ayrıca çağırır; böylece ses
kapalıyken de titreşim sürer. Sessiz tercihi cihazda saklanır; app arka plana geçince (AILE_PAUSE)
ses askıya alınır.

| Oyun | An | Ses |
| --- | --- | --- |
| Hepsi | düğmeler | `tap` (otomatik) |
| Hepsi | kazanma / kaybetme | `win` / `lose` |
| Hepsi | son 10 saniye | `tick` |
| Tavla | zar atma | `dice` |
| Tavla | taş seçme / bırakma | `select` / `move` |
| Tavla | kırma | `hit` |
| Tavla | toplama | `bearOff` |
| Tavla | geçersiz hamle | `error` |
| Tavla (online) | sıra sana geçti | `turn` |
| Kelimematik | harf tuşu / silme | `key` / `erase` |
| Kelimematik | tahmin gönderildi, kutular açılıyor | `reveal` (`pitch: i * 2`) |
| Kelimematik | sözlükte yok | `error` |
| Kelimematik | kelime bulundu | `success` → `win` |
| Sudoku | hücre seçme | `select` |
| Sudoku | rakam yazma / silme | `place` / `erase` |
| Sudoku | çakışan rakam | `error` |
| Sudoku | satır/sütun/kutu tamamlandı | `success` |

Paneller Tailwind'e bağlı değil; temayı CSS değişkenleriyle geçersin:
`--aile-accent`, `--aile-bg`, `--aile-fg`, `--aile-muted`, `--aile-card`, `--aile-border`.

## Mobil app tarafı

`docs/react-native.md` — WebView bileşeni ve mesaj sözleşmesi.
