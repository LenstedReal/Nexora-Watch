# ARCHITECTURE

```
apps/
  web-next-upstream/  Orijinal Next.js (Vercel) + audit düzeltmeleri (derlenmedi)
  android/            Kotlin/Compose/Media3 (orijinal + WS/token düzeltmeleri, derlenmedi)
  ios/                SwiftUI/AVPlayer (yeni, derlenmedi)
backend/              FastAPI + MongoDB — oda, playback, WS, yükleme, ölçüm (çalışıyor)
frontend/             React web istemcisi (çalışıyor, önizleme)
packages/localization/locales.json   12 dil, tüm platformlar ortak anahtar
docs/                 AUDIT, PLAYBACK-SYNC, STORAGE, SECURITY, TESTING
```

- Tek backend süreci; WS fan-out süreç içi (`hub.py`). Yatay ölçek için Mongo change streams veya Redis pub/sub gerekir.
- Video verisi asla WS'den geçmez; her cihaz kaynağı kendi bağlantısından oynatır.
- WebRTC/STUN P2P dosya aktarımı **uygulanmadı** (Aşama 8). Ücretli TURN eklenmedi.
