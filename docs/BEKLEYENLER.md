# Bekleyen işler

Bir dış nedenle şimdilik yapılamayan işler. Engel kalkınca buradan devam edilir.

## Dailymotion kaynağı (beklemede)

**Durum (13 Kasım 2026):** Dailymotion, Türkiye'den yeni hesap açılmasına izin vermiyor ("ülkenizde yeni hesap
oluşturma kullanılamıyor", geçici olduğu söyleniyor). Hesap olmadan Player ID alınamıyor, bu yüzden Dailymotion
eklenmedi. Uygulamada ve sitede Dailymotion hiçbir yerde geçmiyor; kullanıcıya yarım bir özellik gösterilmiyor.

**Neden Player ID gerekiyor:** Dailymotion'ın resmî oynatıcısı (Player Web SDK) yalnızca bir Player ID ile
yükleniyor. Oynat, durdur, ileri sar ve konum okuma bu SDK ile yapılıyor; eşitleme bunlarla kurulabiliyor. Resmî
yol dışında bir oynatıcı kullanılmayacak.

**Engel kalkınca yapılacaklar:**

1. dailymotion.com'da hesap aç (masaüstü sitesi), Studio → Players → Create player, adı `Nexora`, ayarlara dokunma.
2. Listede `x` ile başlayan kısa kodu al (ör. `x8k2m9p`). Gizli değil, düz yazılabilir.
3. Kod tarafı:
   - `backend/resolver.py`: `dailymotion.com/video/<id>` ve `dai.ly/<id>` bağlantılarını `kind: "dailymotion"`,
     `capabilities: {seek: true, rate_correction: false, sync: true}` olarak çöz; canlı yayınları ve oynatma
     listelerini `no_sync_source` ile reddet.
   - `frontend/src/components/player/`: `DailymotionPlayer.jsx` (SDK: `https://geo.dailymotion.com/libs/player/<PLAYER_ID>.js`,
     `play` / `pause` / `seek` / `getState`), `Stage.jsx` içinde sağlayıcı çubuğu ile göster.
   - Player ID ortam değişkeninden gelsin (`DAILYMOTION_PLAYER_ID`), `/api/config` ile istemciye geçsin; boşsa
     Dailymotion kapalı kalsın.
   - `backend/config.py` varsayılan site listesine `dailymotion.com|Dailymotion` eklensin (ID varsa).
   - Testler: çözümleyici testi, sahte SDK ile ev sahibi/misafir eşitleme testi (Twitch/Facebook testleri gibi).
4. Gizlilik politikası: video sağlayıcıları listesine Dailymotion eklenir (TR + EN) ve GitHub'daki
   `NexoraWatch/` kopyaları yeniden üretilir.

## InMobi (sırada, birlikte yapılacak)

Ayrıntılar `docs/ADS.md` içinde. Gerekenler:

- InMobi panelinde `com.lenstedreal.nexorawatch` uygulaması, `home_banner` ve `room_exit` yerleşimleri.
- GitHub depo değişkenleri: `INMOBI_ACCOUNT_ID`, `INMOBI_BANNER_ID`, `INMOBI_INTERSTITIAL_ID`.
- InMobi'nin verdiği app-ads.txt satırı → `site/personal/app-ads.txt` (me.lenstedreal.info kökü).
- Odada ve video izlerken reklam yok; yalnızca oda dışındaki ekranlarda, kişiselleştirilmemiş.
