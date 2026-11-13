# Abonelik servisleri uygulamada (Beta)

Netflix, Disney+, Prime Video ve HBO Max (Max) **yalnızca Nexora mobil uygulamasında**, herkesin **kendi hesabıyla**
izlenir. Nexora görüntüye dokunmaz; sadece oynat / durdur / sar komutlarını odadaki kişiler arasında eşitler
(kumanda gibi). Web sitesinde bu bağlantılar için "Bu servis yalnızca uygulamada" kartı görünür.

## Nasıl çalışır

1. Oda sahibi servisin izleme bağlantısını yapıştırır (ör. `https://www.netflix.com/watch/80100172`).
   `backend/services.py` bağlantıyı tanır ve `kind: "service"` döner: `service` (`netflix` / `disney` / `prime` / `max`),
   düzgün `url`, başlık olarak servisin adı ve `capabilities {sync: true, app_only: true}`.
   Servisin sitesine hiçbir istek atılmaz (sayfa okunmaz, başlık çekilmez).
2. Web uygulaması oynatıcı yerine `ServiceCard` gösterir (`frontend/src/components/player/ServiceCard.jsx`):
   servis harfi ve rengi, "Beta" etiketi, "Bu içerik yalnızca Nexora uygulamasında, kendi … hesabınla izlenir."
   Bu sitelerin hiçbiri iframe içinde açılmaz.
3. Uygulamada (`caps` içinde `service_player` varsa) **Uygulamada aç** düğmesi `service_open` mesajı gönderir.
   `App.tsx` yalnızca o servisin kendi https adresini kabul eder (`serviceUrlOk`) ve `ServicePlayer` açılır
   (`apps/mobile/src/screens/ServicePlayer.tsx`): servisin kendi sayfası bir WebView'da, uygulamanın ortak çerez
   deposuyla (kişi bir kez giriş yapar, sonra girişli kalır), masaüstü tarayıcı kimliğiyle (servisler telefon
   tarayıcısını kendi uygulamalarına yönlendiriyor).
4. Sayfaya bir kontrol betiği eklenir (`apps/mobile/src/core/serviceController.ts`, `CONTROLLER_SRC`):
   - sayfanın ana `<video>` öğesini bulur (MutationObserver, servisler oynatıcıyı sonradan kurar),
   - `{playing, position, duration}` bilgisini play / pause / seeked anında ve timeupdate ile en çok saniyede bir bildirir,
   - odadan gelen `play`, `pause`, `seek(t)` komutlarını uygular,
   - misafirde sapma düzeltmesi: fark 1,5 sn'den büyükse sarar, küçükse dokunmaz,
   - misafir kilidi: misafirin sayfada kendi bastığı oynat/durdur/sar geri alınır, oda sahibinin durumuna dönülür,
   - Netflix: `video.currentTime` ile sarmak Netflix oynatıcısını bozar; bu yüzden sayfanın kendi oynatıcı API'si
     kullanılır (`netflix.appContext.state.playerApp.getAPI().videoPlayer` → oturum → `seek(ms)` / `play()` / `pause()`).
     Diğer servislerde video öğesi kullanılır.
5. Bildirimler `window.__nexoraService(...)` ile odaya (ServiceCard) gider. ServiceCard, `usePlaybackSync` için normal
   bir oynatıcı gibi davranır: oda sahibinin hareketleri odaya yayınlanır, misafirler `follow` komutlarıyla takip eder.
6. Oda sohbetine dönmek için **Odaya dön** düğmesi sayfayı köşede küçük bir kutuya alır (oynamaya devam eder);
   kutuya dokununca tekrar büyür. Çarpı ya da Android geri tuşu servis sayfasını kapatır.

## Ne yapılmaz

- Akışa erişilmez: görüntü/ses okunmaz, kopyalanmaz, kaydedilmez, indirilmez, proxy'lenmez, adresi çıkarılmaz.
- DRM'e dokunulmaz; DRM'li oynatmayı servisin sayfası ve telefonun WebView'u kendisi yapar.
- Kimsenin hesabı paylaşılmaz; Nexora şifre ya da çerez görmez, sunucuya göndermez.
- Web sitesinde bu servisler oynatılmaz.

## Bilinen riskler

- **Servis kuralları:** servislerin kullanım şartları otomasyonu ve kendi uygulamaları dışındaki oynatmayı kısıtlayabilir.
  Hukuki değerlendirme yapılmadı.
- **Google Play incelemesi:** başka servislerin sayfasını uygulama içinde açıp kontrol etmek inceleme ya da marka
  şikâyeti sebebi olabilir. Servis adları ve renkleri yalnızca tanıtım için; resmî logo kullanılmıyor.
- **Sayfa değişiklikleri:** servisler sayfalarını ya da Netflix'in oynatıcı API'sini değiştirirse eşitleme bozulabilir
  ("video bulunamadı" uyarısı çıkar).
- **DRM / cihaz:** bazı servisler WebView'da oynatmayı ya da yüksek kaliteyi engelleyebilir (Widevine seviyesi,
  tarayıcı kimliği kontrolü).

## Test edilenler ve edilemeyenler

- Test edildi: bağlantı tanıma (`backend/tests/test_services.py`), kontrol betiği (Node birim testleri ve Chromium'da
  sahte bir video sayfası ile sahte bir "netflix" API'si: oynat/durdur/sar/sapma/kilit/bildirim), ServiceCard (web ve
  sahte uygulama köprüsüyle uçtan uca), mobil dosyaların derlenmesi.
- Test edilemedi: gerçek servisler (giriş, DRM, gerçek sayfalar), gerçek telefonlar, Play incelemesi.

## Kapatma

- Sunucu: `SERVICES_ENABLED=0` (`backend/config.py`). Bu servislerin bağlantıları yine diğer abonelik platformları gibi
  engellenir (`drm_not_allowed`); `/api/config` içinde `services_enabled: false` döner. Odada o an açık olan bir servis
  videosu kartta kalır; oda sahibi başka video seçince kalkar.
- Uygulama: `App.tsx` içindeki `caps` listesinden `"service_player"` çıkarılırsa web kartı "uygulamanın yeni sürümü
  gerekiyor" der ve servis sayfası açılmaz. Uygulamanın `FALLBACK_CONFIG`'i (sunucuya ulaşılamazken) bu özelliği açmaz;
  servis videosu zaten yalnızca sunucu izin verdiğinde odaya eklenebilir.
