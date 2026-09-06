# C7 — Yeni Kontrol (Buton) Envanteri

> **Uygulayan:** Codex, Sprint 2–4 · **Metinler:** `docs/specs/I18N-STUDIO.md`
> **Brif md.1:** görünen her kontrol gerçek bir iş yapar.

---

## 0. Her kontrol için zorunlu alanlar

Bu dosyadaki tablolarda her satır şunları belirtir:

- **Anahtar** — i18n anahtarı. Etiket koda yazılmaz.
- **Pasiflik** — düğmenin `disabled` olduğu koşul. **Boş bırakılamaz.**
  "Hiç pasif olmaz" da bir cevaptır ve `—` ile yazılır.
- **Onay** — yıkıcı eylemlerde onay adımı gerekli mi.
- **Klavye** — kısayol varsa.
- **Hata** — çağrı başarısız olursa ne olur.

**Genel kurallar:**

1. Dokunma hedefi ≥ `var(--touch)` (44px). İkon-only düğmelerde de.
2. Her düğmenin erişilebilir bir adı var: metin veya `aria-label`.
3. Ağ isteği yapan düğme, istek sürerken **pasif** olur ve metni değişir
   (`…uploading`, `…saving`). İki kez tıklama iki istek üretmez.
4. Hata durumunda düğme **tekrar aktif** olur; kullanıcı çıkmaza girmez.
5. Yıkıcı onay diyaloğu `js/components/Modal.js` üzerinden açılır;
   `window.confirm()` **kullanılmaz** (stil dışı, çevrilemez, odak yönetimi yok).
6. Onay diyaloğunda **varsayılan odak iptal düğmesindedir**. Enter'a basmak
   yanlışlıkla silmez.

---

## 1. Stüdyo — metronom paneli (K2.2)

Konum: `studio` ekranında transport çubuğunun altında, katlanabilir panelde değil —
metronom çalarken erişilebilir olmalı.

| Anahtar | Tip | Pasiflik | Onay | Klavye | Hata |
|---|---|---|---|---|---|
| `metronome.toggle` / `toggleOff` | aç-kapa | — | — | `M` | `metronome.unavailable`, düğme kapalı konuma döner |
| `metronome.bpmDown` | düğme | `bpm <= 30` | — | `←` (panelde odaklıyken) | — |
| `metronome.bpmUp` | düğme | `bpm >= 240` | — | `→` | — |
| `metronome.bpm` | sayı girişi | kayıt sürerken pasif | — | — | aralık dışı değer girilirse en yakın sınıra çekilir |
| `metronome.tap` | düğme | — | — | `T` | 4 vuruştan az veya vuruşlar arası > 3 sn ise değer değişmez, `metronome.tapHint` görünür |
| `metronome.meter` | seçim | kayıt sürerken pasif | — | — | — |
| `metronome.accent` | onay kutusu | — | — | — | — |
| `metronome.volume` | kaydırıcı | — | — | — | — |
| `metronome.countIn` | seçim | kayıt sürerken pasif | — | — | — |

**Metronomun kayıtla ilişkisi:**
- Metronom sesi MIDI kaydına **girmez** (kayıt MIDI olaylarıdır, ses değil).
  Arayüz bunu `metronome.note` ile bir kez söyler.
- Giriş sayımı seçiliyse "Kaydı başlat" → önce sayım çalar, sayım bitince
  kayıt başlar. **Sayım süresi `durationMs`'e dahil edilmez.**
- Sayım sırasında "Kaydı başlat" pasif, "Kaydı durdur" **aktif** olur ve
  sayımı iptal eder (kayıt başlamaz).
- Sayım sırasında ekranda `metronome.countingIn` geri sayımı görünür.

---

## 2. Stüdyo — mevcut kontrollerin değişenleri

| Anahtar | Değişiklik |
|---|---|
| `studio.start` | Pasiflik koşuluna giriş sayımı eklenir: `!owner \|\| recording \|\| draft \|\| countingIn \|\| (source==='midi' && !port)` |
| `studio.stop` | Sayım sırasında da aktif (sayımı iptal eder) |
| `studio.panic` | Değişmez |
| `studio.fullscreen` | Değişmez |

---

## 3. Kayıtlarım — liste ve filtre (K2.5)

| Anahtar | Tip | Pasiflik | Onay | Klavye | Hata |
|---|---|---|---|---|---|
| `recordings.search` | metin girişi | oturumsuz | — | `/` odaklanır | — |
| `recordings.filterPiece` | seçim | eser listesi yüklenemediyse | — | — | eser listesi gelmezse seçim `filterAll`'da kilitli, yanında not |
| `recordings.filterTag` | seçim | etiket yoksa | — | — | — |
| `recordings.sort` | seçim | — | — | — | — |
| `recordings.clearFilters` | düğme | hiç filtre etkin değilse | — | `Esc` (arama kutusunda) | — |
| `recordings.refresh` | düğme | istek sürerken | — | — | mevcut liste **yerinde kalır**, üstte hata satırı |
| `recordings.loadMore` | düğme | istek sürerken | — | — | düğme kalır, altında hata satırı |

**Filtre durumu URL'ye yazılır:** `#/recordings?q=…&pieceId=…&tag=…&sort=…`
Geri tuşu ve bağlantı paylaşımı çalışır. Boş parametreler URL'ye yazılmaz.

---

## 4. Kayıtlarım — satır eylemleri (K2.1, K2.4)

| Anahtar | Tip | Pasiflik | Onay | Hata |
|---|---|---|---|---|
| `recordings.play` | düğme | başka kayıt yükleniyorken | — | `player.failed` satır içinde |
| `recordings.download` | düğme | — | — | satır içi hata |
| `recordings.reupload` | düğme (yalnız yerel taslakta) | istek sürerken | — | satır içi hata, düğme geri aktif |
| `recordings.practicePiece` | düğme (yalnız `pieceId` varsa) | — | — | — |
| `recordings.edit` | düğme | oturumsuz \| yerel taslak | — | — |
| `recordings.delete` | **yıkıcı** | oturumsuz \| yerel taslak | **evet** | onay kapanır, satır içi hata |
| `recordings.deleteDraft` | **yıkıcı** (yalnız yerel taslakta) | — | **evet** | satır içi hata |
| `recordings.compare` | düğme | eser bağı yok \| o eserde < 2 deneme | — | — |

### Düzenleme formu (`recordings.editTitle`)
`title` · `description` · `tags` · `pieceId` alanları. `PATCH /api/recordings/:id`.
`recordings.save` pasiflik: hiçbir alan değişmediyse **veya** `title` boşsa.
Başarıda `recordings.saved` + satır yerinde güncellenir (liste yeniden çekilmez).

### Silme onayı
Başlık `recordings.deleteConfirmTitle`, gövde `recordings.deleteConfirmBody`
(kaydın başlığını içerir ve **.mid indirmeyi önerir**), eylem
`recordings.deleteConfirmAction`, iptal `common.cancel`.
Onay diyaloğunda **`.mid indir` düğmesi de bulunur** — kullanıcı silmeden önce
tek tıkla yedek alabilir. Bu, geri alınamaz bir işlemin tek gerçek koruması.

### Taslak silme onayı
Gövde `recordings.deleteDraftConfirmBody` — "hiçbir yere yüklenmedi" bilgisini
açıkça verir, çünkü kullanıcı bunun sunucuda bir kopyası olduğunu sanabilir.

---

## 5. Oynatıcı — A–B döngüsü ve hız (K2.3)

| Anahtar | Tip | Pasiflik | Klavye | Not |
|---|---|---|---|---|
| `player.pause` / `resume` | aç-kapa | oynatma yokken | `Boşluk` | |
| `player.stop` | düğme | oynatma yokken | `Esc` | |
| `player.speed` | seçim | — | — | 0,5× / 0,75× / 1× / 1,25× / 1,5× |
| `player.loopA` | düğme | oynatma yokken | `A` | konumu A olarak işaretler |
| `player.loopB` | düğme | A işaretlenmemişse | `B` | konumu B olarak işaretler |
| `player.loopClear` | düğme | döngü yoksa | `L` | |
| seek | kaydırıcı | oynatma yokken | `←` `→` (±5 sn) | `player.playbackLabel` |

**Davranış kuralları:**
- `A > B` seçilirse değerler **sessizce takas edilir**; hata gösterilmez.
- `B − A < 500 ms` ise döngü kurulmaz, `player.loopActive` yerine uyarı görünür.
- Döngü başa dönerken **tüm açık notalar bırakılır** (`allNotesOff`), yoksa
  takılı nota kalır. Bu, testle korunacak bir kusur kaynağıdır.
- Hız değişimi oynatma sürerken uygulanır; konum korunur.
- `player.speedNote` bir kez gösterilir — MIDI olduğu için perde bozulmaz.
- Klavye kısayolları **yalnız oynatıcı odaktayken** çalışır; sayfadaki metin
  girişlerinde `Boşluk` boşluk yazar.

---

## 6. Zaman işaretli notlar (K2.4)

| Anahtar | Tip | Pasiflik | Onay | Hata |
|---|---|---|---|---|
| `recordings.addNote` | düğme | oynatma yokken \| not sayısı ≥ 200 | — | satır içi, metin korunur |
| `recordings.notePlaceholder` | metin girişi | — | — | 500 karakter sınırı, sayaç görünür |
| `recordings.deleteNote` | **yıkıcı** | — | **evet** (hafif: satır içi "emin misiniz?") | satır içi |
| not satırı | düğme | — | — | tıklanınca `atMs`'e atlar |

**Not ekleme akışı:** düğmeye basıldığında oynatma **duraklar**, `atMs` o anki
konum olur, metin kutusu odaklanır. Kullanıcı yazarken kayıt akmaya devam
ederse not yanlış ana bağlanır — duraklatma bunu önler.

---

## 7. Çalışmalarım ve eser detayı (K3.1, K3.2)

### Liste ekranı
| Anahtar | Pasiflik | Onay |
|---|---|---|
| `pieces.add` (form gönderimi) | başlık boş \| istek sürerken | — |
| `pieces.open` | — | — |
| `pieces.practice` | — | — |
| `pieces.showArchived` (aç-kapa) | — | — |

### Detay ekranı (`#/pieces/:id`)
| Anahtar | Pasiflik | Onay | Hata |
|---|---|---|---|
| `pieces.edit` | istek sürerken | — | form açık kalır |
| `pieces.archive` / `unarchive` | istek sürerken | **evet** (arşivleme için; geri alınabilir olduğu metinde yazılı) | satır içi |
| `pieces.delete` | `recordingCount > 0` **ise pasif değil, tıklanınca engel mesajı** | **evet** | 409 → `pieces.deleteBlocked` sayıyla |
| `pieces.practice` | — | — | — |
| `recordings.compare` | deneme sayısı < 2 | — | — |
| `pieces.backToPieces` | — | — | — |

**`pieces.delete` neden pasif değil:** Pasif bir düğme *neden* pasif olduğunu
söylemez. Tıklanabilir bırakılıp "bu esere bağlı 7 kayıt var, önce onları silin
veya eseri arşivleyin" demek kullanıcıya yol gösterir. Brif md.1'in ruhu budur.

---

## 8. Ölçümler ve karşılaştırma (K3.3, K3.4)

| Anahtar | Pasiflik | Not |
|---|---|---|
| `metrics.compute` | hesap sürerken \| kayıtta nota yoksa | worker'a gönderir, ilerleme gösterir |
| `metrics.comparePick` | aynı eserde < 2 deneme | seçim listesi |

**Kural:** Ölçüm kartında **hiçbir** değerlendirme ifadesi, emoji, renk kodlu
iyi/kötü göstergesi bulunmaz. `metrics.honesty` metni kartın altında kalıcıdır.
Hesaplanamayan her metriğin yanında `metrics.reason*` metni görünür — satır
boş bırakılmaz veya "0" yazılmaz.

---

## 9. Arşiv — etiket ve mood (K4.1, K4.2)

| Anahtar | Konum | Tip | Pasiflik | Hata |
|---|---|---|---|---|
| `tags.add` | şarkı satırı / detay | metin + Enter | etiket sayısı ≥ 20 | `tags.limit` / `tags.tooLong` |
| `tags.remove` | etiket rozeti | ikon düğme (`aria-label` zorunlu) | istek sürerken | rozet geri gelir, satır içi hata |
| `tags.filterBy` | etiket rozeti | düğme | — | `#/library?tag=…` |
| `mood.assign` | şarkı satırı | seçim (8 seçenek + `mood.none`) | oturumsuz | önceki değere döner, satır içi hata |
| `mood.clear` | mood rozeti | düğme | mood yoksa | — |

**⚠️ Bu, ölü sütunu kapatan iş.** `LibraryView.js:157` bugün mood'u gösteriyor
ama hiçbir kontrol onu yazmıyor. `mood.assign` eklendiğinde sütun gerçek veriyle
dolar. Mood atanmamışsa hücre boş kalmaz: `mood.none` metni **tıklanabilir**
olarak görünür ve seçiciyi açar.

**İyimser güncelleme (optimistic update):** Etiket ve mood değişikliği ekranda
hemen görünür, istek arkada gider. Başarısız olursa **eski değere döner** ve
hata gösterilir. Sessizce eski değerde kalma yok — kullanıcı değişikliğin
kaydedilmediğini bilmeli.

---

## 10. Arşiv — filtre çubuğu (K4.4)

| Anahtar | Tip | Pasiflik |
|---|---|---|
| `filters.minRating` | yıldız seçici (0,5 adım) | — |
| `filters.mood` | seçim (+ "mood'u olmayanlar") | — |
| `filters.tag` | seçim / çoklu seçim | kullanıcının hiç etiketi yoksa |
| `filters.from`, `filters.to` | tarih girişi | — |
| `filters.sort` | seçim | — |
| `filters.clear` | düğme | hiç filtre etkin değilse |

- Etkin filtre sayısı `filters.active` ile gösterilir.
- Durum URL'ye yazılır: `#/library?tag=plak&minRating=4&sort=-rating`.
- `from > to` girilirse **sessizce takas** edilir.
- Sonuç yoksa `filters.noMatch` + `filters.clear` düğmesi.

---

## 11. İstatistik, günlük, yedek (K4.5–K4.7)

| Anahtar | Konum | Pasiflik | Onay | Hata |
|---|---|---|---|---|
| `stats.title` (gezinme) | hesap menüsü | oturumsuz | — | — |
| `diary.title` (gezinme) | hesap menüsü | oturumsuz | — | — |
| `diary.thisMonth` / `lastMonth` / `thisYear` / `custom` | günlük ekranı | — | — | — |
| `diary.widenRange` | boş durumda | — | — | — |
| `backup.export` | ayarlar | istek sürerken | — | `states.errorGeneric` + tekrar dene |
| `backup.import` | ayarlar | dosya seçilmediyse | **evet** | `backup.importFailed` |

**`backup.export` indirme:** Sunucudan gelen JSON `Blob` olarak indirilir.
Büyük arşivlerde bu birkaç saniye sürer — düğme `backup.exporting` metnine geçer.

**`backup.import` onayı:** `backup.importConfirmBody` çakışma politikasını
(**ekler, ezmez**) açıkça yazar. Sonuçta `backup.importDone` eklenen ve atlanan
sayıları gösterir; reddedilen kayıt varsa listesi açılabilir bir bölümde durur.

**İstatistik ekranında yasak:** tür ve yıl grafiği. Veri yok. Bunun yerine
`stats.genreUnavailable` metni durur ve **neden** olmadığını söyler.

---

## 12. Denetim kontrolü

Codex her sprint sonunda şu listeyi doldurur:

```
[ ] Bu sprintte eklenen her kontrol bu dosyada bir satıra sahip mi?
[ ] Her satırın pasiflik koşulu kodda uygulanmış mı?
[ ] Her yıkıcı eylemin onayı var mı, varsayılan odak İptal'de mi?
[ ] Her düğmenin erişilebilir adı var mı? (aria-label veya metin)
[ ] Dokunma hedefleri ≥ 44px mi? (DevTools ile ölçüldü mü)
[ ] Klavye ile her kontrole ulaşılıyor mu? Odak halkası görünür mü?
[ ] İstek sürerken düğme pasif mi, çift tıklama iki istek üretiyor mu?
[ ] Hata sonrası düğme tekrar aktif mi?
[ ] Ekranda etiketi koda gömülü kontrol kaldı mı?
```
