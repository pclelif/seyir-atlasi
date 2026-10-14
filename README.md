# SeyirAtlası

SeyirAtlası; film ve dizileri keşfetmek, ayrıntılarını incelemek ve kişisel
seyir listeleri oluşturmak için geliştirilmiş Türkçe bir web uygulamasıdır.
TMDB'den yapım bilgilerini, OMDb'den IMDb puanlarını alır. **Pusula** adlı
yapay zekâ destekli danışman ise kullanıcının o anki tercihlerini dinleyerek
film veya dizi önerileri üretir.

Proje, bir arayüz çalışması olmasının yanında arama, filtreleme, kişisel
kütüphane, PostgreSQL tabanlı hesap ve yapay zekâ destekli öneri akışlarını tek
bir uygulamada bir araya getirir.

## Özellikler

- **Keşif:** Haftanın öne çıkan film ve dizileri, ad, tür ve yıl ile arama ve filtreleme, IMDb puanına veya popülerliğe göre sıralama.
- **Ayrıntı Pencereleri:** Özet, oyuncular, fragman, benzer yapımlar ve Türkiye'deki izleme sağlayıcıları.
- **Kişisel Kütüphane:** Favoriler, "Daha Sonra İzle" listesi, izlenenler ve isim ile açıklama verilebilen özel listeler.
- **Kişisel Puan:** Yapımlara kendi puanını verme.
- **Paylaşım:** Film ve dizi listelerini bağlantı ile paylaşma, listeyi hesaba kopyalama ve paylaşımı kapatma.
- **Profil:** Film ve dizi koleksiyonlarını birlikte özetleyen hesap profili, aylık ve yıllık seyir özeti, isteğe bağlı herkese açık profil ve veri dışa aktarma.
- **Arayüz:** Açık ve koyu tema, masaüstü ve mobil uyumlu tasarım.
- **Pusula:** Gemini destekli danışmandan tercihe göre üç yapım önerisi alma.

## Sayfalar

| Dosya | Görevi |
| --- | --- |
| `index.html` | Film ana sayfası, film arşivi ve Pusula |
| `series.html` | Dizi ana sayfası, dizi arşivi ve Pusula |
| `movie-list.html` | Favori, izlenen ve özel film listeleri |
| `series-list.html` | Favori, izlenen ve özel dizi listeleri |
| `profile.html` | Hesap işlemleri, istatistikler ve koleksiyon özeti |
| `shared-list.html` | Bağlantıyla paylaşılan film veya dizi listesi |
| `public-profile.html` | İsteğe bağlı herkese açık kullanıcı profili |

## Teknolojiler

- HTML, CSS ve modern JavaScript
- Node.js'in yerleşik HTTP sunucusu
- PostgreSQL
- SMTP veya Brevo API ile e-posta gönderimi
- [TMDB API](https://developer.themoviedb.org/docs/getting-started)
- [OMDb API](https://www.omdbapi.com/)
- [Google Gemini API](https://ai.google.dev/gemini-api/docs)

`server.js` statik dosyaları sunar. Ayrıca API anahtarlarını tarayıcıya açmadan
veri geçitlerini, PostgreSQL hesaplarını, e-posta işlemlerini ve ziyaret
istatistiklerini yönetir.

## Proje Yapısı

```text
.
├── index.html             # Film keşif sayfası
├── series.html            # Dizi keşif sayfası
├── movie-list.html        # Film koleksiyonu
├── series-list.html       # Dizi koleksiyonu
├── profile.html           # Hesap ve profil
├── shared-list.html       # Paylaşılan liste
├── public-profile.html    # Herkese açık profil
├── movies.js              # Film verisi ve arayüz davranışları
├── series.js              # Dizi verisi ve arayüz davranışları
├── profile.js             # Hesap ve profil işlemleri
├── navigation.js          # Ortak gezinme ve görsel etkileşimler
├── styles.css             # Ortak tasarım sistemi
├── server.js              # Statik sunucu, API geçitleri, hesaplar ve e-posta
├── images/                # Logo, ikon ve avatarlar
└── start.command          # macOS için başlatıcı
```

## Kurulum

### Gereksinimler

- Node.js 20 veya üzeri
- Hesap özellikleri için bir PostgreSQL veritabanı
- İnternet bağlantısı
- TMDB, OMDb ve Pusula için ilgili servislerin API anahtarları

### Adımlar

1. Depoyu indirin ve proje dizinine geçin.
2. Örnek ortam dosyasını kopyalayın:

   ```bash
   cp .env.example .env
   ```

3. `.env` içindeki `TMDB_API_KEY`, `OMDB_API_KEY` ve `GEMINI_API_KEY`
   değerlerini kendi anahtarlarınızla değiştirin.
4. Hesap özellikleri için `DATABASE_URL` değerini PostgreSQL bağlantı adresinizle
   doldurun. Yerel veritabanında `DATABASE_SSL=false` kullanın.
5. Sunucuyu başlatın:

   ```bash
   npm start
   ```

6. Tarayıcıda [http://localhost:3000](http://localhost:3000) adresini açın.

macOS'ta proje ile birlikte yerel Node.js çalışma zamanı bulunuyorsa
`start.command` dosyasına çift tıklayarak da uygulamayı açabilirsiniz.

> Sayfaları dosya sisteminden doğrudan açmayın, yerel sunucu üzerinden
> çalıştırın. Pusula yalnızca `/api/pusula` uç noktası erişilebilir olduğunda
> çalışır.

## Ortam Değişkenleri

| Değişken | Zorunlu mu? | Açıklama |
| --- | --- | --- |
| `TMDB_API_KEY` | Keşif için evet | TMDB API anahtarı |
| `OMDB_API_KEY` | IMDb verileri için evet | OMDb API anahtarı |
| `GEMINI_API_KEY` | Pusula için evet | Gemini API anahtarı |
| `GEMINI_MODEL` | Hayır | Varsayılan: `gemini-3.5-flash-lite` |
| `HOST` | Hayır | Yerelde varsayılan `127.0.0.1`, Render'da `0.0.0.0` kullanın |
| `PORT` | Hayır | Varsayılan: `3000` |
| `DATABASE_URL` | Hesaplar için evet | PostgreSQL bağlantı adresi |
| `DATABASE_SSL` | Hayır | Uzak veritabanında `true`, yerelde `false` |
| `APP_URL` | Üretimde evet | Uygulamanın `https://...` adresi |
| `SMTP_HOST`, `SMTP_PORT` | E-posta için evet | SMTP sunucusu ve portu |
| `SMTP_SECURE` | Hayır | Port 465 için `true`, STARTTLS veya 587 için `false` |
| `SMTP_USER`, `SMTP_PASS` | Genellikle evet | SMTP kimlik bilgileri |
| `MAIL_FROM` | E-posta için evet | Gönderen adı ve adresi |
| `BREVO_API_KEY` | Ücretsiz Render'da e-posta için | SMTP portu yerine HTTPS üzerinden çalışan Brevo API anahtarı |
| `ANALYTICS_SECRET` | Üretimde evet | Günlük tekil ziyaret özetlerini üretmek için uzun, rastgele gizli değer |
| `ADMIN_EMAIL` | İstatistik özeti için evet | `/api/analytics/summary` adresine erişebilen doğrulanmış hesabın e-postası |

Üç API anahtarı da yalnızca `server.js` tarafından `.env` dosyasından veya
sunucu ortamından okunur. Tarayıcı TMDB ve OMDb'ye doğrudan bağlanmaz,
`/api/tmdb` ve `/api/omdb` geçitlerini kullanır. Böylece anahtarlar istemci
dosyalarında veya ağ yanıtlarında yayımlanmaz.

## Hesap ve Veriler

Kullanıcı hesapları, doğrulama kayıtları ve iptal edilebilir oturumlar
PostgreSQL'de tutulur. Parolalar benzersiz salt ile `scrypt` kullanılarak
özetlenir. Tarayıcıya parola veya parola özeti yazılmaz. Oturum anahtarı
`HttpOnly`, `SameSite=Lax` ve üretimde `Secure` çerezle taşınır.

Hesap başka cihazlarda kullanılabilir. Film ve dizi koleksiyonları ise şimdilik
tarayıcıda hesap kimliğine bağlı tutulur. Cihazlar arası koleksiyon eşitlemesi
sonraki veri taşıma adımıdır.

Misafirken oluşturulan film koleksiyonu, kullanıcı hesap açtığında ilgili
hesaba aktarılır. Film ve dizi koleksiyonları ayrı saklanır, profil sayfası
ikisini birlikte özetler.

## Pusula Çalışma Mantığı

1. Kullanıcı yapım türü, süre, izleme ortamı ve o anki ihtiyacını seçer.
2. Tarayıcı seçimleri ve son sohbet mesajlarını `POST /api/pusula` ile sunucuya
   gönderir.
3. Sunucu Gemini'den yapılandırılmış bir Türkçe yanıt ve en fazla üç öneri alır.
4. Arayüz önerilen yapımları TMDB'de bularak normal film ve dizi kartları
   şeklinde gösterir.

Uç noktada istek boyutu sınırı ve IP başına basit bir dakikalık hız sınırı
bulunur. Gemini anahtarı tanımlı değilse keşif ve liste özellikleri çalışmaya
devam eder, yalnızca yapay zekâ önerileri kullanılamaz.

## Kontrol

JavaScript dosyalarının temel sözdizimi kontrolü için:

```bash
npm run check
```

## Render'da Yayınlama

Uygulama sunucu tarafında API geçitleri kullandığı için Render'da **Static
Site** yerine **Web Service** olarak yayınlanmalıdır.

1. Depoyu GitHub'a yükleyin ve Render'da **New Web Service** seçeneğini açın.
2. GitHub deponuzu bağlayın.
3. Servis ayarlarını şöyle yapın:

   | Ayar | Değer |
   | --- | --- |
   | Runtime | `Node` |
   | Build Command | `npm install` |
   | Start Command | `npm start` |

4. **Environment** bölümüne şu değişkenleri ekleyin:

   - `HOST=0.0.0.0`
   - `TMDB_API_KEY`
   - `OMDB_API_KEY`
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL`, isteğe bağlı
   - `DATABASE_URL` ve `DATABASE_SSL=true`
   - `APP_URL=https://...`
   - `ANALYTICS_SECRET`
   - `ADMIN_EMAIL`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` ve `MAIL_FROM`
   - `BREVO_API_KEY`, ücretsiz planda SMTP portları kapalı olduğu için SMTP yerine kullanılır

Render `PORT` değişkenini otomatik sağladığı için ayrıca tanımlamayın. Gerçek
API anahtarlarını `.env` dosyasıyla GitHub'a yüklemeyin, yalnızca Render'ın
ortam değişkenleri alanında saklayın.

## Güvenlik

- **Ortam Dosyası:** `.env` dosyası Git tarafından yok sayılır. Gerçek API anahtarlarını depoya eklemeyin.
- **Örnek Dosya:** `.env.example` yalnızca örnek değerler içerir ve güvenle paylaşılabilir.
- **Sızan Anahtarlar:** Bir anahtar yanlışlıkla yayımlanırsa ilgili sağlayıcıdan hemen iptal edip yenisini oluşturun.
- **Üretim Ortamı:** HTTP istekleri HTTPS'e yönlendirilir. HSTS, CSP ve temel tarayıcı güvenlik başlıkları sunucu tarafından eklenir.

## Ziyaret İstatistikleri

Uygulama üçüncü taraf analitik betiği veya analitik çerezi kullanmaz. Her sayfa
görüntülemesi kendi sunucusundaki `/api/analytics/view` uç noktasına bildirilir.
IP adresi veritabanına yazılmaz. Yalnızca gün ve `ANALYTICS_SECRET` ile günlük,
geri döndürülemez bir özet üretmek için anlık kullanılır. Bu özetler günlük
tekil ziyaret tahmini ve sayfa görüntüleme toplamı üretir, 395 gün sonra silinir.

Son 30 günlük özet, `ADMIN_EMAIL` ile eşleşen doğrulanmış hesap oturumu
üzerinden `GET /api/analytics/summary` adresinde JSON olarak görüntülenebilir.

## Bilinen Sınırlar

- Film ve dizi koleksiyonları henüz cihazlar arasında eşitlenmez.
- TMDB ve OMDb erişimi internet bağlantısına ve servislerin kotalarına bağlıdır.
- SMTP veya Brevo yapılandırılmazsa üretimde doğrulama ve şifre yenileme e-postaları gönderilemez.

## Veri ve Marka Notu

Film ve dizi metaverileri ile görselleri TMDB, puan bilgileri OMDb üzerinden
alınır. Bu proje söz konusu servislerle resmî olarak bağlantılı veya onlar
tarafından onaylanmış değildir.
