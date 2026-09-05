# Tasarım Portu — Doğrulama ve Risk Raporu

**Tarih:** 5 Eylül 2026 · **Dal:** `fix/backend-data-auth-hardening` · **Hazırlayan:** Claude (Opus 5)
**Kapsam:** Claude Design kanvasının web istemcisine aktarılması, ardından yapılan doğrulama ve risk analizi

---

## 1. Özet

Claude Design'ın ürettiği paket açıldı (gzip'li manifest + `x-dc` şablonu), tasarım çıkarıldı ve web istemcisine aktarıldı. Altı commit; tüm yönlendirilen ekranlar, sayfa kroması ve tasarım sistemi yenilendi. Backend'e tek dokunuş yapıldı.

Otomatik testler geçiyor, `eslint .` temiz. Tarayıcıda 17 akış elle doğrulandı, konsol hatası yok.

**10 bulgu** kayda geçti; **yedisi kapatıldı ve tarayıcıda doğrulandı**, üçü düşük öncelikli olarak açık. Ayrıca kodun kendisinden değil **dış bağımlılıklardan** doğan 8 gelecek senaryosu kayıt altına alındı — en kritiği Spotify'ın `/v1/recommendations` ucunu yeni uygulamalara kapatmış olması, ki Dig ekranı buna sessizce dayanıyor.

---

## 2. Yapılan değişiklikler

| Commit | Ne |
| --- | --- |
| `b5bf619` | `js/styles.css` sıfırdan: tek token seti (`:root` koyu, `[data-ma-theme="light"]` açık), `ma-*` bileşen sınıfları. `theme-boot.js` ilk boyamadan önce temayı yazıyor. `dom.js`'e `cover()` / `avatar()` / `stars()` / `kicker()` |
| `224a6a2` | Sticky header (marka, aktif rotayı işaretleyen nav, TR/EN/KU segment, tema, hesap menüsü). Arama alanı sayfa kromasından arama ekranına taşındı. 3 dilde ~60 yeni locale anahtarı |
| `f2a5cf6` | Landing, Dashboard (bento), Search (sanatçı sayfası + diskografi kapsama metresi), Library (mood/puan/not sütunlu tablo), **Dig** (yeni ekran) |
| `f25d6ac` | Şarkı çekmecesi, tüm dialoglar, mini player, toast |
| `09f46b8` | Header nav sarma eşiği 640px → 820px (bkz. F1) |
| *(bu rapordan sonra)* | F2–F7'nin düzeltmeleri: onay dialogu ikonu, kapak sekmeleri, kütüphane sayaçları ve kalbi, arama kalbi, Dig swipe |

**Backend'e tek dokunuş:** `/api/me` likes projeksiyonuna `mood` ve `createdAt` eklendi. İkisi de `Like` modelinde zaten vardı; onlarsız mood sütunu kalıcı olarak boş kalıyordu ve "Son eklenenler" var olmayan bir alana göre sıralıyordu.

**Tasarımdan bilinçli iki sapma**

1. **Süre sütunu** (Kütüphane tablosu) — `/api/me` şarkı uzunluğu döndürmüyor. Kalıcı boş sütun yerine çıkarıldı.
2. **Mood seçici** (şarkı çekmecesi) — `mood` alanını yalnızca `/api/dig/swipe` yazıyor; istemciden set edecek uç yok. Kaydedemeyecek kontrol yerine çıkarıldı. Dig'in yazdığı mood kütüphane sütununda görünüyor.

---

## 3. Testler

### 3.1 Otomatik

`node v22.23.1` · `eslint .` → **0 sorun**

Rapor yazılırken: **42 test, 42 geçti**. Düzeltmelerden sonraki son koşu, Astra'nın o sırada commit'lenmemiş MIDI Studio çalışması da ağaçtayken: **51 test, 50 geçti, 0 başarısız** (1 atlandı).

| Dosya | Test | Sahip |
| --- | ---: | --- |
| `test/backend-runtime.test.js` | 32 | mevcut |
| `test/routes.test.js` | 5 | mevcut |
| `test/spotify-errors.test.js` | 4 | mevcut |
| `test/frontend-routing.test.js` | 1 | Astra (`b0e670b`) |
| `test/midi.test.js`, `test/studio-api.test.js` | 9 | Astra (commit'lenmemiş) |

Testler `listen(0)` ile efemer port kullanıyor; Astra'nın 3000'deki `node --watch` sunucusuyla çakışmadı.

### 3.2 Elle doğrulanan akışlar

Chrome, `localhost:3000`, gerçek Spotify verisi, in-memory DB.

| # | Akış | Sonuç |
| --- | --- | --- |
| 1 | Landing (TR, koyu) | ✅ kanvasla eşleşiyor |
| 2 | Dashboard, oturum açık (koyu **ve** açık tema) | ✅ |
| 3 | Sanatçı sayfası + diskografi kapsama metresi (`tarkan`) | ✅ 15 albüm, %0 kapsama, tick'ler doğru |
| 4 | Şarkı arama sonuçları | ✅ |
| 5 | Arama sonucundan arşivleme (kalp) | ✅ kalp doluyor, toast çıkıyor |
| 6 | Albüm ızgarası (diskografi) | ✅ kapak yüklenince baş harf kayboluyor |
| 7 | Kütüphane → Beğenilenler tablosu | ✅ mood/puan/not sütunları |
| 8 | Kütüphane → Listelerim (boş **ve** dolu) | ✅ (sekme sayacı F4 ile düzeltildi) |
| 9 | Liste oluşturma dialogu | ✅ |
| 10 | Ayarlar dialogu | ✅ |
| 11 | Şarkı çekmecesi (sağdan açılır) | ✅ |
| 12 | Toast (hata tonu) | ✅ alt-orta, sol renkli kenar |
| 13 | Dig kuyruğu — gerçek `/api/dig/queue` | ✅ 9 kayıt, sıradakiler paneli |
| 14 | Dig → Arşivle | ✅ kayıt arşive geçti |
| 15 | Dil TR ↔ EN | ✅ tam yeniden çizim |
| 16 | Çıkış | ✅ token silindi, header "Log in", **konsol hatasız** |
| 17 | Genişlikler: 390 / 565 / 680 / 740 / 1366 px | ✅ (F1 düzeltildikten sonra) |

### 3.3 Henüz doğrulanmayanlar

Bunlar test edilmedi — raporun eksiksiz olması için açıkça yazıyorum:

- Kütüphane → **Takip Edilenler** sekmesi veriyle (hiç sanatçı takip edilmedi)
- **Albüm detay dialogu** (karttan açılan), **liste detay dialogu**, **liste silme onayı**
- **Kapak değiştirme** akışının ucu uca çalışması (yükleme + kaydetme)
- **Puanlama** ve **not kaydetme** yazma yolları
- **KU** dili
- Mini player'ın gerçek çalması — denenen şarkının önizlemesi yoktu, oynatma yolu hiç çalışmadı
- **503 "Arama servisi kullanılamıyor"** kartı — Spotify yapılandırılmış olduğu için tetiklenemedi

**Test ortamı uyarısı:** `/api/health` → `{"database":"in-memory"}`. `MONGO_URI` tanımlı olmasına rağmen Mongo'ya ulaşılamıyor ve sunucu geliştirme modunda in-memory'ye düşüyor. Yani yukarıdaki tüm testler kalıcı olmayan veriyle koştu; Mongo yolundaki davranış (özellikle `createdAt` / `mood` projeksiyonu) doğrulanmadı.

---

## 4. Bulgular

| # | Bulgu | Yer | Önem | Sahip | Durum |
| --- | --- | --- | --- | --- | --- |
| F1 | Header nav kırpılıyordu — İngilizce etiketler Türkçeden geniş, ~680px'te "Dig" → "Di" | `js/styles.css` | Orta | ben | ✅ `09f46b8` |
| F2 | Onay dialogunun ikonu tasarım dışına dönüyordu: `showConfirmModal` `#confirmIcon`'un `ma-notice-mark` sınıfını Tailwind'le eziyordu | `js/components/Modal.js` | Orta | ben | ✅ kapandı |
| F3 | Kapak sekmeleri **maviydi**: `setCoverTab` `ma-pill`/`is-active` yerine Tailwind `bg-blue-500` yazıyordu | `js/components/Details.js` | Orta | ben | ✅ kapandı |
| F4 | Kütüphane sekme sayaçları bayat kalıyordu — `render()`'da bir kez okunuyordu; artık üç koleksiyon da izleniyor ve sayaçlar yerinde güncelleniyor | `js/views/LibraryView.js` | Düşük | ben | ✅ kapandı |
| F5 | Kütüphane satırındaki kalp "Beğeniyi kaldır" diyor ama çekmeceyi açıyordu; artık gerçekten arşivden çıkarıyor | `js/views/LibraryView.js` | Orta (a11y) | ben | ✅ kapandı |
| F6 | Arama sonucundaki kalp başlangıç durumunu okumuyordu; artık `isTrackLiked`'ı yansıtıyor ve iki yönlü çalışıyor | `js/views/SearchView.js` | Düşük | ben | ✅ kapandı |
| F7 | Dig'de başarısız swipe kartı yine de tüketiyordu — şarkı sessizce kayboluyordu; artık yalnızca kaydedilen karar kuyruğu ilerletiyor | `js/views/DigView.js` | Orta | ben | ✅ kapandı |
| F8 | Kapak sondalaması `loading="lazy"` avantajını kaybetti — arka plan görselleri lazy değil, 50 satırlık listede 50 sonda | `js/core/dom.js` | Düşük | ben | 🔴 açık |
| F9 | `library.colDuration` ölü anahtar — süre sütunu çıkarıldı, anahtar 3 locale'de duruyor | `js/locales/*.json` | Çok düşük | ben | 🔴 açık |
| F10 | `SpotifyAdapter.getAttributionHTML` hiçbir yerden çağrılmıyor, içi Tailwind | `js/adapters/SpotifyAdapter.js:467` | Çok düşük | — | 🔴 açık |

**F2 ve F3 aynı kalıptan:** markup'ı tasarım sistemine taşıdım ama o elemanları **JS'ten yeniden boyayan** fonksiyonları güncellemedim. Aynı kalıbı taşıyan başka yer kalmadı — `js/` genelinde canlı Tailwind kalıntısı taraması bu ikisi dışında yalnızca ölü kod ve `.hidden` gösteriyor.

**F2–F7 kapatıldı** ve tarayıcıda tek tek doğrulandı: onay dialogu artık token'lı işareti taşıyor, kapak sekmeleri `ma-pill`, kütüphane kalbi gerçekten arşivden çıkarıyor ve sayaç canlı düşüyor, arama kalbi sayfaya dönünce dolu geliyor, `fetch` sahtelenip 500 döndürüldüğünde Dig kartı yerinde kalıyor. Açık kalanlar F8/F9/F10 — üçü de düşük öncelikli, F9 locale dosyaları başka bir oturumda açık olduğu için ertelendi.

---

## 5. Gelecek senaryoları

Kod bugün çalışıyor. Bunlar zamanla veya dış koşul değiştiğinde kırılacak yerler.

### R1 — Spotify öneri ucu kapandı · **Yüksek**

`server.js:1870` Dig kuyruğunu `GET /v1/recommendations` ile kuruyor. Spotify bu ucu 27 Kasım 2024'ten sonra oluşturulan uygulamalara kapattı; o tarihten sonraki bir Client ID ile **404** döner.

Kod bunu yakalıyor ama sessizce yutuyor: `catch (recError) { console.error(...) }` → `tracks` boş kalıyor → soğuk başlangıç yedeği devreye girip `"top hits 2024"` araması yapıyor. Sonuç: **Dig çalışmaya devam eder ama hiç kişiselleştirilmez**, üstelik arayüz hâlâ *"Öneriler takip ettiğin sanatçıların komşularından ve yüksek puanlı kayıtlarından geliyor"* diyor. Kullanıcıya yanlış söylenmiş olur.

**Sunucu doğruyu zaten döndürüyor** — yanıtta `personalized: true|false` var, istemci bunu okumuyor.

> **Yapılacak:** `DigView` `data.personalized`'ı okusun; `false` ise ipucu metnini "popüler kayıtlardan" olarak değiştirsin. Uzun vadede öneri mantığını kendi verimizden kuralım (takip edilen sanatçıların albümleri + yüksek puanlıların sanatçıları), Spotify'a yalnızca metadata için gidelim.

### R2 — Önizleme URL'lerinin kuruması · **Yüksek**

Dig kuyruğu son adımda `finalTracks = enriched.filter(t => t.preview_url)` uyguluyor. Spotify birçok şarkı için `preview_url`'ü boş döndürmeye başladı; iTunes yedeği her şarkıyı kapatamıyor.

Filtre her şeyi elerse kuyruk boş gelir ve ekran **"Kuyruk bitti · 0 kayıt arşivine eklendi"** yazar — yani bir başarısızlık, tamamlanmış bir tur gibi görünür.

> **Yapılacak:** "kuyruk tükendi" ile "kuyruk hiç dolmadı" durumlarını ayır. İkincisi için önizlemesiz kayıtları da göster (önizleme butonu pasif), ya da açık bir "şu an öneri üretilemedi" durumu koy.

### R3 — Tailwind CDN bağımlılığı · **Orta**

`index.html` hâlâ `cdn.tailwindcss.com` yüklüyor. Tasarım portundan sonra buna gerçekten ihtiyaç duyan yer neredeyse kalmadı: canlı kalıntı **F2 + F3 + `.hidden`**. Gerisi ölü kod (`adapters/`, `Component.js`'in hata kutusu).

Bağımlılığın bedeli: Tailwind'in kendi belgeleri bu script'i üretim için önermiyor; CSP'de `script-src`'a dış kaynak açmayı zorunlu kılıyor (bu depoda CSP yeni sıkılaştırıldı); CDN kesilirse kalıntı sınıflar çıplak kalır.

`.hidden`'ı benim `styles.css`'im de tanımlıyor, yani Tailwind gitse de gizleme davranışı ayakta kalır.

> **Yapılacak:** F2 ve F3 kapandıktan sonra ölü kalıntıyı temizle ve CDN script'ini kaldır. Kazanç: bir dış script + bir ağ isteği eksilir, CSP sıkılaşır, tema için tek kaynak kalır (bkz. R5).

### R4 — `.hidden` sıra bağımlılığı · **Orta**

`.ma-btn { display: inline-flex }` ile `.hidden { display: none }` aynı özgüllükte (0,1,0). Şu anda `.hidden` `styles.css`'in **sonunda** olduğu için kazanıyor — `#trackNoteSaveBtn` gibi `class="ma-btn … hidden"` taşıyan elemanlar bu sıraya bağlı. Biri `.hidden` bloğunu dosyanın yukarısına taşırsa not-kaydet butonu **gizlenemez hale gelir** ve kimse nedenini anlamaz.

> **Yapılacak:** `.hidden`'ı `display: none !important` yap ya da bloğun başına "bu kural dosyanın sonunda kalmalı" yorumunu koy. İlki daha sağlam.

### R5 — Çift tema anahtarı ayrışabilir · **Düşük**

Tema iki yerde yazılı: `data-ma-theme` (token setini seçer) ve `dark` sınıfı (kalan Tailwind `dark:` yardımcılarını sürer). `theme-boot.js` ve `applyTheme()` ikisini birlikte yazıyor, bugün tutarlı.

Risk davranışsal değil, sosyal: yeni bir `ma-*` yüzeye Tailwind `dark:` eklenirse iki sistem ayrışmaya başlar. R3 çözülürse bu risk kendiliğinden kapanır.

### R6 — Mood yazma ucu yok · **Düşük**

`mood` alanını yalnızca `/api/dig/swipe` yazıyor. Kullanıcının elle arşivlediği her şarkı kalıcı olarak mood'suz kalır, yani kütüphane tablosundaki mood sütunu çoğunlukla boş görünür ve tasarımın vaat ettiği "mood etiketle" özelliği yarım kalır.

> **Yapılacak:** `POST /api/library/note`'a `mood` ekle (aynı kaydı güncelliyor, yeni uç gerekmez), sonra çekmeceye tasarımdaki mood seçiciyi geri koy.

### R7 — Paralel çalışma / rebase · **Düşük**

Bu dalda iki ajan aynı anda çalıştı. Dosya bazında ayrıştık — Astra `Navbar/Router/auth/library/LibraryView`, ben `styles.css` ve ekranlar — ve `b0e670b` ile `09f46b8` çakışmadan sıralandı. F2/F3/F6/F7 açılırken aynı ayrımı sürdürmek gerekir; F4/F5 Astra'nın dosyalarında.

### R8 — Testler UI'ı görmüyor · **Orta**

42 testin 41'i backend. Astra'nın eklediği `frontend-routing.test.js` tek frontend testi. Bu portta değişen her şey — beş ekran, çekmece, altı dialog, tema, üç dil — **yalnızca elle** doğrulandı. F2 ve F3 tam da bu yüzden testlerden kaçtı: ikisi de tarayıcıda gözle görülür, hiçbir testin bakmadığı yerde.

> **Yapılacak:** En azından tasarım sisteminin bütünlüğü için bir duman testi: `js/` içinde canlı Tailwind yardımcı sınıfı kalmadığını iddia eden bir regex testi, F2/F3 sınıfındaki her regresyonu yakalar ve ucuzdur.

---

## 6. Önerilen sıra

1. ~~**F2–F7**~~ — kapatıldı, her biri tarayıcıda doğrulandı.
2. **R1** (`personalized` bayrağını oku) ve **R2** (boş kuyruğu "bitti"den ayır) — Dig'in dürüstlüğü buna bağlı. İkisi de yeni locale anahtarı istiyor; locale dosyaları başka bir oturumda açık olduğu için bekletildi.
3. **R4** — tek satır, sessiz bir kırılmayı kalıcı olarak kapatır.
4. **R3** — F2/F3 sonrası `js/` içinde canlı Tailwind kalıntısı yalnızca ölü kod ve `.hidden`; CDN script'i artık çıkarılabilir. **R8**'deki duman testi bunu kalıcı kılar.
5. **F8, F9, F10** — temizlik, acelesi yok.

---

*Bu rapordaki her iddia depoda veya tarayıcıda doğrulandı; doğrulanmayanlar §3.3'te ayrıca listelendi.*
