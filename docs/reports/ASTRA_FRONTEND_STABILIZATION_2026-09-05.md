# Frontend Stabilizasyon ve Sertleştirme Raporu — 5 Eylül 2026

Bir önceki devir raporunun (`ASTRA_STABILIZATION_2026-09-05.md`) "Claude'un tamamlaması gerekenler"
listesinden yürütülen çalışma.

## Yönetici özeti

Kısmi kalan frontend göçü tamamlandı ve doğrulandı. Sekiz gerçek ürün hatası bulundu ve giderildi;
bunların üçü kullanıcıya doğrudan bozuk bir arayüz olarak görünüyordu (dashboard kartlarının hiçbir
şey yapmaması, "Son Eklenenler" listesinde sanatçı adının `undefined` çıkması, dışa aktarma
butonlarının çalışmaması). Spotify ve kullanıcı kaynaklı her metnin `innerHTML` üzerinden basıldığı
render yolları güvenli DOM kurulumuna çevrildi. 27 inline event attribute kaldırıldığı için
Content-Security-Policy açılabildi ve `script-src` içinde `unsafe-inline` gerekmeden açıldı.
i18n iskelet olmaktan çıkıp arayüzün tamamını kapsar hale getirildi. ESLint, `.nvmrc`,
`.editorconfig` ve GitHub Actions CI eklendi.

Doğrulama gerçek Chrome üzerinde, canlı Spotify ve MongoDB'ye karşı 55 kontrol ile yapıldı; hepsi
geçti. Backend test paketi 38'den 41'e çıktı ve tamamı geçiyor. ESLint temiz.

- Dal: `fix/backend-data-auth-hardening`
- Aralık: `5c472d4..379f017` (3 commit, 38 dosya, +3.502 / −1.279 satır)
- GitHub'a push edildi.

## Commit'ler

| Commit | Konu |
|---|---|
| `0dc09e6` | Ürün akışlarının onarımı, XSS'e açık render'ların kaldırılması, i18n'in tamamlanması |
| `c6a89ea` | Lint, editör ve CI yapılandırması |
| `379f017` | CSP'nin açılması, `NODE_ENV` boşluğunun kapatılması, bağımlılık yamaları |

## Bulunan ve giderilen hatalar

Bunların hepsi çalışan koddaki gerçek kusurlardı, stil tercihi değil.

| # | Dosya | Hata | Kullanıcıya etkisi |
|---|---|---|---|
| 1 | `js/views/DashboardView.js` | `onOpenProfileModal` ve `onCreatePlaylist` prop'ları hiç geçirilmiyordu — Router view'a yalnız `{ router, queryParams }` veriyor, kalanlar no-op default'a düşüyordu | Dashboard'daki dört bento kartı ve "Yeni liste oluştur" kutusu tıklandığında hiçbir şey yapmıyordu |
| 2 | `js/components/Dashboard.js` | `track.artist` okunuyordu; API alanın adını `artistName` olarak döndürüyor | "Son Eklenenler" ve "En Yüksek Puanlı" listelerinde sanatçı satırı `undefined` |
| 3 | `js/components/Dashboard.js` | Satırlar `onclick="openTrackDetail('<id>')"` üretiyordu | Şarkı detayı yalnız id ile açılıyor, isim/sanatçı/kapak boş geliyordu; ayrıca id üzerinden HTML enjeksiyonu |
| 4 | `js/views/DashboardView.js` | CSV/JSON butonları `if (window.exportToCSV)` ile korunuyordu, bu global artık yok | Dışa aktarma butonları sessizce hiçbir şey yapmıyordu |
| 5 | `js/services/library.js` | Dokuz `catch` bloğunda `t()` çağrılıyor ama import edilmemişti (ESLint'in ilk koşusunda yakalandı) | Bu dosyadaki her hata toast'ı `ReferenceError` fırlatırdı |
| 6 | `server.js` `enrichTracksWithPreviews` | iTunes eşleşme bulamayınca Spotify'ın kendi `preview_url`'ünü `null` ile eziyordu | Spotify'da önizlemesi olan şarkılar da çalınamıyordu |
| 7 | `server.js` `/api/album/:id` | Albüm parçaları iTunes zenginleştirmesinden geçmiyordu | Albüm modalındaki her ▶ butonu "önizleme yok" veriyordu |
| 8 | `js/utils.js` + `js/components/Toast.js` | İki ayrı toast implementasyonu `window.showToast` üzerinde yarışıyordu; hangisinin kazandığı modül yükleme sırasına bağlıydı | Bildirimler tutarsız görünüyordu; ayrıca mesaj metni `innerHTML`'e gidiyordu |

## Güvenlik

### XSS / escaping

`js/core/dom.js` eklendi: `el()`, `img()`, `replace()`, `emptyState()`, `loadingState()`,
`escapeHtml()`, `safeImageUrl()`. Metin daima `textContent` üzerinden gider; yalnız sabit markup
`innerHTML` olarak yazılır.

Yeniden yazılan render yolları — hepsi Spotify veya kullanıcı kaynaklı metin basıyordu:

- `js/views/SearchView.js` — sanatçı, şarkı ve albüm sonuçları
- `js/views/LibraryView.js` — beğenilenler, takip edilenler, listeler
- `js/components/Dashboard.js` — son eklenenler, en yüksek puanlı
- `js/components/Details.js` — albüm, şarkı ve liste modalları (tamamen yeniden yazıldı)
- `js/components/Navbar.js` — kullanıcı adı (hem metin hem `aria-label` içinde)
- `js/services/search.js` — otomatik tamamlama satırları
- `js/components/Toast.js` — sunucudan gelen hata metinleri
- `js/core/Component.js` — hata mesajının markup olarak ayrıştırılması

`safeImageUrl()` yalnız `http(s)`, kök-göreli yollar ve `data:image/*;base64` kabul eder; bir API
yanıtındaki `javascript:` URL'i `src` niteliğine ulaşamaz.

Doğrulama: tarayıcı testi `Tarayıcı Testi <b>xss</b>` adında bir liste oluşturuyor ve DOM'da `<b>`
elementi oluşmadığını kontrol ediyor.

### Content-Security-Policy

Kapalıydı, çünkü sayfa inline event attribute taşıyordu. 27 inline `on*` attribute'u
`data-shell-action` + tek delegasyon dinleyicisine çevrildikten sonra açıldı:

```
default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';
object-src 'none'; script-src 'self' https://cdn.tailwindcss.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com;
font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;
img-src 'self' data: https:; media-src 'self' https:; connect-src 'self';
worker-src 'self' blob:; manifest-src 'self'
```

`script-src` içinde `unsafe-inline` **ve** `unsafe-eval` yok — politikanın anlamlı olmasının şartı
buydu. `style-src` hâlâ `unsafe-inline` istiyor; sebebi Tailwind CDN'in utility sınıflarını çalışma
anında üretip `<style>` elementi olarak enjekte etmesi. Bu, CDN derlemesinin bir özelliği; Tailwind
production'da önceden derlenirse bu direktif de kapatılabilir.

Tarayıcıda tek bir CSP ihlali oluşmadan tüm akışlar çalışıyor.

### NODE_ENV

Önceki davranış: `IS_PRODUCTION = process.env.NODE_ENV === 'production'`. `NODE_ENV` çoğu hosting
ortamında hiç set edilmiyor; bu durumda tüm production korumaları sessizce devre dışı kalıyordu —
`MONGO_URI` eksik veya erişilemez olduğunda sunucu hata vermek yerine uçucu in-memory veritabanına
düşüyordu.

Yeni davranış: açıkça `development` veya `test` olmayan her değer production sayılır. Regresyon
testi eklendi.

### Bağımlılıklar

`npm audit`: **11 açık (7 yüksek) → 3 orta**.

- Yamalandı: `axios`, `path-to-regexp`, `express-rate-limit`, `body-parser`
- Kalan 3 orta: `qs`, `express@4` üzerinden geliyor. Tek yayımlanmış çözüm `express@5`, kırıcı bir
  yükseltme. Bilerek burada yapılmadı; ayrı ve planlı bir migrasyon işi.

## i18n

Önce: 44 anahtar, sitede 17 yerde kullanım. Dil değiştirildiğinde yalnız `data-lang` taşıyan bir
avuç element değişiyor, arayüzün geri kalanı Türkçe kalıyordu.

Şimdi: **139 anahtar × 3 dil**, arayüzün tamamı.

- `ku.json` Soranî (Arap alfabesi) ile yazılmıştı, ayarlar menüsü ise "Kurdî (Kurmancî)" diyordu.
  Latin alfabesiyle Kurmancî olarak yeniden yazıldı. **Soranî tercih ediliyorsa etiketin
  değiştirilmesi gerekir — bu bir tercih kararı, sana bırakıldı.**
- Dil değişimi artık navbar'ı, arama çubuğunu ve açık olan view'ı yeniden çiziyor.
- `<html lang>` niteliği doğru dile ayarlanıyor.
- `data-lang` yanına `data-lang-placeholder`, `data-lang-aria`, `data-lang-title` eklendi.

## Test ve doğrulama

### Tarayıcı akış testi — 55/55

Gerçek Chrome (headless), canlı Spotify API'si ve canlı MongoDB'ye karşı. Sürücü ek bağımlılık
kullanmıyor; Node 22'nin yerleşik `WebSocket`'i üzerinden Chrome DevTools Protocol konuşuyor.

Kapsanan akışlar:

- Kayıt olma, oturumun sayfa yenilemeden sonra sürmesi, verilerin geri yüklenmesi
- Sanatçı araması (Tarkan → 15 albüm), takip et / takibi bırak / tekrar takip et
- Albüm modalı: 12 parça listelendi, albüm puanlama (4 yıldız), albümü arşive ekleme
- Şarkı detayı: beğen, buton durumunun güncellenmesi, **yarım yıldız puanlama (2.5)**, puan yazısı
- Kişisel not: yazma, kaydet butonunun belirmesi, kaydetme, kütüphanede görünmesi
- MiniPlayer: iTunes önizlemesiyle açılma, kapanma
- Liste yaşam döngüsü: oluşturma, şarkı ekleme, kapak değiştirme (URL), şarkı çıkarma, onaylı silme
- **XSS kontrolü:** `<b>xss</b>` içeren liste adının escape edildiği doğrulandı
- Kütüphane sekmeleri: beğenilenler, takip edilenler, listeler
- Dil: TR / EN / KU — başlık, kart metni ve `<html lang>` ayrı ayrı kontrol edildi
- Tema: açık / koyu
- **375 px responsive:** dashboard ve arama sayfasında yatay taşma 0 px
- Konsol: tek bir hata veya başarısız network isteği yok

### Backend test paketi — 41/41

Önceki 38 testin tamamı geçiyor. Üç yeni regresyon testi:

1. CSP direktiflerinin doğruluğu ve `script-src` içinde `unsafe-inline`/`unsafe-eval` olmaması
2. Yayımlanan hiçbir markup'ta inline event attribute bulunmaması (CSP'yi koruyan test)
3. `NODE_ENV` boşken `MONGO_URI` olmadan hızlı başarısızlık

İki eski test güncellendi: kaynak koddaki metni birebir arıyorlardı ve bilerek değiştirdiğim
satırlara bakıyorlardı (`window.confirmCreatePlaylist =` ve sabit Türkçe hata metni). Yeni davranışı
kontrol edecek şekilde yazıldılar.

### Lint

`npx eslint .` — temiz.

### CI simülasyonu

Temiz bir `git clone` üzerinde, `.env` dosyası olmadan `npm ci` → `npm run lint` → `npm test`
çalıştırıldı: hepsi geçti. Test paketi `SKIP_DOTENV_CONFIG` ayarlayıp kendi geçici sırlarını
ürettiği ve `axios`'u stub'ladığı için CI'da hiçbir repository secret'ına ihtiyaç yok.

## Eklenen altyapı

| Dosya | İçerik |
|---|---|
| `eslint.config.js` | Flat config; üç JavaScript lehçesi için ayrı global setleri (sunucuda CommonJS, `js/` altında tarayıcı ES modülleri, `test/` altında Node test runner). `js/theme-config.js` klasik script olarak ayrı ele alınıyor. |
| `.nvmrc` | Node 22 |
| `.editorconfig` | `.gitattributes` ile uyumlu: LF, UTF-8, 4 boşluk (JSON/YAML için 2) |
| `.github/workflows/ci.yml` | Her dal ve PR'da lint + test; ayrıca CRLF kontrolü (`mobile/` hariç — o dizin bilerek normalizasyon dışında bırakılmıştı) |
| `package.json` | `lint`, `lint:fix`, `check` script'leri; `engines.node` `>=20` |

## Yapılmayanlar ve nedenleri

### `server.js` modülerleştirmesi — YAPILMADI

Dosya ~2.560 satır. Bu iş bilinçli olarak yarım bırakılmadı, hiç başlanmadı; frontend doğrulaması ve
güvenlik işleri önceliklendirildi. Sıradaki en büyük kalem bu.

Önerilen yaklaşım: rota grubu grubu taşımak (auth → search/album → library → playlists → ratings →
admin → dig), her adımdan sonra `npm run check` çalıştırmak. Şemalar ve middleware ayrı modüllere
çıkarıldıktan sonra rotalar takip etmeli.

### `js/models/` ve `js/adapters/` — DOKUNULMADI

Yaklaşık 2.000 satır. Yalnız `store.js` içindeki `getTrackModel`, `getArtistModel`,
`getLikedTrackModels`, `getFollowedArtistModels`, `cacheTrack`, `cacheArtist` metotlarından
erişilebiliyorlar — ve bu metotların hiçbiri uygulamada çağrılmıyor. Yani pratikte ölü kod, ama
"ileride kullanılacak mimari" olması ihtimaline karşı silmedim. **Karar senin:** silinecekse
`store.js`'teki o altı metot da birlikte gitmeli.

### 15 maddelik güvenlik curl matrisi — KISMEN

Bu oturumda tam matris koşulmadı. Ancak eşdeğer kapsamın bir kısmı otomatik testlerde duruyor:
statik dosya sızıntısı (`/server.js`, `/.env`, `/package.json`, `/database.sqlite` → 404), CORS
allowlist ve preflight, geçersiz Authorization header'ının mock auth'a düşmemesi, duplicate route
denetimi, CSP, `NODE_ENV` fail-fast.

Yapılmayanlar: `gitleaks` taraması, tüm Git geçmişinin sır taraması, `mobile/` için `npm audit`,
production ortamında canlı CORS/proxy davranışının doğrulanması, admin paneline canlı erişim testi.

### `express@5` yükseltmesi — YAPILMADI

Kalan 3 orta seviye açığın tek çözümü. Kırıcı bir yükseltme olduğu için ayrı bir iş olarak
bırakıldı.

### Tailwind CDN → derlenmiş build — YAPILMADI

Tarayıcı konsolu her yüklemede "should not be used in production" uyarısı veriyor. Tailwind'in
önceden derlenmesi hem bu uyarıyı hem de CSP'deki `style-src 'unsafe-inline'` ihtiyacını kaldırır.

## Akşam için önerilen sıra

1. `server.js` modülerleştirmesi — en büyük ve en çok fayda getirecek kalem.
2. `js/models/` ve `js/adapters/` hakkında karar (sil ya da kullan).
3. Tailwind'i derlenmiş build'e geçir; `style-src 'unsafe-inline'`'ı kaldır.
4. `express@5` migrasyonu; `npm audit`'i sıfıra indir.
5. `gitleaks` + Git geçmişi sır taraması.
6. Kürtçe için Kurmancî / Soranî kararı.

## Not

`ASTRA-PROMPT-music-archive.md` yine takip edilmeyen yerel dosya olarak bırakıldı, commit
edilmedi. `main` dalına merge veya force push yapılmadı.
