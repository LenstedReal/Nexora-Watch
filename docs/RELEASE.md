# Android sürüm yayınlama (APK + AAB, gerçek imza)

Uygulama: **Nexora Watch** · paket adı `com.lenstedreal.nexorawatch` · sürüm `apps/mobile/app.json → expo.version`.
`versionCode` her GitHub Actions derlemesinde otomatik artar (`110000 + çalıştırma numarası`).

## 1. Yükleme anahtarı (upload keystore) oluştur — BİR KEZ
Termux'ta:
```bash
pkg install openjdk-17 -y
cd ~
keytool -genkeypair -v -storetype PKCS12 \
  -keystore nexora-upload.keystore -alias nexora-upload \
  -keyalg RSA -keysize 2048 -validity 10000
```
- Şifreyi güçlü seç ve **bir yere yaz**. Ad-soyad vb. sorularına cevap ver (Ülke kodu: TR).
- Alias: `nexora-upload`. PKCS12'de anahtar şifresi = keystore şifresi.

**Yedekle (çok önemli — kaybedersen güncelleme yayınlayamazsın):**
```bash
mkdir -p ~/storage/downloads/nexora-yedek
cp ~/nexora-upload.keystore ~/storage/downloads/nexora-yedek/
```
Keystore'u ve şifresini şifre yöneticisine / güvenli bir yere de koy. GitHub reposuna ASLA ekleme.

## 2. GitHub Secrets
Base64'e çevir:
```bash
base64 -w0 ~/nexora-upload.keystore > ~/keystore.b64
cat ~/keystore.b64     # çıktıyı kopyala
```
GitHub → repo → **Settings → Secrets and variables → Actions → Secrets → New repository secret**:

| Ad | Değer |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `keystore.b64` içeriği |
| `ANDROID_KEYSTORE_PASSWORD` | keystore şifresi |
| `ANDROID_KEY_ALIAS` | `nexora-upload` |
| `ANDROID_KEY_PASSWORD` | keystore şifresi (aynı) |

**Variables** sekmesi:

| Ad | Değer |
|---|---|
| `NEXORA_API_URL` | `https://nexora.lenstedreal.info` |
| `NEXORA_WEB_URL` | `https://nexora.lenstedreal.info` |

Sonra `rm ~/keystore.b64`.

## 3. Derleme
Push sonrası **Actions → Android (APK + AAB)** otomatik çalışır (ya da **Run workflow**).
Çıktı: **Artifacts → nexora-watch-android** içinde `.apk` (telefona kurulum) ve `.aab` (Google Play).
"Verify signature" adımında sertifika sahibi olarak senin bilgilerin görünmeli (debug değil).

Etiketli sürüm: `git tag v1.1.0 && git push origin v1.1.0` → GitHub Release'e APK+AAB eklenir,
web sitesindeki "Android APK indir" butonu bunu gösterir.

> Not: Eski (debug imzalı) uygulama telefonda yüklüyse yeni sürümü kurmadan önce **kaldır** — imzalar farklı.

## 4. Google Play Console kontrol listesi
- [ ] Uygulama oluştur: ad "Nexora Watch", varsayılan dil Türkçe, Uygulama, Ücretsiz.
- [ ] **Play App Signing**: etkin (varsayılan). AAB'yi yükle, Google uygulama imzalama anahtarını yönetir; senin anahtarın "upload key".
- [ ] **Web sitesi**: `https://nexora.lenstedreal.info` · **Gizlilik politikası**: `https://lenstedreal.github.io/NexoraWatch/privacy-policy.html`
- [ ] **Veri silme**: `https://lenstedreal.github.io/NexoraWatch/delete-data.html` (hesap yok; bu sayfa yeterli)
- [ ] **Çocuk güvenliği standartları (CSAE)**: `https://lenstedreal.github.io/NexoraWatch/child-safety.html`, irtibat: contact.nexorawatch@protonmail.com
- [ ] **Hedef kitle**: 16+ (çocuklara yönelik değil; Play Console'da yalnızca "16-17" ve "18+" yaş gruplarını seç). 18 yaş altı için ebeveyn gözetimi şartı koşullarda yazıyor; uygulamada ilk açılışta yaş beyanı var.
- [ ] **İçerik derecelendirme anketi**: kullanıcılar arası etkileşim (sohbet) VAR, kullanıcı içeriği paylaşımı VAR, konum paylaşımı YOK.
- [ ] **Veri güvenliği formu** (özet):
  - Toplanan: *Uygulama etkinliği → diğer kullanıcı içeriği* (sohbet mesajları, rumuz), *Fotoğraf ve videolar* (yalnızca kullanıcı yüklediğinde), *Uygulama bilgileri ve performans* (senkron ölçümleri), *Cihaz veya diğer kimlikler* → yok.
  - Amaç: Uygulama işlevselliği, güvenlik/kötüye kullanımın önlenmesi. Paylaşım: yok (hizmet sağlayıcılar paylaşım sayılmaz).
  - Aktarım şifreli: Evet (HTTPS). Silme talebi: Evet (veri silme sayfası). Otomatik silme var.
- [ ] **Kullanıcı içeriği (UGC)**: koşullar kabulü (ilk açılış), içerik bildirme (mesaja uzun bas / kişi menüsü), kullanıcı engelleme, oda sahibinin çıkarma yetkisi, moderasyon süreci (docs/DEPLOY.md).
- [ ] **Reklam**: bu sürümde yok, "Hayır" işaretlenir. InMobi reklamı eklenen sürümde "Evet" yapılır; aynı sürümle Veri güvenliği formu ve gizlilik politikası güncellenir. **Uygulama erişimi**: giriş gerektirmez.
- [ ] Mağaza listesi: kısa açıklama, uzun açıklama, 512×512 ikon, 1024×500 öne çıkan görsel, en az 2 telefon ekran görüntüsü.
  - Not: "Better than Rave" ifadesini **mağaza metninde kullanma** (başka uygulama adını anmak Play meta veri politikasına takılabilir); uygulama içinde ve web sitende kalabilir.
- [ ] Önce **Dahili test** kanalına yükle, sonra kapalı test → üretim. Yeni kişisel geliştirici hesaplarında üretime çıkmadan önce kapalı testte belirli sayıda test kullanıcısı ve süre şartı olabilir; Play Console'daki güncel şartı kontrol et.
