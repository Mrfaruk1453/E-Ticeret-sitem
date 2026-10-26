# E-TİCARET SİTESİ: KATALOG, SEPET VE ÖDEME

**Osmaniye Korkut Ata Üniversitesi — Bilgisayar Programcılığı 2. Sınıf**  
**Ders:** Yönlendirilmiş Çalışma 1  
**Proje Kataloğu:** Grup 1 — Proje 02: *E-Ticaret Sitesi: Katalog, Sepet ve Ödeme*  
**Arayüz Şablonu:** ThemeWagon MultiShop  

---

## 📌 Proje Genel Bakışı ve Amacı
Bu proje; küçük bir mağazanın ürünlerini beden ve renk seçenekleriyle (varyantlar) satabildiği, üye olmadan da kullanılabilen misafir sepeti, kupon indirim sistemi ve deneme ortamı (sandbox) ödeme akışı sunan tam teşekküllü bir E-Ticaret platformudur.

Projenin merkezinde şartnamede belirtilen **"Stok ile sepetin birbirine sadık kalması"** ilkesi ve **9 Durumlu Sipariş Durum Makinesi (State Machine)** yer almaktadır.

---

## 🚀 Hızlı Başlangıç ve Çalıştırma

Projeyi çalıştırmak için bilgisayarınızda **Node.js** yüklü olması yeterlidir. Ek bir veritabanı sunucusu (PostgreSQL/MySQL kurulumu) gerekmez.

### 1. Bağımlılıkları Yükleyin:
```bash
npm install
```

### 2. Tohum Verisini (Seed) Yükleyin:
Boş veritabanına 32 ürün, 85 varyant, 6 kategori ve test kuponlarını ekler:
```bash
npm run seed
```

### 3. Sunucuyu Başlatın:
```bash
npm start
```

Tarayıcınızda açın:
- **Alışveriş Sitesi (Müşteri Arayüzü):** [http://localhost:3000](http://localhost:3000)
- **Katalog & Filtreleme:** [http://localhost:3000/shop.html](http://localhost:3000/shop.html)
- **Sepet:** [http://localhost:3000/cart.html](http://localhost:3000/cart.html)
- **Yönetici Paneli (Durum Makinesi Yönetimi):** [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

---

## 🧪 Testler ve Teslimat Kanıtları

### 1. Eşzamanlılık (Stok Yarışı / Race Condition) Testi:
Şartnamedeki *"Aynı anda iki sipariş gönderen denemenin çıktısı teslimde olmalı. İki kişi son ürünü aynı anda aldığında stok eksiye düşmemeli."* kuralının doğrulanması:
```bash
npm run test:concurrency
```
**Testin Yaptığı İşlem:**
- Stoğu yalnızca **1 adet** olan kritik bir test ürünü oluşturulur.
- İki farklı müşteri (`Müşteri A` ve `Müşteri B`) aynı milisaniyede bu son ürünü satın almaya çalışır.
- Veritabanı anlık atomik işlem kilidi (`BEGIN IMMEDIATE`) sayesinde yalnızca **biri** onaylanır (200 OK, Sipariş `ODENDI`), diğeri stok yetersizliği nedeniyle güvenle reddedilir.
- Son stok **0** olarak kalır, **asla -1'e düşmez**.

### 2. Uçtan Uca API ve İş Mantığı Testi:
```bash
npm run test:api
```

### 3. Tüm Testleri Birlikte Çalıştırma:
```bash
npm test
```

---

## ⚙️ Mimari ve Katı Kuralların Uygulanması

| Şartname Kuralı | Uygulama Yöntemi |
| :--- | :--- |
| **Kuruş Cinsinden Tamsayı Para** | Kayan noktalı (`0.1 + 0.2 = 0.30000000000000004`) float hatasını önlemek için tüm fiyatlar, indirimler ve kargo veritabanında `INTEGER cents` (örn: `24990` = 249.90 TL) olarak saklanır. |
| **Fiyat Manipülasyon Koruması** | İstemciden asla fiyat kabul edilmez. İstemci yalnızca `variant_id` ve `quantity` gönderir; tüm tutarlar sunucuda veritabanından okunarak hesaplanır. |
| **HttpOnly Oturum & Misafir Sepeti** | Misafir kullanıcının sepeti `HttpOnly` çerezi (`session_token`) ile eşlenir. |
| **Varyant & Tükendi Durumu** | Her ürünün beden (S, M, L, XL) ve renk (Siyah, Beyaz, vb.) varyantı, tekil stok kodu (SKU) ve stok adedi vardır. Stoğu 0 olan varyant anında `"TÜKENDİ"` olarak işaretlenir ve butonu pasifleşir. |
| **Filtrelerin Adreste Saklanması** | Kategori, fiyat aralığı, arama terimi, beden, renk ve sayfalama URL adresinde (`?category=...&min_price=...&page=...`) saklanır. Sayfa yenilendiğinde filtreler korunur. |
| **E-Posta Simülasyonu & BCC** | Sipariş tamamlandığında müşteriye ve gizli kopya (BCC) olarak mağazaya (`siparis@magaza.com`) HTML sipariş onay e-postası iletilir. |
| **Mükerrer Ödeme Engeli** | `idempotency_key` ve tekil `provider_ref` kısıtı ile aynı ödemenin iki kez `ODENDI` durumuna geçmesi engellenir. |

---

## 🔄 Şekil 02.1 Sipariş Durum Makinesi (State Machine)

Siparişler yalnız tanımlı **9 durumdan** birinde bulunabilir ve yalnız **10 izinli geçiş** yapılabilir:

```
[SEPET] 
   │ (siparişi tamamla)
   ▼
[ÖDEME BEKLİYOR] ────(kart reddedildi)────► [ÖDEME BAŞARISIZ]
   │                                              │ (tekrar dene)
   │ (sağlayıcı onayı)                            ▼
   │ (STOK BU ANDA DÜŞER)                   [ÖDEME BEKLİYOR]
   ▼
[ÖDENDİ] ───────────(iptal talebi)───────► [İPTAL] (Stok Geri Eklenir)
   │
   ▼
[HAZIRLANIYOR]
   │ (kargo takip no girildi)
   ▼
[KARGOLANDI]
   │
   ▼
[TESLİM EDİLDİ] ─────(14 gün içinde)──────► [İADE] (Stok Geri Eklenir)
```

### Durumların Özellikleri:
1. **SEPET**: Fiyat her istekte sunucudan okunur, stok dokunulmaz.
2. **ÖDEME BEKLİYOR**: Sipariş kaydı açıldı, sağlayıcıya yönlendirildi, stok hâlâ serbest.
3. **ÖDEME BAŞARISIZ**: Kart reddedildi; stok hiç düşmedi, müşteri tekrar deneyebilir.
4. **ÖDENDİ**: Sağlayıcı onayladı; **stok bu anda tek işlem (transaction) içinde düşer**.
5. **HAZIRLANIYOR**: Sipariş paketleniyor, stok düşük kalır.
6. **KARGOLANDI**: Kargo takip numarası girilerek kargolandı.
7. **TESLİM EDİLDİ**: Müşteriye teslim edildi; 14 günlük yasal iade penceresi başlar.
8. **İPTAL**: Sipariş iptal edildi; **stok stoğa geri eklenir**.
9. **İADE**: 14 gün içinde iade talebi onaylandı; **stok stoğa geri eklenir**.

---

## 💳 Deneme Ortamı (Sandbox) Test Kartları

Ödeme ekranında (`/checkout.html`) hem başarılı hem başarısız senaryoları tek tıkla test edebilirsiniz:

| Test Kartı | Kart Numarası | Sonuç | Açıklama |
| :--- | :--- | :--- | :--- |
| **Başarılı Kart** | `4242 4242 4242 4242` | ✅ **ONAYLANDI** | Durum `ODENDI` olur, stok düşer, e-posta gönderilir. |
| **Yetersiz Bakiye** | `4000 0000 0000 0002` | ❌ **REDDEDİLDİ** | Durum `ODEME_BASARISIZ` olur, stok düşmez. |
| **Güvenlik Reddi** | `4000 0000 0000 0003` | ❌ **REDDEDİLDİ** | Şüpheli işlem/güvenlik uyarısıyla reddedilir. |

*Son kullanma tarihi için `12/28`, CVV için `123` kullanabilirsiniz.*

---

## 🎟️ Test İndirim Kuponları

Sepet sayfasında (`/cart.html`) test edebileceğiniz kuponlar:

| Kupon Kodu | Tür | İndirim Tutarı | Asgari Sepet Şartı |
| :--- | :--- | :--- | :--- |
| `HOSGELDIN10` | Yüzde | %10 İndirim | 250,00 TL |
| `BAHAR50` | Sabit | 50,00 TL İndirim | 500,00 TL |
| `OGRENCI20` | Yüzde | %20 İndirim | 300,00 TL |
| `SEPET100` | Sabit | 100,00 TL İndirim | 1.000,00 TL |
| `GECMISKUPON` | Test | Tarihi geçmiş (Reddedilir) | 100,00 TL |

---

## 📁 Proje Dosya Yapısı

```
E-Ticeret-sitem/
├── .env.example                # Örnek ortam değişkenleri
├── .env                        # Yerel ortam ayarları (Port 3000, DB)
├── package.json                # Proje paketleri ve çalıştırma komutları
├── server.js                   # Express sunucusu ve middleware'ler
├── README.md                   # Proje teslimat dokümantasyonu
├── data/
│   └── ecommerce.db            # SQLite yerel veritabanı
├── src/
│   ├── config/
│   │   └── database.js         # SQLite bağlantısı ve atomik işlem yöneticisi
│   ├── db/
│   │   └── schema.js           # 9 tablonun şeması, indeksler ve kısıtlar
│   ├── services/
│   │   ├── catalogService.js   # Ürün listeleme, filtreleme, arama ve sayfalama
│   │   ├── cartService.js      # Misafir sepeti, miktar kontrolleri, kuruş hesabı
│   │   ├── couponService.js    # Kupon kuralları, son kullanma ve asgari tutar kontrolü
│   │   ├── stateMachine.js     # 9 durum ve 10 izinli geçiş motoru
│   │   ├── paymentService.js   # Sandbox ödeme simülatörü ve idempotency
│   │   ├── orderService.js     # Sipariş oluşturma ve yönetimi
│   │   └── emailService.js     # Müşteri ve mağaza BCC e-posta bildirimi
│   └── routes/
│       ├── catalogRoutes.js    # /api/products, /api/categories
│       ├── cartRoutes.js       # /api/cart işlemleri
│       ├── checkoutRoutes.js   # /api/checkout ödeme tamamlama
│       ├── orderRoutes.js      # /api/orders sipariş sorgulama
│       └── adminRoutes.js      # /api/admin durum makinesi geçişleri
├── scripts/
│   ├── seed.js                 # 32 ürün, 85 varyant tohumlama komutu
│   ├── test-concurrency.js     # Eşzamanlılık stok yarışı test betiği
│   └── test-api.js             # Uçtan uca API doğrulama betiği
└── public/                     # ThemeWagon MultiShop frontend dosyaları
    ├── css/                    # Bootstrap ve özel stiller
    ├── js/
    │   ├── app-common.js       # Kuruş formatlama, sepet rozeti, bildirimler
    │   ├── app-home.js         # Anasayfa öne çıkanlar ve kategoriler
    │   ├── app-catalog.js      # Katalog, filtreler, arama ve URL senkronizasyonu
    │   ├── app-detail.js       # Beden/renk seçimi ve dinamik stok takibi
    │   ├── app-cart.js         # Sepet yönetimi ve kupon doğrulama
    │   ├── app-checkout.js     # Ödeme formu ve sandbox test kartları
    │   ├── app-order-success.js# Sipariş takip ve durum makinesi stepper'ı
    │   └── app-admin.js        # Yönetici paneli ve durum geçiş butonları
    ├── img/                    # Ürün ve kategori görselleri
    ├── lib/                    # OwlCarousel vb. kütüphaneler
    ├── index.html              # Anasayfa
    ├── shop.html               # Katalog ve Filtreleme
    ├── detail.html             # Ürün Detay & Varyantlar
    ├── cart.html               # Alışveriş Sepeti
    ├── checkout.html           # Ödeme Sayfası (Sandbox)
    ├── order-success.html      # Sipariş Onay & Durum Takibi
    ├── admin.html              # Yönetici Paneli (Durum Makinesi)
    └── contact.html            # İletişim Sayfası
```

---

## 🎓 Akademik Teslimat Notu
Bu çalışma, Osmaniye Korkut Ata Üniversitesi Bilgisayar Programcılığı Bölümü 2. Sınıf öğrencisi Ömer Faruk Üzer tarafından dersin tüm yönergelerine ve Şekil 02.1'de tarif edilen durum makinesi kurallarına eksiksiz riayet edilerek hazırlanmıştır.
