# Codex Backend Runtime ve Güvenlik Düzeltmeleri

**Tarih:** 4 Eylül 2026
**Proje:** Music Archive
**Dal:** `fix/backend-runtime`
**İlgili commit:** `ddb82cc fix: repair backend runtime and security issues`
**Kaynak denetim:** `CLAUDE_BACKEND_AUDIT.md`
**Belge türü:** Teknik devir ve doğrulama raporu

## 1. Çalışmanın kapsamı

Bu çalışma, Music Archive backend'inde Claude denetim raporunda belirtilen kritik runtime ve güvenlik iddialarını kaynak kod üzerinden bağımsız olarak doğrulamak ve doğrulanan sorunları minimum kapsamlı değişikliklerle gidermek amacıyla gerçekleştirildi.

Öncelikli inceleme alanları şunlardı:

1. Eksik `generateRefreshToken` fonksiyonu.
2. Eksik `cacheSet` yardımcısı.
3. Eksik `cacheKey` değişkeni.
4. Login/register ve refresh girdilerinde MongoDB NoSQL injection riski.
5. Production CORS reddinin 500 ve stack trace üretmesi.
6. Production MongoDB bağlantı hatasında in-memory veritabanına sessiz geçiş.
7. Refresh-token akışındaki güvenlik ve çalışma hataları.

Çalışma sırasında ilgisiz refactor yapılmadı, bağımlılık eklenmedi, `package-lock.json` değiştirilmedi ve gerçek secret üretilmedi. Frontend değiştirilmedi. Mobil tarafta yalnızca refresh token rotasyonunun çalışması için zorunlu olan istemci uyarlaması yapıldı.

`.env` dosyasının içeriği bu çalışma kapsamında okunmadı, değiştirilmedi veya rapora aktarılmadı.

## 2. Claude bulgularından doğrulananlar

### 2.1 Eksik refresh token üreticisi

`generateRefreshToken`, login akışının hem in-memory hem MongoDB dalında çağrılıyor fakat tanımlı değildi. Başarılı parola kontrolünden sonra `ReferenceError` oluşuyor ve login HTTP 500 ile sonuçlanıyordu.

Bu bulgu doğrulandı ve kriptografik rastgele token üreten bir yardımcı eklendi.

### 2.2 Eksik search cache bileşenleri

Artist, album ve track arama dalları `cacheSet(cacheKey, ...)` çağırıyordu. Ne `cacheSet` fonksiyonu ne de `cacheKey` değişkeni tanımlıydı. Spotify sonucu başarıyla alınsa dahi bu satırlar aramayı HTTP 500'e düşürüyordu.

Her iki eksiklik de doğrulandı.

### 2.3 Refresh endpoint NoSQL injection yüzeyi

`/api/auth/refresh`, `refreshToken` değerinin primitive string olduğunu doğrulamadan değeri `User.findOne({ refreshToken })` sorgusuna aktarıyordu. JSON nesnesi truthy olduğu için yalnızca boşluk kontrolünü geçebiliyor ve MongoDB operatörü içeren bir nesne sorguya ulaşabiliyordu.

Bu güvenlik bulgusu kod yolu üzerinden doğrulandı.

### 2.4 CORS hata ve bilgi sızıntısı

Allowlist dışında kalan origin için sıradan bir `Error` üretiliyor, ancak kontrollü bir Express hata middleware'i bulunmuyordu. Sonuç olarak reddetme uygun bir 4xx cevabı yerine HTTP 500'e düşebiliyor ve Express çalışma moduna bağlı olarak stack trace ile mutlak dosya yollarını açığa çıkarabiliyordu.

Bu bulgu doğrulandı.

### 2.5 Production MongoDB fallback'i

MongoDB bağlantısı sunucu başlangıcında beklenmiyor ve bağlantı hatasının `catch` dalında `useInMemory = true` yapılıyordu. Aynı davranış production için de geçerliydi. Bu durum geçici bellekte veri kabul edilmesine ve restart/deploy sonrasında sessiz veri kaybına yol açabilirdi.

Sessiz production fallback'i ve başlangıç yarış koşulu doğrulandı.

### 2.6 Refresh-token akışının diğer sorunları

Aşağıdaki sorunlar doğrulandı:

- Token üreticisi eksikti.
- Refresh token düz metin saklanıyordu.
- Token girdisinin tipi doğrulanmıyordu.
- Başarılı kullanım sonrasında token rotasyonu yapılmıyordu.
- Aynı refresh token tekrar tekrar kullanılabiliyordu.

## 3. Doğrulanamayan veya yanlış bulunan bulgular

### 3.1 Login üzerinden başarılı NoSQL injection

Login/register girdilerinde açık primitive-string garantisi bulunmadığı doğrulandı. Bununla birlikte nesne biçiminde kullanıcı adı gönderildiğinde login yolu çoğunlukla MongoDB sorgusuna ulaşmadan `escapeRegex(...).replace` üzerinde JavaScript hatası üretiyordu.

Dolayısıyla login üzerinden başarılı hesap aşımı bağımsız olarak doğrulanmadı. Eski davranış yine de güvenli değildi: beklenmeyen girdiyi kontrollü HTTP 400 yerine HTTP 500 ile sonuçlandıran tesadüfi bir çalışma hatasına dayanıyordu.

### 3.2 Canlı Render CORS durumu

Kaynak koddaki hata yolu doğrulandı, ancak Render dashboard ortam değişkenlerine erişim olmadığı için canlı ortamda `CORS_ORIGINS` veya `NODE_ENV` değerlerinin nasıl tanımlandığı doğrulanamadı.

### 3.3 Canlı Atlas ve Spotify davranışı

MongoDB Atlas'a veya gerçek Spotify API kimlik bilgilerine bağlanılmadı. Bu servislerle ilgili canlı erişim, TLS, allowlist, kota ve yetki davranışları bu çalışmanın kanıt kapsamı dışındadır.

## 4. Değiştirilen dosyalar ve gerekçeleri

| Dosya | Değişiklik | Gerekçe |
|---|---|---|
| `server.js` | Database başlangıç koordinasyonu, input tip doğrulaması, refresh token üretimi/hash/rotasyon, search cache, CORS ve son hata middleware'i | Kritik runtime hatalarını, NoSQL injection yüzeyini, stack sızıntısını ve production veri kaybı riskini gidermek |
| `mobile/services/api.ts` | Refresh cevabında dönen yeni refresh token'ı kaydetme | Server tarafındaki token rotasyonundan sonra sonraki refresh işlemlerinin çalışmasını sağlamak |
| `package.json` | `npm test` scripti | Hedefli backend testlerini standart ve tekrarlanabilir bir komutla çalıştırmak |
| `test/backend-runtime.test.js` | Altı hedefli entegrasyon testi | Düzeltmeleri gerçek secret veya harici servis gerektirmeden doğrulamak |

Bağımlılık ve lockfile değişikliği yapılmadı.

## 5. Refresh token güvenlik modeli

### 5.1 Eski davranış

1. Login, tanımsız `generateRefreshToken()` çağrısı nedeniyle çöküyordu.
2. Üretilmesi amaçlanan refresh token kullanıcı kaydında düz metin tutulacaktı.
3. Refresh endpoint'i token tipini doğrulamıyordu.
4. MongoDB sorgusu kullanıcı girdisini doğrudan kullanıyordu.
5. Başarılı refresh yalnızca yeni access token döndürüyor, refresh token'ı değiştirmiyordu.
6. Çalınan veya ele geçirilen bir refresh token sunucu tarafında değişene kadar tekrar kullanılabiliyordu.

### 5.2 Yeni davranış

1. Refresh token `crypto.randomBytes(64).toString('hex')` ile üretilir.
2. İstemciye 128 hexadecimal karakterden oluşan ham token verilir.
3. Sunucuda ham token yerine SHA-256 özeti saklanır.
4. Refresh endpoint'i yalnızca primitive, boş olmayan string kabul eder.
5. Gelen token önce hash'lenir ve veritabanı eşleşmesi hash üzerinden yapılır.
6. Her başarılı refresh işleminde yeni refresh token üretilir.
7. MongoDB dalında eşleştirme ve hash değişimi atomik `findOneAndUpdate` işlemiyle yapılır.
8. Cevap mevcut `token` alanını korur ve yeni `refreshToken` alanını ekler.
9. Mobil istemci dönen yeni refresh token'ı saklar.
10. Önceki token'ın yeniden kullanımı HTTP 401 ile reddedilir.

Bu geçişin beklenen operasyonel sonucu, deploy öncesinde düz metin biçiminde saklanmış eski refresh token'ların geçersiz olmasıdır. Mevcut kullanıcıların yeniden login olması gerekebilir.

## 6. MongoDB production fail-fast davranışı

Yeni `connectDatabase()` başlangıç akışı aşağıdaki kuralları uygular:

- Sunucu, database bağlantı sonucu belirlenmeden port dinlemeye başlamaz.
- `NODE_ENV=production` iken `MONGO_URI` yoksa başlangıç hata verir.
- Production bağlantısı başarısızsa hata görünür biçimde log'lanır ve yeniden fırlatılır.
- `startServer()` başarısız olduğunda süreç başarısız çıkış kodu alır; HTTP trafiği kabul edilmez.
- MongoDB server selection süresi 5000 ms ile sınırlanmıştır.
- Production dışı development/test kullanımında, URI yoksa veya bağlantı başarısızsa kontrollü in-memory kullanım korunmuştur.

Böylece production'da MongoDB kesintisi geçici ve kalıcı olmayan bir veritabanına sessiz geçiş olarak gizlenmez.

## 7. CORS, input validation ve search cache düzeltmeleri

### 7.1 CORS

- Allowlist dışındaki origin için ayırt edici `CORS_NOT_ALLOWED` hata kodu ve HTTP 403 statüsü tanımlandı.
- Son hata middleware'i bu hatayı `{ "error": "Origin not allowed" }` JSON cevabına dönüştürüyor.
- İstemciye stack trace veya mutlak dosya yolu gönderilmiyor.
- Beklenmeyen diğer hatalar da genel HTTP 500 JSON cevabına dönüştürülüyor.

### 7.2 Input validation

- Register `username` ve `password` alanlarına `.isString().bail()` doğrulaması eklendi.
- Login yalnızca primitive, boş olmayan string kullanıcı adı ve parola kabul ediyor.
- Refresh endpoint'i yalnızca primitive, boş olmayan string token kabul ediyor.
- Nesne girdileri MongoDB sorgularına ulaşmadan HTTP 400 ile reddediliyor.

### 7.3 Search cache

- Boyutu en fazla 200 kayıt olan process-local `Map` cache eklendi.
- Cache yaşam süresi mevcut kullanım noktalarıyla uyumlu şekilde 3600 saniyedir.
- Anahtar biçimi `search:<type>:<trimmed-lowercase-query>` olarak tanımlandı.
- Süresi dolmuş kayıtlar okuma sırasında kaldırılır.
- Kapasite dolduğunda en eski kayıt çıkarılır.
- Spotify çağrısından önce cache okuması yapıldığı için cache gerçek bir okuma/yazma döngüsüne sahiptir.

Cache restart sırasında temizlenir ve birden çok Render instance arasında paylaşılmaz. Bu durum veri doğruluğunu değil yalnızca cache verimliliğini etkiler.

## 8. Çalıştırılan testler ve tam sonuç

### 8.1 Komutlar

Kaynak inceleme ve doğrulama sırasında kullanılan temel komutlar:

```text
wc -l CLAUDE_BACKEND_AUDIT.md
sed -n ... CLAUDE_BACKEND_AUDIT.md
rg --files ...
rg -n "generateRefreshToken|cacheSet|cacheKey|refreshToken|mongoose.connect|useInMemory" ...
node --check server.js
npm test
git diff --check
git status --short
git diff --stat
```

İlk test çalıştırması kısıtlı sandbox ortamının localhost port açmasına izin vermemesi nedeniyle `listen EPERM` ile tamamlanamadı. Kod hatası olmayan bu ortam kısıtından sonra aynı testler izinli yerel loopback ortamında yeniden çalıştırıldı.

### 8.2 Test edilen davranışlar

1. Register ve login'in nesne biçimindeki credential girdilerini HTTP 400 ile reddetmesi.
2. Register → login → refresh akışının çalışması.
3. Refresh token'ın başarılı kullanımda değişmesi.
4. Eski refresh token tekrarının HTTP 401 ile reddedilmesi.
5. Stub Spotify sonucu üzerinde search cache'in çalışması ve ikinci eşdeğer aramanın dış çağrı yapmaması.
6. CORS reddinin JSON HTTP 403 dönmesi ve stack trace içermemesi.
7. Production'da eksik `MONGO_URI` nedeniyle başlangıcın başarısız olması.
8. Production'da MongoDB bağlantı hatasının in-memory fallback yerine fatal olması.

### 8.3 Tam test sonucu

```text
> music-archive@2.0.0 test
> node --test test/*.test.js

tests 6
suites 0
pass 6
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 11411.373935
```

`node --check server.js` başarılı oldu.

Test çıktısında önceden mevcut iki uyarı görüldü:

- `ERR_ERL_KEY_GEN_IPV6`: rate limiter anahtar üretiminde ham `req.ip` kullanımı.
- Mongoose duplicate schema index: `username` index'inin iki kez tanımlanması.

Bu uyarılar yapılan düzeltmelerin testlerini başarısız kılmadı, ancak production öncesi kalan riskler arasındadır.

## 9. Harici servis kullanılmaması

Testlerde gerçek MongoDB Atlas veya Spotify kullanılmadı.

- `.env` yüklemesi test sürecinde `SKIP_DOTENV_CONFIG=true` ile kapatıldı.
- Test secret'ları yalnızca test process ortamında kullanılan açıkça sahte değerlerdi.
- Spotify token ve search çağrıları `axios` stub'larıyla yerel olarak karşılandı.
- Spotify'a ağ isteği gönderilmedi.
- MongoDB bağlantı hatası testi kapalı `127.0.0.1:1` adresini kullandı.
- Atlas'a bağlanılmadı, Atlas verisi okunmadı veya yazılmadı.
- Render dashboard'una ya da environment değerlerine erişilmedi.

## 10. Kalan güvenlik ve production riskleri

1. **Access token ömrü:** Access token hâlâ 7 gün geçerlidir. Daha kısa süreye geçiş oturum politikasını ve istemci davranışını etkileyen ayrı bir karardır.
2. **401/403 tutarsızlığı:** `authenticateToken` geçersiz access token için 403 döndürürken mobil interceptor yalnızca 401'de refresh deniyor olabilir.
3. **Logout/revoke:** Sunucu tarafında refresh token'ı açıkça iptal eden logout/revoke endpoint'i yoktur.
4. **Statik kaynak ifşası:** `express.static('.')` proje kökünü statik olarak yayınlamaya devam eder.
5. **IPv6 rate-limit anahtarı:** `userLimiter` ham `req.ip` kullandığı için IPv6 bypass uyarısı sürmektedir.
6. **Kimliksiz search limiti:** Per-user limiter kimliksiz isteklerde atlanır; yalnızca genel limiter devrededir.
7. **Yinelenen Mongoose index'i:** Username için duplicate index uyarısı devam etmektedir.
8. **Process-local cache:** Cache instance'lar arasında paylaşılmaz ve restart'ta kaybolur.
9. **Veri modeli tutarsızlıkları:** Rating minimumu, eksik note alanları, duplicate like yarışı ve kullanıcı silme sonrası yetim kayıt riski ele alınmadı.
10. **Ölü/yinelenen rotalar:** Raporda belirtilen route çakışmaları bu değişiklik setinin dışındadır.
11. **Spotify API uyumluluğu:** Recommendations ve bazı eski Spotify API özelliklerinin uygulamanın hesap türünde kullanılabilirliği canlı doğrulanmadı.
12. **Health check:** Database durumunu doğrudan yansıtan ayrı bir health endpoint henüz bulunmamaktadır.

## 11. Production öncesi yapılması gerekenler

1. Render'da `NODE_ENV=production` tanımlanmalı.
2. Render'da geçerli MongoDB Atlas URI yapılandırılmalı.
3. `CORS_ORIGINS` yalnızca gerçek web origin'lerini içermeli.
4. Atlas Network Access, DNS, TLS ve Render çıkış erişimi doğrulanmalı.
5. Render deploy log'unda MongoDB bağlantısı tamamlanmadan server listen log'u oluşmadığı kontrol edilmeli.
6. Gerçek Spotify uygulama kimlik bilgileriyle token, artist, album ve track search smoke testleri yapılmalı.
7. Allowlist'teki origin üzerinden register → login → korumalı endpoint → refresh akışı test edilmeli.
8. Allowlist dışındaki origin'in JSON HTTP 403 aldığı doğrulanmalı.
9. Deploy/restart sonrası kullanıcı verisinin Atlas'ta korunduğu kontrol edilmeli.
10. Eski refresh token'ların geçersizleşmesi nedeniyle kullanıcıların yeniden login olacağı operasyon planına eklenmeli.
11. `express.static('.')` kapsamı production yayını öncesinde daraltılmalı.
12. 401/403 otomatik refresh tutarsızlığı ve IPv6 rate limiter uyarısı kapatılmalı.
13. Database erişimini yansıtan health check endpoint'i ve Render health check ayarı değerlendirilmelidir.

## 12. Git dalı, çalışma ağacı ve commit durumu

Rapor oluşturulmadan hemen önce alınan bilgiler:

```text
git branch --show-current
fix/backend-runtime

git status --short
<çıktı yok; çalışma ağacı temiz>
```

Backend runtime ve güvenlik düzeltmeleri commit edilmiştir:

```text
ddb82cc (HEAD -> fix/backend-runtime, origin/fix/backend-runtime) fix: repair backend runtime and security issues
```

Bu rapor işlemi kapsamında yeni commit oluşturulmadı, push veya merge yapılmadı. Önceki kök rapor kaldırıldı; Git bunu takip edilen bir dosya silinmesi olarak raporlamadı. Yeni rapor çalışma ağacında henüz commit edilmemiştir.

Rapor sonrası gerçek `git status --short` özeti:

```text
?? docs/
```

## 13. Sonuç ve devir notu

Claude raporundaki öncelikli backend runtime bulgularının büyük bölümü bağımsız incelemede doğrulandı. Login, refresh, search cache, CORS hata cevabı ve production MongoDB başlangıç davranışı için kritik sorunlar giderildi ve hedefli testlerle doğrulandı.

Backend artık gerçek Spotify, MongoDB Atlas ve Render entegrasyon testlerine başlanabilecek durumdadır. Bununla birlikte Bölüm 10 ve Bölüm 11'de listelenen güvenlik ve operasyon maddeleri tamamlanmadan sistem koşulsuz biçimde production-ready kabul edilmemelidir.
