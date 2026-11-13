import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Download } from "lucide-react";
import { useAppConfig } from "@/lib/config";
import "@/landing.css";

// ---- Owner details (edit here) ------------------------------------------------------------------------------
// KVKK md.10 requires the data controller's identity. Fill in your full legal name (and, if you have one, a
// company title / KEP or postal address) before publishing on Google Play.
export const OWNER = {
  brand: "LenstedReal",
  controller: "LenstedReal (Nexora Watch geliştiricisi)",
  address: "", // e.g. "İl/İlçe, Türkiye" — optional, shown only when filled
};
const UPDATED = "13 Kasım 2026";

export const LEGAL_PAGES = [
  { path: "/gizlilik", label: "Gizlilik Politikası" },
  { path: "/kosullar", label: "Kullanım Koşulları" },
  { path: "/kvkk", label: "KVKK Aydınlatma Metni" },
  { path: "/telif", label: "Telif Hakkı ve İçerik Kaldırma" },
  { path: "/veri-silme", label: "Veri Silme Talebi" },
  { path: "/cocuk-guvenligi", label: "Çocuk Güvenliği Standartları" },
];

export function SiteFooter() {
  const cfg = useAppConfig();
  return (
    <footer className="site-footer">
      <div className="site-footer-in">
        <nav>
          {LEGAL_PAGES.map((p) => (
            <Link key={p.path} to={p.path}>
              {p.label}
            </Link>
          ))}
        </nav>
        <a href={`mailto:${cfg.contact_email}`}>{cfg.contact_email}</a>
        <small>© {new Date().getFullYear()} {OWNER.brand} · Nexora Watch</small>
      </div>
    </footer>
  );
}

function LegalLayout({ title, children }) {
  const cfg = useAppConfig();
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = `${title} · Nexora Watch`;
    window.scrollTo(0, 0);
  }, [title]);
  return (
    <div className="legal">
      <div className="legal-top">
        <header className="lp-nav">
          <Link className="lp-brand" to="/">
            <img src="/branding/logo-256.jpg" alt="" />
            <span>
              Nexora<b>Watch</b>
            </span>
          </Link>
          {/* No download button before the app is on Google Play. */}
          {cfg.play_url && (
            <a className="lp-nav-cta" href={cfg.play_url} target="_blank" rel="noreferrer">
              <Download size={15} /> <span>İndir</span>
            </a>
          )}
        </header>
      </div>
      <article className="legal-doc">
        <div className="legal-toc">
          {LEGAL_PAGES.map((p) => (
            <Link key={p.path} to={p.path} className={pathname === p.path ? "on" : ""}>
              {p.label}
            </Link>
          ))}
        </div>
        <h1>{title}</h1>
        <p className="updated">Son güncelleme: {UPDATED}</p>
        {children}
      </article>
      <SiteFooter />
    </div>
  );
}

/** Data controller from server config (OWNER_NAME / OWNER_ADDRESS in .env), falling back to OWNER. */
const useOwner = () => {
  const cfg = useAppConfig();
  const name = cfg.owner?.name?.trim();
  return {
    controller: name ? `${name} (${OWNER.brand} — Nexora Watch geliştiricisi)` : OWNER.controller,
    address: cfg.owner?.address?.trim() || OWNER.address,
  };
};
const Ctl = () => useOwner().controller;
const Addr = ({ pre = ", ", wrap }) => {
  const a = useOwner().address;
  if (!a) return null;
  return wrap ? ` (${a})` : `${pre}${a}`;
};

const Mail = () => {
  const cfg = useAppConfig();
  return <a href={`mailto:${cfg.contact_email}`}>{cfg.contact_email}</a>;
};

const RETENTION = (
  <table>
    <thead>
      <tr>
        <th>Veri</th>
        <th>Saklama süresi</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Oda bilgileri (oda adı, kod, katılımcı rumuzları), oynatma durumu</td>
        <td>Oda 24 saat sonra sona erer; kayıtlar sona ermeden itibaren en geç 24 saat içinde silinir.</td>
      </tr>
      <tr>
        <td>Sohbet mesajları ve sistem mesajları</td>
        <td>Odanın sona ermesinden itibaren en geç 24 saat içinde silinir.</td>
      </tr>
      <tr>
        <td>Yüklenen videolar ve Google Drive'dan içe aktarılan videolar</td>
        <td>Oda kapatıldıktan veya süresi dolduktan yaklaşık 1 saat sonra; her durumda yüklemeden itibaren en geç 7 gün içinde silinir.</td>
      </tr>
      <tr>
        <td>Senkron ölçüm verileri (gecikme, sapma)</td>
        <td>Oda kayıtlarıyla birlikte silinir.</td>
      </tr>
      <tr>
        <td>Şikâyet kayıtları ve ilgili mesaj kopyası</td>
        <td>İnceleme tamamlanana kadar, en fazla 180 gün; hukuki talep varsa yasal süre boyunca.</td>
      </tr>
      <tr>
        <td>Güvenlik kayıtları (IP adresi, işlem kaydı)</td>
        <td>En fazla 90 gün; 5651 sayılı Kanun kapsamında gerekli olması hâlinde yasal süre boyunca.</td>
      </tr>
      <tr>
        <td>Cihazdaki oda anahtarı ve rumuz</td>
        <td>Yalnızca cihazında tutulur; uygulamayı silerek veya tarayıcı verilerini temizleyerek kaldırabilirsin.</td>
      </tr>
    </tbody>
  </table>
);

export function Privacy() {
  return (
    <LegalLayout title="Gizlilik Politikası">
      <div className="legal-box">
        <p>
          <b>Kısaca:</b> Hesap yok; bugün reklam ve takip/analiz SDK'sı da yok. Odayı kullanman için gereken en az veriyi işliyoruz ve kısa
          sürede otomatik olarak siliyoruz. Verilerini satmıyoruz.
        </p>
      </div>
      <h2>1. Kim olduğumuz</h2>
      <p>
        Nexora Watch, <Ctl /> tarafından geliştirilen ve işletilen ortak video izleme uygulamasıdır (mobil uygulama ve
        nexora.lenstedreal.info). Bu politika mobil uygulama ile web sitesi için geçerlidir. İletişim: <Mail />
        <Addr />.
      </p>
      <h2>2. İşlediğimiz veriler</h2>
      <ul>
        <li>
          <b>Rumuz ve oda bilgileri:</b> Girdiğin rumuz, oluşturduğun/katıldığın odanın adı ve kodu, katılımcı kimliği, çevrimiçi durumu.
        </li>
        <li>
          <b>Sohbet içeriği:</b> Odada gönderdiğin mesajlar ve emoji tepkileri.
        </li>
        <li>
          <b>Paylaşılan içerik:</b> Odaya eklenen video bağlantıları; yüklediğin video dosyaları; Google Drive'dan içe aktarılan herkese
          açık dosyalar; uygulama içi tarayıcıda algılanan videonun adresi ve bulunduğu sayfa adresi.
        </li>
        <li>
          <b>Teknik veriler:</b> IP adresi, istek zamanı, cihaz/tarayıcı tarafından gönderilen standart bağlantı bilgileri, senkron ölçümleri
          (ağ gecikmesi, oynatma sapması, yeniden bağlanma sayısı, oynatıcı hata sayısı).
        </li>
        <li>
          <b>Şikâyetler:</b> Bir mesajı veya kişiyi bildirdiğinde; şikâyet nedeni, notun, ilgili mesajın kopyası ve rumuzlar.
        </li>
        <li>
          <b>Cihazda saklananlar:</b> Odaya yeniden bağlanabilmen için oda anahtarı (token), rumuz, son odalar ve onay tercihlerin
          yalnızca cihazında (mobilde şifreli depolama, webde tarayıcı depolaması) tutulur.
        </li>
      </ul>
      <p>
        Ad-soyad, e-posta, telefon, konum, rehber, kamera veya mikrofon verisi <b>toplamıyoruz</b>. Galeriden video seçtiğinde yalnızca
        seçtiğin dosyaya erişilir.
      </p>
      <h2>3. Amaçlar ve hukuki sebepler</h2>
      <ul>
        <li>Oda oluşturma, katılma, sohbet ve senkron oynatma hizmetini sunmak (sözleşmenin ifası).</li>
        <li>Video yükleme ve oynatmayı sağlamak, kötüye kullanımı ve aşırı yüklenmeyi önlemek (sözleşmenin ifası, meşru menfaat).</li>
        <li>Güvenlik, hata ayıklama ve senkron kalitesini ölçüp iyileştirmek (meşru menfaat).</li>
        <li>Şikâyetleri incelemek, telif ve hukuka aykırı içerik bildirimlerini işlemek, yasal yükümlülükleri yerine getirmek (hukuki yükümlülük, meşru menfaat).</li>
      </ul>
      <h2>4. Saklama süreleri</h2>
      {RETENTION}
      <h2>5. Paylaşım ve hizmet sağlayıcılar</h2>
      <ul>
        <li>
          <b>Oracle Cloud Infrastructure</b> (Frankfurt, Almanya): sunucu, veritabanı ve video depolama altyapısı. Veriler bu nedenle yurt
          dışında barındırılır.
        </li>
        <li>
          <b>Cloudflare</b>: alan adı (DNS) çözümlemesi.
        </li>
        <li>
          <b>YouTube (Google)</b>: odada bir YouTube videosu oynatıldığında resmi YouTube oynatıcısı yüklenir ve YouTube kendi gizlilik
          politikası kapsamında veri işleyebilir. Google Drive bağlantısı içe aktarıldığında sunucumuz dosyayı Google'dan indirir.
        </li>
        <li>Odadaki diğer katılımcılar: rumuzun, mesajların ve odaya eklediğin içerik odadaki herkes tarafından görülür.</li>
        <li>Yetkili kamu kurumları: yalnızca yasal bir zorunluluk olduğunda.</li>
      </ul>
      <p>Verilerini reklam veya pazarlama amacıyla üçüncü kişilere satmıyor, kiralamıyor veya aktarmıyoruz.</p>
      <p>
        <b>Reklamlar:</b> Bugün uygulamada ve sitede reklam göstermiyoruz. İleride mobil uygulamada, oda dışındaki ekranlarda reklam
        göstermeyi planlıyoruz; izleme sırasında reklam gösterilmeyecek. Reklam eklendiği sürümle birlikte reklam ortağının kim olduğunu ve
        hangi verileri işlediğini bu sayfada ve Google Play'deki veri güvenliği bölümünde açıklayacağız.
      </p>
      <h2>6. Güvenlik</h2>
      <p>
        Tüm bağlantılar HTTPS/WSS ile şifrelenir. Oda anahtarları sunucuda yalnızca özet (hash) olarak saklanır. Video adresleri süreli ve
        imzalıdır; oda dışındaki kişiler erişemez. Hiçbir sistem tamamen risksiz değildir; bir ihlal hâlinde yasal sürelerde bildirim yaparız.
      </p>
      <h2>7. Çocuklar</h2>
      <p>
        Nexora Watch 16 yaşın altındaki kullanıcılara yönelik değildir; 18 yaşından küçükler hizmeti ebeveyn veya veli gözetiminde kullanmalıdır. 16 yaş altı bir kullanıcıya ait veri işlendiğini fark edersek
        siliriz. Ayrıntılar için <Link to="/cocuk-guvenligi">Çocuk Güvenliği Standartları</Link>.
      </p>
      <h2>8. Hakların</h2>
      <p>
        Verilerine erişme, düzeltme, silme, işlemeye itiraz etme ve KVKK md. 11'de sayılan diğer haklarını kullanabilirsin. Hesap
        olmadığından talebinde oda kodunu ve rumuzunu belirtmen yeterlidir: <Link to="/veri-silme">Veri Silme Talebi</Link>,{" "}
        <Link to="/kvkk">KVKK Aydınlatma Metni</Link>.
      </p>
      <h2>9. Değişiklikler</h2>
      <p>Bu politikayı güncelleyebiliriz; önemli değişiklikleri uygulama veya site üzerinden duyururuz. Güncel sürüm her zaman bu sayfadadır.</p>
    </LegalLayout>
  );
}

export function Terms() {
  return (
    <LegalLayout title="Kullanım Koşulları">
      <p>
        Nexora Watch'u (mobil uygulama ve web sitesi) kullanarak bu koşulları kabul etmiş olursun. Kabul etmiyorsan hizmeti kullanma.
      </p>
      <h2>1. Uygunluk</h2>
      <p>Hizmeti kullanmak için en az 16 yaşında olmalısın. 18 yaşından küçüksen hizmeti yalnızca ebeveyninin veya velinin izni ve gözetimiyle kullanabilirsin.</p>
      <h2>2. Hizmet</h2>
      <p>
        Nexora Watch; oda oluşturma, kod ile katılma, sohbet, tepki ve odaya eklenen videoların katılımcılar arasında eşzamanlı
        oynatılmasını sağlar. Odalar 24 saat sonra sona erer. Hizmet "olduğu gibi" sunulur; kesintisiz veya hatasız çalışacağı garanti
        edilmez ve özellikler önceden haber verilmeksizin değiştirilebilir.
      </p>
      <h2>3. İçerik ve telif sorumluluğu</h2>
      <ul>
        <li>Odaya eklenen her içerikten (bağlantı, yükleme, içe aktarma, algılanan video) onu ekleyen kullanıcı sorumludur.</li>
        <li>
          Yalnızca hakkına sahip olduğun, lisansladığın veya hak sahibinin kamuya açık paylaşımına izin verdiği içerikleri ekleyebilirsin.
        </li>
        <li>
          Şifreli (DRM) veya abonelik/kişisel hesapla korunan platformlardan (ör. Netflix, Disney+, Prime Video, BluTV, Exxen) içerik almak,
          bu korumaları aşmaya çalışmak veya korsan içerik paylaşmak yasaktır. Uygulama bu platformları desteklemez ve engeller.
        </li>
        <li>
          Uygulama içi video algılama yalnızca desteklenen kamuya açık sitelerde çalışır ve sitelerin kendi kullanım koşullarına uymak
          senin sorumluluğundadır.
        </li>
        <li>Hak ihlali bildirimleri <Link to="/telif">Telif Hakkı ve İçerik Kaldırma</Link> sayfasındaki süreçle işlenir.</li>
      </ul>
      <h2>4. Yasak davranışlar</h2>
      <ul>
        <li>Çocukların cinsel istismarı veya sömürüsüne ilişkin her türlü içerik (sıfır tolerans; yetkililere bildirilir).</li>
        <li>Müstehcen/cinsel içerik, şiddet, nefret söylemi, taciz, tehdit, zorbalık, kişisel verilerin ifşası.</li>
        <li>Spam, dolandırıcılık, kötü amaçlı yazılım veya bağlantı paylaşımı.</li>
        <li>Hizmeti aşırı yüklemek, güvenlik önlemlerini aşmak, başkasının oda anahtarını kullanmak, otomatik araçlarla kötüye kullanmak.</li>
        <li>Türkiye Cumhuriyeti mevzuatına veya bulunduğun ülkenin yasalarına aykırı her türlü kullanım.</li>
      </ul>
      <h2>5. Moderasyon</h2>
      <p>
        Uygunsuz mesajları ve kişileri uygulama içinden bildirebilir, kişileri kendi cihazında engelleyebilirsin. Oda sahibi katılımcıları
        odadan çıkarabilir. Bildirimleri inceler; ihlal tespit ettiğimizde içeriği kaldırabilir, odayı kapatabilir ve erişimi kısıtlayabiliriz.
      </p>
      <h2>6. Sorumluluğun sınırlandırılması</h2>
      <p>
        Kullanıcıların eklediği içeriklerden, üçüncü taraf sitelerden ve hizmetin geçici olarak kullanılamamasından doğan zararlardan,
        yürürlükteki mevzuatın izin verdiği en geniş ölçüde sorumlu değiliz. Kasıt ve ağır ihmal hâlleri saklıdır.
      </p>
      <h2>7. Uygulanacak hukuk</h2>
      <p>
        Bu koşullar Türkiye Cumhuriyeti hukukuna tabidir. Tüketici işlemlerinde tüketici hakem heyetleri ve tüketici mahkemelerinin
        yetkisi saklıdır.
      </p>
      <h2>8. İletişim</h2>
      <p>
        Sorular ve bildirimler için: <Mail />
      </p>
    </LegalLayout>
  );
}

export function Kvkk() {
  return (
    <LegalLayout title="KVKK Aydınlatma Metni">
      <p>
        6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") md. 10 uyarınca, veri sorumlusu sıfatıyla <Ctl />
        <Addr wrap /> olarak Nexora Watch kapsamında işlenen kişisel verilerin hakkında seni bilgilendiriyoruz.
      </p>
      <h2>1. İşlenen kişisel veriler</h2>
      <ul>
        <li>Kimlik: rumuz (gerçek ad zorunlu değildir).</li>
        <li>İşlem güvenliği: IP adresi, katılımcı kimliği, oda anahtarının özeti, işlem kayıtları.</li>
        <li>Müşteri işlem: oda kayıtları, sohbet mesajları, eklenen video bağlantıları, şikâyet kayıtları.</li>
        <li>Görsel/işitsel kayıt: kullanıcının yüklediği veya içe aktardığı video dosyaları (içeriğe bağlı olarak).</li>
      </ul>
      <h2>2. İşleme amaçları</h2>
      <p>
        Hizmetin sunulması (oda, sohbet, senkron oynatma, video yükleme), bilgi güvenliğinin sağlanması, kötüye kullanımın önlenmesi,
        şikâyet ve hak ihlali bildirimlerinin yönetimi, hizmet kalitesinin ölçülmesi ve yasal yükümlülüklerin yerine getirilmesi.
      </p>
      <h2>3. Hukuki sebepler (KVKK md. 5/2)</h2>
      <ul>
        <li>(c) Bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması.</li>
        <li>(ç) Veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi.</li>
        <li>(e) Bir hakkın tesisi, kullanılması veya korunması.</li>
        <li>(f) İlgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla veri sorumlusunun meşru menfaati.</li>
      </ul>
      <h2>4. Toplama yöntemi</h2>
      <p>Veriler; mobil uygulama ve web sitesi üzerinden, elektronik ortamda, otomatik yollarla ve senin girdiğin bilgilerle toplanır.</p>
      <h2>5. Aktarım</h2>
      <p>
        Kişisel verilerin; barındırma hizmeti alınan Oracle Cloud Infrastructure (Frankfurt, Almanya) sunucularında saklanır ve bu
        kapsamda KVKK md. 9 hükümlerine uygun olarak yurt dışına aktarılır. DNS hizmeti için Cloudflare kullanılır. Odaya bir YouTube
        videosu eklendiğinde YouTube oynatıcısı yüklenir. Veriler, talep hâlinde yetkili kamu kurum ve kuruluşlarıyla yasal sınırlar
        içinde paylaşılabilir. Reklam/pazarlama amaçlı aktarım yapılmaz.
      </p>
      <h2>6. Saklama</h2>
      {RETENTION}
      <h2>7. KVKK md. 11 kapsamındaki hakların</h2>
      <ul>
        <li>Kişisel verilerinin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme,</li>
        <li>İşlenme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme,</li>
        <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,</li>
        <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme,</li>
        <li>KVKK md. 7 şartları çerçevesinde silinmesini veya yok edilmesini isteme,</li>
        <li>Düzeltme/silme işlemlerinin aktarılan üçüncü kişilere bildirilmesini isteme,</li>
        <li>Münhasıran otomatik sistemlerle analiz sonucu aleyhine bir sonucun ortaya çıkmasına itiraz etme,</li>
        <li>Kanuna aykırı işleme nedeniyle zarara uğraman hâlinde zararın giderilmesini talep etme.</li>
      </ul>
      <h2>8. Başvuru</h2>
      <p>
        Taleplerini oda kodu, rumuzun ve talebinin açıklamasıyla <Mail /> adresine iletebilirsin. Başvurular en geç 30 gün içinde
        ücretsiz olarak sonuçlandırılır. Başvurunun reddedilmesi veya cevabı yetersiz bulman hâlinde Kişisel Verileri Koruma Kurulu'na
        şikâyet hakkın saklıdır.
      </p>
    </LegalLayout>
  );
}

export function Copyright() {
  return (
    <LegalLayout title="Telif Hakkı ve İçerik Kaldırma">
      <p>
        Nexora Watch fikri mülkiyet haklarına saygı duyar. Kullanıcılar yalnızca hakkına sahip oldukları veya kamuya açık olarak
        paylaşılmasına izin verilen içerikleri ekleyebilir. Abonelik/DRM korumalı platformlar teknik olarak engellenir.
      </p>
      <h2>Hak sahibi misin? Kaldırma bildirimi</h2>
      <p>
        5846 sayılı Fikir ve Sanat Eserleri Kanunu ve 5651 sayılı Kanun kapsamında, aşağıdaki bilgilerle <Mail /> adresine bildirimde
        bulunabilirsin:
      </p>
      <ol>
        <li>Adın-soyadın / temsil ettiğin kurum ve iletişim bilgilerin,</li>
        <li>Hakkı ihlal edildiğini düşündüğün eser ve hak sahipliğine ilişkin bilgi/belge,</li>
        <li>İhlalin gerçekleştiği oda kodu, video adresi veya ekran görüntüsü gibi tanımlayıcı bilgiler,</li>
        <li>Bilgilerin doğru olduğuna ve hak sahibi ya da yetkili temsilci olduğuna dair beyanın, tarih ve imzan.</li>
      </ol>
      <p>
        Usulüne uygun bildirimleri en kısa sürede, en geç 24-48 saat içinde değerlendirir; ilgili içeriği kaldırır veya erişimi engelleriz.
        Odalar ve yüklenen videolar zaten kısa süre içinde otomatik olarak silinir.
      </p>
      <h2>İtiraz</h2>
      <p>
        İçeriği hatalı kaldırıldığını düşünen kullanıcı, gerekçesi ve iletişim bilgileriyle aynı adrese itiraz edebilir. İtirazlar bildirim
        sahibine iletilir.
      </p>
      <h2>Tekrarlayan ihlaller</h2>
      <p>Tekrar eden ihlallerde ilgili kullanıcının ve cihazın erişimini kalıcı olarak kısıtlayabiliriz.</p>
    </LegalLayout>
  );
}

export function DeleteData() {
  return (
    <LegalLayout title="Veri Silme Talebi">
      <div className="legal-box">
        <p>
          Nexora Watch'ta <b>hesap yoktur</b>. Bu yüzden silinecek bir "hesap" da bulunmaz. Verilerin büyük kısmı zaten otomatik olarak
          silinir.
        </p>
      </div>
      <h2>Otomatik silme</h2>
      {RETENTION}
      <h2>Cihazındaki verileri silme</h2>
      <ul>
        <li>
          <b>Android/iOS:</b> Uygulamayı kaldırdığında cihazdaki rumuz, oda anahtarları ve son odalar silinir. Ayarlar → Uygulamalar →
          Nexora Watch → Depolama → Verileri temizle ile de silebilirsin.
        </li>
        <li>
          <b>Web:</b> Tarayıcıda nexora.lenstedreal.info için site verilerini temizle.
        </li>
      </ul>
      <h2>Sunucudaki verilerin hemen silinmesini isteme</h2>
      <p>
        Otomatik süreleri beklemeden silinmesini istediğin oda, sohbet, video veya şikâyet kayıtları için <Mail /> adresine şu bilgilerle
        yaz: oda kodu, kullandığın rumuz, yaklaşık tarih ve silinmesini istediğin veri. Talebini en geç 30 gün içinde ücretsiz olarak
        sonuçlandırır, sonucu bildiririz. Yasal saklama yükümlülüğü bulunan güvenlik kayıtları yalnızca yasal süre sonunda silinir.
      </p>
    </LegalLayout>
  );
}

export function ChildSafety() {
  return (
    <LegalLayout title="Çocuk Güvenliği Standartları">
      <p>
        Nexora Watch, çocukların cinsel istismarı ve sömürüsüne (CSAE) ve çocuk cinsel istismarı materyaline (CSAM) karşı{" "}
        <b>sıfır tolerans</b> politikası uygular. Bu sayfa Google Play Çocuk Güvenliği Standartları politikası kapsamında yayımlanmıştır.
      </p>
      <h2>Standartlarımız</h2>
      <ul>
        <li>Hizmet 16 yaş ve üzeri kullanıcılar içindir; 18 yaşından küçükler için ebeveyn gözetimi gerekir. İlk açılışta yaş beyanı ve koşulların kabulü istenir.</li>
        <li>Çocukları cinselleştiren, istismar eden veya tehlikeye atan her türlü içerik, mesaj ve davranış yasaktır.</li>
        <li>Bu tür içerikler tespit edildiğinde veya bildirildiğinde derhal kaldırılır, oda kapatılır ve ilgili kullanıcının erişimi engellenir.</li>
        <li>Yasaların gerektirdiği durumlarda içerik ve ilgili kayıtlar yetkili makamlara (Türkiye'de Emniyet Genel Müdürlüğü, BTK İhbar Web; uluslararası NCMEC vb.) bildirilir ve korunur.</li>
      </ul>
      <h2>Bildirim</h2>
      <ul>
        <li>
          <b>Uygulama içinden:</b> Mesaja uzun bas → "Bildir"; Kişiler listesinde kişinin yanındaki menü → "Bildir".
        </li>
        <li>
          <b>E-posta:</b> <Mail /> (konu: "Çocuk güvenliği"). Bu bildirimler öncelikli olarak, en geç 24 saat içinde incelenir.
        </li>
        <li>
          Acil bir tehlike varsa önce <b>112</b>'yi ara veya{" "}
          <a href="https://www.ihbarweb.org.tr" target="_blank" rel="noreferrer">
            ihbarweb.org.tr
          </a>{" "}
          üzerinden ihbarda bulun.
        </li>
      </ul>
      <h2>İletişim noktası</h2>
      <p>
        Çocuk güvenliği konularındaki irtibat kişisi: <Ctl />, <Mail />.
      </p>
    </LegalLayout>
  );
}
