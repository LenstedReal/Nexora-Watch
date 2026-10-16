# Nexora Watch — PRD

## Problem statement
Rave-benzeri senkron video izleme platformu. Monorepo: Web (React), Android (Kotlin/Compose), iOS (SwiftUI).
Üç istemci de **aynı API sözleşmesini** kullanır (`/api/rooms`, `/api/ws`, `/api/uploads/*`, `/api/media/*`).
Öncelikler: oda kaybı olmaması, kusursuz oynatma senkronu, WebSocket dayanıklılığı, güvenli video yükleme (Oracle Cloud hedef), temiz tasarım.

## Stack (preview ortamı)
- Backend: FastAPI + MongoDB (`/app/backend`), WebSocket hub, multipart upload (geçici: Emergent Object Storage; OCI anahtarları gelince `OciDriver` otomatik devreye girer).
- Frontend: React + custom CSS (`/app/frontend`).
- Mobil: `/app/apps/android`, `/app/apps/ios` (bu ortamda derlenemez, mantık yazıldı).
- Orijinal Next.js kodu: `/app/apps/web-next-upstream` (korunuyor).

## Yapılanlar
### 2026-06 (önceki oturum)
- FastAPI mock backend, WS hub, upload/stream, resolver (YouTube/Drive/MP4/M3U8), docs/*.md.
### 2026-06-16 (bu oturum) — web yeniden tasarım + oynatma düzeltmeleri
- **Oynatma:** `HtmlPlayer` yeniden yazıldı; buffering göstergesi artık `readyState` tabanlı 250ms poll (asla takılı kalmaz), StrictMode temizlik hatası yakalanıyor, network/URL hatasında bir kez taze URL ile yeniden deneme.
- **Misafir autoplay:** sesli dene → sessiz autoplay'e düş ("Ses için dokun") → en son "Senkrona katılmak için dokun".
- **Host pause** artık buffering sırasında da yayınlanıyor.
- **Backend stream:** 16 MB Range limiti kaldırıldı, part cache 24.
- **Tasarım (Rave tarzı):** üst bar (durum noktası, Invite, menü: Çık/Odayı kapat), video sahnesi (ortalanmış, tam ekran butonu kaldırıldı), mobilde Chat/Kişiler/Video sekmeleri + okunmamış rozeti, masaüstünde sağ kolon (avatar şeridi + sohbet). Sohbet balonları + renkli avatarlar, emoji satırı doğrudan mesaj gönderiyor.
- Kaldırılan gereksiz detaylar: Sync HUD, depolama kullanım satırı ("Oracle anahtarı bekleniyor"), tam ekran.
- Upload state `useUpload` hook'una taşındı (sekme değişince yükleme kesilmez).
- i18n: 12 dile yeni anahtarlar eklendi (`tap_sound`, `people`, `now_playing`, `host_empty`, `host_paused`, ...).
- Doğrulama: WebM upload → host play → misafir 0.25 s içinde senkron; emoji chat'e düşüyor (headless Chromium H.264 desteklemediği için MP4 burada test edilemez; sunucu Range yanıtları curl ile doğrulandı).

## Kullanıcıdan beklenenler
- Oracle Cloud Object Storage: `OCI_S3_ENDPOINT`, `OCI_REGION`, `OCI_ACCESS_KEY`, `OCI_SECRET_KEY`, `OCI_BUCKET` (backend/.env).
- FCM push için Firebase service account (Phase 8).
- Mağaza için uygulama adı/ikon/paket adı onayı.

## Backlog
- P0: Kullanıcının gerçek cihazında MP4 oynatma doğrulaması (HEVC/iPhone videoları için codec uyarısı).
- P1: Android/iOS UI'yi yeni web tasarımına hizalama (aynı endpoint'ler).
- P1: Davet linki paylaşım sayfası, geç katılan host konumundan başlar (zaten expectedPosition ile var).
- P2: Host video kuyruğu, FCM push, AI hata asistanı.
