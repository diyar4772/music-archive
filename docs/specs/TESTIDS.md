# K1.5 — Test Kimlikleri (`data-testid`) Kayıt Defteri

> **Yazan:** Claude · 6 Eylül 2026 · **Kaynak:** `docs/specs/SPRINT2-VERIFICATION.md` §0
> **Zorlayan:** `npm run audit` (Kimliksiz kontrol = 0) ve `test/testids.test.js`
> **İlgili:** `docs/specs/CONTROLS.md` (kontrolün *davranışı*), bu dosya (kontrolün *kimliği*)

---

## 0. Kural

**Kullanıcıya görünen her kontrol dilden bağımsız bir `data-testid` taşır.**

Sebep, bu turda somut olarak yaşandı: `test/browser/studio-smoke.mjs` düğmeleri
görünen Türkçe metne göre buluyordu (`b.textContent === 'Kaydı başlat'`).
K1.2 ekranları üç dile taşıyınca bu seçiciler eşleşmeyi bırakacaktı — üstelik
`?.click()` sessizce hiçbir şey yapmadığı için hata "düğme bulunamadı" değil,
üç adım sonraki bir zaman aşımı olarak görünecekti. Sebebi görünmeyen kırılma.

`data-testid`:

- **stil vermez** — CSS'te asla seçici olarak kullanılmaz,
- **kullanıcıya görünmez** — erişilebilir ad değildir; onun için `aria-label` var,
- **i18n anahtarı değildir** — anahtar `studio.start`, kimlik `studio-start`,
- **kalıcıdır** — bir kez yayımlandıktan sonra yeniden adlandırılmaz;
  kontrol kalkarsa kimlik de kalkar.

## 1. Adlandırma

| Kural | Örnek |
|---|---|
| i18n anahtarının nokta yerine tire hâli | `studio.start` → `studio-start` |
| Liste ekranı çoğul, satır kontrolü tekil | `recordings-refresh` (ekran) · `recording-play` (satır) |
| Yalnız küçük harf, rakam ve tire | `search-type-artist` |
| Ekran adı önce, eylem sonra | `library-track-unlike` |
| Aynı etiket iki ekrandaysa kimlik ayrışır | `piece-practice` (Çalışmalarım) · `recording-practice-piece` (Kayıtlarım) |

Dinamik kimlikler şablon dizesiyle üretilir (`nav-${section.id}`); kayıt defteri
üretilen **tüm** değerleri açıkça yazar, çünkü test defteri okur.

Kod tarafında kimlik `el()` seçeneği olarak verilir:

```js
el('button', { className: 'ma-btn', text: t('dig.keep'), testid: 'dig-keep', attrs: { type: 'button' } })
```

Stüdyo yardımcıları (`js/studio/ui.js`) kimliği **ilk argüman olarak zorunlu**
ister — unutulması mümkün olmasın diye:

```js
button('studio-start', t('studio.start'), () => this.start(), true)
input('piece-field-title', 'title', t('pieces.fieldTitlePlaceholder'))
select('studio-source', 'source', options)
```

## 2. Kayıt defteri

`✅` = kodda var ve testin kullanabileceği durumda · `⏳` = spec'i yazıldı,
ilgili sprintte eklenecek. Bir kontrol `⏳`'den `✅`'ye ancak koda girdiği
commit'te geçer.

### 2.1 Uygulama kabuğu

| Kimlik | Kontrol | Yer | Durum |
|---|---|---|---|
| `bootstrap-retry` | Açılış hatası → tekrar dene | `js/app.js` | ✅ |
| `auth-form` | Giriş/kayıt formu | `index.html` | ✅ |
| `auth-username` · `auth-password` | Kimlik alanları | `index.html` | ✅ |
| `auth-submit` · `auth-switch` · `auth-close` | Gönder · moda geç · kapat | `index.html` | ✅ |
| `state-action` | Dört durum bloğunun eylemi (tekrar dene / giriş yap) | `js/components/States.js` | ✅ |

Durum bloğunun **türü** `data-state` ile okunur: `loading` · `empty` · `error` ·
`denied` · `signed-out`. Test "hata durumu göründü mü" sorusunu metinle değil
`[data-state=error]` ile sorar.

### 2.2 Başlık ve hesap menüsü

| Kimlik | Kontrol | Durum |
|---|---|---|
| `nav-home` | Marka → panoya dön | ✅ |
| `nav-dashboard` · `nav-studio` · `nav-recordings` · `nav-pieces` | Ana bölümler (`nav-${section.id}`) | ✅ |
| `subnav-dashboard` · `subnav-search` · `subnav-library` · `subnav-dig` | Arşiv alt gezintisi (`subnav-${id}`) | ✅ |
| `nav-lang-tr` · `nav-lang-en` · `nav-lang-ku` | Dil anahtarı (`nav-lang-${code}`) | ✅ |
| `nav-theme` | Tema anahtarı | ✅ |
| `nav-login` · `nav-account` | Giriş düğmesi · hesap menüsü | ✅ |
| `nav-menu-likes` · `nav-menu-follows` · `nav-menu-playlists` · `nav-menu-create-playlist` · `nav-menu-settings` · `nav-menu-logout` | Menü satırları (`nav-menu-${item.action}`) | ✅ |

### 2.3 Karşılama ve pano

| Kimlik | Kontrol | Durum |
|---|---|---|
| `landing-register` · `landing-features` · `landing-studio` | Karşılama çağrıları | ✅ |
| `dashboard-open-likes` · `dashboard-open-follows` · `dashboard-open-playlists` | Bento kartları | ✅ |
| `dashboard-export-csv` · `dashboard-export-backup` | Dışa aktarma | ✅ |
| `dashboard-track` | Panel satırı (son eklenen / en yüksek puan) | ✅ |

### 2.4 Arşiv (Kütüphane)

| Kimlik | Kontrol | Durum |
|---|---|---|
| `library-tab-likes` · `library-tab-follows` · `library-tab-playlists` | Sekmeler (`library-tab-${tab.id}`) | ✅ |
| `library-track-row` | Bir arşiv satırı (kapsam seçici) | ✅ |
| `library-track-cover` · `library-track-open` | Kapak · satır gövdesi | ✅ |
| `library-track-note` · `library-track-unlike` | Not rozeti · arşivden çıkar | ✅ |
| `library-artist` · `library-playlist` | Sanatçı kartı · çalma listesi kutusu | ✅ |
| `library-new-playlist` · `library-create-playlist` | Yeni liste kutusu · boş durum eylemi | ✅ |
| `library-start-searching` | Boş arşiv → aramaya git | ✅ |
| `library-filter-*` · `library-sort` · `library-tag-*` · `library-mood-*` | Filtre/sıralama/etiket/mood çubuğu | ⏳ K4.1–K4.4 |

### 2.5 Arama ve sanatçı

| Kimlik | Kontrol | Durum |
|---|---|---|
| `search-input` · `search-clear` | Arama alanı · temizle | ✅ |
| `search-type-artist` · `search-type-track` · `search-type-album` | Tür süzgeci (`search-type-${type.id}`) | ✅ |
| `search-suggestion` · `search-history-item` | Otomatik tamamlama satırları | ✅ |
| `search-retry` · `search-back-to-library` | 503 kartının eylemleri | ✅ |
| `search-artist` · `search-album` | Sanatçı kartı · albüm kutusu | ✅ |
| `search-track-row` · `search-track-cover` · `search-track-open` | Sonuç satırı ve açma yolları | ✅ |
| `search-track-archive` · `search-track-details` | Arşive al/çıkar · ayrıntı | ✅ |
| `artist-follow` | Takip et / bırak | ✅ |

### 2.6 Dig

| Kimlik | Kontrol | Durum |
|---|---|---|
| `dig-preview` · `dig-skip` · `dig-keep` · `dig-reset` | Önizle · geç · sakla · yeniden başlat | ✅ |

### 2.7 Parça kaydı, albüm, çalma listesi

| Kimlik | Kontrol | Durum |
|---|---|---|
| `track-row` · `track-row-play` · `track-row-open` · `track-row-remove` | Diyalog içi parça satırı | ✅ |
| `track-detail-close` | Çekmeceyi kapat | ✅ |
| `track-play` · `track-like` | Önizleme · arşive al/çıkar | ✅ |
| `track-note` · `track-note-save` | Kişisel not · kaydet | ✅ |
| `track-add-to-playlist` | Listeye ekle | ✅ |
| `rating-star-1` … `rating-star-5` (`rating-star-${position}`) · `rating-clear` | Yıldızlar · puanı sil | ✅ |
| `album-save` | Albümü arşive al/çıkar | ✅ |
| `playlist-option` | "Listeye ekle" seçenek satırı | ✅ |
| `playlist-change-cover` · `playlist-delete` | Kapak değiştir · listeyi sil | ✅ |
| `details-close` | Albüm/liste diyaloğunu kapat | ✅ |
| `add-to-playlist-close` · `add-to-playlist-cancel` | Kapat · vazgeç | ✅ |
| `create-playlist-close` · `create-playlist-name` · `create-playlist-confirm` · `create-playlist-cancel` | Yeni liste diyaloğu | ✅ |
| `confirm-yes` · `confirm-cancel` | Onay diyaloğu | ✅ |
| `cover-close` · `cover-tab-upload` · `cover-tab-url` · `cover-file` · `cover-url` · `cover-save` · `cover-cancel` | Kapak diyaloğu | ✅ |
| `settings-close` · `settings-theme` · `settings-language` | Ayarlar | ✅ |
| `player-progress` · `player-toggle` · `player-close` | Mini çalıcı (önizleme sesi) | ✅ |

### 2.8 Stüdyo

| Kimlik | Kontrol | Durum |
|---|---|---|
| `studio-source` · `studio-device` · `studio-connect` | Kaynak · cihaz · MIDI bağla | ✅ |
| `studio-start` · `studio-stop` · `studio-timer` | Kaydı başlat · durdur · süre | ✅ |
| `studio-keyboard` · `studio-roll` | Ekran piyanosu · piano roll | ✅ |
| `studio-capture` · `studio-field-title` · `studio-field-description` · `studio-field-tags` · `studio-field-piece` | Künye bölümü ve alanları | ✅ |
| `studio-notation` · `studio-preview-sound` · `studio-panic` · `studio-fullscreen` | Ayarlar ve araçlar | ✅ |
| `studio-result` | Sonuç/mesaj bölgesi (kapsam seçici) | ✅ |
| `studio-upload` · `studio-new-take` | Arşive kaydet · yeni deneme | ✅ |
| `studio-play-draft` · `studio-download-draft` | Taslağı dinle · `.mid` indir | ✅ |
| `studio-goto-recordings` · `studio-open-recordings` | Kayıtlarıma git (üst çubuk · yükleme sonrası) | ✅ |
| `metronome-toggle` · `metronome-tap` · `metronome-bpm` · `metronome-bpm-up` · `metronome-bpm-down` · `metronome-meter` · `metronome-accent` · `metronome-volume` · `metronome-count-in` | Metronom paneli | ⏳ K2.2 |

**Not:** `studio-upload` yükleme başarısız olunca ekranda kalır, etiketi
`recordings.reupload` olur ve **kimliği değişmez**. Test "tekrar yükle sunuldu
mu" sorusunu `[data-testid=studio-result] [data-state=error]` + düğmenin tekrar
etkinleşmesiyle sorar.

### 2.9 Kayıtlarım

| Kimlik | Kontrol | Durum |
|---|---|---|
| `recordings-refresh` · `recordings-open-studio` · `recordings-load-more` | Ekran çubuğu | ✅ |
| `recording-row` | Bir kayıt kartı (kapsam seçici; `data-storage=local\|stored`) | ✅ |
| `recording-play` · `recording-download` · `recording-reupload` | Satır eylemleri | ✅ |
| `recording-practice-piece` | Bu kaydın eserini stüdyoda çalış | ✅ |
| `recording-edit` · `recording-save` · `recording-delete` · `recording-delete-draft` | Düzenleme ve silme | ⏳ K2.1 |
| `recording-add-note` · `recording-delete-note` | Zaman işaretli notlar | ⏳ K2.4 |
| `recordings-search` · `recordings-filter-piece` · `recordings-filter-tag` · `recordings-sort` · `recordings-clear-filters` | Arama ve süzgeçler | ⏳ K2.5 |
| `recording-compare` | İki denemeyi karşılaştır | ⏳ K3.4 |

### 2.10 Çalışmalarım ve eser detayı

| Kimlik | Kontrol | Durum |
|---|---|---|
| `piece-form` · `piece-field-title` · `piece-field-composer` · `piece-field-notes` · `piece-field-catalog` · `piece-save` | Yeni eser formu | ✅ |
| `pieces-refresh` · `piece-row` · `piece-practice` | Liste ve satır | ✅ |
| `piece-open` · `piece-edit` · `piece-archive` · `piece-unarchive` · `piece-delete` · `pieces-show-archived` · `piece-back` | Eser detayı | ⏳ K3.1–K3.2 |
| `metrics-compute` · `metrics-compare-pick` | Ölçüm kartı | ⏳ K3.3–K3.4 |

### 2.11 MIDI oynatıcı

| Kimlik | Kontrol | Durum |
|---|---|---|
| `player` | Oynatıcı bloğu (kapsam seçici) | ✅ |
| `player-seek` · `player-pause` · `player-stop` | Konum · duraklat/devam · durdur | ✅ |
| `player-speed` · `player-loop-a` · `player-loop-b` · `player-loop-clear` | Hız ve A–B döngüsü | ⏳ K2.3 |

## 3. Testler bunu nasıl zorluyor

1. **`npm run audit` → "Kimliksiz kontrol"** hedefi `0`. Betik `js/` ve
   `index.html` içindeki her `el('button'|'input'|'select'|'textarea', …)`
   çağrısını ve her düz `<button>`/`<input>`/`<select>`/`<textarea>` etiketini
   tarar; kimliği olmayanı satırıyla listeler. Stüdyo yardımcılarının ilk
   argümanı dize sabiti değilse o da bulgu sayılır.
2. **`test/testids.test.js`** (`npm test` içinde, tarayıcı gerekmez):
   - kimliksiz kontrol yok;
   - bu defterde `✅` işaretli her kimlik kodda geçiyor;
   - kodda geçen her kimlik bu defterde yazılı (şablonla üretilenler önek
     eşleşmesiyle);
   - `test/browser/studio-smoke.mjs` içinde görünen metne göre kontrol arayan
     seçici yok.
3. **`test/browser/studio-smoke.mjs`** kontrolleri yalnız kimliğe göre bulur,
   bulunamayan kontrolde **o satırda** düşer (`control not on the page: …`),
   ve dil değiştirip kimliklerin sağ kaldığını ayrıca doğrular.

## 4. Codex için kural

Yeni bir kontrol eklerken sıra şudur:

1. `docs/specs/CONTROLS.md`'den davranışı (pasiflik, onay, hata) al.
2. Bu defterden kimliği al. **Defterde yoksa kimliği uydurma** — satırı buraya
   ekle, `⏳`'yi `✅` yap, aynı commit'te koda geç.
3. Kontrolü `testid` ile kur; metni `t()` ile ver, üç dilde birden.
4. `npm run audit` ve `npm test` yeşil olmadan commit etme.
