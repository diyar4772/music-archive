# C5 — Veri Modeli Değişiklikleri ve Göç

> **Uygulayan:** Codex, Sprint 2–4 · **Kararlar:** KR-2, KR-3, KR-5
> Mevcut şemalar 5 Eylül 2026'da okunarak çıkarıldı.

---

## 0. Değişmeyen kurallar

1. **Hiçbir mevcut alan silinmez veya yeniden adlandırılmaz.** Üretimde veri var.
2. Yeni alanların hepsi **isteğe bağlı**dır ve eski belgelerde yokken okunabilir
   bir varsayılana düşer. Toplu güncelleme (`updateMany`) çalıştırılmaz.
3. `userId` her belgede zorunlu, her sorguda filtre. İstemciden gelmez.
4. Yeni indeks eklenirken **mevcut indekslerle çakışma** kontrol edilir:
   aynı ön eke sahip iki indeks gereksiz yer kaplar.
5. Mobil istemci `/api/library/*` yanıtlarını okuyor olabilir. Yanıtlara alan
   **eklemek** güvenlidir; alan çıkarmak veya tip değiştirmek değildir.

---

## 1. `Recording` — mevcut

```js
{ userId, clientId, title, description, tags: [String],
  source, input, instrument, durationMs,
  events: [{ at, data: [Number] }],
  pieceId, takeGroupId, contentHash, createdAt, updatedAt }
```
İndeksler: `{userId, clientId} unique` · `{userId, createdAt:-1, _id:-1}`

### Eklenecek

```js
notes: [{ _id: false, id: String, atMs: Number, text: String, createdAt: Date }]
metrics: {
  version: Number,
  computedAt: Date,
  values: mongoose.Schema.Types.Mixed   // MIDI-METRICS.md §5 şekli
}
```

| Alan | Neden gömülü, ayrı koleksiyon değil |
|---|---|
| `notes` | Her zaman kaydın kendisiyle birlikte okunur. Kayıt başına ≤ 200 not, her biri ≤ 500 karakter → en kötü 100 KB. Ayrı koleksiyon her kayıt açılışında ikinci sorgu demek. |
| `metrics` | Kayıt başına tek sonuç. Brif "analizler versiyonlanır ve yeniden çalıştırılabilir" diyor — `version` bunu karşılar; geçmiş sürümler saklanmaz, yeniden hesaplanabilir oldukları için. |

**Belge boyutu uyarısı:** `events` zaten 60.000'e kadar olay tutabiliyor
(~2–3 MB). MongoDB belge sınırı 16 MB. `notes` + `metrics` bu tavana anlamlı
katkı yapmaz, ama Codex bir kayıt için **en kötü durum boyutunu ölçüp** rapora yazar.

### Eklenecek indeksler

```js
recordingSchema.index({ userId: 1, pieceId: 1, createdAt: -1 });  // eser detayı, K3.1
recordingSchema.index({ userId: 1, tags: 1 });                    // etiket filtresi, K2.5
recordingSchema.index({ userId: 1, title: 'text' });              // q araması, K2.5
```

**`{userId, pieceId}` gerekçesi:** eser detay ekranı bu sorguyu her açılışta
yapar. Mevcut `{userId, createdAt}` indeksi `pieceId` filtresini kapsamaz;
sunucu tüm kullanıcı kayıtlarını tarar.

**Text index uyarısı:** Bir koleksiyonda **yalnız bir** text index olabilir.
`description`'ı da kapsamak isteniyorsa tek bileşik text index olarak tanımlanır:
`{ title: 'text', description: 'text' }`. Sonradan ikinci bir text index eklemek
hata verir — Codex bunu baştan doğru kurar.

---

## 2. `Piece` — mevcut

```js
{ userId, clientId, title, composer, notes, catalogTrackId, createdAt, updatedAt }
```
İndeks: `{userId, clientId} unique`

### Eklenecek

```js
archived: { type: Boolean, default: false }
```

**Göç yok.** `archived` alanı olmayan eski belgeler `undefined` döner; sorgu
`{ archived: { $ne: true } }` biçiminde yazılır — `{ archived: false }` **değil**,
çünkü o eski belgeleri dışarıda bırakır. Bu, sessizce eserlerin kaybolmasına yol
açacak türden bir hatadır; testle korunur.

### Eklenecek indeks

```js
pieceSchema.index({ userId: 1, archived: 1, createdAt: -1 });
```

---

## 3. `Like` — mevcut

```js
{ userId, trackId, trackName, artistId, artistName, image, previewUrl,
  source: 'manual'|'dig', mood: String|null, userNote: String|null,
  noteUpdatedAt: Date|null, createdAt, updatedAt }
```
İndeksler: `{userId}` · `{trackId}` · `{userId, trackId} unique`

### Eklenecek

```js
tags: { type: [String], default: undefined }   // KR-5
```

`default: undefined` bilinçli: `default: []` her belgeye boş dizi yazar ve
mevcut 146 kaydı gereksizce şişirir. Okuma tarafında `like.tags || []`.

### Eklenecek indeks

```js
likeSchema.index({ userId: 1, tags: 1 });
```

**`{userId}` indeksi zaten var** — `{userId, tags}` onu ön ek olarak kapsar.
Codex, `{userId}` tek başına indeksinin **hâlâ gerekli olup olmadığını ölçer**;
gereksizse siler ve gerekçesini yazar. (Ölçmeden silme.)

### Eklenecek indeks — tarih filtresi

```js
likeSchema.index({ userId: 1, createdAt: -1 });
```
K4.4'ün tarih aralığı ve K4.6'nın günlük görünümü bunu kullanır.

---

## 4. `Like.mood` göçü — dikkat

Şema bugün `mood`'u **serbest `String`** olarak tanımlıyor ve varsayılanı `null`.
KR-3 kapalı liste getiriyor: `energetic · melancholic · calm · intense · joyful ·
dark · nostalgic · focus`.

**Ölçülen gerçek:** `js/` içinde mood **yazan tek satır yok**. Yani üretimde
büyük olasılıkla her `mood` alanı `null`. Codex bunu **varsaymaz, sorgular**:

```js
db.likes.aggregate([{ $group: { _id: "$mood", n: { $sum: 1 } } }])
```

- Sonuç yalnız `null` ise → doğrulama kapalı listeye kilitlenir, göç gerekmez.
- Liste dışı değer varsa → o değerler **korunur**, arayüzde ham metin olarak
  gösterilir, ama yeni atamalarda yalnız kapalı liste seçilebilir. Kullanıcı
  verisi silinmez.

Sorgu sonucu rapora yazılır.

---

## 5. `Rating` — değişiklik yok

KR-4 gereği 0,5–5 yıldız ve yarım adım doğrulaması olduğu gibi kalır.
İstatistik ekranının puan dağılımı bu koleksiyondan toplanır; yeni alan gerekmez.

### Eklenecek indeks

```js
ratingSchema.index({ userId: 1, rating: 1 });
```
K4.4'ün `minRating` filtresi ve K4.5'in dağılım toplaması için.
Mevcut `{userId, itemId, itemType} unique` bunu kapsamıyor.

---

## 6. Yeni koleksiyon — `PracticeSession` (K3.5, opsiyonel)

Sprint 3'te zaman kalırsa. Kalmazsa **yazılmaz** — yarım şema bırakılmaz.

```js
{ userId, clientId, startedAt, endedAt, durationMs,
  recordingIds: [String], pieceIds: [String], createdAt, updatedAt }
```
İndeks: `{userId, clientId} unique` · `{userId, startedAt: -1}`

**Hedef, puan, başarım alanı yoktur** (KR-3 gerekçesiyle aynı hat: ölçülen
gerçek tutulur, değerlendirme üretilmez).

---

## 7. Kullanıcı silme akışı

`server.js` içindeki kullanıcı silme akışına `Recording` ve `Piece` temizliği
**zaten eklenmiş** (`docs/reports/MIDI_STUDIO_2026-09-05.md`). Yeni koleksiyon
eklenirse (`PracticeSession`) o akışa **da** eklenir. Bu unutulursa yetim veri
kalır; testle korunur:

```
test: kullanıcı sil → o kullanıcıya ait Recording, Piece, PracticeSession,
Like, Rating, Playlist, Follow sayısı 0
```

---

## 9. Yeni koleksiyon — `JournalEntry` (Müzik Defteri, uygulandı)

```js
{ userId, trackId, trackName, artistName, image,
  body, rating, editedAt, createdAt, updatedAt }
```
İndeksler: `{userId, trackId, createdAt:-1}` · `{userId, createdAt:-1}`

| Alan | Kural |
|---|---|
| `body` | 1–2000 karakter, `trim` sonrası zorunlu |
| `rating` | Yazıldığı andaki `Rating` değerinin **kopyası**; `null` olabilir. Geriye dönük doldurulmaz. |
| `trackName` · `artistName` · `image` | Denormalize. Şarkı arşivden çıkarılsa da kaydın kimin hakkında olduğu okunabilsin diye. |
| `editedAt` | `null` = hiç düzenlenmedi. Düzenleme `createdAt`'i değiştirmez. |

**Neden ayrı koleksiyon, `Like` içine gömülü dizi değil:** not sayısı kullanıcı
ve şarkı başına sınırsıza yakın büyür (şarkı başına 500 tavanı var), ve defter
şarkı arşivden çıkarıldıktan sonra da yaşar — gömülü dizi `Like` silinince
giderdi. Kayıt notlarının (§1 `Recording.notes`) gömülü olmasının sebebi tersine
işliyor: onlar her zaman kaydın kendisiyle okunur ve kayıt silinince gitmelidir.

**Mevcut `Like.userNote` alanı silinmedi** (§0/1). Eski tek notu deftere taşıyan
göç: `scripts/migrate-notes.mjs` (`npm run migrate:notes`), tekrar çalıştırmaya
karşı korumalı, `userNote`'u yerinde bırakır.

---

## 8. Toplam değişiklik özeti

| Koleksiyon | Yeni alan | Yeni indeks |
|---|---|---|
| `Recording` | `notes[]`, `metrics{}` | `{userId,pieceId,createdAt}`, `{userId,tags}`, text index |
| `Piece` | `archived` | `{userId,archived,createdAt}` |
| `Like` | `tags[]` | `{userId,tags}`, `{userId,createdAt}` |
| `Rating` | — | `{userId,rating}` |
| `PracticeSession` | yeni koleksiyon (opsiyonel) | 2 indeks |

**Göç betiği gerekmez.** Tüm yeni alanlar isteğe bağlıdır ve okuma tarafı
yokluğa dayanıklı yazılır. İndeksler Mongoose tarafından arka planda oluşturulur;
Codex ilk çalıştırmada indeks oluşumunun tamamlandığını (`collection.indexes()`)
doğrular ve rapora yazar.
