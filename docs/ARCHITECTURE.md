# ARCHITECTURE

```
backend/              FastAPI + MongoDB — oda, playback, WS, yükleme, ölçüm (Docker + docker-compose)
apps/mobile/          Expo (React Native, TypeScript) — Android + iOS tek kod tabanı; APK GitHub Actions'ta üretilir
frontend/             React web istemcisi (aynı API)
packages/localization/locales.json   12 dil, ortak anahtarlar
archive/              Eski Kotlin (android-legacy), SwiftUI (ios-legacy), Next.js (web-next-legacy) — kullanılmıyor
deploy/Caddyfile      İsteğe bağlı HTTPS ters vekil
docs/                 AUDIT, PLAYBACK-SYNC, STORAGE, SECURITY, TESTING
```

- Tek backend süreci; WS fan-out süreç içi (`hub.py`). Yatay ölçek için Redis pub/sub veya Mongo change streams gerekir.
- Video verisi asla WS'den geçmez; her cihaz kaynağı kendi bağlantısından oynatır.
- Mobil senkron motoru (`apps/mobile/src/core/sync.ts`) saf TypeScript'tir ve birim testlidir; web istemcisiyle paylaşılmak üzere tasarlandı.
- Web'den video algılama: istemci sayfadaki video adresini bulur, `PUT /api/rooms/{code}/video` gövdesinde `url` + isteğe bağlı `referer` / `title` gönderir; doğrudan/HLS kaynaklarda `video.headers = {"Referer": ...}` döner.
- Eski Emergent depolama sürücüsü kaldırıldı; varsayılan yerel disk (`MEDIA_DIR`), Oracle Object Storage isteğe bağlı.
- Güvenlik değişiklikleri: `/api/media/{id}/stream` imzası tüm sürücülerde zorunlu; `GET /api/rooms/{code}/metrics/summary` katılımcı kimliği (`participant_id` + `token`) ister; rate limit istemci IP'sini uvicorn `--proxy-headers` üzerinden alır (X-Forwarded-For'a doğrudan güvenilmez).
- WebRTC sesli sohbet / P2P **uygulanmadı**.
