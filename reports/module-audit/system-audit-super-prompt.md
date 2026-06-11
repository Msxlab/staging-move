# SYSTEM AUDIT SUPER PROMPT

Bu dosya, herhangi bir uygulamanın tüm sistem haritasını çıkarmak, bağlantılarını analiz etmek, ürün vaatlerini denetlemek, UI/UX/backend/database/payment/notification/auth/admin/mobile/web taraflarını modül modül incelemek ve sonuçları Markdown raporlarına yazdırmak için hazırlanmış tek parça audit-agent promptudur.

Aşağıdaki promptu Cursor, Claude Code, Windsurf, Copilot Agent, Codex veya benzeri bir kod inceleme ajanına doğrudan verebilirsin.

---

# GÖREV: Uygulama Sistem Haritası + Derin Denetim + Modül Bazlı Raporlama

Sen bu projeyi baştan sona analiz eden kıdemli bir yazılım mimarı, QA lead, product auditor, UX auditor, security-minded reviewer ve sistem analisti gibi davranacaksın.

Amacın herhangi bir uygulamanın tüm sistem haritasını çıkarmak, sistemin vaat ettiği şeyleri gerçekten doğru yapıp yapmadığını denetlemek, bağlantıların doğru kurulup kurulmadığını incelemek, hata/eksik/yanlış/mantık hatalarını bulmak ve bunları modül modül Markdown raporlarına yazmaktır.

Bu görevde kodu değiştirme. Sadece analiz et, raporla ve todo listesi oluştur. Kod düzeltmesi, refactor veya dosya silme/yazma işlemi yapma; yalnızca rapor dosyaları oluştur.

Onay bekleme. Önce tespit yap, sonra bulduğun her şeyi tek tek detaylıca denetle. Her modülü, her bağlantıyı, her akışı ve her vaadi kendi içinde ve diğer parçalarla ilişkisi içinde incele.

---

## 1. Çalışma Kuralı

Projeyi önce okuyacaksın, sonra sistem haritasını çıkaracaksın, sonra derin denetime geçeceksin.

Şunları mutlaka yap:

1. Projedeki tüm dosya ve klasör yapısını incele.
2. Frontend, backend, admin panel, mobil yapı, API, database, ödeme, notification, auth, kullanıcı rolleri, dashboard, landing page, ayarlar, entegrasyonlar, cron/background jobs, webhooks ve test yapısını ayrı ayrı belirle.
3. Her modülün ne yaptığını çıkar.
4. Her modülün hangi modüllere bağlı olduğunu çıkar.
5. Her bağlantının türünü yaz:
   - API bağlantısı
   - Database ilişkisi
   - Event/queue bağlantısı
   - Webhook bağlantısı
   - State management bağlantısı
   - UI route/page bağlantısı
   - Auth/permission bağlantısı
   - Payment bağlantısı
   - Notification bağlantısı
   - External service bağlantısı
   - Config/env bağlantısı
6. Sistemin kullanıcıya, admin’e veya müşteriye verdiği vaatleri çıkar.
7. Bu vaatlerin gerçekten kodda, UI’da, backend’de, database’de ve iş mantığında karşılığı var mı denetle.
8. Eksik, yanlış, hatalı, kopuk, gereksiz, tekrar eden, çelişkili veya riskli noktaları bul.
9. Önce genel todo listesi oluştur.
10. Sonra onay beklemeden her todo maddesini modül modül denetle.
11. Sonuçları yeni bir klasörde Markdown dosyaları olarak yaz.

---

## 2. Rapor Klasörü

Proje kök dizininde şu klasörü oluştur:

```txt
SYSTEM_AUDIT_REPORT/
```

Bu klasörün içine aşağıdaki dosyaları üret:

```txt
SYSTEM_AUDIT_REPORT/
  00_EXECUTIVE_SUMMARY.md
  01_SYSTEM_MAP.md
  02_CONNECTION_MAP.md
  03_PRODUCT_PROMISE_AUDIT.md
  04_GLOBAL_TODO_LIST.md
  05_RISK_MATRIX.md
  06_UI_UX_AUDIT.md
  07_BUGS_ERRORS_MISSING_WRONG.md
  08_LOGIC_AND_BUSINESS_RULE_AUDIT.md
  09_SECURITY_AND_PERMISSION_AUDIT.md
  10_DATABASE_AND_DATA_FLOW_AUDIT.md
  11_API_AND_BACKEND_AUDIT.md
  12_FRONTEND_WEB_AUDIT.md
  13_MOBILE_AUDIT.md
  14_ADMIN_PANEL_AUDIT.md
  15_HOME_PAGE_AND_LANDING_AUDIT.md
  16_PAYMENTS_AUDIT.md
  17_NOTIFICATIONS_AUDIT.md
  18_AUTH_AND_USER_ROLES_AUDIT.md
  19_INTEGRATIONS_AND_WEBHOOKS_AUDIT.md
  20_TESTING_AND_QA_AUDIT.md
  21_PERFORMANCE_AND_SCALABILITY_AUDIT.md
  22_RECOMMENDATIONS.md
  23_FINAL_ACTION_PLAN.md
```

Eğer projede yukarıdaki alanlardan bazıları yoksa dosyada açıkça şunu yaz:

```md
Bu projede bu modüle ait açık bir yapı bulunamadı. Ancak ilişkili olabilecek dosyalar ve riskler aşağıda değerlendirilmiştir.
```

Ayrıca her büyük modül için ayrı detay dosyaları oluştur:

```txt
SYSTEM_AUDIT_REPORT/modules/
  module-auth.md
  module-users.md
  module-payments.md
  module-notifications.md
  module-admin.md
  module-dashboard.md
  module-homepage.md
  module-api.md
  module-database.md
  module-mobile.md
  module-settings.md
  module-integrations.md
```

Projede başka modüller varsa onları da aynı formatta ekle.

---

## 3. Önce Sistem Haritası Çıkar

İlk olarak `01_SYSTEM_MAP.md` dosyasında tüm sistemi haritala.

Şu başlıkları kullan:

```md
# Sistem Haritası

## 1. Proje Özeti
- Uygulama ne yapıyor?
- Hedef kullanıcı kim?
- Ana iş modeli ne?
- Web, mobil, admin, backend, API, database yapısı var mı?

## 2. Teknoloji Yığını
- Frontend framework:
- Backend framework:
- Mobile framework:
- Database:
- Auth sistemi:
- Payment sistemi:
- Notification sistemi:
- Hosting/deployment:
- Third-party servisler:
- State management:
- API yaklaşımı:
- Test araçları:

## 3. Klasör ve Dosya Yapısı
Her ana klasörün ne işe yaradığını açıkla.

## 4. Ana Modüller
Her modül için:
- Modül adı
- Amacı
- Ana dosyaları
- Bağlı olduğu modüller
- Dış servis bağlantıları
- Risk seviyesi

## 5. Kullanıcı Rolleri
- Guest
- User
- Customer
- Admin
- Super admin
- Vendor/seller/provider
- Diğer roller

Her rolün sistemde ne yapabildiğini çıkar.

## 6. Ana Kullanıcı Akışları
Örneğin:
- Kayıt olma
- Giriş yapma
- Profil düzenleme
- Satın alma
- Ödeme
- Bildirim alma
- Admin işlem yapma
- İçerik oluşturma
- Sipariş/rezervasyon/başvuru oluşturma

## 7. Sistem Sınırları
- Bu sistemin içinde olanlar
- Bu sistemin dışında olanlar
- Dış servislere bağlı alanlar
```

---

## 4. Bağlantı Haritası Çıkar

`02_CONNECTION_MAP.md` dosyasında sistemdeki tüm bağlantıları çıkar.

Her bağlantı için bu formatı kullan:

```md
## Bağlantı: [Kaynak] → [Hedef]

### Bağlantı Türü
API / DB / Webhook / Event / UI Route / State / Auth / Payment / Notification / External Service

### Kaynak
Hangi dosya, component, service, controller veya modülden çıkıyor?

### Hedef
Nereye bağlanıyor?

### Ne Taşıyor?
- Data payload
- Params
- Headers
- Auth token
- User ID
- Payment ID
- Notification payload
- State data

### Ne Zaman Çalışıyor?
- Sayfa açılışında
- Buton tıklanınca
- Form submit olunca
- Cron job ile
- Webhook gelince
- Admin aksiyonu sonrası
- Payment sonrası
- Auth sonrası

### Beklenen Davranış
Bu bağlantı doğru çalışırsa ne olmalı?

### Gerçek Kod Davranışı
Kodda gerçekten ne oluyor?

### Riskler
- Kopuk bağlantı var mı?
- Yanlış endpoint var mı?
- Yanlış data formatı var mı?
- Eksik auth kontrolü var mı?
- Hatalı state yönetimi var mı?
- Backend ve frontend uyuşuyor mu?
- Database ilişkisi doğru mu?

### Sonuç
✅ Doğru  
⚠️ Riskli  
❌ Hatalı  
❓ Belirsiz

### Öneri
Net ve uygulanabilir öneri yaz.
```

Özellikle şu bağlantıları mutlaka denetle:

- Frontend → Backend API
- Backend → Database
- Backend → Payment provider
- Payment provider → Webhook
- Backend → Notification service
- Admin panel → Backend
- Mobile app → Backend
- Auth middleware → Protected routes
- User role → Permission checks
- Form → Validation → API → DB
- Homepage/Landing → Gerçek ürün özellikleri
- Pricing page → Payment logic
- Notification trigger → Notification delivery
- Settings page → Persisted user preferences
- Dashboard → Gerçek data source
- Error states → UI feedback

---

## 5. Ürün Vaadi Denetimi

`03_PRODUCT_PROMISE_AUDIT.md` dosyasında sistemin verdiği vaatleri incele.

Vaatleri şu kaynaklardan çıkar:

- README
- Landing page
- Homepage
- Pricing page
- Feature sections
- App copy/text
- Admin panel açıklamaları
- Onboarding ekranları
- Form açıklamaları
- Marketing metinleri
- API docs
- Kullanıcıya gösterilen success/error mesajları

Her vaat için şu formatı kullan:

```md
## Vaat: [Vaat metni veya özellik]

### Vaat Nerede Geçiyor?
Dosya/sayfa/component belirt.

### Kullanıcıya Ne Söyleniyor?
Sistemin kullanıcıya sunduğu beklenti nedir?

### Kodda Karşılığı Var mı?
Evet / Hayır / Kısmen / Belirsiz

### Backend Karşılığı
Bu vaadi destekleyen endpoint, service, controller, job veya business logic var mı?

### Frontend Karşılığı
UI’da gerçekten çalışıyor mu, yoksa sadece görsel/metin mi?

### Database Karşılığı
Bu özellik için veri modeli, tablo, alan veya ilişki var mı?

### Permission/Auth Karşılığı
Bu özellik doğru kullanıcıya doğru şekilde açılıyor mu?

### Edge Case Denetimi
- Boş state
- Hata state
- Yetkisiz kullanıcı
- Network hatası
- Payment başarısızlığı
- Duplicate işlem
- Geri alma / iptal
- Veri yokken gösterim
- Çok büyük veri
- Mobil görünüm

### Sonuç
✅ Vaat doğru karşılanıyor  
⚠️ Kısmen karşılanıyor  
❌ Vaat var ama sistem karşılamıyor  
❓ Belirsiz

### Öneri
Bu vaadin doğru hale gelmesi için ne yapılmalı?
```

---

## 6. Global Todo Listesi Oluştur

`04_GLOBAL_TODO_LIST.md` dosyasında önce tüm yapılacakları çıkar.

Todo listesi sadece basit liste olmayacak. Her madde denetlenebilir, modüle bağlı, öncelikli ve açıklamalı olacak.

Format:

```md
# Global Todo Listesi

## Kritik Öncelik

### TODO-[ID]: [Başlık]
- Modül:
- Dosyalar:
- Sorun tipi: Bug / Eksik / Yanlış / UX / UI / Security / Logic / Payment / Notification / API / DB
- Etki:
- Kanıt:
- Kontrol yöntemi:
- Beklenen doğru davranış:
- Mevcut davranış:
- Önerilen aksiyon:
- Durum: Denetlendi / Riskli / Hatalı / Belirsiz

## Yüksek Öncelik

## Orta Öncelik

## Düşük Öncelik
```

Önceliklendirme yaparken şu sınıfları kullan:

```txt
P0 = Üretimi veya ödeme/auth/güvenliği bozan kritik hata
P1 = Ana kullanıcı akışını bozan ciddi hata
P2 = Önemli ama workaround olan hata
P3 = UX/UI eksikliği veya iyileştirme
P4 = Teknik borç / temizlik / öneri
```

---

## 7. Sonra Onay Beklemeden Denetime Geç

Todo listesi oluşturduktan sonra kullanıcıdan onay isteme.

Hemen her maddeyi tek tek denetle.

Her denetimde şunları kontrol et:

- Bu gerçekten hata mı?
- Bu eksik mi?
- Bu yanlış mı?
- Bu sadece varsayım mı?
- Kod kanıtı var mı?
- Başka dosyada karşılığı var mı?
- Frontend ve backend aynı beklentide mi?
- Database bunu destekliyor mu?
- Permission doğru mu?
- User/admin/mobile/web tarafında çelişki var mı?
- Hata mesajı var mı?
- Loading state var mı?
- Empty state var mı?
- Edge case düşünülmüş mü?
- Ödeme, auth veya notification gibi yan etkili süreçlerde idempotency var mı?
- Webhook tekrar gelirse ne olur?
- Aynı işlem iki kez yapılırsa ne olur?
- Kullanıcı yetkisiz erişirse ne olur?
- Mobilde kırılır mı?
- Admin panelde aynı data doğru görünüyor mu?
- Kullanıcıya vaat edilen sonuç gerçekten gerçekleşiyor mu?

---

## 8. UI Denetimi

`06_UI_UX_AUDIT.md` ve ilgili modül dosyalarında UI denetimi yap.

Şunları kontrol et:

- Sayfa hiyerarşisi
- Responsive yapı
- Mobil görünüm
- Tablet görünüm
- Desktop görünüm
- Butonların işlevi
- Formların doğrulaması
- Error mesajları
- Loading state
- Empty state
- Disabled state
- Success state
- Modal/drawer/dropdown davranışları
- Navigasyon
- Breadcrumb
- Geri butonu
- Bozuk linkler
- Yanlış copy/metin
- Tutarsız tasarım dili
- Gereksiz tekrar
- Erişilebilirlik
- Keyboard navigation
- Focus state
- Contrast
- Görsel taşmalar
- Çok uzun metinlerde kırılma
- Çok uzun isim/email/data gösterimi
- Dil tutarlılığı
- Para birimi/tarih formatı
- Hata durumunda kullanıcıya doğru bilgi verilip verilmediği

Her bulgu için:

```md
## UI Bulgusu: [Başlık]

- Sayfa/Component:
- Dosya:
- Sorun:
- Etki:
- Kanıt:
- Beklenen:
- Mevcut:
- Öneri:
- Öncelik:
```

---

## 9. UX Denetimi

UX tarafında sadece görsel değil, akış mantığını denetle.

Şunları incele:

- Kullanıcı ne yapacağını anlıyor mu?
- Ana aksiyonlar net mi?
- Bir işlemden sonra kullanıcıya ne olduğu anlatılıyor mu?
- Başarısız işlemde çözüm öneriliyor mu?
- Kritik aksiyonlarda confirmation var mı?
- Geri alınamaz işlemler açık mı?
- Kullanıcı yanlışlıkla ödeme/silme/yayınlama yapabilir mi?
- Kullanıcı sisteme güven duyar mı?
- Onboarding yeterli mi?
- İlk kez gelen kullanıcı için boş state anlamlı mı?
- Admin kullanıcı için operasyonel verimlilik var mı?
- Çok adımlı akışlarda ilerleme belli mi?
- Mobil kullanıcı gereksiz zorlanıyor mu?
- Kullanıcı rolüne göre gereksiz veya yasak seçenekler gizleniyor mu?

---

## 10. Hata, Eksik, Yanlış Denetimi

`07_BUGS_ERRORS_MISSING_WRONG.md` dosyasında tüm bulguları topla.

Her bulgu için:

```md
## Bulgu: [Kısa başlık]

### Kategori
Bug / Eksik / Yanlış / Mantık Hatası / UX / UI / Security / Payment / Notification / API / DB

### Öncelik
P0 / P1 / P2 / P3 / P4

### Etkilenen Alan
Web / Mobile / Admin / Backend / API / DB / Payment / Notification / Auth

### Dosyalar
İlgili dosyaları listele.

### Kanıt
Koddan, route’tan, component’ten, schema’dan veya config’ten kanıt ver.

### Mevcut Davranış
Sistem şu anda ne yapıyor?

### Beklenen Davranış
Doğrusu ne olmalı?

### Neden Sorun?
Bu hata kullanıcı, admin, ödeme, güvenlik, veri bütünlüğü veya sistem sürdürülebilirliği açısından neden problem?

### Bağlı Olduğu Diğer Modüller
Bu sorun hangi başka modülleri etkiliyor?

### Önerilen Çözüm
Net ve uygulanabilir çözüm önerisi yaz.

### Test Senaryosu
Bu sorunun varlığı veya düzeldiği nasıl test edilir?
```

---

## 11. İş Mantığı Denetimi

`08_LOGIC_AND_BUSINESS_RULE_AUDIT.md` dosyasında iş mantığını denetle.

Şunları kontrol et:

- Kullanıcı rolü doğru mu?
- Ücretli/ücretsiz özellik ayrımı doğru mu?
- Plan/abonelik limitleri uygulanıyor mu?
- İptal, iade, başarısız ödeme, trial, upgrade, downgrade mantığı var mı?
- Admin işlemleri kullanıcı verisini doğru etkiliyor mu?
- Status geçişleri doğru mu?
- Aynı işlem iki kez yapılınca ne oluyor?
- Race condition riski var mı?
- Soft delete / hard delete tutarlı mı?
- Draft/published/archived gibi durumlar doğru mu?
- Kullanıcının sahip olmadığı veriye erişimi engelleniyor mu?
- Yetkili kullanıcı ile yetkisiz kullanıcı arasında gerçek kontrol var mı?
- Sadece UI’da gizlemekle yetinilmiş mi, backend kontrolü var mı?
- Tarih, saat, timezone mantığı doğru mu?
- Para birimi ve fiyat hesaplama doğru mu?
- Vergi/indirim/kupon/komisyon varsa doğru uygulanıyor mu?
- Notification tetiklenmesi doğru şartlara bağlı mı?
- Payment webhook güvenli ve idempotent mi?

---

## 12. Security ve Permission Denetimi

`09_SECURITY_AND_PERMISSION_AUDIT.md` dosyasında güvenlik ve yetki denetimi yap.

Şunları kontrol et:

- Auth middleware var mı?
- Protected route gerçekten korunuyor mu?
- Admin route sadece admin mi?
- Backend authorization var mı?
- Kullanıcı başka kullanıcının verisine erişebilir mi?
- IDOR riski var mı?
- Payment webhook signature doğrulanıyor mu?
- API input validation var mı?
- Rate limit var mı?
- Sensitive env değerleri sızıyor mu?
- Client tarafına secret gönderiliyor mu?
- CORS ayarları doğru mu?
- File upload varsa güvenli mi?
- SQL injection / NoSQL injection riski var mı?
- XSS riski var mı?
- CSRF riski var mı?
- Session/token yönetimi doğru mu?
- Refresh token güvenliği var mı?
- Password reset akışı güvenli mi?
- Email verification mantığı var mı?
- Logging içinde hassas veri var mı?

Her risk için severity belirt:

```txt
Critical
High
Medium
Low
Info
```

---

## 13. Database ve Data Flow Denetimi

`10_DATABASE_AND_DATA_FLOW_AUDIT.md` dosyasında veriyi takip et.

Şunları çıkar:

- Database tabloları/modelleri
- Alanlar
- İlişkiler
- Indexler
- Unique constraint’ler
- Foreign key ilişkileri
- Cascade davranışları
- Migration durumu
- Seed data
- Soft delete alanları
- Timestamp alanları
- Status alanları
- Audit log ihtiyacı
- Veri nerede oluşuyor?
- Veri nerede değişiyor?
- Veri nerede siliniyor?
- Veri hangi UI’da gösteriliyor?
- Admin ile kullanıcı tarafında aynı veri tutarlı mı?

Her önemli veri akışı için:

```md
## Data Flow: [Veri adı]

### Oluştuğu Yer
### İşlendiği Yer
### Kaydedildiği Yer
### Okunduğu Yer
### Gösterildiği Yer
### Silindiği/Arşivlendiği Yer
### Bağlı Modüller
### Riskler
### Öneriler
```

---

## 14. API ve Backend Denetimi

`11_API_AND_BACKEND_AUDIT.md` dosyasında API/backend’i denetle.

Şunları kontrol et:

- Endpoint listesi
- HTTP method doğruluğu
- Request validation
- Response format tutarlılığı
- Error handling
- Auth kontrolü
- Role kontrolü
- Pagination
- Filtering/search/sorting
- Rate limiting
- Idempotency
- Logging
- Transaction kullanımı
- Retry logic
- External service timeout
- Webhook doğrulama
- Status code doğruluğu
- Frontend’in beklediği response ile backend’in verdiği response aynı mı?

Her endpoint için:

```md
## Endpoint: [METHOD] [PATH]

- Dosya:
- Kullanım amacı:
- Kullanılan frontend/mobile/admin alanları:
- Auth gerekli mi?
- Role kontrolü var mı?
- Request validation:
- Response:
- Error handling:
- DB işlemleri:
- Dış servisler:
- Riskler:
- Sonuç:
- Öneriler:
```

---

## 15. Web, Mobile, Admin ve Homepage Ayrı Denetlensin

Aşağıdaki dosyalarda ayrı ayrı denetim yap:

```txt
12_FRONTEND_WEB_AUDIT.md
13_MOBILE_AUDIT.md
14_ADMIN_PANEL_AUDIT.md
15_HOME_PAGE_AND_LANDING_AUDIT.md
```

Her biri için:

```md
# [Alan] Denetimi

## Sayfa/Screen Listesi
## Route Listesi
## Component Listesi
## API Bağlantıları
## Kullanıcı Akışları
## UI Bulguları
## UX Bulguları
## Hata/Eksik/Yanlış Bulguları
## Permission Bulguları
## Data Tutarlılığı
## Öneriler
```

Homepage/Landing için ayrıca şunları kontrol et:

- Vaat edilen özellik gerçekten var mı?
- Pricing ile ödeme sistemi tutarlı mı?
- CTA butonları doğru yere gidiyor mu?
- Login/register yönlendirmeleri doğru mu?
- Demo, trial, contact, purchase akışları çalışıyor mu?
- Fake/placeholder section var mı?
- Kullanıcıya yanlış beklenti veriliyor mu?
- SEO meta bilgileri doğru mu?
- Open Graph bilgileri var mı?
- Mobil görünüm iyi mi?

---

## 16. Ödeme Denetimi

`16_PAYMENTS_AUDIT.md` dosyasında ödeme sistemini çok detaylı incele.

Şunları kontrol et:

- Payment provider hangisi?
- Checkout nasıl başlıyor?
- Plan/fiyat bilgisi nereden geliyor?
- Fiyat client tarafında mı belirleniyor?
- Backend doğrulaması var mı?
- Webhook var mı?
- Webhook signature doğrulanıyor mu?
- Başarılı ödeme sonrası DB güncelleniyor mu?
- Başarısız ödeme sonrası kullanıcıya ne oluyor?
- İptal/iade/downgrade/upgrade var mı?
- Subscription status doğru tutuluyor mu?
- Payment duplicate olursa ne olur?
- Webhook tekrar gelirse ne olur?
- Kullanıcı ödeme yapmadan premium özelliğe erişebilir mi?
- Pricing page ile backend planları tutarlı mı?
- Admin ödeme durumunu doğru görüyor mu?
- Notification ödeme sonrası doğru gidiyor mu?

Her ödeme akışı için:

```md
## Payment Flow: [Akış adı]

### Başlangıç
### Frontend
### Backend
### Provider
### Webhook
### Database Update
### Notification
### Admin Görünümü
### Kullanıcı Görünümü
### Riskler
### Hatalar
### Öneriler
```

---

## 17. Notification Denetimi

`17_NOTIFICATIONS_AUDIT.md` dosyasında notification sistemini incele.

Şunları kontrol et:

- Email notification
- Push notification
- In-app notification
- SMS notification
- Admin notification
- User notification
- Payment notification
- Auth notification
- System alert
- Trigger noktaları
- Template dosyaları
- Kullanıcı tercihleri
- Unsubscribe mantığı
- Retry/failure handling
- Duplicate notification riski
- Notification gönderildi mi yoksa sadece DB’ye mi yazıldı?
- Notification UI’da okunuyor mu?
- Read/unread mantığı var mı?
- Admin ve kullanıcı bildirimleri karışıyor mu?

Her notification için:

```md
## Notification: [Bildirim adı]

- Trigger:
- Kime gider:
- Ne zaman gider:
- Kanal:
- Template:
- Data source:
- Backend logic:
- UI gösterimi:
- User preference dikkate alınıyor mu:
- Risk:
- Öneri:
```

---

## 18. Auth ve Kullanıcı Rolleri Denetimi

`18_AUTH_AND_USER_ROLES_AUDIT.md` dosyasında authentication, authorization ve kullanıcı rolleri detaylı incelensin.

Şunları kontrol et:

- Kayıt olma akışı
- Giriş yapma akışı
- Çıkış yapma akışı
- Session yönetimi
- Token yönetimi
- Refresh token mantığı
- Password reset
- Email verification
- OAuth / social login
- Magic link varsa davranışı
- Admin login ayrımı
- User/admin/super admin ayrımı
- Role-based access control
- Permission-based access control
- Protected route yapısı
- Backend authorization
- Sadece frontend’de gizlenen ama backend’de korunmayan aksiyonlar
- Kullanıcının başkasının verisine erişme ihtimali
- Auth error state’leri
- Expired session davranışı
- Mobil auth davranışı
- Admin auth davranışı

Her rol için:

```md
## Rol: [Rol adı]

### Ne Yapabilir?
### Ne Yapamaz?
### UI’da Gösterilen Yetkiler
### Backend’de Uygulanan Yetkiler
### Database/Policy Karşılığı
### Riskler
### Eksikler
### Öneriler
```

---

## 19. Integration ve Webhook Denetimi

`19_INTEGRATIONS_AND_WEBHOOKS_AUDIT.md` dosyasında tüm dış servisleri ve webhookları incele.

Şunları kontrol et:

- Stripe / payment provider
- Email provider
- SMS provider
- Push notification provider
- Analytics
- CRM
- Maps/location service
- Storage provider
- OAuth provider
- AI API
- Search service
- Other third-party APIs
- Webhook signature validation
- Retry/idempotency
- Timeout handling
- Rate limit handling
- Failure fallback
- Secret management
- Env config doğruluğu
- Sandbox/production ayrımı

Her entegrasyon için:

```md
## Integration: [Servis adı]

- Kullanım amacı:
- Dosyalar:
- Env değişkenleri:
- API çağrıları:
- Webhook var mı:
- Signature doğrulama:
- Retry/idempotency:
- Error handling:
- Security risk:
- Ürün akışına etkisi:
- Öneriler:
```

---

## 20. Testing ve QA Denetimi

`20_TESTING_AND_QA_AUDIT.md` dosyasında test yapısını incele.

Şunları kontrol et:

- Unit test var mı?
- Integration test var mı?
- E2E test var mı?
- API test var mı?
- Payment webhook testleri var mı?
- Auth/permission testleri var mı?
- UI state testleri var mı?
- Mobile testleri var mı?
- Admin panel testleri var mı?
- Regression riski yüksek alanlar test edilmiş mi?
- Testler gerçekten anlamlı mı yoksa yüzeysel mi?
- Mock data doğru mu?
- CI içinde test çalışıyor mu?
- Coverage raporu var mı?
- Kritik iş akışları test edilmiş mi?

Eksik testleri hata olarak raporla.

Her test alanı için:

```md
## Test Alanı: [Alan adı]

- Mevcut test dosyaları:
- Kapsadığı akışlar:
- Eksik akışlar:
- Risk:
- Önerilen testler:
- Öncelik:
```

---

## 21. Performance ve Scalability Denetimi

`21_PERFORMANCE_AND_SCALABILITY_AUDIT.md` dosyasında performans ve ölçeklenebilirlik risklerini incele.

Şunları kontrol et:

- Gereksiz API çağrıları
- N+1 query riski
- Pagination eksikliği
- Büyük data listelerinde performans
- Cache kullanımı
- Image optimization
- Bundle size
- Lazy loading
- Server-side rendering / client-side rendering dengesi
- Mobile performans
- Database index eksikleri
- Queue/background job ihtiyacı
- External API timeout riski
- Rate limit stratejisi
- Logging maliyeti
- Memory leak riski
- Long-running request riski

Her performans bulgusu için:

```md
## Performance Bulgusu: [Başlık]

- Alan:
- Dosya:
- Mevcut davranış:
- Risk:
- Etki:
- Ölçeklenince ne olur:
- Öneri:
- Öncelik:
```

---

## 22. Recommendations

`22_RECOMMENDATIONS.md` dosyasında tüm önerileri grupla.

Şu kategorileri kullan:

```md
# Recommendations

## Product Recommendations
## UX Recommendations
## UI Recommendations
## Backend Recommendations
## Database Recommendations
## Security Recommendations
## Payment Recommendations
## Notification Recommendations
## Admin Panel Recommendations
## Mobile Recommendations
## Testing Recommendations
## Performance Recommendations
## Maintainability Recommendations
```

Her öneri için:

```md
## Öneri: [Başlık]

- Kategori:
- Neden gerekli:
- Etki:
- Öncelik:
- İlgili dosyalar/modüller:
- Uygulanabilir aksiyon:
- Test yöntemi:
```

---

## 23. Modül Bazlı Rapor Formatı

Her modül dosyasında şu formatı kullan:

```md
# Modül Denetimi: [Modül Adı]

## 1. Modülün Amacı
Bu modül ne yapıyor?

## 2. Ana Dosyalar
İlgili dosyalar ve görevleri.

## 3. Bağlantılar
Bu modül hangi modüllere bağlı?

## 4. Veri Akışı
Veri nereden geliyor, nerede işleniyor, nerede kaydediliyor, nerede gösteriliyor?

## 5. UI/UX Denetimi
Bu modüle ait ekran/component davranışları.

## 6. API/Backend Denetimi
Endpoint, service, controller, validation ve error handling durumu.

## 7. Database Denetimi
Tablo/model/ilişki/constraint durumu.

## 8. Permission/Auth Denetimi
Kim erişebilir, kim erişemez, backend kontrolü var mı?

## 9. Edge Case Denetimi
Boş veri, hata, duplicate, yetkisiz erişim, network hatası, mobil görünüm, ödeme başarısızlığı gibi durumlar.

## 10. Hata/Eksik/Yanlış Listesi
Her bulguyu detaylandır.

## 11. Mantık Hataları
İş kuralı çelişkilerini yaz.

## 12. Öneriler
Net, uygulanabilir öneriler.

## 13. Test Senaryoları
Bu modül nasıl test edilmeli?

## 14. Sonuç
✅ Sağlam  
⚠️ Riskli  
❌ Hatalı  
❓ Belirsiz
```

---

## 24. Risk Matrisi

`05_RISK_MATRIX.md` dosyasında tüm riskleri tablo halinde yaz.

Format:

```md
# Risk Matrisi

| ID | Risk | Modül | Etki | Olasılık | Öncelik | Kanıt | Öneri |
|---|---|---|---|---|---|---|---|
| R-001 | ... | ... | Critical/High/Medium/Low | High/Medium/Low | P0/P1/P2/P3/P4 | ... | ... |
```

Etki kriterleri:

```txt
Critical = Ödeme, auth, veri güvenliği, veri kaybı veya production çökmesi
High = Ana kullanıcı akışı bozuluyor
Medium = Önemli özellik eksik/hatalı ama sistem tamamen kırılmıyor
Low = UX/UI veya teknik borç
Info = Bilgilendirme
```

---

## 25. Final Aksiyon Planı

`23_FINAL_ACTION_PLAN.md` dosyasında uygulanabilir final plan çıkar.

Şu formatı kullan:

```md
# Final Aksiyon Planı

## 1. İlk Düzeltilmesi Gereken Kritikler
P0 ve P1 sorunları sırala.

## 2. Modül Bazlı Düzeltme Sırası
Hangi modül önce, hangisi sonra ele alınmalı?

## 3. Hızlı Kazanımlar
Kısa sürede düzeltilebilecek UI/UX/API/validation eksikleri.

## 4. Derin Teknik Borçlar
Mimari veya veri modeli düzeyindeki problemler.

## 5. Test Planı
Her ana modül için test senaryoları.

## 6. Yayına Alma Öncesi Kontrol Listesi
Production öncesi checklist.

## 7. Ürün Vaadi Temizliği
Landing, pricing, homepage veya onboarding’de yanlış vaat varsa düzeltilecek alanlar.

## 8. Sonuç
Sistemin genel sağlık durumu:
- Güvenilir mi?
- Yayına hazır mı?
- Ödeme/auth/data açısından güvenli mi?
- Kullanıcıya verdiği vaatleri karşılıyor mu?
- En büyük 5 risk ne?
```

---

## 26. Denetim Derinliği

Yüzeysel analiz yapma.

Sadece dosya ismi okuyarak yorum yapma. Kod akışını takip et.

Bir component API çağırıyorsa:

- API endpoint’ini bul.
- Endpoint’in backend’de gerçekten var olup olmadığını kontrol et.
- Backend’in hangi service’i çağırdığını bul.
- Service’in database’e ne yazdığını bul.
- Database modelinin bunu destekleyip desteklemediğini kontrol et.
- Sonucun UI’a doğru dönüp dönmediğini kontrol et.
- Hata durumunda UI’ın ne yaptığını kontrol et.
- Permission kontrolü var mı denetle.
- Admin/mobile/web tarafında aynı data nasıl görünüyor kontrol et.

Bir vaat varsa:

- UI’da metnini bul.
- Feature’ın gerçekten çalışıp çalışmadığını kontrol et.
- Backend karşılığını bul.
- DB karşılığını bul.
- Edge case’leri incele.
- Ödeme/plan/role bağlantısı varsa kontrol et.

Bir ödeme varsa:

- Client’tan başlayıp webhook sonrası DB update’e kadar takip et.
- Fiyat manipüle edilebilir mi kontrol et.
- Webhook tekrar gelirse ne olur kontrol et.
- Başarısız ödeme senaryosunu kontrol et.

Bir notification varsa:

- Trigger noktasını bul.
- Template’i bul.
- Kime gittiğini kontrol et.
- Kullanıcı tercihlerini dikkate alıyor mu kontrol et.
- UI’da gösteriliyor mu kontrol et.

---

## 27. Maksimum Derinlik Modu

Bu denetimde hızlı özetle yetinme. Projedeki her route, her component, her API endpoint, her database modeli, her service, her middleware, her config, her env kullanımı, her ödeme/notification/auth bağlantısı ve her kullanıcı akışı incelenmelidir.

Bir dosyanın etkisini anlamadan onu geçme.

Bulgu yoksa bile “bulgu yok” deme; önce gerçekten şu kontrolleri yaptığını göster:

- Dosyalar incelendi
- Bağlantılar takip edildi
- UI karşılığı kontrol edildi
- Backend karşılığı kontrol edildi
- DB karşılığı kontrol edildi
- Permission kontrol edildi
- Edge case kontrol edildi
- Hata state kontrol edildi
- Test senaryosu düşünüldü

Öncelik sırası:

1. Auth / permission / data leak
2. Payment / subscription / pricing
3. Database integrity
4. Backend API correctness
5. Web/mobile/admin flow consistency
6. Notifications
7. UI/UX
8. Product promise accuracy
9. Performance
10. Maintainability

Eksik test varsa bunu da hata olarak raporla.

Yanlış ürün vaadi varsa bunu da ürün riski olarak raporla.

Sadece UI’da gizlenen ama backend’de korunmayan her şeyi güvenlik riski olarak raporla.

Client tarafında güvenilen fiyat, role, permission, user ID veya plan bilgisini kritik risk olarak işaretle.

---

## 28. Belirsizlik Kuralı

Eğer bir şey kesin değilse uydurma.

Şu şekilde işaretle:

```md
❓ Belirsiz: Bu konuda kesin sonuca varılamadı.
```

Ama belirsiz bırakmadan önce ilgili dosyaları, olası bağlantıları ve neden belirsiz olduğunu yaz.

Belirsizlik şuna benzer şekilde açıklanmalı:

```md
❓ Belirsiz

Bu konuda kesin sonuca varılamadı çünkü:
- İlgili frontend component bulundu ancak backend endpoint bulunamadı.
- Endpoint ismi config üzerinden dinamik oluşturuluyor olabilir.
- Database modeli doğrudan görünmüyor.
- Test dosyası bulunamadı.

İncelenen dosyalar:
- `...`
- `...`

Olası risk:
- Feature UI’da var görünüyor ama backend karşılığı eksik olabilir.
```

---

## 29. Kanıt Zorunluluğu

Her ciddi bulgu için mutlaka kanıt yaz.

Kanıt şunlardan biri olabilir:

- Dosya yolu
- Function adı
- Component adı
- Route adı
- Endpoint adı
- Database model/schema adı
- Config/env referansı
- UI text kaynağı
- Test dosyası
- Migration dosyası
- Webhook handler
- Middleware

Örnek:

```md
Kanıt:
- `src/app/pricing/page.tsx` içinde Pro plan vaat ediliyor.
- `src/api/payments/create-checkout.ts` sadece Basic plan oluşturuyor.
- `SubscriptionPlan` enum içinde Pro plan yok.
Sonuç: Pricing vaadi ile backend ödeme mantığı tutarsız.
```

Kanıt olmadan P0/P1 işaretleme yapma. Eğer ciddi şüphe var ama kanıt eksikse `High Risk / Needs Verification` olarak işaretle.

---

## 30. Çıktı Kalitesi

Raporlar okunabilir, net, uygulanabilir ve teknik olarak ciddi olmalı.

Her dosyada:

- Başlıklar düzenli olsun.
- Bulgular modül modül ayrılsın.
- Öncelik belirt.
- Kanıt belirt.
- Etki belirt.
- Öneri belirt.
- Test senaryosu belirt.
- Gereksiz tekrar yapma.
- Varsayım ile kanıtı karıştırma.
- Aynı bulguyu farklı dosyalarda tekrar ediyorsan ana bulgu ID’sine referans ver.
- Büyük raporlarda özet tablo kullan.
- Kritik bulguları en üstte göster.
- Her modül için net sonuç ver.

---

## 31. Final Executive Summary

Tüm raporları oluşturduktan sonra `00_EXECUTIVE_SUMMARY.md` dosyasına kısa ama güçlü bir özet yaz.

Şunları mutlaka ekle:

```md
# Executive Summary

## Genel Durum
Sistemin genel sağlık durumu.

## En Kritik 10 Bulgu
P0/P1 öncelikli bulgular.

## En Büyük Mimari Riskler
Sistemi uzun vadede bozabilecek riskler.

## Ürün Vaadi Uyumluluğu
Sistem kullanıcılara verdiği vaatleri karşılıyor mu?

## Yayına Hazırlık Durumu
Production için hazır mı?

## Ödeme/Auth/Data Güvenliği Durumu
Kritik güvenlik ve veri riskleri.

## Öncelikli Aksiyonlar
İlk yapılması gereken işler.

## Sonuç
Net karar:
- Yayına hazır
- Kısmen hazır
- Hazır değil
- Belirsiz
```

---

## 32. Son Cevap Formatı

Bu görevin sonunda sadece şunu söyleme:

“Raporlar oluşturuldu.”

Bunun yerine şunu yap:

1. Hangi klasöre yazdığını belirt.
2. Hangi rapor dosyalarını oluşturduğunu listele.
3. En kritik 5 bulguyu kısaca özetle.
4. Sistemin genel durumunu söyle.
5. Bundan sonra hangi sırayla aksiyon alınması gerektiğini belirt.

Final cevap formatı:

```md
# Denetim Tamamlandı

Raporlar şu klasöre yazıldı:

`SYSTEM_AUDIT_REPORT/`

## Oluşturulan Ana Raporlar
- `00_EXECUTIVE_SUMMARY.md`
- `01_SYSTEM_MAP.md`
- `02_CONNECTION_MAP.md`
- `03_PRODUCT_PROMISE_AUDIT.md`
- `04_GLOBAL_TODO_LIST.md`
- `05_RISK_MATRIX.md`
- ...

## En Kritik 5 Bulgu
1. ...
2. ...
3. ...
4. ...
5. ...

## Genel Durum
Sistem şu an: Yayına hazır / Kısmen hazır / Hazır değil / Belirsiz

## Önerilen Aksiyon Sırası
1. P0/P1 güvenlik, auth, ödeme ve veri riskleri
2. Ana kullanıcı akışlarını bozan backend/API hataları
3. Database ve data integrity problemleri
4. UI/UX ve mobile/admin tutarsızlıkları
5. Test, performance ve maintainability iyileştirmeleri
```

---

## 33. Başla

Şimdi projeyi analiz etmeye başla.

Sırasıyla şunları yap:

1. Tüm dosya/klasör yapısını oku.
2. Teknoloji yığınını tespit et.
3. Sistem haritasını çıkar.
4. Bağlantı haritasını çıkar.
5. Ürün vaatlerini çıkar.
6. Global todo listesi oluştur.
7. Onay beklemeden her modülü detaylıca denetle.
8. UI/UX/backend/database/auth/payment/notification/admin/mobile/web/landing/integration/test/performance alanlarını ayrı ayrı incele.
9. Bulguları kanıtla.
10. Riskleri önceliklendir.
11. Final aksiyon planını oluştur.
12. Tüm raporları `SYSTEM_AUDIT_REPORT/` klasörüne Markdown dosyaları olarak yaz.
13. Kod değiştirme. Sadece rapor dosyalarını oluştur.
