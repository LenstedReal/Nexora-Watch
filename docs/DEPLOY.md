# Sunucu kurulumu ve güncelleme (Oracle VM)

Mevcut kurulum: Oracle Cloud **zeppelin** (Ubuntu 24.04, 1 GB RAM + 2 GB swap), Docker Compose.

| Adres | Ne sunar |
|---|---|
| `https://nexora.lenstedreal.info` | Web uygulaması (tanıtım + web'de izleme + yasal sayfalar) ve `/api` (backend + WebSocket) |
| `https://me.lenstedreal.info` | Kişisel site (`site/personal/index.html`) |

## Güncelleme (her yeni sürümde)
```bash
ssh -i ~/.ssh/oracle ubuntu@158.101.173.231
cd ~/Nexora-Watch
git pull
sudo docker compose --profile tls up -d --build
sudo docker compose ps
curl -s https://nexora.lenstedreal.info/api/config | head -c 300; echo
```
Web derlemesi (React) 1 GB RAM'de 5–12 dk sürebilir; swap sayesinde tamamlanır.

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
