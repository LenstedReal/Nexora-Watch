# Google Play hazırlığı (Nexora Watch)

Paket adı: `com.lenstedreal.nexorawatch` · Hedef kitle: 16+ · Reklam: var (InMobi, yalnızca Android)

## 1. Mağaza kaydı

### Türkçe
**Kısa açıklama (≤ 80 karakter):**
> Arkadaşlarınla aynı anda video izle, sohbet et. Oda kur, kodu paylaş, başla.

**Tam açıklama:**
> Nexora Watch ile arkadaşlarınla aynı videoyu aynı saniyede izlersin. Bir oda kur, kodu ya da bağlantıyı paylaş;
> herkes tek dokunuşla katılır. Odayı kuran kişi oynatır, durdurur ve ileri sarar, herkesin ekranı otomatik eşitlenir.
>
> • YouTube, Vimeo, Twitch ve diğer desteklenen kaynaklardan bağlantı yapıştır
> • Kendi videonu yükle (7 gün sonra otomatik silinir)
> • Oda sohbeti, izleme sırası ve oylama, altyazı (.srt / .vtt)
> • Hesap gerekmez: sadece bir takma ad seç
> • Türkçe, İngilizce ve Almanca
>
> Videolar her kaynağın kendi resmî oynatıcısıyla oynatılır. Uygunsuz içeriği oda içinden şikâyet edebilirsin.

### English
**Short description (≤ 80 chars):**
> Watch videos in sync with friends and chat. Create a room, share the code, go.

**Full description:**
> Nexora Watch lets you and your friends watch the same video at the same second. Create a room, share the code or
> link, and everyone joins with one tap. The host plays, pauses and seeks; every screen stays in sync automatically.
>
> • Paste links from YouTube, Vimeo, Twitch and other supported sources
> • Upload your own video (deleted automatically after 7 days)
> • Room chat, watch queue with voting, subtitles (.srt / .vtt)
> • No account needed: just pick a nickname
> • Turkish, English and German
>
> Videos play in each source's own official player. You can report inappropriate content from inside the room.

Kontrol: kısa açıklamalar 80 karakterin altında (TR 76, EN 78). Ekran görüntüleri: en az 2 telefon görüntüsü
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
`https://nexora.lenstedreal.info/veri-silme`). Hesap yok. Veriler satılmaz.

| Veri türü (Play adı) | Toplanıyor mu | Paylaşılıyor mu | Neden | Zorunlu mu | Not |
|---|---|---|---|---|---|
| Kişisel bilgi → Ad (takma ad) | Evet | Hayır | Uygulama işlevi | Evet | Oda içinde görünen takma ad; oda bitince silinir |
| Mesajlar → Uygulama içi mesajlar | Evet | Hayır | Uygulama işlevi | Hayır | Oda sohbeti; oda bittikten 24 saat sonra silinir |
| Fotoğraf ve videolar → Videolar | Evet | Hayır | Uygulama işlevi | Hayır | Yüklenen videolar; en geç 7 gün sonra silinir |
| Cihaz veya diğer kimlikler → Reklam kimliği | Evet (reklamlar açıkken) | **Evet** (InMobi) | Reklam | Hayır | InMobi SDK; onay ekranı ile |
| Uygulama bilgileri ve performans → Kilitlenme günlükleri | Evet | Hayır | Analiz (hata ayıklama) | Hayır | Hata mesajı, yığın izi (≤ 4 KB), sayfa yolu, sürüm, tarayıcı bilgisi; 14 gün sonra silinir; kimlik bilgisi yok |
| Uygulama etkinliği → Diğer | Evet | Hayır | Uygulama işlevi | Evet | Eşitleme ölçümleri (gecikme), oda başına; oda bittikten 24 saat sonra silinir |

Toplanmayanlar: e-posta, telefon, konum, kişiler, takvim, ödeme bilgisi, sağlık, dosyalar (yüklenen video dışında).
Not: IP adresi yalnızca hız sınırı için bellekte tutulur, kaydedilmez.

## 4. Reklamlar

- "Uygulamanızda reklam var mı?" → **Evet** (InMobi banner + geçiş reklamı, ayrıntı: docs/ADS.md).
- **app-ads.txt:** `https://me.lenstedreal.info/app-ads.txt` (dosya: `site/personal/app-ads.txt`, içerik
  docs/ADS.md'deki InMobi satırı). Play Console → Mağaza ayarları → **Web sitesi** alanı tam olarak
  `https://me.lenstedreal.info` olmalı; aksi halde InMobi app-ads.txt'yi bulamaz ve reklam geliri düşer.
  Kontrol: `curl -s https://me.lenstedreal.info/app-ads.txt`

## 5. Hedef kitle ve içerik

- Hedef yaş grupları: **16-17 ve 18+** (13 altı ve 13-15 seçilmez; uygulama içinde yaş onayı var, `MIN_AGE=16`).
- Çocuklara yönelik değil → "Aileler için tasarlandı" programına girilmez.
- Gizlilik politikası: `https://nexora.lenstedreal.info/gizlilik`
- Çocuk güvenliği standartları (sosyal uygulamalar için zorunlu): `https://nexora.lenstedreal.info/cocuk-guvenligi`
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
