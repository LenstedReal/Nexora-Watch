# Bildirimler (davet push'u) — kurulum

Nexora Watch hesap istemez. Uygulama/site rastgele bir cihaz kimliği tutar (`nx:dev`). İki cihaz aynı odada
en az 2 dakika birlikte kalınca sunucu bunu "birlikte izlediniz" olarak kaydeder (yalnızca iki cihaz görür,
90 gün sonra silinir). Odadan "Davet et" ile bu kişilere bildirim gönderilebilir. Bildirimler Firebase Cloud
Messaging (FCM HTTP v1) ile gider. Firebase kurulmadan her şey çalışır; yalnızca bildirim gitmez
(API `{"sent": false, "reason": "push_not_configured"}` döner).

## 1. Firebase projesi
1. https://console.firebase.google.com → **Proje ekle** (Analytics gerekmez).
2. **Android uygulaması ekle** → paket adı: `com.lenstedreal.nexorawatch`.
3. `google-services.json` dosyasını indir.

## 2. Uygulama (GitHub Actions)
1. Dosyayı base64 yap: `base64 -w0 google-services.json`
2. GitHub → Settings → Secrets and variables → Actions → **New repository secret**:
   ad `GOOGLE_SERVICES_JSON`, değer: base64 çıktısı.
3. `android.yml` bu secret varsa dosyayı `apps/mobile/google-services.json` olarak yazar; `app.config.js`
   dosya varsa `android.googleServicesFile` ekler. Secret yoksa uygulama yine derlenir, bildirim kapalı olur.
   Dosyayı depoya koyma (`.gitignore`'da).

## 3. Sunucu
1. Firebase → Proje ayarları → **Hizmet hesapları** → **Yeni özel anahtar oluştur** (JSON iner).
2. Sunucudaki `~/Nexora-Watch/.env` dosyasına, JSON dosyasının base64 hâli tek satır olarak girer:
   `FCM_SERVICE_ACCOUNT_B64=<base64>` (Termux'tan ssh ile; anahtar sohbete ya da depoya yazılmaz).
   Alternatif: `FCM_SERVICE_ACCOUNT_JSON=<dosya yolu>`.
3. Bir sonraki dağıtım (main'e push) backend'i bu ayarla yeniden başlatır. `PyJWT[crypto]` gerekli (RS256 imza).

## API
- `POST /api/devices {device_id, secret}` — cihazı kaydet (sonraki isteklerde `X-Nexora-Device` / `X-Nexora-Key`).
- `POST /api/devices/me/push {token, platform}` — FCM cihaz anahtarı (`getDevicePushTokenAsync`).
- `GET /api/devices/me/people` — en çok 30 kişi; `DELETE /api/devices/me/people/{id}` ya da hepsi.
- `POST /api/rooms/{kod}/invite {participant_id, token, to}` — saatte en çok 10 davet; yalnızca birlikte izlenen kişiye.
  Bildirim: başlık "Nexora Watch", metin "<takma ad> seni odasına çağırıyor", veri `{room, url: nexora://room/KOD}`.

## Henüz yapılmadı / doğrulanmadı
- Site ve uygulamada "Birlikte izlediklerin" bölümü ve "Bildirimlere izin ver" düğmesi (arayüz) bu turda yazılmadı.
- Uygulamada izin isteme, anahtarı gönderme ve bildirime dokununca odayı açma kodu yazılmadı (`expo-notifications` bağımlılığı ve eklentisi eklendi).
- Gerçek FCM gönderimi burada denenemedi (ağ ve Firebase projesi yok); testler sahte gönderici kullanır.
