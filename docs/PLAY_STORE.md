# Google Play hazırlığı (Nexora Watch)

Paket adı: `com.lenstedreal.nexorawatch` · Hedef kitle: 16+ · Reklam: var (InMobi, yalnızca Android)

## 1. Mağaza kaydı

### Türkçe
**Kısa açıklama (≤ 80 karakter):**
> Sevgilinle film gecesi, arkadaşlarınla dizi maratonu: aynı saniyede izle.

**Tam açıklama:**
> Sevgilinle film gecesi, arkadaşlarınla dizi maratonu ya da kısa videolar: Nexora Watch ile aynı videoyu aynı saniyede
> izlersin. Bir oda kur, kodu ya da bağlantıyı paylaş;
> herkes tek dokunuşla katılır. Odayı kuran kişi oynatır, durdurur ve ileri sarar, herkesin ekranı otomatik eşitlenir.
>
> • YouTube, TikTok, Facebook, Twitch kayıtları, Google Drive ve video bağlantılarını yapıştır
> • Kendi videonu yükle (7 gün sonra otomatik silinir)
> • Oda sohbeti, izleme sırası ve oylama, altyazı (.srt / .vtt)
> • Hesap gerekmez: sadece bir takma ad seç
> • Türkçe, İngilizce ve Almanca
>
> Videolar her kaynağın kendi resmî oynatıcısıyla oynatılır. Uygunsuz içeriği oda içinden şikâyet edebilirsin.

### English
**Short description (≤ 80 chars):**
> Movie night with your partner, series marathons with friends, all in sync.

**Full description:**
> Movie night with your partner, a series marathon with friends or short clips: Nexora Watch lets you watch the same
> video at the same second. Create a room, share the code or
> link, and everyone joins with one tap. The host plays, pauses and seeks; every screen stays in sync automatically.
>
> • Paste links from YouTube, TikTok, Facebook, Twitch past broadcasts, Google Drive and video links
> • Upload your own video (deleted automatically after 7 days)
> • Room chat, watch queue with voting, subtitles (.srt / .vtt)
> • No account needed: just pick a nickname
> • Turkish, English and German
>
> Videos play in each source's own official player. You can report inappropriate content from inside the room.

Kontrol: kısa açıklamalar 80 karakterin altında (TR 73, EN 74). Ekran görüntüleri: en az 2 telefon görüntüsü
(oda ekranı, sohbet), 512×512 simge, 1024×500 öne çıkan görsel.

## 2. İçerik derecelendirmesi (IARC anketi)

Kategori: **Uygulama (oyun değil) → Sosyal / iletişim**.

| Soru | Cevap |
|---|---|
| Şiddet, korku, cinsellik, küfür içeriyor mu? | Hayır (uygulamanın kendi içeriği yok) |
| Kullanıcılar birbiriyle iletişim kurabiliyor / içerik paylaşabiliyor mu? | **Evet** (oda sohbeti, video bağlantısı ve yükleme) |
| Kullanıcı tarafından oluşturulan içerik moderasyonu var mı? | Evet: oda içi şikâyet, oda sahibi kişiyi çıkarabilir, sunucu tarafında oda kapatma (docs/DEPLOY.md "Moderasyon") |
| Konum paylaşımı | Hayır |
| Dijital satın alma | Hayır |
| Kumar / benzetimli kumar | Hayır |
| Uyuşturucu, alkol, tütün | Hayır |

Beklenen sonuç: kullanıcı etkileşimi uyarısıyla düşük/orta derece (ör. PEGI 12, "Kullanıcılar etkileşim kurar").

## 3. Veri güvenliği formu (Data safety)

Genel: veriler aktarım sırasında şifrelenir (**HTTPS: evet**). Kullanıcı veri silme isteyebilir (**evet**:
`https://lenstedreal.github.io/NexoraWatch/delete-data.html`). Hesap yok. Veriler satılmaz.

| Veri türü (Play adı) | Toplanıyor mu | Paylaşılıyor mu | Neden | Zorunlu mu | Not |
|---|---|---|---|---|---|
| Kişisel bilgi → Ad (takma ad) | Evet | Hayır | Uygulama işlevi | Evet | Oda içinde görünen takma ad; oda bitince silinir |
| Mesajlar → Uygulama içi mesajlar | Evet | Hayır | Uygulama işlevi | Hayır | Oda sohbeti; oda bittikten 24 saat sonra silinir |
| Fotoğraf ve videolar → Videolar | Evet | Hayır | Uygulama işlevi | Hayır | Yüklenen videolar; en geç 7 gün sonra silinir |
| Cihaz veya diğer kimlikler | Evet | **Evet** (InMobi; Firebase yalnızca bildirim için) | Uygulama işlevi, Reklam | Hayır | Rastgele cihaz kimliği ve bildirim anahtarı (bildirime izin verilirse; 90 gün kullanılmazsa silinir). Reklam: InMobi SDK yaş kısıtlı modda çalışır, reklam kimliği gönderilmez; yine de SDK'nın işlediği teknik bilgiler için ihtiyatlı olarak "paylaşılıyor" beyan edilir |
| Uygulama etkinliği → Uygulama etkileşimleri | Evet | **Evet** (InMobi) | Reklam | Hayır | Reklam gösterimi ve tıklama bilgisi (InMobi); kişiselleştirilmemiş reklam |
| Uygulama bilgileri ve performans → Kilitlenme günlükleri | Evet | Hayır | Analiz (hata ayıklama) | Hayır | Hata mesajı, yığın izi (≤ 4 KB), sayfa yolu, sürüm, tarayıcı bilgisi; 14 gün sonra silinir; kimlik bilgisi yok |
| Uygulama etkinliği → Diğer | Evet | Hayır | Uygulama işlevi | Evet | Eşitleme ölçümleri (gecikme), oda başına; oda bittikten 24 saat sonra silinir |

Toplanmayanlar: e-posta, telefon, konum, kişiler, takvim, ödeme bilgisi, sağlık, dosyalar (yüklenen video dışında).
Not: IP adresi yalnızca hız sınırı için bellekte tutulur, kaydedilmez.

## 4. Reklamlar

- "Uygulamanızda reklam var mı?" → **Evet** (InMobi banner + geçiş reklamı, ayrıntı: docs/ADS.md).
- **Reklam kimliği beyanı:** uygulamada `AD_ID` izni var (InMobi SDK) → **Evet**, amaç **Reklam**.
- **app-ads.txt:** `https://nexora.lenstedreal.info/app-ads.txt` (dosya `frontend/public/app-ads.txt`; aynı dosya
  `me.lenstedreal.info/app-ads.txt` adresinde de var). Play Console → Mağaza ayarları → **Web sitesi** alanı
  `https://nexora.lenstedreal.info` olmalı; InMobi dosyayı bu adresten bulur.
  Kontrol: `curl -s https://nexora.lenstedreal.info/app-ads.txt | head -1`

## 5. Hedef kitle ve içerik

- Hedef yaş grupları: **16-17 ve 18+** (13 altı ve 13-15 seçilmez; uygulama içinde yaş onayı var, `MIN_AGE=16`).
- Çocuklara yönelik değil → "Aileler için tasarlandı" programına girilmez.
- Web sitesi: `https://nexora.lenstedreal.info`
- Gizlilik politikası: `https://lenstedreal.github.io/NexoraWatch/privacy-policy.html` (aynı metin `https://nexora.lenstedreal.info/gizlilik` adresinde de durur)
- Veri silme: `https://lenstedreal.github.io/NexoraWatch/delete-data.html`
- Çocuk güvenliği standartları (sosyal uygulamalar için zorunlu): `https://lenstedreal.github.io/NexoraWatch/child-safety.html`
- Bu sayfalar LenstedReal.github.io deposunun `NexoraWatch/` klasöründedir; Nexora'daki metin değişirse oradaki kopya da yenilenmeli.
- İletişim e-postası: `contact.nexorawatch@protonmail.com`

## 6. Kapalı test (yeni kişisel hesaplar için zorunlu)

2023 sonrası açılan **kişisel** geliştirici hesaplarında üretime çıkmadan önce: kapalı testte **en az 12 testçi**,
**14 gün boyunca kesintisiz** katılmış olmalı.

1. Play Console → Test → **Kapalı test** → yeni kanal ("closed") oluştur.
2. Testçiler: bir e-posta listesi (Google hesapları) ya da Google Grubu ekle; en az 12 kişi, tercihen 15-20
   (bırakan olursa sayı 12'nin altına düşmesin).
3. AAB'yi yükle (aşağıda), sürüm notunu yaz, incelemeye gönder.
4. Onaydan sonra "katılım bağlantısını" testçilere gönder; her biri bağlantıdan katılıp uygulamayı Play'den kurmalı.
5. 14 gün boyunca testçiler uygulamayı arada açsın; geri bildirimleri topla, gerekirse yeni AAB yükle
   (süre sıfırlanmaz).
6. 14 gün dolunca Kontrol paneli → **Üretime erişim başvurusu**; soruları (test nasıl geçti, ne düzeltildi) cevapla.

## 7. AAB nerede?

GitHub → Actions → **"Android (APK + AAB)"** iş akışı → son başarılı çalıştırma → en alttaki **Artifacts** →
`nexora-watch-android` (zip). İçinde `nexora-watch-<sürüm>-<versionCode>.aab` (Play'e yüklenen dosya) ve APK var.
Sürüm kodu her derlemede artar; Play aynı kodu ikinci kez kabul etmez. İmzalama: yükleme anahtarı GitHub
secret'ından gelir (docs/RELEASE.md); Play App Signing açık olmalı.
