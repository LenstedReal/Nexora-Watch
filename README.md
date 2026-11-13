# Nexora Watch

Arkadaşlarınla aynı videoyu **aynı anda** izlediğin, Rave benzeri senkron izleme uygulaması. Oda kurarsın, kodu paylaşırsın; YouTube, Vimeo, Twitch, Kick (canlı), Internet Archive, Dropbox, doğrudan MP4/M3U8 bağlantısı, Google Drive, web sayfasından algılanan video ya da telefonundan yüklediğin bir video herkeste aynı saniyede oynar. Yanında sohbet, emoji tepkileri ve katılımcı listesi var.

## Repo yapısı

| Klasör | İçerik |
|---|---|
| `backend/` | FastAPI + MongoDB API: odalar, WebSocket senkron, sohbet, parçalı video yükleme, Drive içe aktarma, moderasyon |
| `frontend/` | React web uygulaması — **web sitesi ve mobil uygulamanın arayüzü** (tek kod) |
| `apps/mobile/` | Expo (React Native) kabuk: web arayüzünü WebView'da açar + yerel özellikler (sitelerde video algılama, yatay ekran, ekranı açık tutma, derin bağlantı, geri tuşu, açılış animasyonu) |
| `site/personal/` | me.lenstedreal.info kişisel sayfa |
| `deploy/` | Caddy (HTTPS) + web derleme |
| `docs/` | Kurulum, yayın, mimari |

## Otomasyon (GitHub Actions)

- **Deploy server** (`deploy.yml`): `main`'e push → GitHub imajları derler, sunucu yalnızca indirip yeniden başlar (web, API, kişisel site). Canlı sürüm: `/version.txt`. Kurulum: `docs/DEPLOY.md`.
- **Android** (`android.yml`): `apps/mobile/` değişince imzalı APK + AAB üretir; APK'yı otomatik olarak GitHub Releases'e (latest) koyar.
- **Backend** (`backend.yml`): API testleri + Docker derleme.

Arayüz web'de olduğu için web'deki her düzeltme uygulamaya da yeni APK gerekmeden yansır.

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
npx expo start        # uygulama web arayüzünü (EXPO_PUBLIC_WEB_URL) WebView içinde açar; bkz. docs/DEPLOY.md
```

## Desteklenen kaynaklar

Resmî oynatıcılarla çalışan kaynaklar (sitelerin kendi oynatıcısı ve belgelenmiş JS API'leri):

- **YouTube** ve **Vimeo**: odada senkron (oynat, durdur, sar). Misafirlerin oynatıcıya dokunması kilitli.
- **Twitch**: kayıtlı yayın (`twitch.tv/videos/...`) senkron; canlı kanal (`twitch.tv/<kanal>`) herkeste canlı oynar, senkron kontrolü yoktur. Klipler eşitlenemediği için kabul edilmez. Twitch kuralları gereği oynatıcının üstüne hiçbir şey çizilmez (düğmeler yanda durur) ve oynatıcı en az 400×300 piksel olmalıdır; dik telefonda "yan çevir" notu çıkar.
- **Kick**: yalnızca canlı kanal (`kick.com/<kanal>`), Kick'in resmî gömme oynatıcısıyla herkeste canlı oynar; senkron kontrolü yoktur (Kick'in gömme oynatıcısının JavaScript arayüzü yok). Kayıtlı yayınlar ve klipler resmî olarak gömülemediği için kabul edilmez.
- **Internet Archive** sayfası (`archive.org/details/...`): öğenin resmî metadata API'sinden tarayıcıda oynayan video dosyası seçilir, kalıcı `archive.org/download/...` adresiyle eklenir.
- **Dropbox** paylaşım bağlantısı: `raw=1` ile dosyanın kendisi olarak açılır.
- **Dailymotion**: resmî oynatıcı Dailymotion Studio'da oluşturulan bir Player ID istiyor; bu kimlik olmadan eklenmedi.

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
- İlk açılışta yaş (16+, 18 yaş altı ebeveyn gözetimiyle) ve koşul onayı; mesaj/kişi bildirme, engelleme, host için odadan çıkarma
- Siteden algılama yalnızca desteklenen kamuya açık sitelerde; DRM/abonelik platformları engelli
- Google Drive: herkese açık dosya sunucuya içe aktarılır, tam senkron oynar
- Yatay mod / tam ekran ve yatayda yan sohbet paneli
- Otomatik silme (videolar en geç 7 gün), yasal sayfalar (Gizlilik, Koşullar, KVKK, Telif, Veri silme, Çocuk güvenliği)
- Gerçek anahtarla imzalı APK + AAB (GitHub Actions)
