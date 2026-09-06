# Codex — Buradan Başla (6 Eylül 2026)

> **Bu dosya bir devir teslimdir, plan değildir.** Plan hâlâ
> `docs/plans/CODEX-PLAN-2026-09-05.md`; sözleşmeler `docs/specs/` altında;
> üstün belge `MUSIC-ARCHIVE-BRIEF.md`. Bu dosya yalnız şunu söyler:
> **dün gece ne değişti, sen nereden devam ediyorsun, nelere dikkat edeceksin.**

---

## 0. Otuz saniyelik özet

Sprint 1 kapandı. Son açık kalem **K1.5 (test seçicilerini dilden ayır)** de
kapatıldı — Claude yaptı, çünkü Sprint 2'nin tarayıcı testleri onun üstüne
kurulacaktı. Senin başlayacağın yer **Sprint 2 / K2.1: kayıt düzenleme ve
silme.** Bekleyen karar, açık soru veya yazılmamış spec yok.

```
git log --oneline -1     # K1.5 commit'i
npm run check            # lint + 59 test
npm run audit            # 10 kalem, hepsi hedefte
```

Bu üçü yeşil değilse **kod yazmadan önce** onu düzelt.

## 1. K1.5 ne değiştirdi — çalışmanı doğrudan etkileyen 5 madde

### 1.1 Görünen her kontrol `data-testid` taşır

Kayıt defteri: **`docs/specs/TESTIDS.md`** (138 kimlik). Kural:

- Kontrolün *davranışı* `docs/specs/CONTROLS.md`'de, *kimliği* `TESTIDS.md`'de.
- Defterde `⏳` işaretli kimlikler senin sprintlerine ait. Kontrolü koda
  geçirdiğin commit'te satırı `✅` yap. **Aynı commit** — ayrı bırakırsan
  defter yalan söyler ve test kırmızıya döner.
- Defterde olmayan bir kimliğe ihtiyacın olursa **uydurma**: satırı deftere ekle
  (adlandırma kuralı §1'de), sonra koda geç.

### 1.2 `el()` artık `testid` seçeneği alıyor

```js
el('button', { className: 'ma-btn', text: t('recordings.delete'),
    testid: 'recording-delete', attrs: { type: 'button' }, on: { click } })
```

`cover()` / `avatar()` de `testid` alır ve alt düğüme geçirir.

### 1.3 Stüdyo yardımcılarının imzası değişti — kimlik **ilk argüman**

```js
// js/studio/ui.js
button(testid, text, click, primary = false)
input(testid, name, placeholder = '', max = 120)
select(testid, name, options)
```

Eski çağrı şekli (`button(t('...'), fn)`) artık kimliği etiket sanar. Denetim ve
test bunu yakalar ama zamanını yemesin: yeni kontrol yazarken kimlikle başla.

Kimliği devreden sarmalayıcı yazacaksan ilk parametrenin adı `testid` olsun —
denetim bu adı tanıyor (bkz. `RecordingsView.row()` içindeki `act()`).

### 1.4 Tarayıcı testi artık metne bakmıyor

`test/browser/studio-smoke.mjs`:

```js
const click = async (id, scope = '') => { … };      // [data-testid="…"]
await click('recording-reupload', '[data-storage=local] ');   // kapsamlı tıklama
const tr = key => say('tr', key);                    // beklenen metin locale'den
```

Sprint 2 senaryolarını (10 döngü, A–B, silme onayı) buraya eklerken:

- Kontrolü **kimlikle** bul; `textContent` ile arama yapma — `test/testids.test.js`
  bunu reddediyor.
- Beklenen metni `say('tr', 'anahtar')` ile oku, dizeyi teste gömme.
- Durum sorusunu yapıyla sor: `[data-state=error]`, `[data-storage=local]`,
  `[data-testid=recording-row]` — hepsi dilden bağımsız.
- Silme onayı `confirm-yes` / `confirm-cancel` kimliklerini kullanır ve
  **`window.confirm()` kullanılmaz** (CONTROLS.md §0.5).

### 1.5 Denetime yeni kalem eklendi

`npm run audit` → **"Kimliksiz kontrol"**, hedef `0`. `js/` ve `index.html`
içindeki her `el('button'|'input'|'select'|'textarea', …)` ve her düz
`<button>`/`<input>`/`<select>`/`<textarea>` taranıyor. Ayrıca
`test/testids.test.js` (5 test, tarayıcısız) defter ile kodun mutabakatını
`npm test` içinde kontrol ediyor.

## 2. Başlamadan önce bir kez çalıştır

`npm run test:browser` bu oturumda **çalıştırılamadı** (yerel MongoDB + uzaktan
hata ayıklama açık Chrome gerekiyordu, ortam yoktu). Seçiciler statik olarak
kodla uyumlu doğrulandı ama uçtan uca geçtiği doğrulanmadı. K2.1'e başlamadan
önce ilk işin bu olsun:

```bash
# ayrı, tek kullanımlık MongoDB + açık test gizleri + ENABLE_MOCK_AUTH=false
STUDIO_TEST_URL=http://127.0.0.1:3109 npm run test:browser
```

Düşerse mesaj doğrudan hangi kimliğin bulunamadığını söyler
(`control not on the page: [data-testid="…"]`). Sonucu Sprint 2 raporunun
başına yaz — geçtiğini varsayma.

## 3. Sıradaki iş: Sprint 2

Sıra plandaki gibi. Her ticket **ayrı commit**, her commit öncesi
`npm run check` + `npm run audit` yeşil.

| # | Ticket | Neden bu sırada | Kimlikler (defterde ⏳) |
|---|---|---|---|
| 1 | **K2.1** Kayıt düzenleme + silme | En yüksek öncelikli eksik: bugün yanlış başlıkla kaydeden kullanıcının hiçbir çıkışı yok (B1/B2) | `recording-edit` `recording-save` `recording-delete` `recording-delete-draft` |
| 2 | **K2.2** Metronom + giriş sayımı | K2.3 ve K2.6 zamanlamayı ondan okuyacak | `metronome-toggle` `metronome-tap` `metronome-bpm` `metronome-bpm-up/down` `metronome-meter` `metronome-accent` `metronome-volume` `metronome-count-in` |
| 3 | **K2.3** A–B döngüsü, hız, kısayollar | Oynatıcı K2.4'ün notlarını konumlandıracak | `player-speed` `player-loop-a` `player-loop-b` `player-loop-clear` |
| 4 | **K2.4** Zaman işaretli notlar | Oynatıcı oturduktan sonra | `recording-add-note` `recording-delete-note` |
| 5 | **K2.5** Arama, filtre, sıralama | 500 kayıt tohumlaması hazır: `test/perf/seed-recordings.mjs` | `recordings-search` `recordings-filter-piece` `recordings-filter-tag` `recordings-sort` `recordings-clear-filters` |
| 6 | **K2.6** Kayıt sonrası tam piano roll | A–B bölgesini gölgeleyecek, yani K2.3'ten sonra | — (canvas, kontrol değil) |

Ölçüm gerektiren kabuller (`sapma < 10 ms`, `ilk boya < 300 ms`, `60 fps`) için
yöntem `docs/specs/SPRINT2-VERIFICATION.md`'de tanımlı. **Kendi ölçüm yöntemini
uydurma**; ölçemediğin şeye "ölçülemedi" yaz, sayı üretme.

## 4. K2.1'e girerken üç tuzak

1. **Sahiplik sunucuda.** `userId` token'dan gelir; başkasının kaydına erişim
   **404** (403 değil — kaydın varlığını sızdırma). `API-CONTRACTS.md` §uçlar.
2. **MIDI olayları değiştirilemez.** `PATCH` yalnız başlık, açıklama, etiket ve
   `pieceId` alır; olay gövdesi gelirse **400**. Aksi hâlde kayıt "düzenlenmiş"
   olur ve arşiv fikri çöker.
3. **Silme geri alınamaz.** Onay diyaloğu `Modal.js` üzerinden açılır, varsayılan
   odak **iptalde**, gövdede kaydın başlığı geçer ve **`.mid indir` düğmesi
   onay diyaloğunun içinde bulunur** (CONTROLS.md §4). Kullanıcının tek gerçek
   koruması bu.

Ayrıca `DATA-MODEL.md` §2'deki tuzak hâlâ geçerli: arşiv sorgusu
`{ $ne: true }` olmalı, `{ archived: false }` eski belgeleri kaybettirir.

## 5. Değişmeyen kurallar

`CODEX-PLAN-2026-09-05.md` §2'deki 15 madde aynen yürürlükte. En sık kırılan
üçünü tekrar yazıyorum:

- **Ölü buton yok.** Ekrandaki her kontrol gerçek iş yapar.
- **Uydurma veri yok.** Veri yoksa boş durum.
- **Koda dize gömme.** Her metin `t()` ile ve tr/en/ku üçünde birden.
  Şimdi buna bir dördüncüsü eklendi: **kimliksiz kontrol yok.**
