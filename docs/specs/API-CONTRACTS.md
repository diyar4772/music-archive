# C4 — API Sözleşmeleri

> **Uygulayan:** Codex, Sprint 2–4 · **Veri modeli:** `docs/specs/DATA-MODEL.md`
> Bu dosyada olmayan bir uç nokta yazılmaz. Bir alan gerekliyse önce buraya eklenir.

---

## 0. Mevcut sözleşmeler — uyulacak desenler

Kod okunarak çıkarıldı, uydurulmadı:

| Konu | Stüdyo uçları (`server/studio.js`) | Eski arşiv uçları (`server.js`) |
|---|---|---|
| Başarı gövdesi | `{ recording }`, `{ pieces }` — bayrak yok | `{ success: true, ... }` |
| Hata gövdesi | `{ error: "Türkçe cümle" }` | `{ success: false, error: "..." }` |
| Kimlik | `clientId` (istemci ürettiği UUID v4) | Mongo `_id` veya `trackId` |
| Yetki | `guard` = `authenticateToken` + kullanıcı var mı + `canPersist()` | `authenticateToken` |
| Kalıcılık yoksa | **503** | değişir |

**Karar:** Yeni stüdyo uçları `server/studio.js` desenini izler.
Yeni arşiv uçları `server.js` desenini izler. **İki deseni birleştirmek bu turun
işi değil** — çalışan bir şeyi "daha temiz olur" diye yeniden yazmak yasak.

---

## 1. ⚠️ Hata mesajları ve i18n — yeni kural

Bugün sunucu hata mesajlarını **sabit Türkçe** döndürüyor
(`'Kayıt bulunamadı.'`), istemci de bunları doğrudan ekrana basıyor. Kürtçe
arayüzde Türkçe hata çıkıyor. Bu, K1.2'nin kabulünü kırar.

**Yeni sözleşme — her hata gövdesi:**

```json
{ "error": "Kayıt bulunamadı.", "code": "recording_not_found" }
```

- `code` **makine okunur**, değişmez, snake_case.
- `error` insan okunur yedek — istemci `code` için bir çeviri bulamazsa bunu gösterir.
- İstemci `code` → `t('errors.' + code)` eşlemesi yapar.
- **Mevcut uçların `error` metinleri değişmez**; yalnız yanlarına `code` eklenir.
  Böylece hiçbir eski davranış kırılmaz.

**Kod listesi** (`errors.*` ad alanı, üç dilde çevrilecek):
`recording_not_found · piece_not_found · catalog_track_not_found · session_missing ·
db_unavailable · invalid_recording · invalid_payload · duplicate_content ·
piece_has_recordings · limit_exceeded · payload_too_large · import_invalid · rate_limited`

---

## 2. Ortak kurallar

1. **Sahiplik:** her sorgu `{ userId: req.user.id }` ile filtrelenir. Başkasının
   kaynağına erişim **404** — 403 değil. 403 kaynağın var olduğunu sızdırır.
2. **İstemciden asla kabul edilmeyenler:** `userId`, `createdAt`, `updatedAt`,
   `contentHash`, kalıcılık durumu, dosya yolu, `events` (güncellemede).
3. **`Cache-Control: no-store`** kişisel veri döndüren her uçta.
4. **Gövde boyutu:** varsayılan Express sınırı korunur; `POST /api/library/import`
   için ayrı ve **daha yüksek** sınır tanımlanır (§9).
5. **Hız sınırı:** yeni yazma uçları `userLimiter` altına girer. `import` kendi
   dar limitine sahiptir (§9).
6. **Kısmi güncelleme:** `PATCH` gövdesinde **yalnız gönderilen alanlar** değişir.
   Gönderilmeyen alan silinmez. `null` göndermek "temizle" demektir ve yalnız
   `pieceId`, `mood` için geçerlidir.

---

## 3. `PATCH /api/recordings/:id` — kayıt üstverisini düzenle

**Yetki:** `guard`. **Ticket:** K2.1

**İstek**
```json
{ "title": "Chopin Op.9 No.2 — 3. deneme",
  "description": "Sol el pedalsız",
  "tags": ["chopin", "yavaş"],
  "pieceId": "9f3c…-uuid" }
```

| Alan | Kural |
|---|---|
| `title` | zorunlu değil; verilirse 1–120 karakter, boş olamaz |
| `description` | ≤ 2000 karakter; `""` geçerli (temizler) |
| `tags` | dizi, ≤ 12 öğe, her biri 1–40 karakter, tekilleştirilir |
| `pieceId` | UUID v4 veya `null`. Verilirse eser **bu kullanıcıya ait** olmalı, yoksa 404 `piece_not_found` |
| **`events`** | **gönderilirse 400 `invalid_payload`.** MIDI içeriği düzenlenemez. |
| `durationMs`, `input`, `source`, `instrument`, `id` | aynı — gönderilirse 400 |

**Yanıt 200:** `{ "recording": { …olaylar hariç özet… } }`

**Hatalar:** 400 `invalid_payload` · 401 `session_missing` · 404 `recording_not_found`
· 404 `piece_not_found` · 503 `db_unavailable`

**Not:** `pieceId` değişince `takeGroupId` de aynı değere çekilir — bugün kayıt
oluşturulurken böyle davranıyor (`StudioView.start()`), tutarlılık korunur.

---

## 4. `DELETE /api/recordings/:id`

**Yetki:** `guard`. **Ticket:** K2.1

**Yanıt 200:** `{ "deleted": true }`
**Hatalar:** 401 · 404 `recording_not_found` · 503

**Kurallar:**
- Kalıcı silme. Çöp kutusu **yok** — arayüz onay adımıyla ve "önce .mid indirin"
  uyarısıyla koruyor (bkz. `docs/specs/CONTROLS.md`).
- Silinen kaydın zaman işaretli notları da silinir (aynı belgenin içinde).
- Silme, IndexedDB'deki yerel taslağı **etkilemez** — o ayrı bir eylemdir.
- Aynı `id` ikinci kez silinirse 404. İdempotent 200 dönmez: kullanıcıya
  "zaten yoktu" demek, yanlış kaydı sildiğini fark etmesini engeller.

---

## 5. `GET /api/recordings` — filtreleme genişletmesi

**Ticket:** K2.5. Mevcut `offset` ve `pieceId` korunur, üzerine eklenir.

| Parametre | Kural | Davranış |
|---|---|---|
| `offset` | 0 – 100000 tamsayı (mevcut) | sayfalama |
| `pieceId` | UUID v4 (mevcut) | esere göre |
| `tag` | 1–40 karakter | etikete göre; tam eşleşme, küçük harf |
| `q` | ≤ 80 karakter | `title` ve `description` içinde arama |
| `sort` | `newest` \| `oldest` \| `longest` \| `title` | varsayılan `newest` |

**`q` uygulaması:** düzenli ifade değil. `q` kullanıcıdan gelir; ham regex'e
çevrilmesi **ReDoS** açar. İki seçenek:
1. `title` üzerinde Mongo **text index** (tercih edilen), veya
2. `escapeRegExp(q)` ile kaçışlanmış `$regex` + `$options: 'i'`.

Codex (1)'i seçer; performansı yetmezse (2)'ye düşer ve **hangisini neden
seçtiğini rapora yazar**. Kaçışlanmamış regex kabul edilmez.

**Yanıt:** mevcut şekil korunur — `{ recordings: [...], hasMore: bool }`.
Sayfa boyutu 50 kalır.

---

## 6. Zaman işaretli notlar

**Ticket:** K2.4. Notlar `Recording` belgesinin içinde gömülü dizidir
(ayrı koleksiyon değil — her zaman kaydıyla birlikte okunur, ayrı sorgu israfı).

### `POST /api/recordings/:id/notes`
```json
{ "atMs": 45120, "text": "burada tempo düştü" }
```
| Alan | Kural |
|---|---|
| `atMs` | tamsayı, `0 ≤ atMs ≤ recording.durationMs` |
| `text` | 1–500 karakter |

Kayıt başına **en fazla 200 not**; aşılırsa 400 `limit_exceeded`.
**Yanıt 201:** `{ "note": { "id": "uuid", "atMs": 45120, "text": "…", "createdAt": "…" } }`
`id` **sunucuda** üretilir (`crypto.randomUUID()`), istemciden alınmaz.

### `DELETE /api/recordings/:id/notes/:noteId`
**Yanıt 200:** `{ "deleted": true }` · **404** `recording_not_found` (not veya kayıt yoksa — ikisi ayrılmaz)

Notlar `atMs` sırasına göre saklanır ve öyle döndürülür.

---

## 7. Eser (Piece) uçları

**Ticket:** K3.2 · **Karar:** KR-2 (varsayılan arşivleme)

### `GET /api/pieces` — genişletme
Yeni parametre: `includeArchived` (`"1"` ise arşivlenenler de gelir).
Varsayılan: arşivlenenler **gelmez**. Yanıt öğelerine `archived: bool` ve
`recordingCount: number` eklenir (`$lookup` yerine tek bir toplu sayım sorgusuyla).

### `GET /api/pieces/:id`
**Yanıt 200:**
```json
{ "piece": { "id":"…", "title":"…", "composer":"…", "notes":"…",
             "catalogTrackId": null, "archived": false,
             "recordingCount": 7, "createdAt":"…", "updatedAt":"…" } }
```
**404** `piece_not_found`

### `PATCH /api/pieces/:id`
| Alan | Kural |
|---|---|
| `title` | 1–120 karakter |
| `composer` | ≤ 120 |
| `notes` | ≤ 2000 |
| `catalogTrackId` | ≤ 120 veya `null`; verilirse kullanıcının `Like` kaydında olmalı → yoksa 404 `catalog_track_not_found` |
| `archived` | `true` / `false` |

**Not:** Mevcut `POST /api/pieces` `$setOnInsert` kullanıyor, yani **var olan
eseri güncellemiyor** — sessizce eskisini döndürüyor. Bu davranış korunur
(oluşturma idempotent kalsın); güncelleme artık `PATCH` ile yapılır.

### `DELETE /api/pieces/:id`
- Bağlı kayıt varsa → **409** `piece_has_recordings`, gövdede
  `{ "error": "…", "code": "piece_has_recordings", "recordingCount": 7 }`.
  İstemci bu sayıyı `pieces.deleteBlocked` metnine yerleştirir.
- Bağlı kayıt yoksa → 200 `{ "deleted": true }`.

---

## 8. Arşiv uçları

### 8.1 `PUT /api/library/track/:trackId/tags` — K4.1
```json
{ "tags": ["plak", "konserde-izledim"] }
```
| Kural | Değer |
|---|---|
| Etiket sayısı | ≤ 20 |
| Etiket uzunluğu | 1–40 karakter |
| Normalizasyon | `trim()`, `toLocaleLowerCase('tr')`, tekilleştirme |
| İzinli karakterler | harf, rakam, boşluk, `-`, `_`. Diğerleri → 400 `invalid_payload` |

Tam değiştirme (`PUT`) — istemci güncel listeyi gönderir.
**Yanıt:** `{ success: true, tags: [...] }` · **404** şarkı bu kullanıcının
beğenilerinde değilse.

**`toLocaleLowerCase('tr')` uyarısı:** Türkçe'de `I` → `ı`, `İ` → `i`.
"Indie" ve "indie" aynı etiket olur, bu istenen davranış. Ama normalizasyon
**sunucuda** yapılır, istemcide değil — iki taraf farklı yaparsa mükerrer etiket doğar.

### 8.2 `PUT /api/library/track/:trackId/mood` — K4.2
```json
{ "mood": "melancholic" }
```
Kapalı liste (KR-3): `energetic · melancholic · calm · intense · joyful · dark ·
nostalgic · focus`, veya `null` (temizle). Liste dışı → 400 `invalid_payload`.

**Depolanan değer İngilizce anahtardır**, görünen ad istemcide `t('mood.'+key)`.
Bugün `likeSchema.mood` serbest `String` — göç için bkz. `DATA-MODEL.md` §4.

**Yanıt:** `{ success: true, mood: "melancholic" }`

### 8.3 `GET /api/library/tracks` — filtre genişletmesi — K4.4
Mevcut sayfalama korunur, eklenenler:

| Parametre | Kural |
|---|---|
| `tag` | 1–40 karakter, normalize edilmiş |
| `mood` | kapalı listeden biri, veya `none` (mood'u olmayanlar) |
| `minRating` | 0.5–5, 0.5 adım |
| `from`, `to` | ISO 8601 tarih; `createdAt` aralığı |
| `sort` | `added` \| `rating` \| `artist` \| `title`; `-` öneki ters sıra |

`minRating` **`Rating` koleksiyonunda**, diğerleri `Like`'ta. Birlikte
kullanıldıklarında `$lookup` yerine iki adımlı sorgu: önce `Rating`'ten eşleşen
`itemId` kümesi, sonra `Like` sorgusuna `$in`. Küme 10.000'i aşarsa
`minRating` filtresi uygulanamaz → 400 `limit_exceeded` yerine **filtreyi
yoksaymaz**, kullanıcıya sınırı bildirir. (Gerçekçi arşiv boyutunda bu olmaz;
sessizce yanlış sonuç dönmemesi için yazıldı.)

### 8.4 `GET /api/library/stats` — genişletme — K4.5
Mevcut 7 sayaç **korunur**, üzerine eklenir:

```json
{ "success": true, "stats": {
    "...mevcut alanlar...",
    "ratingDistribution": { "0.5": 2, "1": 0, "...": 0, "5": 31 },
    "addedByMonth": [ { "month": "2026-08", "count": 47 } ],
    "topArtists": [ { "artistName": "…", "count": 28 } ],
    "moodDistribution": { "melancholic": 40, "none": 12 },
    "tagDistribution": [ { "tag": "plak", "count": 18 } ],
    "studio": { "recordings": 24, "totalDurationMs": 5400000, "piecesWorked": 6 }
} }
```

**Sınırlar:** `topArtists` ve `tagDistribution` en fazla 20 öğe.
`addedByMonth` en fazla 60 ay.
**Tür ve yıl alanı YOKTUR** ve uydurulmaz — `Like` şemasında böyle bir veri
saklanmıyor. Arayüz bu bölümde `stats.genreUnavailable` metnini gösterir.

### 8.5 `GET /api/library/diary` — K4.6
| Parametre | Kural |
|---|---|
| `from`, `to` | ISO 8601; aralık ≤ 366 gün, yoksa 400 `invalid_payload` |

**Yanıt:**
```json
{ "success": true, "events": [
  { "at":"2026-09-04T21:12:00Z", "type":"liked",   "trackId":"…", "title":"…", "artistName":"…", "image":"…" },
  { "at":"2026-09-04T21:15:00Z", "type":"rated",   "trackId":"…", "title":"…", "rating":4.5 },
  { "at":"2026-09-04T22:03:00Z", "type":"recorded","recordingId":"…", "title":"…", "durationMs":184000 }
] }
```
`type`: `liked` · `rated` · `noted` · `recorded`. Zaman sırasına göre azalan.
Sayfa başına en fazla 500 olay; aşarsa `hasMore: true`.

**Uydurma yok:** günlük özeti cümlesi, mood tahmini, haftalık yorum **üretilmez**.
Bunlar olay listesidir; yorumu kullanıcı yapar.

---

## 9. Yedekleme — K4.7

### `GET /api/library/export`
**Yanıt 200**, `Content-Type: application/json`, `Content-Disposition: attachment`.
```json
{ "format": "music-archive-backup", "version": 1,
  "exportedAt": "2026-09-05T…",
  "likes": [...], "ratings": [...], "playlists": [...],
  "pieces": [...], "recordings": [...] }
```
- `recordings` **MIDI olaylarını içerir** — yedek kayıp veriye karşıdır, özet değil.
- `userId`, `_id` gibi iç kimlikler **çıkarılır**; ilişkiler `clientId`/`trackId` üzerinden kurulur.
- Kayıt sayısı çok yüksekse (>500 kayıt veya >50 MB) yanıt akış (stream) olarak
  yazılır, belleğe toplanmaz.

### `POST /api/library/import`
**Gövde sınırı:** 64 MB (bu uca özel; genel sınır değişmez).
**Hız sınırı:** saatte 5 istek.

**Çakışma politikası — "ekle, ezme":**

| Tür | Anahtar | Zaten varsa |
|---|---|---|
| `likes` | `trackId` | atlanır |
| `ratings` | `itemId`+`itemType` | atlanır |
| `pieces` | `clientId` | atlanır |
| `recordings` | `clientId` | atlanır |
| `playlists` | ad | ad sonuna ` (2)` eklenerek yeni liste |

**Yanıt 200:**
```json
{ "success": true, "added": { "likes": 120, "recordings": 4 },
  "skipped": { "likes": 6, "recordings": 1 },
  "rejected": [ { "type": "recording", "clientId": "…", "code": "invalid_recording" } ] }
```

**Kurallar:**
- Her kayıt **tek tek** `validateRecording()`'den geçer. Tek bozuk kayıt tüm
  içe aktarmayı düşürmez; `rejected` listesine girer.
- Kısmi başarı **başarı sayılmaz ve gizlenmez** — arayüz eklenen, atlanan ve
  reddedilen sayıları birlikte gösterir.
- `format` alanı `"music-archive-backup"` değilse 400 `import_invalid`.
- `version` bilinmiyorsa (>1) 400 `import_invalid` — ileri sürümü tahminle okumaz.
- İçe aktarma **başka kullanıcının** yedeğini kabul eder; her şey oturum sahibine yazılır.

---

## 10. Test zorunlulukları

Her yeni uç için **en az** şu testler (`test/studio-api.test.js` ve
`test/backend-runtime.test.js` desenine uygun):

1. Mutlu yol.
2. **İkinci hesapla erişim → 404.**
3. Oturumsuz → 401.
4. Geçersiz gövde → 400 ve doğru `code`.
5. Kalıcı DB kapalıyken → 503.
6. Sınır aşımı (etiket sayısı, not sayısı, tarih aralığı) → 400.
7. `PATCH` için: gönderilmeyen alanın **değişmediği**.
8. `DELETE` için: ikinci silme → 404.

`import`/`export` için ayrıca: dışa aktar → ikinci hesaba içe aktar → veri
birebir eşleşiyor mu; bozuk kayıt içeren yedek kısmi başarıyla dönüyor mu.

---

## 11. Müzik Defteri — şarkı başına not geçmişi

**Uygulandı:** 7 Eylül 2026 · **Kod:** `server/journal.js` · **Model:** `DATA-MODEL.md` §9

Eski davranış `Like.userNote` idi: tek alan, her kayıt öncekini siliyordu.
Defter bunun yerine **ekler**. `userNote` alanı kaldırılmadı (mobil istemci
okuyor olabilir, §0 kuralı); yeni yazım yolu ona dokunmaz.

**Yetki:** `authenticateToken`. Kalıcı DB **şart değildir** — arşiv uçları gibi
bellek içi geliştirme modunda da çalışır (stüdyo uçlarından ayrılan tek nokta;
sebebi: defter, kaydedilmiş bir performans iddiası taşımaz).
Her yanıtta `Cache-Control: no-store`.

### 11.1 `GET /api/library/journal`

| Parametre | Kural |
|---|---|
| `trackId` | isteğe bağlı; verilirse yalnız o şarkının notları |
| `limit` | 1–100, varsayılan 20. Aralık dışı → **400** `journal_range_invalid` (sessizce kırpılmaz) |
| `offset` | 0–100000, varsayılan 0 |

**Yanıt 200:** `{ entries: [...], total, limit, offset }` — `createdAt` azalan.

```json
{ "id": "…", "trackId": "…", "trackName": "…", "artistName": "…", "image": null,
  "body": "2027: Bu yaz sürekli dinledim.", "rating": 4.5,
  "createdAt": "2027-08-02T20:11:00.000Z", "editedAt": null }
```

### 11.2 `POST /api/library/journal`

```json
{ "trackId": "…", "body": "…", "trackName": "…", "artistName": "…", "image": "…" }
```

- `body` 1–2000 karakter (`trim` sonrası). Boş → 400 `journal_body_required`,
  uzun → 400 `journal_body_too_long`.
- `trackId` zorunlu, ≤ 200 karakter → 400 `journal_track_required`.
- `trackName` / `artistName` / `image` **isteğe bağlı**; gönderilmezse arşiv
  satırından (`Like`) doldurulur. Şarkı arşivde olmak zorunda değildir.
- `rating` **istemciden alınmaz**: sunucu o anki `Rating` kaydını okuyup
  kopyalar. Sonradan puan değişmesi eski kayıtları değiştirmez.
- Şarkı başına 500 not; aşarsa **409** `journal_limit_exceeded`.
- Hız sınırı: dakikada 60 yazma (`journalLimiter`) → **429** `rate_limited`.
  `userLimiter` kullanılmaz; o sınır Spotify kotası içindir ve üçüncü nota
  "çok fazla arama isteği" cevabı verirdi.

**Yanıt 201:** `{ entry }`

### 11.3 `PATCH /api/library/journal/:id`

`{ "body": "…" }` — yalnız metin değişir. `createdAt` ve `rating` **korunur**;
`editedAt` damgalanır. Başkasının kaydı → **404** (§2.1).

### 11.4 `DELETE /api/library/journal/:id`

**Yanıt 200:** `{ success: true }` · ikinci silme → **404**
`journal_entry_not_found`. Diğer notlar etkilenmez.

### 11.5 Bağlı değişiklikler

- `GET /api/me` → her `likes[]` satırına `noteCount` ve `lastNoteAt` eklendi
  (alan **eklemek** güvenlidir, §0/5). Tek `aggregate` ile, satır başına sorgu yok.
- **Arşivden çıkarmak notları silmez.** `DELETE /api/library/track/:trackId`
  yalnız `Like` satırını kaldırır; defter kalır. Geçmişi silen tek yol 11.4'tür.
- Hata gövdeleri §1 kuralına uyar: `{ error: "insan cümlesi", code: "snake_case" }`.
  İstemci `code` → `journal.*` çeviri anahtarı eşlemesini
  `js/services/journal.js` içinde tutar.
