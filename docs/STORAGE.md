# STORAGE & COST CONTROLS

## Sürücüler
| Sürücü | Ne zaman | Not |
|---|---|---|
| `local` (varsayılan) | OCI değişkenleri eksikse | Parçalar `MEDIA_DIR/parts/<media_id>/<n>` altına yazılır, `complete` sırasında tek dosyada birleştirilir (`MEDIA_DIR/rooms/<kod>/<media_id>.<uzantı>`). Okuma `/api/media/{id}/stream` üzerinden HTTP Range (206) ile. Docker'da `media-data` volume'u. |
| `oci` | `OCI_S3_ENDPOINT, OCI_REGION, OCI_ACCESS_KEY, OCI_SECRET_KEY, OCI_BUCKET` beşi de doluysa | Oracle Object Storage S3-uyumlu API, ön-imzalı `upload_part` / `get_object` URL'leri. İstemci dosyayı **doğrudan** bucket'a yükler. |

Eski geçici `emergent` sürücüsü kaldırıldı. `/api/media/{id}/stream` her iki sürücüde de geçerli HMAC imzası (`exp` + `sig`) ister; OCI'de imza doğrulandıktan sonra ön-imzalı URL'ye yönlendirir. Mobil uygulama CORS'a ihtiyaç duymaz; tarayıcıdan doğrudan OCI'ye PUT için bucket CORS'u gerekir (aşağıya bakın).

## OCI kurulumu (kullanıcının yapacağı)
1. OCI Console → Object Storage → Bucket oluştur (Standard tier, **Private**).
2. Identity → Users → kendi kullanıcın veya ayrı servis kullanıcısı → **Customer Secret Keys** → Generate (Access/Secret).
3. Namespace'i not et. Endpoint: `https://<namespace>.compat.objectstorage.<region>.oraclecloud.com`.
4. Minimum IAM politikası (servis kullanıcısı grubu için):
   `Allow group nexora-uploader to manage objects in compartment <c> where target.bucket.name='<bucket>'`
5. Tarayıcıdan doğrudan PUT için bucket'a CORS gerekir; OCI S3-uyumlu API'de CORS desteği **doğrulanmalı** — desteklenmiyorsa parça PUT'ları backend proxy'si üzerinden yapılır (kod yolu hazır: emergent sürücüsündeki gibi).
6. `.env`: `OCI_S3_ENDPOINT=...`, `OCI_REGION=eu-frankfurt-1`, `OCI_ACCESS_KEY=...`, `OCI_SECRET_KEY=...`, `OCI_BUCKET=nexora-media` → backend yeniden başlat.

## Always Free sınırları (resmî dokümana göre, hesapla doğrulanmalı)
20 GB toplam Object Storage (Standard+Infrequent+Archive), 50.000 API isteği/ay, 10 TB/ay çıkış. Ücretsiz deneme bittikten sonra limitler hesap tipine göre değişebilir — **doğrulanmadı**.

## Kontroller (yapılandırılabilir env)
| Değişken | Varsayılan |
|---|---|
| `MAX_UPLOAD_BYTES` | 2 GB |
| `STORAGE_QUOTA_BYTES` | 18 GB (20 GB'ın altında güvenlik payı) |
| `PARTICIPANT_QUOTA_BYTES` | 4 GB |
| `STORAGE_WARN_RATIO` | 0,8 → `/api/storage/usage` `warn:true` |
| `OCI_MONTHLY_REQUEST_LIMIT` | 45.000 (50k'nın altında) — aşılacaksa yükleme 429 ile durur |
| `MEDIA_RETENTION_DAYS` | 7 |
| `STALE_UPLOAD_HOURS` | 24 → yarım multipart abort + `failed` |

- İstek sayacı yalnızca backend'in yaptığı OCI çağrılarını sayar; istemcinin doğrudan PUT/GET istekleri sayılmaz (yaklaşık). Kesin değer için OCI Metrics/Usage Reports kullanılmalı.
- `local` sürücüsünde disk kullanımı `STORAGE_QUOTA_BYTES` ile sınırlanır; sunucu diskinin bu değerden büyük olduğundan emin olun.
- Transcode/HLS üretimi **yok** ve otomatik ücretli kaynak açılmaz. MP4 olduğu gibi Range ile oynatılır.
- Oda kapandığında dosya hemen silinmez (ürün kararı bekliyor); retention politikası belgelendi, otomatik silme **henüz uygulanmadı**.
