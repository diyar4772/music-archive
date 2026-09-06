# Music Archive — Stabilizasyon, Güvenlik ve Canlı Doğrulama Görevi

## 0. ROLÜN

Sen bu repo üzerinde çalışan kıdemli bir yazılım mühendisisin. Görevin **yeni özellik eklemek değil**. Görevin:

1. Mevcut hataları bulup düzeltmek
2. Ölü kodu ve yarım kalmış yapıları temizlemek
3. Siteyi gerçekten çalışır hale getirmek — sadece "derleniyor" değil, **tarayıcıda ve curl ile doğrulanmış** şekilde
4. Güvenlik taraması yapıp bulguları raporlamak

Bu iş bir **restorasyon** işi. Kod tabanı iki yarım kalmış refactor'ın üst üste yığılmasından oluşuyor. Yeni katman ekleme — var olanı sadeleştir.

---

## 1. ELİNDEKİ MATERYAL

Repo kökündeki `docs/` klasöründe ve bu prompt'un yanında sana verilen denetim raporları var. **İşe başlamadan önce hepsini oku:**

- `Music-Archive-Denetim-ve-Yol-Haritasi.md` — benim hazırlattığım tam yapısal denetim. Satır numaralı, ölçülmüş bulgular içeriyor. **Bu senin ana referansın.**
- `CLAUDE_BACKEND_AUDIT.md` — backend güvenlik denetimi (Claude tarafından)
- `docs/reports/CODEX_BACKEND_RUNTIME_SECURITY_FIXES_2026-09-04.md`
- `docs/reports/CODEX_BACKEND_PRODUCTION_HARDENING_2026-09-04.md`

Bu raporlardaki bulguların çoğu **zaten düzeltilmiş**. Körü körüne uygulama — her bulguyu önce mevcut kodda doğrula, hâlâ geçerli mi bak. Düzeltilmiş bir şeyi tekrar "düzeltmek" regresyon üretir.

**Repo:** `github.com/diyar4772/music-archive`
**Çalışma branch'i:** `fix/backend-data-auth-hardening`
**Stack:** Node 22 / Express 4 / Mongoose 8 / vanilla JS ESM frontend / Expo (React Native) mobil

---

## 2. DEĞİŞMEZ KURALLAR

Bunları ihlal edersen iş reddedilir.

1. **`npm test` her zaman 29/29 geçmeli.** Şu an geçiyor. Her commit'ten önce çalıştır. Test kırılırsa dur, düzelt, sonra devam et.
2. **Mevcut güvenlik sertleştirmelerini geri alma.** `requireSecret()`, fail-closed mock auth, production'da MongoDB fail-fast, CORS allowlist — bunlar bilinçli kararlar. Dokunma.
3. **Sır üretme, sır yazma, `.env` commit etme.** Örnek değer gerekiyorsa `.env.example`'a placeholder yaz.
4. **`panel-4772.html` dosya adını değiştirme.** Kasıtlı seçilmiş.
5. **`mobile/` klasörüne dokunma.** Expo tarafı temiz durumda, bu görevin kapsamı dışında.
6. **Her faz ayrı commit.** Tek dev commit atma. Commit mesajları açıklayıcı olsun.
7. **Emin olmadığında sil, ekleme.** Bu bir temizlik görevi. Şüphedeyken kod eklemek yerine sor.
8. **Tahmin ettiğin şeyi "düzelttim" diye raporlama.** Her düzeltme ya bir testle ya bir curl çıktısıyla ya bir tarayıcı gözlemiyle kanıtlanmalı.

---

## 3. ÖNCE ORTAMI KUR — YOKSA HİÇBİR ŞEYİ TEST EDEMEZSİN

### 3.1 KRİTİK BİLGİ: Arama neden çalışmıyor

Kullanıcının "şarkıcı arayamıyorum" şikayeti **kod hatası değil, konfigürasyon eksikliği.** Bunu canlı doğruladım:

```
GET /api/health                      → HTTP 200   ✅ sunucu sağlıklı görünüyor
POST /api/register                   → HTTP 200   ✅ kayıt çalışıyor
POST /api/login                      → HTTP 200   ✅ giriş çalışıyor
GET  /api/search?artist=tarkan       → HTTP 500   ❌ {"error":"Failed to get Spotify Token"}

Sunucu logu: Spotify Auth Error: Request failed with status code 403
```

**Kök neden:** `server.js` içinde `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` başlangıçta `requireSecret()` ile zorunlu tutuluyor. Ama `SPOTIFY_CLIENT_ID` ve `SPOTIFY_CLIENT_SECRET` **hiç doğrulanmıyor** (satır ~335, `getSpotifyToken`). Değerler yoksa `Buffer.from("undefined:undefined")` Spotify'a gidiyor, Spotify 403 dönüyor, uygulama runtime'da 500 veriyor.

Sonuç: **sunucu yeşil görünüyor, health check geçiyor, ama arama tamamen ölü.** Sessiz hata sınıfının ders kitabı örneği.

### 3.2 Yapman gerekenler

**a) Kullanıcıdan Spotify credential'ları iste.** Sen üretemezsin. Kullanıcı `developer.spotify.com/dashboard`'dan bir app oluşturup Client ID + Secret vermeli. Bunlar olmadan arama, albüm, autocomplete — hiçbiri test edilemez.

Kullanıcıya net söyle: *"Arama fonksiyonunu doğrulayabilmem için SPOTIFY_CLIENT_ID ve SPOTIFY_CLIENT_SECRET gerekli. Bunlar olmadan bu bölümü sadece mock'la test edebilirim, gerçek davranışı doğrulayamam."*

**b) Startup validasyonu ekle.** Spotify credential'ları eksikse sunucu **açılışta yüksek sesle uyarmalı**, runtime'da sessizce 500 vermemeli:

```js
// Sırlar zorunlu değil (Spotify olmadan da uygulamanın geri kalanı çalışır)
// ama eksikse açılışta bağırmalı ve /api/health bunu raporlamalı.
const SPOTIFY_CONFIGURED = Boolean(
  process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET
);
if (!SPOTIFY_CONFIGURED) {
  console.warn('⚠️  SPOTIFY_CLIENT_ID/SECRET yok — arama, albüm ve autocomplete uçları 503 dönecek.');
}
```

**c) Hata mesajını dürüst yap.** `getSpotifyToken()` şu an her hatayı `'Failed to get Spotify Token'` diye yutuyor. Ayır:

- Credential yok → `503 { error: 'SEARCH_UNAVAILABLE', detail: 'Spotify credentials not configured' }`
- Credential var ama Spotify 401/403 → `502 { error: 'SEARCH_UPSTREAM_AUTH_FAILED' }`
- Spotify 429 → `429` olarak geçir, retry-after başlığıyla
- Ağ hatası / timeout → `504`

**d) `/api/health` genişlet.** Şu an sadece DB durumu bakıyor. Şunu döndürsün:

```json
{ "status": "ready", "database": "in-memory|mongodb", "spotify": "configured|missing" }
```

Böylece "sunucu ayakta ama arama ölü" durumu tek istekte görünür.

**e) Frontend'de anlamlı hata göster.** Arama 503 dönünce kullanıcı boş ekran değil, *"Arama servisi şu an kullanılamıyor"* mesajı görmeli. Şu an sessizce hiçbir şey olmuyor.

### 3.3 Yerel çalıştırma

```bash
npm ci
cp .env.example .env       # doldur
npm test                   # 29/29 geçmeli — geçmiyorsa DUR
npm run dev
```

Minimum `.env`:

```
NODE_ENV=development
JWT_SECRET=<güçlü rastgele değer>
ADMIN_USERNAME=<...>
ADMIN_PASSWORD=<...>
SPOTIFY_CLIENT_ID=<kullanıcıdan>
SPOTIFY_CLIENT_SECRET=<kullanıcıdan>
CORS_ORIGINS=http://localhost:3000
# MONGO_URI opsiyonel — yoksa in-memory DB'ye düşer (sadece development'ta)
```

---

## 4. FAZLAR

Sırayı bozma. Her faz bir öncekinin üstüne kuruluyor.

### FAZ 0 — Satır sonlarını normalize et

**Neden:** Repo'da 85 dosya CRLF, 47 dosya LF, `.gitattributes` yok. Bunun ölçülmüş etkisi:

```
main → fix/backend-data-auth-hardening
  Ham diff:         110 dosya, 26.432 ekleme, 19.115 silme
  Normalize:         37 dosya,  7.789 ekleme,    472 silme
  server.js tek başına: ham 2.975 ekleme → gerçekte 326
```

**Diff'in %85'i gürültü. 73 dosyada sıfır anlamlı değişiklik var.** Bunu düzeltmeden yaptığın her değişikliğin review'u imkânsız olur.

**Yap:**

1. Kök dizine `.gitattributes`:
   ```gitattributes
   * text=auto eol=lf
   *.png binary
   *.jpg binary
   *.ttf binary
   ```
2. `git add --renormalize .`
3. Tek commit: `chore: normalize line endings to LF`
4. `npm test` — 29/29

Bu commit devasa görünecek. Normal, bir kereliğine.

---

### FAZ 1 — Ölü kodu sil

İçe aktarma grafiği `js/app.js`'ten başlanarak (dinamik `import()` dahil) çıkarıldı. 41 JS dosyasından 31'i canlı, 10'u erişilemez.

**Sil:**

```
server/index.js                          (0 byte)
server/config/index.js                   (0 byte)
server/models/index.js                   (0 byte)
server/middleware/auth.middleware.js     (0 byte)
server/middleware/rateLimit.middleware.js(0 byte)
server/services/itunes.service.js        (0 byte)
server/services/spotify.service.js       (0 byte)

index_backup.html      (133 satır — ölü zincirin kökü)
css/main.css           (309 — sadece index_backup.html referans veriyor)
css/components.css     (967 — aynı)
manifest.json          (29 — hiçbir canlı sayfa çağırmıyor)

js/core/Store.js                (637 — js/state/store.js ile çakışıyor, ikincisi kullanılıyor)
js/core/index.js                (8)
js/components/TrackItem.js      (262)
js/components/AlbumModal.js     (243)
js/components/TrackRow.js       (139)
js/components/AddArtistForm.js  (108)
js/components/StatCards.js      (80)
js/components/ArtistCard.js     (64)
js/services/dataService.js      (162)
js/services/spotify.js          (43)
js/data/artists.json            (24 — sadece ölü dataService.js okuyor)
```

**Toplam: 3.208 satır = kod tabanının %11,4'ü.**

> ⚠️ `server/` klasörü tamamen boş 7 dosyadan oluşuyor. Birisi modülerleştirme iskeletini kurmuş, içini hiç doldurmamış. `package.json` hâlâ `"main": "server.js"` diyor. Bu klasör durduğu sürece her agent "modüler yapı var" diye yanlış varsayım yapacak. **Sil.** FAZ 5'te gerçekten dolduracaksın.

> ℹ️ `js/adapters/index.js` içindeki `YouTubeAdapter` / `LocalFileAdapter` / `AppleMusicAdapter` satırları **yorum halinde**, kırık import değil. Adapters klasörüne dokunma.

**Doğrula:**
```bash
npm test                                   # 29/29
node server.js &                           # sonra tarayıcıda /
# Konsolda tek bir 404 veya module resolution hatası olmamalı
```

---

### FAZ 2 — Express route gölgelemesini düzelt

**Bu, projedeki en ciddi sessiz runtime hatası.** Aynı path birden fazla kez kaydedilmiş. Express **ilk eşleşeni** çalıştırır; sonrakiler ölü koddur.

| Path | Kazanan | ÖLÜ (hiç çalışmıyor) |
|---|---|---|
| `GET /api/library/tracks` | satır 1948 → `authenticateToken` | satır 2786 → `mobileAuth` |
| `GET /api/library/artists` | satır 2038 → `authenticateToken` | satır 2875 → `mobileAuth` |
| `DELETE /api/library/track/:param` | satır 2168 → `:trackId` | satır 2437 → `:spotifyId` |

Son satır özellikle sinsi: **Express route eşleştirirken parametre adına bakmaz.** `:trackId` ile `:spotifyId` aynı pattern'dir. Mobilin "spotifyId ile sil" endpoint'i asla çağrılmıyor — istek web'in `:trackId` handler'ına düşüyor.

**Ek olarak kavramsal çiftlenmeler var:**

```
POST /api/follow          ↔  POST /api/library/follow
POST /api/like            ↔  POST /api/library/like
GET  /api/playlists       ↔  GET  /api/library/playlists
POST /api/playlists       ↔  POST /api/library/playlists
```

46 route kayıtlı, gerçek API yüzeyi ~35.

**Yap:**

1. **İki auth middleware'ini birleştir.** `authenticateToken` (satır 457) ve `mobileAuth` (satır 2289) arasındaki tek gerçek fark mock-auth fallback'i. Tek middleware yaz, fallback'i flag'le yönet. İkisinin de mevcut güvenlik davranışını koru — özellikle `MOCK_AUTH_ENABLED` çift kilidi (`NODE_ENV==='development'` **VE** `ENABLE_MOCK_AUTH==='true'`).
2. Gölgelenen 3 route'u sil.
3. Çiftlenmiş kavramsal route'lara **karar ver.** Önerim: `/api/library/*` namespace'ini kanonik yap, eski `/api/follow`, `/api/like`, `/api/playlists` uçlarını koru ama içeriden yeni handler'a delege et (mobil ve web'in mevcut sürümlerini kırmamak için). Kararını gerekçesiyle rapora yaz.
4. **Her düzeltme için test yaz.** Özellikle: "aynı path iki kez kayıtlı değil" diye bir guard testi ekle:
   ```js
   // app._router.stack'i gez, (method, path) çiftlerinde duplicate ara
   ```
   Bu test bir daha aynı hatanın oluşmasını engeller.

**Doğrula:** Her route'u curl'le tek tek çağır, beklenen status kodunu al. Sonucu tablo halinde raporla.

---

### FAZ 3 — Tek frontend'e in

**Şu anki durum:** `index.html` 3.689 satır. İçinde **2.758 satır inline JavaScript** var. Ve sayfanın altında `<script type="module" src="js/app.js">` da var. Yani **iki ayrı uygulama aynı sayfada başlıyor.**

Daha kötüsü: inline kısımda **19 doğrudan `fetch()` çağrısı** var — `js/services/api.js` katmanı (auth header, token yenileme, hata yönetimi) tamamen baypas ediliyor.

Kanıt — birebir kopya:
```
index.html:1741      const res = await fetch(`${API_URL}/search?artist=...&type=${apiType}`)
js/services/search.js:27  const res = await fetch(`${API_URL}/search?artist=...&type=${apiType}`)
```

**Karar: `js/` modüler yapıyı koru, inline JS'i oraya taşı.** Mimari zaten mevcut (Router, Component, Store, View'lar). İnline monoliti seçip `js/`'i silmek 31 canlı modülü çöpe atmak olur.

**Yap — parça parça, her adımda test ederek:**

1. Önce **auth interceptor'ı** taşı (index.html satır ~1014-1070, `nativeFetch` + refresh mantığı) → `js/services/api.js` ile birleştir. İkisi aynı işi yapıyor.
2. Sonra **arama** (satır ~1741) → `js/services/search.js` zaten var, inline'ı sil.
3. Sonra **playlist işlemleri** (satır ~2209, 2303, 2342, 2683, 2745) → `js/services/library.js`
4. Sonra **like/follow** (satır ~2819, 2866, 2919)
5. Sonra **album modal** (satır ~1898)
6. Kalan UI mantığını ilgili `js/components/` ve `js/views/` dosyalarına dağıt.

**Her taşımadan sonra:** tarayıcıda ilgili özelliği elle test et. `index.html` satır sayısını rapora yaz — ilerleme ölçülebilir olmalı.

**Bitiş çizgisi:** `index.html` < 200 satır (sadece HTML iskeleti + module script), inline `fetch()` sayısı **0**.

Bu fazın uzun sürmesi normal. Yarım bırakırsan **hangi noktada kaldığını rapora net yaz** — hangi özellikler taşındı, hangileri hâlâ inline.

---

### FAZ 4 — Zemini sabitle

Repo'da şu an **hiçbiri yok**: CI, linter, formatter, `.editorconfig`, `.nvmrc`, Docker.

**Ekle:**

```
.nvmrc                    → 22
.editorconfig             → indent 4 space, LF, final newline
eslint.config.js          → flat config; en azından no-unused-vars, no-undef,
                            no-duplicate-imports. Mevcut kodda çıkan hataları
                            düzelt, kuralları gevşetme.
.github/workflows/ci.yml  → push + PR'da: npm ci && npm run lint && npm test
```

CI özellikle önemli: agent'ın ürettiği kodun testleri kırıp kırmadığını insan kontrol etmezse kimse etmez.

---

### FAZ 5 — `server.js`'i gerçekten parçala

2.975 satırlık monolit. FAZ 1'de sildiğin boş iskeleti şimdi **gerçekten** doldur.

**Hedef:**
```
server/
├── index.js           # app kurulumu + listen, ~80 satır
├── config/index.js    # env okuma, sabitler, requireSecret
├── models/            # mongoose şemaları + in-memory fallback
├── middleware/        # auth (TEK), rateLimit, errorHandler
├── routes/            # auth, library, search, admin, dig, playlists
└── services/          # spotify, itunes, cache
```

**Yöntem — tek seferde bölme.** Route grubu grubu taşı:

```
1. admin route'ları    → server/routes/admin.js    → npm test
2. search route'ları   → server/routes/search.js   → npm test
3. playlist route'ları → server/routes/playlists.js→ npm test
4. library route'ları  → server/routes/library.js  → npm test
5. auth route'ları     → server/routes/auth.js     → npm test
6. dig route'ları      → server/routes/dig.js      → npm test
7. kalan: modeller, servisler, middleware
```

Her adımda `server.js` küçülür, `npm test` yeşil kalır. `package.json`'daki `"main"` ve `scripts.start` en sonda güncellenir.

**Bu faz mekanik ve testle doğrulanabilir — senin için ideal iş.** Ama acele edip hepsini bir commit'e sıkıştırma.

---

### FAZ 6 — Güvenlik taraması

#### 6.1 Otomatik

```bash
npm audit --production
npm audit --audit-level=high
cd mobile && npm audit; cd ..
npx --yes gitleaks detect --source . --no-git -v   # çalışan dizin
npx --yes gitleaks detect --source . -v            # tüm git geçmişi
```

> Not: Git geçmişini ben zaten taradım — **sızmış gerçek sır yok.** Bulunanların hepsi placeholder (`your_client_secret_here`, `CHANGE_THIS_TO_...`). `.env` doğru gitignore'lanmış. Yine de kendi taramanı yap ve teyit et.

#### 6.2 Elle kontrol listesi

Her maddeyi **canlı istekle** doğrula, kod okuyarak değil:

| # | Kontrol | Beklenen |
|---|---|---|
| 1 | `GET /server.js`, `/package.json`, `/.env`, `/.git/config` | 404 — *(ben doğruladım, geçiyor)* |
| 2 | Auth'suz `GET /api/library/tracks` | 401 |
| 3 | Geçersiz/expired token ile korumalı uç | 401, mock fallback'e düşmemeli |
| 4 | Normal kullanıcı token'ı ile `GET /api/admin/users` | 403 |
| 5 | `/api/auth/refresh` NoSQL injection (`{"refreshToken":{"$ne":null}}`) | Reddedilmeli |
| 6 | `NODE_ENV=production` + `MONGO_URI` yok | Açılışta ölmeli |
| 7 | `NODE_ENV=production` + Mongo erişilemez | Ölmeli, in-memory'ye düşmemeli |
| 8 | İzinsiz origin'den CORS preflight | 403, stack trace sızdırmadan |
| 9 | Rate limit — IPv4 ve IPv6'dan | İkisi de sınırlanmalı, IPv6 baypası olmamalı |
| 10 | Şifre alanı response'ta | Hiçbir uçta dönmemeli |
| 11 | Refresh token DB'de | Sadece SHA-256 hash olarak |
| 12 | Bilinmeyen `/api/*` yolu | Kontrollü JSON 404 |
| 13 | `helmet` başlıkları | CSP dahil aktif |
| 14 | `express.json` limit | 5mb — aşınca 413 |
| 15 | Admin panel `/admin` | Auth gerektirmeli — *(şu an `/admin` 200 dönüyor, içeride auth var mı doğrula)* |

#### 6.3 Bilinen açık risk — düzelt

`IS_PRODUCTION = process.env.NODE_ENV === 'production'`.

VPS'te `node server.js` denip `NODE_ENV` set edilmezse `IS_PRODUCTION` **false** olur → Mongo koparsa sessizce in-memory DB'ye düşer → **veri kaybı, kimse fark etmez.**

**Yap:** ya deploy dokümanında `NODE_ENV=production`'ı zorunlu kıl ve startup'ta `NODE_ENV` set değilse uyar, ya da mantığı ters çevir: `IS_DEVELOPMENT` açıkça set edilmedikçe production varsay. İkinci seçenek daha güvenli. Kararını gerekçelendir.

---

## 5. CANLI TEST — SİTE GERÇEKTEN ÇALIŞIYOR MU

Kod okuyarak "çalışıyor" deme. **Sunucuyu ayağa kaldır, tarayıcıda aç, her akışı elle yürüt.**

### 5.1 Backend uçtan uca (curl)

```bash
# health
curl -s localhost:3000/api/health | jq

# kayıt → giriş → token
curl -s -X POST localhost:3000/api/register -H 'Content-Type: application/json' \
  -d '{"username":"testuser","password":"TestPass123!"}'
TOKEN=$(curl -s -X POST localhost:3000/api/login -H 'Content-Type: application/json' \
  -d '{"username":"testuser","password":"TestPass123!"}' | jq -r .token)

# ARAMA — asıl şikayet bu
curl -s "localhost:3000/api/search?artist=tarkan&type=artist"    | jq
curl -s "localhost:3000/api/search?artist=tarkan&type=simple"    | jq
curl -s "localhost:3000/api/search?artist=sezen%20aksu&type=track" | jq
curl -s "localhost:3000/api/search?artist=&type=artist"          # 400 bekleniyor
curl -s "localhost:3000/api/search"                              # 400 bekleniyor
curl -s "localhost:3000/api/search?artist=xyzqwerty123&type=simple" # 404 bekleniyor

# kütüphane
curl -s localhost:3000/api/library/tracks  -H "Authorization: Bearer $TOKEN" | jq
curl -s localhost:3000/api/library/artists -H "Authorization: Bearer $TOKEN" | jq
curl -s localhost:3000/api/me              -H "Authorization: Bearer $TOKEN" | jq
```

Her uç için **gerçek status kodunu ve response gövdesini** rapora yaz.

### 5.2 Tarayıcı — elle yürünecek akışlar

Her adımda **DevTools Console ve Network sekmesi açık olsun.** Tek bir kırmızı hata bile kabul edilemez.

1. **Sayfa yükleniyor mu** — `/` aç. Konsol temiz mi? Başarısız istek var mı?
2. **Kayıt** — modal açılıyor mu, form gönderiliyor mu, token saklanıyor mu?
3. **Giriş** — çıkış yapıp tekrar gir. Sayfayı yenile, oturum kalıcı mı?
4. **🎯 SANATÇI ARAMA — asıl şikayet.** Arama kutusuna "Tarkan" yaz.
   - İstek gidiyor mu? Hangi URL'e?
   - Status ne dönüyor?
   - Sonuç ekrana basılıyor mu?
   - Hata durumunda kullanıcı **bir şey görüyor mu**, yoksa sessizce boş mu kalıyor?
   - Autocomplete/debounce çalışıyor mu?
   - **Bu akışın her adımını ayrı ayrı raporla.** "Arama çalışıyor" yetmez.
5. **Şarkı ve albüm arama** — type=track, type=album
6. **Sanatçı takip et / bırak** — sayfa yenileyince kalıcı mı?
7. **Şarkı beğen / kaldır**
8. **Playlist** — oluştur, şarkı ekle, şarkı çıkar, kapak değiştir, sil
9. **Puanlama** — puan ver, değiştir, sil
10. **Kütüphane sayfası** — takip edilenler ve beğenilenler doğru listeleniyor mu?
11. **Dashboard / istatistikler** — sayılar tutuyor mu?
12. **MiniPlayer** — iTunes preview çalıyor mu?
13. **Dil değiştirme** — TR / EN / KU. `js/locales/*.json` yükleniyor mu?
14. **Admin paneli** `/admin` — normal kullanıcıyla erişilebiliyor mu? (Erişilebiliyorsa **açık**)
15. **Responsive** — 375px genişlikte layout bozuluyor mu?

### 5.3 Regresyon kontrolü

FAZ 3'te frontend taşıma yaptıktan **sonra** yukarıdaki 15 maddeyi baştan tekrar yürüt. Taşıma sırasında bir şey kırıldıysa burada yakalanır.

---

## 6. RAPORLAMA

Çalışmanı `docs/reports/ASTRA_STABILIZATION_<tarih>.md` olarak yaz. Format:

```markdown
# Astra Stabilizasyon Raporu — <tarih>

## 1. Yönetici özeti
   3-5 cümle. Ne yapıldı, ne yapılamadı, ana risk ne.

## 2. Başlangıç durumu
   git rev-parse HEAD, npm test çıktısı, branch

## 3. Faz faz yapılanlar
   Her faz için: ne değişti, hangi dosyalar, neden, nasıl doğrulandı

## 4. Düzeltilen hatalar
   | # | Hata | Kök neden | Düzeltme | Kanıt (test/curl/ekran) |

## 5. Canlı test sonuçları
   §5.1 curl tablosu (uç, status, gövde özeti)
   §5.2 15 akışın tek tek sonucu — ✅/❌/⚠️ ve açıklama

## 6. Güvenlik taraması
   Otomatik tarama çıktıları + 15 maddelik elle kontrol tablosu

## 7. Doğrulanamayan / yanlış bulunan iddialar
   Denetim raporlarındaki hangi bulgular artık geçerli değil,
   hangilerini doğrulayamadın ve neden

## 8. Kalan riskler
   Düzeltilmemiş her şey. Dürüst ol.

## 9. Yapılmayanlar ve nedeni
   Özellikle: Spotify credential'ı yoksa test edilemeyen her şey

## 10. Sonraki adımlar
```

**Rapor kuralları:**

- **Yapmadığın şeyi yaptım deme.** Kısmi iş kısmi olarak raporlanır.
- **Doğrulayamadığını "doğruladım" deme.** Spotify credential'ı yoksa arama akışını doğrulayamazsın; öyle yaz.
- Her düzeltmeye kanıt ekle: test adı, curl çıktısı, veya konsol ekran görüntüsü tarifi.
- Denetim raporlarındaki bir bulguya **katılmıyorsan söyle** ve gerekçelendir. Mevcut raporlarda Claude ve Codex birbirinin bulgularını denetlemiş — sen de aynısını yap.

---

## 7. YAPMA LİSTESİ

- ❌ Yeni özellik ekleme. Kullanıcı istemedi.
- ❌ Bağımlılık ekleme — gerçekten zorunlu değilse. Ekliyorsan gerekçelendir.
- ❌ Framework değiştirme. Vanilla JS frontend kalacak, React'e çevirme.
- ❌ Veritabanı şeması değiştirme — açık bir hata düzeltmiyorsan.
- ❌ `mobile/` klasörüne dokunma.
- ❌ Mevcut testleri "geçsin diye" gevşetme veya silme.
- ❌ Tek dev commit. Faz faz commit'le.
- ❌ Kullanıcının onayı olmadan `main`'e merge etme veya force push.
- ❌ Tahmine dayalı "düzeltme". Sebebi anlamadığın hatayı düzeltiyormuş gibi yapma — raporla ve sor.

---

## 8. BİTİŞ ŞARTLARI

Aşağıdakilerin hepsi sağlanmadan iş bitmiş sayılmaz:

- [ ] `.gitattributes` var, `git diff` çıktısı temiz ve okunabilir
- [ ] 3.208 satır ölü kod silindi, `npm test` 29/29 geçiyor
- [ ] Duplicate route yok; guard testi bunu koruyor
- [ ] Tek auth middleware var
- [ ] `index.html` < 200 satır, inline `fetch()` sayısı 0 *(veya: nereye kadar gelindiği net raporlandı)*
- [ ] ESLint temiz, CI yeşil
- [ ] `/api/health` DB **ve** Spotify durumunu raporluyor
- [ ] Spotify credential'ı yoksa: açılışta uyarı + uçlarda 503 + frontend'de anlaşılır mesaj
- [ ] §5.2'deki 15 akış tek tek yürütüldü ve raporlandı
- [ ] Güvenlik kontrol listesinin 15 maddesi canlı istekle doğrulandı
- [ ] `NODE_ENV` set değilken in-memory'ye sessiz düşme riski kapatıldı
- [ ] `docs/reports/ASTRA_STABILIZATION_<tarih>.md` yazıldı

---

## 9. BAŞLARKEN

İlk mesajında şunları yap, sonra dur ve onay bekle:

1. Denetim raporlarını oku, özetle
2. `git log --oneline -10` ve `npm test` çalıştır, çıktıyı paylaş
3. `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` iste
4. Fazları ve tahmini süreyi listele
5. Denetim raporlarında **katılmadığın** bir şey varsa şimdi söyle

Sonra FAZ 0'dan başla.
