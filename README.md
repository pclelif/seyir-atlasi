# SeyirAtlası

SeyirAtlası; film ve dizileri keşfetmek, ayrıntılarını incelemek ve kişisel
seyir listeleri oluşturmak için geliştirilmiş Türkçe bir web uygulamasıdır.
TMDB'den yapım bilgilerini, OMDb'den IMDb puanlarını alır. **Pusula** adlı
yapay zekâ destekli danışman ise kullanıcının o anki tercihlerini dinleyerek
film veya dizi önerileri üretir.

Proje, bir arayüz çalışması olmasının yanında arama, filtreleme, kişisel
kütüphane, PostgreSQL tabanlı hesap ve yapay zekâ destekli öneri akışlarını tek bir
uygulamada bir araya getirir.

## Neler sunuyor?

- Haftanın öne çıkan film ve dizilerini görüntüleme
- Ad, tür ve yıl ile arama ve filtreleme
- IMDb puanına veya popülerliğe göre sıralama
- Özet, oyuncular, fragman, benzer yapımlar ve Türkiye'deki izleme
  sağlayıcılarını içeren ayrıntı pencereleri
- Yapımları favorilere, “Daha Sonra İzle” listesine veya izlenenlere ekleme
- İsim ve açıklama verilebilen özel listeler oluşturma
- Filmlere kişisel puan verme ve film listelerini bağlantı ile paylaşma
- Film ve dizi koleksiyonlarını birlikte özetleyen gerçek hesap profili
- Cihazlar arasında eşitlenen koleksiyonlar ve kişisel puanlar
- Kalıcı liste bağlantıları, listeyi hesaba kopyalama ve paylaşımı kapatma
- Aylık/yıllık seyir özeti, isteğe bağlı herkese açık profil ve veri dışa aktarma
- Açık/koyu tema ve masaüstü/mobil uyumlu arayüz
- Gemini destekli Pusula ile tercihe göre üç yapım önerisi alma

## Sayfalar

| Dosya | Görevi |
| --- | --- |
| `index.html` | Film ana sayfası, film arşivi ve Pusula |
| `series.html` | Dizi ana sayfası, dizi arşivi ve Pusula |
| `movie-list.html` | Favori, izlenen ve özel film listeleri |
| `series-list.html` | Favori, izlenen ve özel dizi listeleri |
| `profile.html` | Hesap işlemleri, istatistikler ve koleksiyon özeti |
| `shared-list.html` | Bağlantıyla paylaşılan film/dizi listesi |
| `public-profile.html` | İsteğe bağlı herkese açık kullanıcı profili |

## Kullanılan teknolojiler

- HTML, CSS ve modern JavaScript
- Node.js'in yerleşik HTTP sunucusu
- [TMDB API](https://developer.themoviedb.org/docs/getting-started)
- [OMDb API](https://www.omdbapi.com/)
- [Google Gemini API](https://ai.google.dev/gemini-api/docs)

`server.js` statik dosyaları sunar; API anahtarlarını tarayıcıya açmadan veri
geçitlerini, PostgreSQL hesaplarını ve e-posta işlemlerini yönetir.

## Kurulum ve çalıştırma

### Gereksinimler

- Node.js 20 veya üzeri
- İnternet bağlantısı
- TMDB, OMDb ve Pusula için ilgili servislerin API anahtarları

1. Depoyu indirin ve proje dizinine geçin.
2. Örnek ortam dosyasını kopyalayın:

   ```bash
   cp .env.example .env
   ```

3. `.env` içindeki `TMDB_API_KEY`, `OMDB_API_KEY` ve `GEMINI_API_KEY`
   değerlerini kendi API anahtarlarınızla değiştirin.
4. Sunucuyu başlatın:

   ```bash
   npm start
   ```

5. Tarayıcıda [http://localhost:3000](http://localhost:3000) adresini açın.

macOS'ta proje ile birlikte yerel Node.js çalışma zamanı bulunuyorsa
`start.command` dosyasına çift tıklayarak da uygulamayı açabilirsiniz.

> Uygulama sayfalarını dosya sisteminden doğrudan açmak yerine yerel sunucu
> üzerinden çalıştırın. Pusula yalnızca `/api/pusula` uç noktası erişilebilir
> olduğunda çalışır.

## Ortam değişkenleri

| Değişken | Zorunlu mu? | Açıklama |
| --- | --- | --- |
| `TMDB_API_KEY` | Keşif için evet | TMDB API anahtarı |
| `OMDB_API_KEY` | IMDb verileri için evet | OMDb API anahtarı |
| `GEMINI_API_KEY` | Pusula için evet | Gemini API anahtarı |
| `GEMINI_MODEL` | Hayır | Varsayılan: `gemini-3.5-flash-lite` |
| `HOST` | Hayır | Yerelde varsayılan: `127.0.0.1`; Render'da `0.0.0.0` kullanın |
| `PORT` | Hayır | Varsayılan: `3000` |
| `DATABASE_URL` | Hesaplar için evet | PostgreSQL bağlantı adresi |
| `DATABASE_SSL` | Hayır | Uzak veritabanında `true`; yerelde `false` |
| `APP_URL` | Üretimde evet | Uygulamanın `https://...` adresi |
| `SMTP_HOST` / `SMTP_PORT` | E-posta için evet | SMTP sunucusu ve portu |
| `SMTP_SECURE` | Hayır | Port 465 için `true`, STARTTLS/587 için `false` |
| `SMTP_USER` / `SMTP_PASS` | Genellikle evet | SMTP kimlik bilgileri |
| `MAIL_FROM` | E-posta için evet | Gönderen adı ve adresi |
| `BREVO_API_KEY` | Ücretsiz Render'da e-posta için | SMTP portu yerine HTTPS üzerinden Brevo API anahtarı |
| `ANALYTICS_SECRET` | Üretimde evet | Günlük tekil ziyaret özetlerini üretmek için uzun, rastgele gizli değer |
| `ADMIN_EMAIL` | İstatistik özeti için evet | `/api/analytics/summary` erişimine izin verilen doğrulanmış hesap e-postası |

Üç API anahtarı da yalnızca `server.js` tarafından `.env` dosyasından veya
sunucu ortamından okunur. Tarayıcı TMDB ve OMDb'ye doğrudan bağlanmaz;
`/api/tmdb` ve `/api/omdb` geçitlerini kullanır. Böylece anahtarlar istemci
JavaScript dosyalarında veya ağ yanıtlarında yayımlanmaz.

## Proje yapısı

```text
.
├── index.html             # Film keşif sayfası
├── series.html            # Dizi keşif sayfası
├── movie-list.html        # Film koleksiyonu
├── series-list.html       # Dizi koleksiyonu
├── profile.html           # Hesap ve profil
├── movies.js              # Film verisi ve arayüz davranışları
├── series.js              # Dizi verisi ve arayüz davranışları
├── profile.js             # Yerel hesap ve profil işlemleri
├── navigation.js          # Ortak gezinme ve görsel etkileşimler
├── styles.css             # Ortak tasarım sistemi
├── server.js              # Statik sunucu ve Pusula API geçidi
├── images/                # Logo, ikon ve avatarlar
└── start.command          # macOS için başlatıcı
```

## Hesap ve veriler

Kullanıcı hesapları, doğrulama kayıtları ve iptal edilebilir oturumlar
PostgreSQL'de tutulur. Parolalar benzersiz salt ile `scrypt` kullanılarak
özetlenir; tarayıcıya parola veya parola özeti yazılmaz. Oturum anahtarı
`HttpOnly`, `SameSite=Lax` ve üretimde `Secure` çerezle taşınır.

Bu nedenle:

- Hesap başka cihazlarda kullanılabilir.
- Film ve dizi koleksiyonları şimdilik tarayıcıda hesap kimliğine bağlı tutulur;
  cihazlar arası koleksiyon eşitlemesi sonraki veri taşıma adımıdır.

Misafirken oluşturulan film koleksiyonu, kullanıcı yerel bir hesap açtığında
ilgili hesaba aktarılır. Film ve dizi koleksiyonları ayrı saklanır; profil
sayfası ikisini birlikte özetler.

## Pusula nasıl çalışıyor?

1. Kullanıcı yapım türü, süre, izleme ortamı ve o anki ihtiyacını seçer.
2. Tarayıcı seçimleri ve son sohbet mesajlarını `POST /api/pusula` ile sunucuya
   gönderir.
3. Sunucu Gemini'den yapılandırılmış bir Türkçe yanıt ve en fazla üç öneri alır.
4. Arayüz önerilen yapımları TMDB'de bularak normal film/dizi kartları şeklinde
   gösterir.

Uç noktada istek boyutu sınırı ve IP başına basit bir dakikalık hız sınırı
bulunur. Pusula anahtarı tanımlı değilse uygulamanın keşif ve liste özellikleri
çalışmaya devam eder; yalnızca yapay zekâ önerileri kullanılamaz.

## Kontrol

JavaScript dosyalarının temel sözdizimi kontrolünü çalıştırmak için:

```bash
npm run check
```

## Render'da yayınlama

Bu uygulama sunucu tarafında API geçitleri kullandığı için Render'da **Static
Site** yerine **Web Service** olarak yayınlanmalıdır.

1. Depoyu GitHub'a yükleyin ve Render'da **New Web Service** seçeneğini açın.
2. GitHub deponuzu bağlayın.
3. Servis ayarlarını aşağıdaki gibi yapılandırın:

   | Ayar | Değer |
   | --- | --- |
   | Runtime | `Node` |
   | Build Command | `npm install` |
   | Start Command | `npm start` |

4. Render'ın **Environment** bölümüne şu değişkenleri ekleyin:

   - `HOST=0.0.0.0`
   - `TMDB_API_KEY`
   - `OMDB_API_KEY`
    - `GEMINI_API_KEY`
    - İsteğe bağlı olarak `GEMINI_MODEL`
    - `DATABASE_URL`, `DATABASE_SSL=true`
    - `APP_URL=https://...`
    - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`

Render `PORT` değişkenini otomatik sağladığı için ayrıca tanımlamayın. Gerçek
API anahtarlarını `.env` dosyasıyla GitHub'a yüklemeyin; yalnızca Render'ın
ortam değişkenleri alanında saklayın.

## Güvenlik

- `.env` dosyası Git tarafından yok sayılır; gerçek API anahtarlarını depoya
  eklemeyin.
- `.env.example` yalnızca örnek değerler içerir ve güvenle paylaşılabilir.
- Bir anahtar yanlışlıkla yayımlanırsa ilgili sağlayıcıdan hemen iptal edip
  yenisini oluşturun.
- Üretimde HTTP istekleri HTTPS'e yönlendirilir; HSTS, CSP ve temel tarayıcı
  güvenlik başlıkları sunucu tarafından eklenir.

## Ziyaret istatistikleri

Uygulama üçüncü taraf analitik betiği veya analitik çerezi kullanmaz. Her sayfa
görüntülemesi kendi sunucusundaki `/api/analytics/view` uç noktasına bildirilir.
IP adresi veritabanına yazılmaz; yalnızca gün ve `ANALYTICS_SECRET` ile günlük,
geri döndürülemez bir özet üretmek için anlık kullanılır. Bu özetler günlük
tekil ziyaret tahmini ve sayfa görüntüleme toplamı üretir, 395 gün sonra silinir.

Son 30 günlük özet, `ADMIN_EMAIL` ile eşleşen doğrulanmış hesap oturumu üzerinden
`GET /api/analytics/summary` adresinden JSON olarak görüntülenebilir.

## Bilinen sınırlar

- Film ve dizi koleksiyonları henüz cihazlar arasında eşitlenmez.
- TMDB ve OMDb erişimi internet bağlantısına ve ilgili servislerin kotalarına
  bağlıdır.
- SMTP yapılandırılmazsa üretimde doğrulama ve şifre yenileme e-postaları gönderilemez.

## Veri ve marka notu

Film/dizi metaverileri ve görselleri TMDB, puan bilgileri OMDb üzerinden alınır.
Bu proje söz konusu servislerle resmî olarak bağlantılı veya onlar tarafından
onaylanmış değildir.
