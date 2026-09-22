# Mobil app tarafı (React Native / Expo)

Oyunlar web'de çalışır ve app içinde `WebView` ile açılır. App'in yapması gereken
iki şey var: **oyunu açmak** ve **token vermek**.

## 1. App token üretimi (backend)

Oyun-api, ana app'in imzaladığı bir JWT bekler. Bu token'ı **istemcide değil,
ana backend'inde** üret; imzalama sırrı (`APP_TOKEN_SECRET`) telefona inmemeli.

```ts
// ana-backend: GET /oyun-token  (oturum açmış kullanıcı için)
import { SignJWT } from "jose";

const secret = new TextEncoder().encode(process.env.APP_TOKEN_SECRET!);

export async function oyunTokenUret(user: {
  id: string;
  adSoyad: string;
  kullaniciAdi: string;
  avatarUrl?: string | null;
  aileId?: string | null;
}) {
  return new SignJWT({
    name: user.adSoyad,
    username: user.kullaniciAdi,
    avatarUrl: user.avatarUrl ?? null,
    familyId: user.aileId ?? null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("aile-app")
    .setAudience("oyun-api")
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}
```

## 2. Oyun ekranı (React Native)

`react-native-webview` gerekir: `npx expo install react-native-webview`

```tsx
import { useCallback, useRef } from "react";
import { SafeAreaView, Share, ActivityIndicator, StyleSheet } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

const OYUNLAR = {
  kelimematik: "https://kelimematik.aile.app",
  sudoku: "https://sudoku.aile.app",
  tavla: "https://tavla.aile.app",
} as const;

export function OyunEkrani({ oyunId }: { oyunId: keyof typeof OYUNLAR }) {
  const webRef = useRef<WebView>(null);
  const router = useRouter();

  const cevapla = useCallback((mesaj: object) => {
    // WebView içindeki sayfaya mesaj gönder.
    webRef.current?.postMessage(JSON.stringify(mesaj));
  }, []);

  const mesajGeldi = useCallback(
    async (event: WebViewMessageEvent) => {
      let mesaj: { type: string; [k: string]: unknown };
      try {
        mesaj = JSON.parse(event.nativeEvent.data);
      } catch {
        return; // oyunla ilgisi olmayan mesaj
      }

      switch (mesaj.type) {
        case "AILE_AUTH_REQUEST": {
          // Token'ı ana backend'den al (kısa ömürlü olduğu için her açılışta yenile).
          const appToken = await apiIstek<string>("/oyun-token");
          cevapla({ type: "AILE_AUTH_RESPONSE", appToken });
          break;
        }
        case "AILE_CLOSE":
          router.back();
          break;
        case "AILE_HAPTIC":
          await haptikCalistir(mesaj.style as string);
          break;
        case "AILE_SHARE":
          await Share.share({ message: String(mesaj.text) });
          break;
        case "AILE_GAME_OVER":
          // İstersen burada bildirim/rozet tetikle.
          break;
      }
    },
    [cevapla, router],
  );

  return (
    <SafeAreaView style={styles.tam}>
      <WebView
        ref={webRef}
        source={{ uri: OYUNLAR[oyunId] }}
        onMessage={mesajGeldi}
        // Oyunlar tam ekran ve sabit; sayfa zıplamasın.
        bounces={false}
        overScrollMode="never"
        scrollEnabled={false}
        // Oyun içi durum (ör. yarım kalan sudoku) app kapanınca kaybolmasın.
        domStorageEnabled
        javaScriptEnabled
        startInLoadingState
        renderLoading={() => <ActivityIndicator style={styles.tam} />}
        // Sadece kendi oyun alan adlarımıza izin ver.
        onShouldStartLoadWithRequest={(req) =>
          Object.values(OYUNLAR).some((url) => req.url.startsWith(url))
        }
        allowsBackForwardNavigationGestures={false}
      />
    </SafeAreaView>
  );
}

async function haptikCalistir(style: string) {
  if (style === "success") return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  if (style === "error") return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  const map = {
    light: Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy: Haptics.ImpactFeedbackStyle.Heavy,
  } as const;
  return Haptics.impactAsync(map[style as keyof typeof map] ?? Haptics.ImpactFeedbackStyle.Light);
}

const styles = StyleSheet.create({ tam: { flex: 1 } });
```

## 3. Eğlence sekmesindeki kartlar

Ekrandaki "Yakında" rozetlerini oyun açıldıkça kaldır:

```tsx
const oyunlar = [
  { id: "kelimematik", ad: "Kelimematik", aciklama: "Kelime bulma ve zekâ oyunu", hazir: true },
  { id: "sudoku", ad: "Sudoku", aciklama: "Klasik sayı bulmacası", hazir: true },
  { id: "tavla", ad: "Tavla", aciklama: "Aile ile keyifli bir parti", hazir: true },
] as const;

// Karta dokununca:
router.push(`/eglence/${oyun.id}`);
```

## Alternatif: token'ı adres satırında vermek

`postMessage` köprüsünü kurmak istemiyorsan, token'ı hash olarak da verebilirsin:

```tsx
source={{ uri: `${OYUNLAR[oyunId]}#t=${appToken}` }}
```

SDK token'ı okur okumaz adres çubuğundan siler. Yine de köprü yöntemi tercih edilir:
token süresi dolduğunda oyun yeniden isteyebilir, sayfayı yenilemek gerekmez.

## Mesaj sözleşmesi

| Oyundan app'e | Anlamı |
| --- | --- |
| `AILE_AUTH_REQUEST` | Token istiyor. `AILE_AUTH_RESPONSE` ile cevapla. |
| `AILE_READY` | Oyun yüklendi ve başladı. |
| `AILE_CLOSE` | Kullanıcı kapat'a bastı. |
| `AILE_HAPTIC` | Titreşim: `light \| medium \| heavy \| success \| error`. |
| `AILE_SHARE` | Skor paylaşımı. |
| `AILE_INVITE_FRIEND` | Arkadaş davet ekranını aç. |
| `AILE_GAME_OVER` | Oyun bitti, skor bilgisiyle. |

| App'ten oyuna | Anlamı |
| --- | --- |
| `AILE_AUTH_RESPONSE` | İstenen token. |
| `AILE_PAUSE` / `AILE_RESUME` | App arka plana geçti / döndü. |
