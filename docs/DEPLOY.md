# Sunucu kurulumu ve güncelleme (Oracle VM)

Mevcut kurulum: Oracle Cloud **zeppelin** (Ubuntu 24.04, 1 GB RAM + 2 GB swap), Docker Compose.

| Adres | Ne sunar |
|---|---|
| `https://nexora.lenstedreal.info` | Web uygulaması (tanıtım + web'de izleme + yasal sayfalar) ve `/api` (backend + WebSocket) |
| `https://me.lenstedreal.info` | Kişisel site (`site/personal/index.html`) |

## Güncelleme (her yeni sürümde)

`main` dalına push yeterli. Sunucuda komut çalıştırmak gerekmez:

1. GitHub Actions (`.github/workflows/deploy.yml`) iki imajı derler ve GHCR'a yükler:
   API (`nexora-watch-backend`) ve web + Caddy + kişisel site (`nexora-watch-web`).
2. Sunucu yalnızca bu imajları indirir ve servisleri yeniden başlatır (`deploy/server-update.sh`).
   1 GB'lık makinede artık derleme yapılmaz.
3. Yeni sürüm cevap vermezse iş kırmızıya döner ve sebebi GitHub'daki çalışma sayfasında yazar.

Canlıdaki sürüm: <https://nexora.lenstedreal.info/version.txt> (`<uygulama sürümü> <commit>`).

**Sunucuda `--build` çalıştırma.** Elle yeniden başlatmak gerekirse (imajlar zaten sunucudadır):
```bash
cd ~/Nexora-Watch
sudo docker compose --profile tls up -d --no-build
sudo docker compose ps
```

### Sorun giderme
| GitHub'daki hata | Ne yapmalı |
|---|---|
| Sunucuya SSH ile bağlanılamadı | `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` secret'larını kontrol et; sunucu açık mı? |
| Sunucudaki kopya ileri sarılamıyor | Sunucuda `cd ~/Nexora-Watch && git status`: değişmiş dosya varsa `git stash` ile kenara al, sonra işi GitHub'dan yeniden çalıştır. `.env` ve `docker-compose.override.yml` izlenmeyen dosyalardır, etkilenmez. |
| İmaj indirilemedi | Disk dolu olabilir: `df -h /` ve `sudo docker system df` |
| Yeni sürüm cevap vermiyor | Hata satırının üstündeki `docker compose logs` çıktısına bak; `.env` eksik ya da hatalı olabilir |
| Başka bir güncelleme hâlâ çalışıyor | Bitmesini bekle, sonra işi yeniden çalıştır |

## .env (sunucuda `~/Nexora-Watch/.env`)
```
MEDIA_SIGNING_SECRET=<64 karakter, bir kez üretildi — DEĞİŞTİRME>
CORS_ORIGINS=*
DOMAIN=nexora.lenstedreal.info
PERSONAL_DOMAIN=me.lenstedreal.info
```
Diğer ayarlar için kök dizindeki `.env.example` dosyasına bak.

## 1 GB RAM ayarı (`docker-compose.override.yml`, sadece sunucuda)
```yaml
services:
  mongo:
    command: ["--wiredTigerCacheSizeGB", "0.25"]
    mem_limit: 450m
  backend:
    mem_limit: 300m
    ports: !reset []
```

## DNS (Cloudflare → lenstedreal.info → DNS)
| Tür | Ad | Değer | Proxy |
|---|---|---|---|
| A | `nexora` | 158.101.173.231 | **DNS only (gri)** |
| A | `me` | 158.101.173.231 | **DNS only (gri)** |

`api`, `app`, `stream`, `backend` kayıtları başka projeye ait — dokunma.

## Oracle güvenlik
- Security List: TCP 80 ve 443 açık (WireGuard 51820/UDP ve 51821/TCP kuralları korunuyor).
- Sunucu içi iptables: 80/443 kuralları `netfilter-persistent save` ile kalıcı.

## Moderasyon: şikâyetleri okumak
```bash
cd ~/Nexora-Watch
sudo docker compose exec mongo mongosh nexora --quiet --eval 'db.reports.find({status:"open"}).sort({created_at:-1}).limit(20).forEach(printjson)'
# İncelendi olarak işaretle:
sudo docker compose exec mongo mongosh nexora --quiet --eval 'db.reports.updateMany({status:"open"},{$set:{status:"reviewed"}})'
# Bir odayı acilen kapatmak:
sudo docker compose exec mongo mongosh nexora --quiet --eval 'db.rooms.updateOne({code:"ABC234"},{$set:{status:"closed",closed_at:new Date()}})'
```

## Otomatik silme (backend her 10 dakikada çalıştırır)
- Kapanan/süresi dolan odaların videoları ~1 saat sonra, tüm videolar en geç 7 gün içinde silinir.
- Oda mesajları oda bittikten 24 saat sonra, şikâyetler 180 gün, işlem kayıtları 90 gün sonra silinir.
- Docker logları servis başına en fazla 30 MB tutulur.

## Disk ve yedek
```bash
df -h /                                  # disk
sudo docker system df                    # docker kullanımı
sudo docker compose exec mongo mongodump --db nexora --archive > ~/nexora-$(date +%F).archive   # veritabanı yedeği
```

## Otomatik deploy: tek seferlik kurulum

Akış yukarıda ("Güncelleme"). GHCR için ayar gerekmez: sunucu, işin kendi geçici anahtarıyla giriş yapar ve
iş bitince çıkış yapar. Gereken tek şey sunucuya SSH erişimi için üç secret:

```bash
# 1) Sunucuda (ubuntu@zeppelin): sadece deploy için ayrı bir anahtar
ssh-keygen -t ed25519 -N "" -C nexora-deploy -f ~/.ssh/nexora_deploy
cat ~/.ssh/nexora_deploy.pub >> ~/.ssh/authorized_keys

# 2) Termux'ta: anahtarı GitHub secret olarak kaydet (dosya telefona kopyalanmaz)
ssh -i ~/.ssh/oracle ubuntu@158.101.173.231 'cat ~/.ssh/nexora_deploy' | gh secret set DEPLOY_SSH_KEY -R LenstedReal/nexora-watch
gh secret set DEPLOY_HOST -R LenstedReal/nexora-watch -b 158.101.173.231
gh secret set DEPLOY_USER -R LenstedReal/nexora-watch -b ubuntu
```

Secret'lar yoksa imajlar yine derlenir, sunucu adımı uyarı verip atlanır.

Kurallar: sunucudaki kopya yalnızca ileri sarılır (`git merge --ff-only`); `git reset --hard` ve force push
kullanılmaz. `.env`, `docker-compose.override.yml` ve veri birimlerine dokunulmaz.

## Mobil uygulama mimarisi

Android/iOS uygulaması, web uygulamasının (`frontend/`) kendisini WebView içinde gösterir; ekranlar ve akış
web ile birebir aynıdır ve web güncellendiğinde uygulama da yeni APK gerekmeden güncellenir. Uygulamaya özel
parçalar (`apps/mobile/App.tsx`): sitelerde gezip video algılama (`BrowserModal`), yatay ekran, oda açıkken ekranın
kapanmaması, `/room/KOD` bağlantıları, Android geri tuşu, açılış animasyonu ve bağlantı hatası ekranı.
Web tarafında köprü: `frontend/src/lib/native.js`.
