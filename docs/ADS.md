# Reklamlar (InMobi, yalnızca Android uygulaması)

Yalnızca InMobi kullanılır (AdMob yok). Kurallar `apps/mobile/src/core/ads.ts` içindedir ve
`apps/mobile/src/core/ads.test.ts` ile test edilir:

- Oda ekranında (`/room/...`) hiçbir zaman reklam yok.
- Banner yalnızca ana sayfada (`/`), en altta, gezinme çubuğunun üstünde; WebView banner yüksekliği kadar daraltılır.
- Geçiş reklamı yalnızca odadan ana sayfaya dönüldüğünde, en fazla 3 dakikada bir; uygulama açılışında,
  arka plandan dönüşte (ilk 5 sn) ve bir sonraki sayfa oda ise asla.
- Kimliklerden biri boşsa reklamla ilgili her şey sessizce kapalıdır, AD_ID izni de eklenmez.

## Kimlikler nereye girilir (yer tutucular)

GitHub → Settings → Secrets and variables → Actions → **Variables** (secret değil, variable):

| Değişken | Ne | Nereden |
|---|---|---|
| `INMOBI_ACCOUNT_ID` | InMobi hesap kimliği (Account ID) | InMobi panel → hesap |
| `INMOBI_BANNER_ID` | Banner placement ID (yalnız rakam) | InMobi panel → uygulama → placement (Banner 320x50) |
| `INMOBI_INTERSTITIAL_ID` | Interstitial placement ID (yalnız rakam) | InMobi panel → placement (Interstitial) |

Akış: `vars.*` → `.github/workflows/android.yml` (`EXPO_PUBLIC_INMOBI_*`) → `apps/mobile/app.config.js`
(`extra.inmobi`) → `App.tsx` (`AD_IDS`). Kodda kimlik yazılmaz.

İlk derlemelerde InMobi panelinde test modunu açın (Integration sekmesi / test cihazı); canlıya geçmeden kapatın.

## app-ads.txt

Adres: `https://nexora.lenstedreal.info/app-ads.txt` (sitenin kökünde, düz metin). Play Console'daki
geliştirici web sitesi bu alan adı olmalıdır. Satır biçimi (IAB):

```
inmobi.com, <INMOBI_ACCOUNT_ID>, DIRECT, 83e75a7ae333ca9d
```

Son alan InMobi'nin sertifika kimliğidir; InMobi panelinde gösterilen satırla karşılaştırın ve paneldeki satırı esas alın
(bu belge yazılırken InMobi sayfasından doğrulanamadı).

## Play Console

- Uygulama içeriği → Reklamlar: **Evet, reklam içeriyor**.
- Reklam kimliği beyanı: **Evet** (reklam için kullanılıyor).
- Veri güvenliği: "Cihaz veya diğer kimlikler" (reklam kimliği) ve "Uygulama etkinliği / tanılama" — üçüncü tarafla
  (InMobi) paylaşılıyor, amaç: reklam; aktarımda şifreli.
- Hedef kitle: 16+ (çocuklara yönelik değil).

## Gizlilik ve onay

Şu an onay aracı (CMP) yoktur; uygulama InMobi'ye `gdpr_consent_available: false, gdpr: "1"` gönderir ve
`setIsAgeRestricted(true)` ile cihaz kimliği gönderilmez → yalnızca kişiselleştirilmemiş reklam.
AB/AEA kullanıcılarına kişiselleştirilmiş reklam gösterilecekse Google sertifikalı, IAB TCF 2.2 uyumlu bir CMP gerekir;
SDK 10.7.5+ TCF dizgesini kendisi okur.

Gizlilik politikasına eklenecek metin:

> Nexora Watch Android uygulaması, ana sayfada ve odadan çıkarken reklam göstermek için InMobi reklam ağını kullanır.
> İzleme odalarında hiçbir zaman reklam gösterilmez. Reklam sunmak için InMobi'ye cihaz türü, işletim sistemi, IP adresi
> ve uygulama etkinliği gibi teknik bilgiler aktarılabilir. Onayınız olmadan kişiselleştirilmiş reklam gösterilmez ve
> reklam kimliğiniz paylaşılmaz. InMobi'nin veri işleme koşulları için https://www.inmobi.com/privacy-policy adresine bakabilirsiniz.
