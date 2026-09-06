---
name: music-archive-denetim
katman: wiki
tarih: 2026-09-05
tags:
  - proje/music-archive
  - alan/agent-tooling
  - alan/second-brain
  - tip/denetim-raporu
durum: aktif
kaynak: "diyar4772/music-archive @ fix/backend-data-auth-hardening (751b56d)"
aliases:
  - Music Archive Denetimi
  - MA Temizlik Planı
---

# Music Archive — Yapısal Denetim ve Agent Altyapısı Yol Haritası

## Güncel durum — 5 Eylül 2026, yapım brifi

Güncel öncelik `MUSIC-ARCHIVE-BRIEF.md` dosyasıdır. Aşağıdaki eski denetim
`751b56d` revizyonunu anlatır; güncel hata listesi olarak kullanılmamalıdır.
Yeni başlangıç `f2a5cf6`: tek ESM frontend, 85 satırlık HTML iskeleti, route
gölgeleme koruması, ESLint ve CI zaten vardır. İlk doğrulamada 41/41 backend
testi ve lint geçti. Web Vanilla JS, mobil Expo/React Native; Flutter yok.

Faz 0'da bulunan güncel kusurlar: bozuk URL escape'inin Router'ı durdurması,
arşiv yükleme hatalarının boş liste olarak gösterilmesi, çıkış işleminin iki
defa çalışması ve kaydedilen albümlerin çıkışta bellekte kalması. Düzeltildi;
URL ayrıştırmasına regresyon testi, arşiv hata ekranına yeniden deneme eklendi.
Kalıcı veritabanı ve tarayıcı kabul sonuçları yeni teslim raporunda tutulacak.

İlk MIDI akışı eklendi: `server/studio.js` kalıcı Recording/Piece modellerini ve
sahiplik denetimli API'yi içeriyor; `js/studio/` bağımsız MIDI motoru, canvas,
IndexedDB kurtarma, standart `.mid` dışa aktarma ve sentetik oynatma sağlıyor.
Ana gezinme Arşivim / Stüdyo / Kayıtlarım / Çalışmalarım oldu; mevcut katalog
ekranları Arşivim alt gezinmesinde korundu. Açılıştaki uydurma arşiv kartı kaldırıldı.

6 Eylül 2026 — Sprint 1 kodu bitti: token dönüşümü, dört durum bileşenleri ve
stüdyo ekranlarının üç dile taşınması tamamlandı (513 anahtar × tr/en/ku).
K1.5 ile görünen her kontrol dilden bağımsız bir `data-testid` aldı
(`docs/specs/TESTIDS.md`, 138 kimlik); tarayıcı testi artık kontrolleri metne
göre değil kimliğe göre buluyor. `npm run audit` on kalemin onunda hedefte.
Sıradaki iş Sprint 2 / K2.1: kayıt düzenleme ve silme.

Faz durumu: Faz 0 doğrulandı; Faz 1 eski ekranların bütün token/durum dönüşümü
nedeniyle kısmi; Faz 2 gerçek donanım kabulü ve örnek tabanlı ses nedeniyle
deneysel; Faz 3'ün ilk MIDI kalıcılık/kurtarma akışı hazır, ses/A–B/metronom
kapsamı bekliyor. Bunlar tamamlanmış fazlar olarak işaretlenmedi. Brifin sonundaki
ilk uçtan uca akış isteği önceliklendirildi; mikrofon ve analiz açılmadı.

Sonraki sıra: gerçek piyano kabul testi → saptanan MIDI kusurları → tasarım
tokenları ve dil kapsamının tamamlanması → Faz 3'ün kalan kayıt araçları →
mikrofon. Ayrıntılı envanter, test kanıtları ve cihaz adımları:
`docs/reports/MIDI_STUDIO_2026-09-05.md`.

## Plan ve spec seti — 6 Eylül 2026

Sonraki tur iki plana bölündü. `docs/plans/CLAUDE-PLAN-2026-09-05.md` tasarım,
sözleşme ve denetim işini; `docs/plans/CODEX-PLAN-2026-09-05.md` uygulamayı
tanımlar. Claude tarafı tamamlandı: `docs/specs/` altında dokuz sözleşme dosyası
var — token dönüşüm tablosu, dört durum matrisi, 287 anahtarlık tr/en/ku
sözlüğü, 12 uç noktalık API sözleşmesi, veri modeli ve indeksler, MIDI ölçüm
formülleri ve eşikleri, ~70 kontrollük buton envanteri, performans ölçüm
yöntemleri ve kapalı kararlar (KR-1…KR-7).

Kod okunarak doğrulanan yeni bulgular: kayıt ve eser **silinemiyor/düzenlenemiyor**
(`server/studio.js` yalnız POST/GET içeriyor); `LibraryView.js:157` mood sütununu
çiziyor ama `js/` içinde mood **yazan tek satır yok**; `Like` şemasında `tags`
alanı yok; arşivde filtre/sıralama yok; tür ve yıl verisi hiç saklanmıyor.

Sprint sırası: Faz 1'i kapat (token, üç dil, dört durum, erişilebilirlik) →
Faz 3'ü kapat (kayıt yönetimi, metronom, A–B, zaman işaretli not) → Faz 6 ilk
dilim (eser detayı, dürüst MIDI ölçümleri, deneme karşılaştırma) → Faz 7 arşiv
yüzeyi (etiket, mood, filtre, istatistik, günlük, yedek). Faz 4, 5 ve 8
bu turda açılmıyor.

Sıra: mevcut akışların doğrulanması → mevcut tasarıma bağlı stüdyo yüzeyi →
deneysel MIDI motoru → ilk kaydet/kurtar/yeniden dinle akışı. Mikrofon, analiz
ve ileri çalışma araçları sonraki işlerdir; donanım kabulü otomatik testle
tamamlanmış sayılmayacak.

---

> [!abstract] Bir cümlede
> Repo'nun **güvenliği iyi durumda** (29/29 test geçiyor), ama **yapısı iki yarım kalmış refactor'ın üstüste yığılmasından** ibaret: iki paralel frontend, boş bir backend iskeleti, birbirini gölgeleyen API route'ları ve diff'in %85'ini yiyen bir satır sonu kaosu. Kod yazmadan önce **silmek** gerekiyor.

---

## 0. Yönetici Özeti

Bu proje senin dediğin gibi "başarısız bir projenin ayağa kaldırılması" — ama teşhis bundan biraz farklı. Kod kötü değil. **Kod fazla.** Aynı işi yapan iki üç katman yan yana duruyor ve hiçbiri diğerini silmemiş.

| Bulgu | Şiddet | Ölçüm |
|---|---|---|
| İki paralel frontend (inline monolit + ESM modüller) | 🔴 Kritik | `index.html` içinde 2.758 satır inline JS + ayrıca `js/` altında 31 canlı modül |
| Express route gölgelemesi — mobil endpoint'ler hiç çalışmıyor | 🔴 Kritik | 3 route ölü: satır 2437, 2786, 2875 |
| `server/` klasörü tamamen boş | 🟠 Yüksek | 7 dosya, 0 byte |
| CRLF/LF karışıklığı diff'i şişiriyor | 🟠 Yüksek | Ham diff 26.432 satır → normalize 7.789 satır |
| Erişilemeyen ölü modüller | 🟡 Orta | 3.208 satır (kod tabanının %11,4'ü) |
| CI / linter / formatter / Docker yok | 🟡 Orta | 0 dosya |
| Backend güvenlik sertleştirmesi | 🟢 İyi | 29/29 test geçiyor, fail-closed |

**Yapılması gereken sıra:** Önce sil → sonra satır sonlarını sabitle → sonra tek frontend seç → sonra agent altyapısı kur. Bu sırayı bozarsan agent'lar temizlenmemiş kaosun üstüne kaos ekler.

---

## 1. Repo Adli Analizi

Repo klonlandı, `fix/backend-data-auth-hardening` branch'i (`751b56d`) üzerinde çalışıldı, bağımlılıklar kuruldu, testler çalıştırıldı. Aşağıdakiler tahmin değil, ölçüm.

### 1.1 🔴 İki paralel frontend aynı sayfada çalışıyor

`index.html` 3.689 satır. İçinde:

- **2.758 satır inline JavaScript** (2 blok halinde)
- 307 satır inline CSS
- Ve en altta: `<script type="module" src="js/app.js">`

Yani sayfa açıldığında **iki ayrı uygulama başlatılıyor**. İnline monolit kendi işini yapıyor, `js/app.js` de kendi Router'ını, Store'unu, View'larını kuruyor.

Daha kötüsü: `index.html` içinde **19 adet doğrudan `fetch()` çağrısı** var. Yani `js/services/api.js` katmanı — auth header'ı, token yenileme, hata yönetimi hepsi orada — **baypas ediliyor**. Aynı API'ye iki farklı yoldan, iki farklı hata davranışıyla gidiliyor.

> [!warning] Bu neden önemli
> Bir agent'a "login akışını düzelt" dediğinde, hangi katmanı düzelteceğini bilemez. İkisini birden düzeltirse iki kat context yakar. Birini düzeltirse hata yaşamaya devam edersin ve nedenini bulamazsın. **Bu, projenin "çok karışık" hissettirmesinin bir numaralı sebebi.**

### 1.2 🔴 Express route gölgelemesi — mobil uygulamanın 3 endpoint'i hiç çalışmıyor

`server.js` içinde aynı path iki kez kaydedilmiş. Express **ilk eşleşeni** çalıştırır, ikincisi ölü koddur:

| Path | 1. kayıt (kazanan) | 2. kayıt (ÖLÜ) |
|---|---|---|
| `GET /api/library/tracks` | satır 1948 → `authenticateToken` | satır 2786 → `mobileAuth` |
| `GET /api/library/artists` | satır 2038 → `authenticateToken` | satır 2875 → `mobileAuth` |
| `DELETE /api/library/track/:param` | satır 2168 → `:trackId` | satır 2437 → `:spotifyId` |

Son satır özellikle sinsi: Express route eşleştirirken **parametre adına bakmaz**. `:trackId` ile `:spotifyId` aynı pattern'dir. Mobil uygulamanın "spotifyId ile sil" endpoint'i asla çağrılmıyor — istek web'in `:trackId` handler'ına düşüyor ve muhtemelen sessizce yanlış davranıyor.

Ayrıca kavramsal olarak çiftlenmiş rotalar var: `POST /api/follow` ↔ `POST /api/library/follow`, `POST /api/like` ↔ `POST /api/library/like`, `GET|POST /api/playlists` ↔ `GET|POST /api/library/playlists`. Toplam 46 route var ama gerçek API yüzeyi ~35.

> [!bug] Kök neden
> İki auth sistemi (`authenticateToken` web için, `mobileAuth` mobil için) ayrı ayrı geliştirilmiş, kimse ikisini birleştirmemiş. Mobil özellikler eklenirken mevcut route'lar kontrol edilmeden yenileri dosyanın altına yazılmış.

### 1.3 🟠 `server/` klasörü tamamen boş

```
server/index.js                          0 byte
server/config/index.js                   0 byte
server/models/index.js                   0 byte
server/middleware/auth.middleware.js     0 byte
server/middleware/rateLimit.middleware.js 0 byte
server/services/itunes.service.js        0 byte
server/services/spotify.service.js       0 byte
```

Birisi (muhtemelen bir AI agent) "server.js'i modülerleştirelim" diye klasör yapısını kurmuş, dosyaları oluşturmuş, **içini hiç doldurmamış**. `package.json` hâlâ `"main": "server.js"` diyor.

Bu klasör repo'da durdukça her agent onu görüp "ah, modüler yapı var" diye yanlış varsayımda bulunacak.

### 1.4 🟠 Satır sonu kaosu — diff'in %85'i gürültü

85 dosya CRLF, 47 dosya LF. `.gitattributes` yok. Sonuç:

```
main → fix/backend-data-auth-hardening

Ham diff:        110 dosya, 26.432 ekleme, 19.115 silme
Normalize edilmiş: 37 dosya,  7.789 ekleme,    472 silme

server.js tek başına:
  Ham:        2.975 ekleme / 2.740 silme   (dosyanın TAMAMI)
  Normalize:    326 ekleme /    91 silme   (gerçek değişiklik)
```

**73 dosyada sıfır anlamlı değişiklik var** ama diff onları tamamen değişmiş gösteriyor.

> [!danger] Bu senin agent maliyetin
> Claude Code'a "bu branch'i review et" dediğinde 26 bin satırlık diff okutuyorsun, gerçek değişiklik 8 bin satır. Ayrıca her agent düzenlemesi dosyanın satır sonlarını flip'leyip yeni sahte diff üretiyor. Bu tek başına en yüksek getirili düzeltme: **bir `.gitattributes` dosyası.**

### 1.5 🟡 Ölü modüller — 3.208 satır

`js/app.js`'ten başlayıp import grafiğini takip ettim (dinamik `import()` dahil). 41 JS dosyasından **31'i canlı, 10'u erişilemez**.

Silinebilir liste:

| Satır | Dosya | Not |
|---:|---|---|
| 637 | `js/core/Store.js` | `js/state/store.js` ile çakışıyor, ikincisi kullanılıyor |
| 262 | `js/components/TrackItem.js` | |
| 243 | `js/components/AlbumModal.js` | |
| 162 | `js/services/dataService.js` | |
| 139 | `js/components/TrackRow.js` | |
| 108 | `js/components/AddArtistForm.js` | |
| 80 | `js/components/StatCards.js` | |
| 64 | `js/components/ArtistCard.js` | |
| 43 | `js/services/spotify.js` | |
| 24 | `js/data/artists.json` | sadece ölü `dataService.js` okuyor |
| 8 | `js/core/index.js` | |
| 967 | `css/components.css` | sadece `index_backup.html` referans veriyor |
| 309 | `css/main.css` | aynı |
| 133 | `index_backup.html` | ölü dosya, ölü zincirin kökü |
| 29 | `manifest.json` | PWA manifest'i hiçbir canlı sayfa çağırmıyor |
| 0×7 | `server/**` | boş iskelet |

**Toplam: 3.208 satır = kod tabanının %11,4'ü.**

> [!note] Yanlış alarm — düzelttim
> `js/adapters/index.js` içindeki `YouTubeAdapter` / `LocalFileAdapter` / `AppleMusicAdapter` importları ilk taramada "kırık import" göründü. **Değiller — yorum satırı halindeler.** Adapters klasörü sağlam.

### 1.6 🟢 İyi haberler — bunlara dokunma

Bu branch'te ciddi iş yapılmış, hakkını vermek lazım:

- **29/29 test geçiyor.** `npm test` çalıştırdım, hepsi yeşil. Rate limit IPv6 güvenliği, CORS 403 davranışı, production fail-fast — hepsi test edilmiş.
- **Sırlar fail-closed.** `JWT_SECRET` `requireSecret()` ile zorunlu; yoksa uygulama açılmıyor.
- **Mock auth çift kilitli:** `NODE_ENV === 'development'` **ve** `ENABLE_MOCK_AUTH === 'true'` gerekiyor.
- **Production'da MongoDB hatası ölümcül** — sessizce in-memory'ye düşmüyor.
- **Git geçmişinde sızmış sır yok.** Tüm geçmişi taradım; bulunanların hepsi placeholder (`your_client_secret_here`, `CHANGE_THIS_TO_...`). `.env` doğru şekilde gitignore'lanmış.
- **Mobil taraf hardcoded host'tan temizlenmiş** — `PROD_API_URL` yoksa build hata veriyor, eski host'a token sızdırmıyor.
- **Mongoose index'leri düşünülmüş** (`refreshToken`, `lastLogin`, `createdAt`).
- `CLAUDE_BACKEND_AUDIT.md` + `docs/reports/` — Claude ve Codex'in birbirini denetlediği kayıt zinciri. Bu değerli, sakla.

> [!tip] Kalan tek gerçek güvenlik riski
> `IS_PRODUCTION = process.env.NODE_ENV === 'production'`. VPS'te `node server.js` dersen ve `NODE_ENV` set değilse, `IS_PRODUCTION` **false** olur → Mongo bağlantısı koparsa sessizce in-memory DB'ye düşer → veri kaybı. Deploy'da `NODE_ENV=production` set etmeyi unutma, ya da mantığı ters çevir (production'ı varsayılan yap).

---

## 2. Temizlik Planı

Sırayla. Her aşama tek bir PR, tek bir commit teması.

### Aşama 0 — Satır sonlarını sabitle (30 dakika, en yüksek getiri)

Kök dizine `.gitattributes`:

```gitattributes
* text=auto eol=lf
*.png binary
*.ttf binary
*.jpg binary
```

Sonra:

```bash
git add --renormalize .
git commit -m "chore: normalize line endings to LF"
```

Bu tek commit devasa görünecek — sorun değil, **bir kereliğine**. Sonrasında bütün diff'lerin anlamlı olur.

### Aşama 1 — Ölü kodu sil (1 saat)

```bash
git rm -r server/                      # boş iskelet
git rm index_backup.html css/ manifest.json
git rm js/core/Store.js js/core/index.js
git rm js/services/dataService.js js/services/spotify.js
git rm js/data/artists.json
git rm js/components/{AddArtistForm,AlbumModal,ArtistCard,StatCards,TrackItem,TrackRow}.js
npm test                               # 29/29 hâlâ geçmeli
```

> [!question] "Ya lazım olursa?"
> Git'te duruyor. `git log --all --diff-filter=D` ile her zaman geri getirebilirsin. Repo'da tutmanın tek etkisi her agent oturumunda context yakmak.

### Aşama 2 — Route gölgelemesini düzelt (2-3 saat)

1. `mobileAuth` ile `authenticateToken`'ı **tek middleware'de birleştir.** İkisinin farkı sadece mock-auth fallback'i; onu bir flag ile yönet.
2. Gölgelenen 3 route'u sil (2437, 2786, 2875).
3. Çiftlenmiş kavramsal route'lara karar ver: `/api/follow` mi `/api/library/follow` mi? Birini seç, diğerini `301`'le ya da sil.
4. Her düzeltme için test yaz — test altyapısı zaten kurulu.

### Aşama 3 — Tek frontend'e karar ver (en büyük iş)

Üç seçenek var, ikisi kötü:

| Seçenek | Değerlendirme |
|---|---|
| **A. `js/` modüler yapıyı seç**, inline JS'i oraya taşı | ✅ **Önerilen.** Mimari zaten var (Router, Store, Component, View'lar). İnline 2.758 satırı parça parça modüllere taşı. Her taşımada `index.html` küçülür. Ölçülebilir ilerleme. |
| B. İnline monoliti seç, `js/`'i sil | ❌ 31 canlı modülü çöpe atarsın, tek dosyada 3.700 satır kalır. Agent'lar için en kötü senaryo. |
| C. İkisini de bırak | ❌ Şu anki durum. |

**Bitiş çizgisi:** `index.html` < 200 satır (sadece HTML iskeleti + `<script type="module" src="js/app.js">`), sıfır inline `fetch()`.

### Aşama 4 — Zemini sabitle

```
.gitattributes      ✅ Aşama 0'da yapıldı
.nvmrc              → 22
.editorconfig       → indent 4, LF
eslint.config.js    → en azından no-unused-vars, no-undef
.github/workflows/ci.yml → npm ci && npm test, her push'ta
```

CI özellikle önemli: agent'ın ürettiği kodun testleri kırıp kırmadığını **sen kontrol etmezsen** kimse etmez.

---

## 3. Hedef Mimari

```
music-archive/
├── AGENTS.md              # tek gerçek kaynak (bkz. §4.4)
├── CLAUDE.md              # → symlink veya "@AGENTS.md" import
├── .gitattributes .editorconfig .nvmrc eslint.config.js
├── .github/workflows/ci.yml
├── server/                # ARTIK GERÇEKTEN DOLU
│   ├── index.js           # app kurulumu, ~80 satır
│   ├── config/            # env, sabitler
│   ├── models/            # mongoose şemaları
│   ├── middleware/        # auth (TEK), rateLimit, error
│   ├── routes/            # auth, library, search, admin, dig
│   └── services/          # spotify, itunes, cache
├── web/
│   ├── index.html         # < 200 satır
│   ├── js/                # mevcut modüler yapı, artık tek yapı
│   └── admin.html         # panel-4772'nin devamı
├── mobile/                # Expo — zaten temiz, dokunma
├── test/
└── docs/reports/          # denetim arşivi
```

> [!note] `server.js` → `server/` göçü nasıl yapılır
> 2.975 satırı tek seferde bölme. Route grubu grubu taşı: önce `admin`, sonra `search`, sonra `library`. Her taşımadan sonra `npm test`. `server.js` küçüldükçe ilerlemeyi görürsün. Bu iş **agent için ideal** — mekanik, test'le doğrulanabilir, geri alınabilir.

---

## 4. Araştırma: Agent & Second Brain Ekosistemi

Sorduğun "Karpathy wiki, Hermes, code agent, skills" seçeneklerini tarayıp gerçekten işine yarayacakları ayıkladım.

### 4.1 Karpathy'nin LLM Wiki paterni

Nisan 2026'da Karpathy X'te bir gist paylaştı ve konu patladı. Temel fikir:

> RAG her soruda bilgiyi sıfırdan keşfeder. Wiki bilgiyi **derler ve biriktirir.** Retrieve etme — compile et.

**Üç katman:** `raw/` (ham kaynaklar, değişmez) → `wiki/` (LLM'in yazdığı sayfalar) → `CLAUDE.md` (şema/kurallar).
**Üç operasyon:** `ingest` (yeni kaynak işle, 10-15 wiki sayfasına dokun), `query` (cevapla, cevabı yeni sayfa olarak dosyala), `lint` (haftalık sağlık kontrolü — öksüz sayfa, çelişki, kırık link).

Karpathy'nin derleyici analojisi: `raw/` = kaynak kod, LLM = derleyici, `wiki/` = binary.

**Senin için anlamı:** Bu senin [[obsidian-archive|The Archive]] notunda zaten keşfettiğin patern. Ama şunu netleştirmek lazım — **LLM Wiki, Albert'in RAG'ini değiştirmez, tamamlar.** 59K chunk'lık Qdrant koleksiyonun geniş arama için doğru araç. LLM Wiki ise "bu beş dokümanı sentezleyen ince soru" için doğru araç. İkisi farklı iş yapıyor.

Ekosistem (Karpathy'nin gist'i patern, ürün değil — implementasyonlar topluluktan geldi):

- **`karpathy-llm-wiki`** (Astro-Han) — Agent Skills formatında kurulabilir skill. Claude Code, Codex, Cursor'da çalışıyor. **Başlamak için en düşük sürtünmeli seçenek.**
- **`llm-knowledge-bases`** (rvk7895) — Claude Code plugin'i, doğrudan Obsidian wiki'si üretiyor.
- **`llm_wiki`** (nashsu) — masaüstü uygulaması, üç sütunlu arayüz. Patern'i ürünleştirmiş.
- **`llm-atomic-wiki`** (cablate) — atom katmanı, topic-branch'ler, iki katmanlı lint ekliyor. Ölçekte ne kırılıyor onu anlatıyor.
- **LLM Wiki v2** (rohitg00 gist) — production'da ne bozulduğunu anlatan blueprint: confidence scoring, supersession, retention decay. **"Wiki'nin çöp çekmecesine dönmesini" engelleyen katman.** Senin 1.243 dosyalık vault'un için bu ek katman en kritik olanı.

### 4.2 Hermes Agent (Nous Research)

Sorduğun "hermes" bu. Şubat 2026'da Nous Research'ün açık kaynak (MIT) yayınladığı **kendi kendini geliştiren** agent.

**Ayırt edici özelliği — kapalı öğrenme döngüsü:**

```
görev çalıştır → karmaşıksa otomatik SKILL.md üret → hafızayı güncelle → sonraki görev
```

Aynı işi ikinci kez istediğinde "bunu daha önce yapmıştım" deyip cilalanmış skill dosyasını kullanıyor. v0.12+'da **Curator** var: 7 günlük cron döngüsünde kendi skill kütüphanesini not veriyor, birleştiriyor, budayor.

**Teknik:**
- CLI + TUI, 18-23 mesajlaşma platformu (Telegram, Discord, Slack, WhatsApp, Signal)
- 7 terminal backend (local, Docker, SSH, Modal, Daytona, Vercel Sandbox)
- Model bağımsız — `hermes model` ile OpenRouter, OpenAI, kendi endpoint'in
- Yerleşik cron scheduler
- MCP entegrasyonu (hem client hem server)
- Profiller — izole çoklu instance
- **agentskills.io açık standardıyla uyumlu** (Claude Code skill'leri ile aynı format)
- $5'lık VPS'te çalışıyor

**Obsidian ile ilişkisi** — bunu güzel özetleyen bir çerçeve var: *Obsidian insanın okuduğu ve düzenlediği statik katman; Hermes o bilgiyi okuyup otomatik çalıştıran, güncelleyen ve öğrenen dinamik katman.* İkisi rakip değil, tamamlayıcı.

**`open-second-brain`** (itechmeat) — Hermes için Obsidian vault'unda yaşayan yerel hafıza. Gece "dream pass"leriyle tekrarlanan düzeltmeleri ölçülebilir güvenle onaylanmış tercihlere çeviriyor. Claude Code, Codex ve OpenClaw adaptörleri + genel MCP server'ı var.

> [!warning] Star sayılarına güvenme
> Bu ekosistemin star sayıları kaynaklar arasında tutarsız: Hermes için "16.8k", "134k+", "215k+" gibi rakamlar dolaşıyor; Graphify için "69K" ve "89,330". Bu tutarsızlık başlı başına bir sinyal. Star ilgiyi ölçer, production hazırlığını değil. **Karar verirken repo'ya bak, listeye değil.**

### 4.3 Kod knowledge graph'ları — repo'yu taratmak için

"Tüm repo'yu tarayıp gereksizleri silecek sistem" istedin. Bu kategori tam olarak o.

Sorun net: bir agent'a "bu fonksiyonu değiştirsem ne kırılır?" dediğinde 40 dosya grep'liyor, 12'sini tam okuyor, göremediği dinamik dispatch'i tahmin ediyor, 80 bin token yakıp bir junior'dan kötü cevap veriyor.

| Araç | Yaklaşım | Not |
|---|---|---|
| **Graphify** | Her şeyi indeksle — kod, dokümanlar, PDF, SQL şemaları. Leiden clustering. 25+ AI asistan entegrasyonu. | Çok formatlı korpus tek graf'ta. YC S26. |
| **GitNexus** | Etki analizini önceden hesapla. Tarayıcıda, sunucusuz. MCP ile açıyor. `gitnexus analyze --skills` ile **repo'nun fonksiyonel alanlarını tespit edip her biri için `.claude/skills/` altına skill üretiyor.** | ⚠️ **PolyForm Noncommercial lisansı** — ticari repo'da kullanamazsın. Freelance işlerinde bu bir engel. |
| **CodeGraph** | Tek dosya, minimal. | En düşük kurulum maliyeti. |
| **graphify-go** | Go portu, agent-first, insan arayüzü yok. `query/explain/path/affected/update` primitifleri. | MIT. |
| **DeepWiki** (Cognition) | Public repo'lardan wiki üretiyor. Bulut, kapalı kaynak. | Özel repo'lar için uygun değil. |
| **`llms.txt`** | Standart değil, sadece kök dizine iyi yapılandırılmış bir markdown. | **LLM wiki paterninin en hafif hali.** Music Archive için muhtemelen yeterli. |

> [!important] Music Archive özelinde dürüst değerlendirme
> Music Archive **144 dosya**. Knowledge graph araçları 50+ dosyalı repo'larda kazanç sağlıyor ama asıl farkı binlerce dosyada yaratıyor. Senin durumunda graf kurmak **temizlikten sonra** mantıklı — şu an graf kurarsan ölü kodu da indeksler ve agent'a "burada iki frontend var" diye yanlış bilgi verir.
>
> **Sıra: temizle → sonra indeksle.** GitNexus'un `--skills` özelliği Aşama 3 bittikten sonra gerçekten değerli olur.

### 4.4 AGENTS.md / CLAUDE.md / SKILL.md — hangisi ne yapar

| Dosya | Ne zaman yüklenir | Ne için |
|---|---|---|
| `AGENTS.md` | Her oturumda, tam | Araç-bağımsız standart. Codex, Cursor, Copilot, Windsurf okuyor. |
| `CLAUDE.md` | Her oturumda, tam | Claude Code'a özel. **Claude Code AGENTS.md'yi native okumuyor** — `ln -s AGENTS.md CLAUDE.md` veya içine `@AGENTS.md` import et. |
| `SKILL.md` | **Koşullu** — sadece görev description'a uyunca | Asıl güç burada. Progressive disclosure: oturum başında sadece isim+description okunur, gerisi tetiklenince yüklenir. |

**Önerilen kurulum:** `AGENTS.md` tek gerçek kaynak, `CLAUDE.md` onu import eden ince katman.

> [!danger] Bunu bilmen lazım — sayısal kanıt
> Şubat 2026'da ETH Zürich (Gloaguen ve ark.) bu context dosyalarının işe yarayıp yaramadığını ölçen ilk ciddi çalışmayı yayınladı. Sonuçlar rahatsız edici:
> - **LLM'in ürettiği** AGENTS.md dosyaları başarı oranını **~%3 düşürdü** (hiç dosya olmamasına kıyasla)
> - **İnsanın yazdığı** dosyalar başarıyı sadece **~%4 artırdı**
> - Her iki durumda da inference maliyeti **%20+ arttı**
>
> Kök neden: detaylı kod tabanı özetleri zaten repo'da olan bilgiyi tekrarlıyor. Agent kodu zaten okuyor; kodun söylediğini tekrar etmek context yakıyor ve gürültü ekliyor.
>
> **Pratik kural:** `/init` ile üretilen dosyayı olduğu gibi bırakma. Acımasızca buda. İçinde sadece **agent'ın koddan çıkaramayacağı** şeyler kalsın. `tsconfig.json` zaten TypeScript kullandığını söylüyor — onu yazma. Linter kuralları deterministik olarak zorlanıyor — onları yazma.

Music Archive'ın `AGENTS.md`'sinde olması gereken, koddan çıkarılamayacak şeyler:

```markdown
- server.js parçalanıyor. Yeni route ekleme — mevcut olanı taşı.
- Aynı path iki kez kaydedilmemeli. Ekleme yapmadan önce:
  grep -n "app\.\(get\|post\)('/api/..." server.js
- index.html'e inline JS ekleme. Yeni kod js/ altına modül olarak.
- Satır sonu LF. .gitattributes'a dokunma.
- Her değişiklikten sonra: npm test (29 test geçmeli)
- panel-4772.html adı kasıtlı. Değiştirme.
```

### 4.5 Obsidian ↔ Claude Code bağlantısı

Zaten 1.243 dosyalık vault'un var. Bağlama yolları, sürtünme sırasına göre:

1. **Symlink** — `ln -s ~/vault/Projeler/music-archive ./docs`. Tek komut, sıfır bağımlılık. **Başlangıç için bu.**
2. **MCP bridge** — `obsidian-claude-code-mcp` (iansinnott, Obsidian plugin'i, WebSocket+HTTP/SSE, otomatik keşif) veya `mcp-obsidian` (Calclavia). Vault'a yazma/arama/backlink takibi verir. Not: Obsidian'ın **resmi** MCP paketi yok, hepsi topluluk yapımı — seçtiğin repo'yu kaynak doğrusu kabul et.
3. **Obsidian eklentileri** — Smart Connections, Copilot.

> [!tip] Vault hijyeni — bunu ihlal etme
> Topluluğun en çok tekrarladığı kural: **vault'un senin otantik düşüncelerini içermeli. Claude okusun ama üretilmiş içerikle kirletmesin.** Claude'un çıktıları (planlar, hafıza) `~/.claude/` altında; bilgi vault'ta.
>
> Bir başka faydalı çerçeve: **wiki'nin iki yazarı olmalı.** İnsan düşüncesi korunmalı, agent'ın bakımını yaptığı bilgi taze kalmalı. Agent her şeyi yazarsa wiki jenerik prozaya kayar; her şeyi sen yaparsan çürür.
>
> Senin [[obsidian-archive]] notundaki `Wiki/` alt klasörü + `katman: wiki` frontmatter kararı tam olarak bu ayrımı uyguluyor. Doğru karar vermişsin — devam et.

---

## 5. Sana Özel Öneri

Sorduğun soru "hangi seçeneklere bakmalıyım" idi. Dürüst cevap: **çoğuna bakmamalısın, henüz.**

### Ne almalı, ne almamalı

| Araç | Karar | Gerekçe |
|---|---|---|
| `.gitattributes` + CI | ✅ **Hemen** | Sıfır maliyet, en yüksek getiri. Diff'lerinin %85'ini geri kazanıyorsun. |
| Karpathy LLM Wiki (skill olarak) | ✅ **Hemen** | Vault'unda zaten keşfettiğin patern. `karpathy-llm-wiki` skill'i ile 10 dakikada kurulur. |
| Obsidian symlink | ✅ **Hemen** | Bir komut. MCP'ye sonra geçersin. |
| `AGENTS.md` (elle yazılmış, kısa) | ✅ **Aşama 1'den sonra** | Ama `/init` çıktısını olduğu gibi bırakma — ETH bulgusu. |
| LLM Wiki v2 katmanları (confidence, supersession) | 🟡 **3 ay sonra** | 1.243 dosyada wiki çürümesi gerçek bir risk. Ama önce temel wiki çalışsın. |
| Hermes Agent | 🟡 **Bekle** | Güçlü ama ayrı bir öğrenme yükü. Ayrıca kendi kendine skill üreten bir agent'ı **kirli bir repo'ya salmak** kötü skill'ler üretir. Temizlikten sonra. |
| GitNexus / Graphify | 🟡 **Aşama 3'ten sonra** | 144 dosyada marjinal kazanç. Ölü kod indekslenirse zararlı. GitNexus'un lisansı freelance için sorun. |
| OpenClaw, Graphify+Obsidian combo'ları | ❌ **Atla** | Şu an ihtiyacın olmayan karmaşıklık. |

### Neden Hermes'i şimdi önermiyorum

Hermes'in değer önerisi **tekrarlayan işi otomatik skill'e çevirmek**. Bunun işe yaraması için tekrarlayan, tanımlı bir iş akışın olması gerekiyor. Şu an Music Archive'da yaptığın iş tekrarlayan değil — **keşif ve temizlik**. Bu tek seferlik iş.

Hermes'i şu an kurarsan: kirli repo üzerinde çalışırken ürettiği skill'ler kirli varsayımları kodlar ("index.html'de inline JS düzenleme prosedürü" gibi bir skill üretebilir), sonra Curator onları 7 günlük döngüde cilalayıp kalıcılaştırır. **Yanlış bilgiyi kurumsallaştırırsın.**

Doğru sıra: temizle → stabil yapı → sonra tekrarlayan işi otomatikleştir.

### Bu proje aslında ne için iyi

Kendin söyledin: "terminal kullanımı ve AI coding araçlarını deneyimlemek için." O zaman bu repo'yu **ürün olarak değil, laboratuvar olarak** kullan. Ve bu haliyle mükemmel bir laboratuvar, çünkü içinde her gerçek dünya problemi var:

- Yarım kalmış refactor (`server/`)
- Sessiz runtime bug'ı (route gölgelemesi)
- Araç kaynaklı gürültü (CRLF)
- Ölü kod
- Test var ama kapsama dengesiz

Bunları temizlemek, sıfırdan temiz proje yazmaktan **çok daha öğretici** — çünkü freelance'te sana gelecek işler tam olarak böyle görünecek. [[freelance-strategy]] açısından: "legacy Node/Express kod tabanını denetleyip stabilize ettim, ölçülebilir sonuçlarla" cümlesi, "müzik arşivi uygulaması yaptım"dan çok daha satılabilir.

---

## 6. Yol Haritası

```
HAFTA 1 — Zemin
  □ .gitattributes + git add --renormalize
  □ Ölü kodu sil (3.208 satır)
  □ .nvmrc, .editorconfig, eslint config
  □ .github/workflows/ci.yml
  → Çıktı: her diff okunabilir, CI yeşil

HAFTA 2 — Backend
  □ mobileAuth + authenticateToken birleştir
  □ Gölgelenen 3 route'u sil
  □ Çiftlenmiş route'lara karar ver
  □ Her düzeltmeye test
  → Çıktı: 46 route → ~35, tek auth yolu

HAFTA 3-4 — Frontend
  □ index.html inline JS'i js/ modüllerine taşı (parça parça)
  □ 19 inline fetch() → js/services/api.js
  □ index.html < 200 satır
  → Çıktı: tek frontend

HAFTA 5 — server.js parçalama
  □ server/ klasörünü GERÇEKTEN doldur
  □ Route grubu grubu taşı, her seferinde npm test
  → Çıktı: 2.975 satırlık monolit gitti

HAFTA 6 — Agent altyapısı (ARTIK ANLAMLI)
  □ AGENTS.md yaz (kısa, koddan çıkarılamayanlar)
  □ Karpathy LLM Wiki skill'ini vault'a kur
  □ Obsidian symlink
  □ İsteğe bağlı: knowledge graph indeksi
  → Çıktı: temiz repo + çalışan agent altyapısı
```

**Her aşamanın ölçülebilir bir bitiş şartı var.** "Daha iyi hissettiriyor" bitiş şartı değil. Satır sayısı, route sayısı, test sayısı — bunlar bitiş şartı.

---

## Kaynaklar

**LLM Wiki paterni**
- Karpathy'nin orijinal gist'i (`llm-wiki.md`) — patern belgesi, ürün değil
- https://github.com/Astro-Han/karpathy-llm-wiki — kurulabilir Agent Skill
- https://github.com/rvk7895/llm-knowledge-bases — Claude Code plugin, Obsidian çıktılı
- https://github.com/nashsu/llm_wiki — masaüstü implementasyon
- https://github.com/cablate/llm-atomic-wiki — atom katmanı, topic branch, iki katmanlı lint
- https://gist.github.com/rohitg00/2067ab416f7bbe447c1977edaaa681e2 — LLM Wiki v2, production dersleri
- https://blog.starmorph.com/blog/karpathy-llm-wiki-knowledge-base-guide — Claude Code + Obsidian kurulum rehberi

**Hermes Agent**
- https://github.com/nousresearch/hermes-agent — resmi repo (MIT)
- https://github.com/0xNyk/awesome-hermes-agent — ekosistem dizini
- https://github.com/itechmeat/open-second-brain — Obsidian tabanlı yerel hafıza
- https://okikusan-public.dev/hermes-agent-second-brain-engine.en — Obsidian statik / Hermes dinamik çerçevesi
- https://dannyshmueli.com/2026/05/18/Hermes-Console-turns-Obsidian-into-my-agent-workspace/ — "wiki'nin iki yazarı" fikri

**Kod knowledge graph'ları**
- https://shirokoff.ca/blog/code-knowledge-graphs-graphify-codegraph-gitnexus — üç aracın karşılaştırması + lisans uyarısı
- https://antaoalmada.dev/posts/Code-Agent-Knowledge-Graphs/ — hangi senaryoda hangisi
- https://github.com/abhigyanpatwari/GitNexus — repo-specific skill üretimi
- https://pkg.go.dev/github.com/dobbo-ca/graphify-go — agent-first Go portu

**Context dosyaları**
- https://www.morphllm.com/agents-md-guide — AGENTS.md spec 2026
- https://www.termdock.com/blog/skill-md-vs-claude-md-vs-agents-md — ETH Zürich çalışması detayları
- https://thepromptshelf.dev/blog/agents-md-vs-claude-md/ — symlink/import kurulumu

**Obsidian entegrasyonu**
- https://github.com/iansinnott/obsidian-claude-code-mcp
- https://blog.starmorph.com/blog/obsidian-claude-code-integration-guide — 5 strateji, sürtünmeye göre sıralı

---

> [!success] Bir sonraki adım
> `.gitattributes` dosyasını yaz ve `git add --renormalize .` çalıştır. 30 dakika. Sonrasında her şey daha kolay.

İlgili: [[obsidian-archive]] · [[albert]] · [[freelance-strategy]] · [[music-archive]]
