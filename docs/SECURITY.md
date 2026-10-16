# SECURITY

- Katılımcı token'ı: 256-bit rastgele, yalnız sha256 hash saklanır; host yetkisi sunucuda `role` alanından, istemcinin `isHost` iddiası kullanılmaz.
- Token REST gövdesinde `token` veya `X-Participant-Token` başlığıyla; WS'de query param (TLS üzerinden). Loglara yazılmaz.
- Medya: süreli HMAC imzalı (`MEDIA_SIGNING_SECRET`) okuma URL'leri (6 saat) yalnızca odadaki katılımcıya verilir; OCI'de ön-imzalı GET. Bucket private.
- Yükleme yalnız host; silme yalnız sahip veya host; tüm yükleme/silme olayları `audit_log`.
- SSRF koruması: `/api/resolve` özel/loopback/link-local IP'leri ve her yönlendirmeyi engeller.
- Rate limit: IP başına 120 yazma/dk; WS 40 kare/sn, sohbet 8/5 sn.
- Secret'lar yalnız `backend/.env`; APK/IPA/JS paketinde OCI anahtarı yok.
- Bilinen eksik: hesap sistemi yok (oda bazlı kimlik); WS token'ı URL'de (proxy loglarına düşebilir) — kısa ömürlü WS bileti ileride.
