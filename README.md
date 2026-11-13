# Nexora Watch

Arkadaşlarınla aynı videoyu **aynı anda** izlediğin, Rave benzeri birlikte izleme uygulaması. Oda kurarsın, kodu ya da davet bağlantısını paylaşırsın; video herkeste aynı saniyede oynar. Yanında sohbet, emoji tepkileri, katılımcı listesi ve oylamalı video sırası var.

- Web: https://nexora.lenstedreal.info
- Android: GitHub Releases (`latest`), Google Play'e hazırlanıyor
- Kişisel sayfa: https://me.lenstedreal.info · İndirmeler: https://apk.lenstedreal.info

## Desteklenen kaynaklar

| Kaynak | Nasıl | Eşitleme |
|---|---|---|
| YouTube (video, Shorts) | resmî oynatıcı | var |
| TikTok | resmî gömme oynatıcı | var |
| Facebook videoları | resmî oynatıcı (JS SDK) | var (yüklenemezse eşitlemesiz gömme) |
| Instagram, X (Twitter) | resmî gömme | yok |
| Twitch | resmî oynatıcı | kayıtlı yayın var, canlı yok |
| Kick (canlı) | resmî gömme | yok |
| Google Drive | herkese açık dosya içe aktarılır | var |
| MP4 / M3U8 bağlantısı, telefondan yüklenen video | kendi oynatıcımız (kalite, altyazı, sıra) | var |
| Netflix, Disney+, Prime Video, HBO Max (beta) | yalnızca uygulamada, herkes kendi hesabıyla | var, bkz. `docs/SERVICES.md` |

Vimeo, Internet Archive ve Dropbox bağlantıları yapıştırılınca da çalışır; listelerde gösterilmez. Resmî oynatıcıların üstüne hiçbir şey çizilmez; başlık ve düğmeler oynatıcının altındaki çubuktadır.

## Repo yapısı

| Klasör | İçerik |
|---|---|
| `backend/` | FastAPI + MongoDB: odalar, WebSocket eşitleme, sohbet, sıra, altyazı, yükleme, Drive içe aktarma, moderasyon |
| `frontend/` | React web uygulaması: hem web sitesinin hem mobil uygulamanın arayüzü (tek kod) |
| `apps/mobile/` | Expo kabuğu: arayüzü WebView'da açar; yerel özellikler (sitelerde video bulma, abonelik servisleri, yatay ekran, derin bağlantı, InMobi reklam modülü) |
| `site/personal/`, `site/apk/` | me.lenstedreal.info ve apk.lenstedreal.info |
| `deploy/` | Caddy (HTTPS, üç alan adı) + web derleme |
| `packages/localization/` | Ortak çeviri dosyası (tr, en, de) |
| `docs/` | Kurulum, yayın, mimari, eşitleme, reklamlar, abonelik servisleri |

## Alan adları (Caddy)

| Değişken | Varsayılan | Ne sunar |
|---|---|---|
| `DOMAIN` | — | web uygulaması + `/api` (WebSocket dahil) |
| `PERSONAL_DOMAIN` | `me.lenstedreal.info` | kişisel sayfa |
| `APK_DOMAIN` | `apk.lenstedreal.info` | indirme sayfası + dokunma sayacı (`/api/track`) |

## Otomasyon (GitHub Actions)

- **Deploy** (`deploy.yml`): `main`'e push → imajlar derlenir, sunucu indirip yeniden başlar. Canlı sürüm: `/version.txt`. Bkz. `docs/DEPLOY.md`.
- **Android** (`android.yml`): `apps/mobile/` değişince imzalı APK + AAB üretir; APK Releases'e (`latest`) konur, AAB işin "Artifacts" bölümündedir. InMobi kimlikleri depo değişkenlerinden okunur (`docs/ADS.md`).
- **Backend** (`backend.yml`): API testleri + Docker derleme.

Arayüz web'de olduğu için web'deki düzeltmeler uygulamaya yeni APK gerekmeden yansır; yalnızca `apps/mobile/` değişiklikleri yeni APK ister.

## Çalıştırma

```bash
cp .env.example .env              # MEDIA_SIGNING_SECRET: openssl rand -hex 32
docker compose up -d              # API: http://<sunucu>:8001/api/
DOMAIN=nexora.alanadin.com docker compose --profile tls up -d   # HTTPS
```

Yüklenen videolar `media-data` volume'unda tutulur ve en geç 7 günde silinir. Oracle Object Storage isteğe bağlıdır (`docs/STORAGE.md`).

## Testler

```bash
cd backend && pip install -r requirements-dev.txt
MEDIA_SIGNING_SECRET=dev uvicorn server:app --port 8001 &
NEXORA_API_URL=http://localhost:8001 pytest -q
cd apps/mobile && npm test        # eşitleme ve reklam kuralları (Node 22+)
```

## Belgeler

- `docs/DEPLOY.md`: sunucu, güncelleme, DNS, yedek
- `docs/RELEASE.md`: imzalı APK/AAB, Google Play kontrol listesi
- `docs/PLAYBACK-SYNC.md`: eşitleme protokolü
- `docs/ADS.md`: InMobi kurulumu (odada reklam yok)
- `docs/SERVICES.md`: Netflix, Disney+, Prime Video, HBO Max (beta)
- `docs/SECURITY.md`, `docs/STORAGE.md`, `docs/TESTING.md`, `docs/ARCHITECTURE.md`
