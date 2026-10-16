# Nexora Watch — Teknik Denetim Raporu (Aşama 1)

Tarih: Haziran 2026 · İncelenen: `github.com/LenstedReal/Nexorass11` (HEAD `16d376d`) ve `github.com/LenstedReal/Nexora-Watch` (HEAD `0b094e0`).

## 1. İncelenenler / bulunamayanlar
| Öğe | Durum |
|---|---|
| Next.js 16 App Router web (`src/app`, `src/lib/nexora`) | İncelendi |
| API route'ları (`src/app/api/rooms/[...path]`, `upload`, `resolve`, `drive`, `media`) | İncelendi |
| WebSocket sunucusu (`api/ws.ts`, `src/lib/realtime.ts`) | İncelendi |
| Veritabanı (`src/lib/db.ts`, `migrations/0002-0004`) | İncelendi |
| Android (`android/`, Kotlin + Compose + Media3, `7.6.1 / 70601`) | İncelendi (yalnızca Nexorass11'de var) |
| `grok-workspace-5..10`, `NexoraWatch-Grok-9-7.6.1-debug.apk`, `grok-prompt-unity.md` | **Depolarda yok** — incelenmedi. `attachments/Nexora-Watch1-grok-audit.tar.gz` açılmadı. |
| iOS kodu | **Yok** (sıfırdan yazıldı, bkz. `apps/ios`) |
| Unity | **Yok** |

İki depo arasındaki fark: Nexorass11 = Nexora-Watch + `android/` + bağlantı durumu/haptik UI (son commit). Backend kodu aynı.

## 2. Mevcut mimari (gerçekte olan)
- Web + API: Next.js (Vercel), `pg` ile Neon Postgres; **`DATABASE_URL` yoksa süreç içi PGLite (WASM, bellekte)**.
- Oda: `nexora_rooms` tek satır; `participants`, `video`, `playback` JSONB sütunları. Mesajlar `nexora_messages`.
- Gerçek zaman: `api/ws.ts` bir `ws` sunucusu oluşturuyor ama **`listen()` çağrılmıyor**; Vercel serverless fonksiyonları kalıcı WebSocket tutamaz. Web istemcisi bu yüzden pratikte **1 sn aralıklı polling** (oda + mesaj = istemci başına 2 istek/sn) ile çalışıyor.
- Yükleme: `/api/upload` dosyanın **tamamını formData ile API'den geçiriyor**, `BLOB_READ_WRITE_TOKEN` varsa Vercel Blob (`access: "public"`), yoksa `/tmp`.

## 3. Sıralı hata listesi (kanıtlı)
| # | Önem | Sorun | Kanıt |
|---|---|---|---|
| 1 | KRİTİK | Oda kaybı: `DATABASE_URL` yoksa her serverless örneği kendi bellek içi PGLite'ını kullanır; soğuk başlatma/farklı örnek = "Oda bulunamadı". | `src/lib/db.ts` `dbSource = databaseUrl ? "neon" : "pglite"`, `new PGlite()` (in-memory) |
| 2 | KRİTİK | Kayıp güncelleme: `joinRoom/leaveRoom` tüm `participants` dizisini okuyup geri yazıyor; eşzamanlı katılımda biri diğerini siliyor. | `server.ts` `updateParticipants()` |
| 3 | YÜKSEK | Playback'te revision/sıra yok; geç gelen eski komut yeni durumu ezer. Host her 1 sn HTTP PUT yazıyor. | `setPlayback()`, `room/[code]/page.tsx` heartbeat `setInterval(...,1000)` |
| 4 | YÜKSEK | WebSocket üretimde çalışmıyor (listen yok + Vercel). `broadcastRealtime` route handler'dan çağrılsa da peer haritası başka süreçte. | `api/ws.ts`, `src/lib/realtime.ts` |
| 5 | YÜKSEK | Yeniden bağlanma: sabit 2,5 sn, sınırsız, backoff/jitter yok; yeniden bağlanınca state yenilenmiyor. Android'de de aynı. | `use-room.ts`, `NexoraWebSocket.kt scheduleReconnect()` |
| 6 | YÜKSEK | Yetki: tüm host işlemleri yalnızca `participant_id` ile; id oda yanıtında herkese açık → herhangi bir katılımcı host id'siyle playback/video değiştirebilir. | `participantForRoom()` sadece id kontrolü; `GET /api/rooms/{code}` participants listesi |
| 7 | YÜKSEK | Yükleme: 2 GB'a kadar dosya API belleğinden geçiyor (Vercel gövde sınırı ~4,5 MB → büyük dosyalar başarısız), Blob `public` (tahmin edilebilir URL = yetki), kota/temizlik/audit yok. | `api/upload/route.ts`, `media-store.ts` |
| 8 | ORTA | Okuma yolunda silme: süresi dolan oda `loadRoom` içinde mesajlarıyla siliniyor. | `loadRoom()` → `deleteRoom()` |
| 9 | ORTA | `api/ws.ts` TS hatası: `RealtimePeer` tipi import edilmemiş. | `sendRealtime(peer: RealtimePeer, ...)` |
| 10 | ORTA | Buffering ayrımı web'de HTML video için yok: host `pause` olayları ile buffering ayrılmıyor; YouTube'da kısmen var. | `page.tsx` publish(play/pause/seeked) |
| 11 | DÜŞÜK | Android WS/API adresi Vercel'e sabit kodlu. | `NexoraRepository.DEFAULT_BASE_URL` |

Doğrulanmamış: gerçek Vercel ortam değişkenleri (Neon bağlı mı?), APK davranışı, iki fiziksel cihaz senkron değerleri.

## 4. Yapılanlar
### 4.1 Çalışan önizleme (bu ortam) — `backend/` FastAPI + MongoDB, `frontend/` React
API sözleşmesi korunarak (aynı yollar, `playing/position/updated_at` alanları) güvenilir bir referans backend yazıldı:
- Ayrı koleksiyonlar: `rooms`, `room_playback` (revision + last_seq), `room_participants` (token_hash), `room_messages` (client_id ile idempotent), `media`, `audit_log`, `sync_metrics`, `usage`.
- Atomik `find_one_and_update` ile playback; eski `seq` veya eski `media_id` komutu reddedilir (`applied:false`).
- Katılımcı sırrı (token): oluştur/katıl yanıtında verilir, sha256 olarak saklanır; host işlemleri ve WS bağlantısı token ister.
- Bağlantı kopması odayı silmez; süresi dolan oda `status=expired` olur (veri hemen silinmez), bakım döngüsü 24 saat sonra mesajları temizler.
- WS `/api/ws`: hello (tam state), ping/pong (saat farkı), playback, message, reaction, buffering; aynı katılımcının ikinci soketi eskisini kapatır (4000). Kapanış kodları 4404/4410/4403.
- Web istemcisi: backoff+jitter, 6 deneme, sonra "Yeniden dene"; yeniden bağlanmada `GET /api/rooms/{code}`; görünürlük/online olaylarında kontrollü yenileme; 25 sn pong yoksa ölü soket kapatılır.
- Senkron: sunucu saati (min-RTT örneği), buffering ≠ pause, >2 sn seek (3 sn cooldown), HTML video'da 0,25–2 sn arası ±%5 hız düzeltmesi, YouTube'da hız düzeltmesi yok. Host olay bazlı yayınlar; 1 sn yerel kontrol, yalnızca uyumsuzlukta veya 20 sn keepalive'da yazar.
- Ölçüm: istemciler 2 sn'de bir sapma örneği, komut gecikmesi, buffering süresi, düzeltme ve yeniden bağlantı sayısı gönderir; `GET /api/rooms/{code}/metrics/summary` ortalama/maks sapma ve >2 sn olay sayısını verir (Sync paneli → "Ölçüm raporu").
- Yükleme: init → parça URL'leri → doğrudan parça PUT → complete (parça sayısı + toplam bayt doğrulaması) → abort; fingerprint ile devam ettirme ve tekrar yüklemeyi önleme; kota (global/katılımcı/dosya), aylık OCI istek sayacı, 24 saatte yarım yüklemeleri temizleme, audit log, süreli imzalı medya URL'leri, Range 206 akışı.

### 4.2 Upstream Next.js düzeltmeleri — `apps/web-next-upstream/` (**DERLENMEDİ / TEST EDİLMEDİ**)
- `migrations/0005_nexora_playback_revision.sql` (yalnızca ekleme).
- `server.ts`: playback seq/revision koruması, atomik participant upsert, okuma yolunda silme kaldırıldı.
- `use-room.ts`: backoff + jitter, 6 deneme, açılışta oda yenileme.
- Kalan: leave/presence hâlâ dizi yazıyor; 1 sn polling; WS Vercel'de çalışmıyor → çözüm: realtime'ı bu FastAPI servisine (veya Oracle VM'e) taşımak.

### 4.3 Android — `apps/android/` (**DERLENMEDİ**: bu ortamda Gradle/SDK yok)
- `NexoraWebSocket.kt`: backoff+jitter, 6 deneme → `FAILED`, `ROOM_GONE`, `retryNow()`, token, `seq`/`media_id`/`sent_at`, chat `client_id`.
- `SessionStore` token saklama, `HomeViewModel`/`RoomViewModel` token geçirme, OkHttp interceptor `X-Participant-Token`.
- API adresi `BuildConfig.NEXORA_API_BASE_URL` (`-PnexoraApi=` ile). Sürüm `7.6.2 / 70602`, paket kimliği korunarak.

### 4.4 iOS — `apps/ios/` (**DERLENMEDİ**: Xcode yok) — SwiftUI + AVPlayer + URLSessionWebSocketTask, XcodeGen `project.yml`, `SyncMathTests`.

## 5. Unity kararı
Unity şu an **önerilmiyor**. Gerekçe: resmî YouTube oynatıcısı Unity içinde desteklenmiyor (WebView eklentisi gerekir), Media3/AVPlayer PiP, erişilebilirlik ve arka plan davranışlarını yeniden uygulamak gerekir, APK boyutu tipik olarak +40–80 MB artar. Ölçüm yapılmadı (Unity projesi yok). 3D sinema odası istenirse ayrı bir "Unity as a Library" katmanı olarak prototiplenip aynı senaryolarla ölçülmeli.

## 6. Geri alma
- Önizleme: Emergent "Rollback". Upstream: tüm değişiklikler `apps/` altında kopya; orijinal depo dokunulmadı. Migration 0005 yalnızca sütun ekler, eski kod bunları yok sayar.
