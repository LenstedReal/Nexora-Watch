# TESTING

## Otomatik (bu ortamda çalıştırıldı)
- `tests/upload_smoke.py <API> tests/sample.mp4` — multipart yükleme, Range 206, bayt eşleşmesi, yetkisiz silme/yükleme 403, kota 413, format 415.
- Backend smoke (oda/rejoin/host-only/stale seq/WS hello-pong-push/kötü token/oda kalıcılığı) — sonuçlar `test_reports/`.

## İki fiziksel telefon prosedürü (YAPILMADI — kullanıcı yapmalı)
1. Telefon A: oda kur, MP4 bağlantısı ayarla. Telefon B: davet bağlantısıyla katıl.
2. Sync panelini (Activity simgesi) iki cihazda aç.
3. Play → 30 sn bekle → Pause → ileri sar 60 sn → geri sar → video değiştir.
4. B'nin Wi-Fi'ını 20 sn kapat/aç; uygulamayı arka plana alıp 30 sn sonra dön.
5. B ağ hızını düşür (geliştirici ayarı / hücresel).
6. "Ölçüm raporu" → `avg/max/>2s/latency` değerlerini kaydet; ham veri `GET /api/rooms/{code}/metrics/summary`.

Kabul: oda ve playback state'i her adımdan sonra korunmalı; >2 sn olaylar raporlanmalı.

## Platform build'leri
- Android: `cd apps/android && ./gradlew assembleDebug testDebugUnitTest -PnexoraApi=https://...` (bu ortamda **çalıştırılamadı**).
- iOS: `cd apps/ios && xcodegen && xcodebuild -scheme NexoraWatch -destination 'platform=iOS Simulator,name=iPhone 15' test` (**çalıştırılamadı**).
