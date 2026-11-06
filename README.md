# Nexora Watch

Arkadaşlarınla aynı videoyu **aynı anda** izlediğin, Rave benzeri senkron izleme uygulaması. Oda kurarsın, kodu paylaşırsın; YouTube, doğrudan MP4/M3U8 bağlantısı, Google Drive, web sayfasından algılanan video ya da telefonundan yüklediğin bir video herkeste aynı saniyede oynar. Yanında sohbet, emoji tepkileri ve katılımcı listesi var.

## Repo yapısı

| Klasör | İçerik |
|---|---|
| `backend/` | FastAPI + MongoDB API: odalar, WebSocket senkron, sohbet, parçalı video yükleme (yerel disk veya Oracle Object Storage) |
| `apps/mobile/` | **Yeni mobil uygulama** — Expo (React Native, TypeScript). Android ve iOS tek kod tabanı |
| `frontend/` | React web istemcisi (aynı API) |
| `docs/` | Mimari, senkron protokolü, depolama, güvenlik, test |
| `archive/` | Eski, derlenmeyen Kotlin / SwiftUI / Next.js kodları (yalnızca referans, kullanılmıyor) |

## APK'yı GitHub Actions'tan almak

1. Repo → **Settings → Secrets and variables → Actions → Variables** → `NEXORA_API_URL` değişkenini ekle (ör. `https://api.alanadin.com`). İsteğe bağlı: `NEXORA_WEB_URL` (davet linklerinde kullanılır).
2. `apps/mobile/` altında bir değişiklik push'la ya da **Actions → Android APK → Run workflow**.
3. Çalışma bitince (≈10–15 dk) ilgili run sayfasında **Artifacts → nexora-watch-apk** indir, zip'i aç, APK'yı telefona kur.
4. `v1.0.0` gibi bir tag push'larsan APK otomatik olarak GitHub Release'e de eklenir.

Notlar:
- APK debug anahtarıyla imzalanır: her telefona kurulur ama Google Play'e yüklenemez (Play için ayrı upload keystore gerekir).
- Eski Nexora APK'sı kuruluysa imza farklı olduğu için önce onu kaldır.
- `NEXORA_API_URL` boş bırakılırsa uygulama açılınca sunucu adresini sorar.

## Uygulama içi sunucu adresi
Varsayılan sunucu `https://nexora.lenstedreal.info` uygulamaya gömülüdür (GitHub değişkeni `NEXORA_API_URL` ile değiştirilebilir).
Test için ⚙️ Ayarlar → **Gelişmiş** altından geçici olarak başka bir sunucu girilebilir; normal kullanıcıların bunu değiştirmesi gerekmez.

## Backend'i çalıştırmak (Docker)

```bash
cp .env.example .env          # MEDIA_SIGNING_SECRET'i uzun rastgele bir değerle değiştir (openssl rand -hex 32)
docker compose up -d          # API: http://<sunucu>:8001/api/
```

HTTPS (Caddy otomatik sertifika alır; alan adının DNS kaydı sunucuya bakmalı, 80/443 açık olmalı):

```bash
DOMAIN=api.alanadin.com docker compose --profile tls up -d
```

Yüklenen videolar varsayılan olarak `media-data` volume'unda (yerel disk) tutulur. `.env` içine `OCI_*` değişkenlerinin beşi de girilirse Oracle Object Storage kullanılır (bkz. `docs/STORAGE.md`).

## Testler

Backend (MongoDB gerekir):

```bash
cd backend
pip install -r requirements-dev.txt
MEDIA_SIGNING_SECRET=dev uvicorn server:app --port 8001 &
NEXORA_API_URL=http://localhost:8001 pytest -q
```

Mobil senkron motoru (Node 22+):

```bash
cd apps/mobile && npm test
```

Her push'ta `.github/workflows/backend.yml` aynı testleri MongoDB servisiyle çalıştırır ve Docker imajını derler.

## Mobil geliştirme

```bash
cd apps/mobile
npm install
npx expo start        # Expo Go yerine development build önerilir (expo-video, WebView native modül)
```

## Web'den video algılama

Bir web sayfasının bağlantısını verdiğinde uygulama sayfayı kendi tarayıcısında açar, sayfadaki `<video>` öğelerini ve ağ isteklerindeki MP4/M3U8 adreslerini algılar; seçtiğin videoyu kaynak sayfa adresiyle (Referer) birlikte odaya gönderir. Backend `referer` ve `title` alanlarını kabul eder, doğrudan/HLS kaynaklarda bu başlığı `headers` olarak oyunculara iletir; böylece karşıdaki kişi de aynı videoyu senkron izler.

Sınırlar:
- DRM'li servisler (Netflix, Disney+, Prime vb.) ve `blob:` / MediaSource (MSE) ile parça parça oynatılan videolar paylaşılamaz; bunların herkese açık bir adresi yoktur.
- Oturum çerezi, imzalı/kısa ömürlü token veya IP kısıtlaması gerektiren bağlantılar diğer cihazlarda açılmayabilir.
- Referer kontrolü dışında özel başlık isteyen siteler desteklenmez.

## Oracle Cloud adımları

Ayrıca eklenecek.


## Dokümanlar
- [docs/DEPLOY.md](docs/DEPLOY.md): Oracle sunucusu, güncelleme komutları, DNS, moderasyon, yedek
- [docs/RELEASE.md](docs/RELEASE.md): keystore oluşturma, GitHub Secrets, imzalı APK/AAB, Google Play kontrol listesi
- [docs/PLAYBACK-SYNC.md](docs/PLAYBACK-SYNC.md): senkron protokolü

## Sürüm 1.1.0 özeti
- Diller: Türkçe, English, Deutsch (mobil + web)
- Mavi-pembe neon tema, açılış animasyonu, "Better than Rave"
- İlk açılışta yaş (13+) ve koşul onayı; mesaj/kişi bildirme, engelleme, host için odadan çıkarma
- Siteden algılama yalnızca desteklenen kamuya açık sitelerde; DRM/abonelik platformları engelli
- Google Drive: herkese açık dosya sunucuya içe aktarılır, tam senkron oynar
- Yatay mod / tam ekran ve yatayda yan sohbet paneli
- Otomatik silme (videolar en geç 7 gün), yasal sayfalar (Gizlilik, Koşullar, KVKK, Telif, Veri silme, Çocuk güvenliği)
- Gerçek anahtarla imzalı APK + AAB (GitHub Actions)
