# Claude Planı — Tasarım, Sözleşme ve Denetim

> **Tarih:** 5 Eylül 2026 · **Branch:** `fix/backend-data-auth-hardening`
> **Eşlik eden belge:** `docs/plans/CODEX-PLAN-2026-09-05.md`
> **Referanslar:** `MUSIC-ARCHIVE-BRIEF.md` (üstün belge), `Music-Archive-Denetim-ve-Yol-Haritasi.md`,
> `docs/reports/MIDI_STUDIO_2026-09-05.md`, `_dev_journal/Olabilecek_fikirler.md`

---

## Durum — 6 Eylül 2026

**Claude tarafı tamamlandı.** Bütün spec'ler `docs/specs/` altında yazıldı;
Codex'in başlaması için bekleyen bir karar kalmadı.

| Kalem | Dosya | Durum |
|---|---|---|
| C1 Token envanteri | `docs/specs/DESIGN-TOKENS.md` | ✅ ölçüldü, dönüşüm tablosu hazır |
| C2 Dört durum matrisi | `docs/specs/SCREEN-STATES.md` | ✅ 10 rota × 5 durum, 41 dolu hücre |
| C3 Üç dilli sözlük | `docs/specs/I18N-STUDIO.md` | ✅ 287 anahtar × tr/en/ku, JSON doğrulandı |
| C4 API sözleşmeleri | `docs/specs/API-CONTRACTS.md` | ✅ 12 uç, hata kodları, test zorunlulukları |
| C5 Veri modeli | `docs/specs/DATA-MODEL.md` | ✅ 5 koleksiyon, indeksler, göç notu |
| C6 Ölçüm dürüstlüğü | `docs/specs/MIDI-METRICS.md` | ✅ formüller, eşikler, golden dosyalar |
| C7 Kontrol envanteri | `docs/specs/CONTROLS.md` | ✅ ~70 kontrol, pasiflik koşullarıyla |
| C8 Performans harness'ı | `docs/specs/PERF-HARNESS.md` | ✅ P1–P6 ölçüm yöntemleri |
| C10 Karar kayıtları | `docs/specs/DECISIONS.md` | ✅ KR-1…KR-7 kapandı |
| C9 Sprint denetimi | `docs/reviews/TEMPLATE.md` + `npm run audit` | ✅ altyapı hazır, denetim Codex bitirince |
| Sprint 2 hazırlığı | `docs/specs/SPRINT2-VERIFICATION.md`, `test/perf/seed-recordings.mjs` | ✅ doğrulama yöntemleri + tohumlama |

**Kapanan kararlar** (proje sahibi onayıyla, §6'daki önerilerin tamamı):
KR-1 kendi örnek çalıcımız · KR-2 varsayılan arşivleme · KR-3 mood'u kullanıcı
atar · KR-4 5 yıldız kalır · KR-5 fiziksel koleksiyon = etiket · KR-6 mikrofon
bu turda yok · KR-7 `design-tokens.json` tek kaynak.

**Sırada:** Codex, `docs/plans/CODEX-PLAN-2026-09-05.md` Sprint 1'den başlar.

---

## 0. İş bölümü — neden iki plan

Codex'in iyi olduğu şey: net sözleşmesi olan işi hızlı ve doğru yazmak.
Codex'in kötü olduğu şey: ürün kararı vermek, "bu metin üç dilde ne olmalı",
"bu metrik hangi koşulda hesaplanmaz", "bu buton ne zaman pasif" gibi soruları
tutarlı cevaplamak. Brifin 1. maddesi (**ölü buton yok**) ve 8. maddesi
(**uydurma veri yok**) tam olarak bu ikinci kümede kırılır.

Bu yüzden:

| Claude (bu plan) | Codex (diğer plan) |
|---|---|
| Ekran, buton, metin, durum ve metrik **sözleşmesini** yazar | Sözleşmeyi **kodlar** |
| API şeklini, doğrulama kurallarını, hata kodlarını belirler | Endpoint'i, modeli, testi yazar |
| Üç dilde metinleri üretir | `js/locales/*.json` içine yerleştirir, `t()` ile bağlar |
| Her sprint sonunda **denetler**, dürüstlük kontrolü yapar | Denetim bulgularını kapatır |
| Ölçüm harness'ını tasarlar | Harness'ı çalıştırır, sonucu raporlar |

**Kural:** Codex, spec dosyası yazılmamış bir ticket'a başlamaz. Spec yoksa Codex
kendi kararını verir ve bu kararlar tutarsız çıkar — geçmişte tam olarak bu oldu
(`js/models`, `js/adapters` gibi terk edilmiş soyutlamalar).

---

## 1. Bu turda ne yapılıyor, ne yapılmıyor

Brif "bir fazı bitirmeden diğerine geçme" diyor. Şu anki gerçek durum:

- **Faz 0** — doğrulandı, kapalı.
- **Faz 1** — kısmi. Eski ekranlarda elle yazılmış renk/px var, stüdyo ekranları
  yalnız Türkçe, dört durum her ekranda yok. **Bu turda kapanacak.**
- **Faz 2** — deneysel. Gerçek donanım kabulü **sende** (bkz. §7). Örnek tabanlı
  piyano sesi KR-1'e bağlandı: yeni bağımlılık yok, kendi çalıcımız, Sprint 3 sonu.
- **Faz 3** — ilk MIDI kalıcılık akışı hazır; metronom, count-in, A–B döngüsü,
  zaman işaretli not, kayıt düzenleme/silme eksik. **Bu turda kapanacak.**
- **Faz 6** — ilk dilim açılacak: eser detayı, denemeleri karşılaştırma.
- **Faz 7** — arşiv tarafı yeni butonlar. Stüdyo tarafı kapandıktan **sonra**.
- **Faz 4 (mikrofon), Faz 5 (analiz motoru), Faz 8** — bu turda **açılmıyor**.
  Sebep: Faz 3 bitmeden Faz 4'e girmek brifin ana kuralını çiğner ve mikrofon
  yolu tek başına bir tur büyüklüğünde iş.

**Bu turda kasıtlı olarak yapılmayacaklar** (fikirler dosyasında var, ama şimdi değil):

- Rozet/başarım sistemi — brif "gerekçesiz başarı puanı üretme" diyor; gamification
  bunu ihlal etmeye çok yakın. Önce ölçülebilir metrikler otursun.
- Mood takvimi Spotify `audio-features` üzerinden — o endpoint'in güncel erişim
  durumu doğrulanmadan planlanamaz (bkz. §6, KR-3).
- Sosyal özellikler, paylaşım, poster export.
- Spotify'a playlist aktarımı — yazma yetkisi ayrı OAuth kapsamı ister.

---

## 2. Bulgular — planın dayandığı ölçümler

Kod okunarak doğrulandı, tahmin değil:

| # | Bulgu | Kanıt | Sonuç |
|---|---|---|---|
| B1 | Kayıt **silinemiyor, düzenlenemiyor** | `server/studio.js` yalnız `POST/GET /api/recordings`, `GET/POST /api/pieces` | Yanlış başlıkla kaydeden kullanıcı çaresiz. En yüksek öncelikli eksik. |
| B2 | Eser **silinemiyor, düzenlenemiyor** | aynı dosya, `PATCH`/`DELETE` yok | Aynı sorun. |
| B3 | Arşivde **mood sütunu her zaman boş** | `LibraryView.js:157` mood'u gösteriyor; `js/` içinde mood **yazan** tek satır yok | Brif md.1 ihlali: veri girişi olmayan görünen alan. |
| B4 | Etiket sistemi yok | `likeSchema` alanları: `mood`, `userNote`, `source` — `tags` yok | Fikirler dosyasındaki #vinyl-owned, #concert-seen için şema değişikliği şart. |
| B5 | Arşivde filtre/sıralama yok | `LibraryView.js` içinde `filter`/`sort` yok | 500+ kayıt hedefi (Faz 7 kabul) bu haliyle karşılanamaz. |
| B6 | İstatistik yüzeyi zayıf | `/api/library/stats` yalnız 7 sayaç döner; tür/yıl verisi hiç saklanmıyor | Tür/yıl grafiği **veri olmadan** çizilemez — önce zenginleştirme, sonra grafik. |
| B7 | Stüdyo ekranları tek dilde | `StudioView/RecordingsView/PiecesView` içinde gömülü Türkçe metin; `js/locales/*.json` 214 anahtar, `studio.*` ad alanı yok | Faz 1 kabulü buradan kırılıyor. |
| B8 | Piano roll yalnız canlı son 8 sn | `PianoCanvas.js`, `studio.css --roll-height` | Kayıt sonrası tam görünüm yok; karşılaştırma için gerekli. |
| B9 | Oynatıcıda A–B, hız, not yok | `RecordingPlayer.js`: seek + duraklat/durdur var | Faz 3 kalan kalemleri. |
| B10 | Dışa aktarma kısmi | `Export.js`: CSV + istatistik JSON; not/puan/etiket/kayıt yok, içe aktarma hiç yok | Faz 7 "arşivin içe ve dışa aktarımı" karşılanmıyor. |

---

## 3. Claude iş kalemleri

Her kalem bir **spec dosyası** üretir. Codex bu dosyaları girdi alır.
Spec dosyaları `docs/specs/` altında toplanır.

### C1 — Tasarım token envanteri ve dönüşüm haritası
**Çıktı:** `docs/specs/DESIGN-TOKENS.md`
- `js/styles.css` (1.791 satır) ve `js/studio.css` (78 satır) taranır; elle yazılmış
  her hex/rgb/px değeri listelenir, karşılık gelen token'a eşlenir.
- Token'ı olmayan değerler için yeni token önerilir (ad, değer, koyu/açık karşılığı).
- `design-tokens.json` ile CSS değişkenleri arasındaki **tek kaynak** kararı yazılır.
- Kalıcı istisna listesi: canvas çizim renkleri (`--key-white`, `--key-black`) ve
  1px kenarlıklar gibi token'lanması anlamsız olanlar gerekçeyle işaretlenir.
**Kabul:** Codex bu tabloyu satır satır uygulayabilir; hiçbir satır "karar ver" demez.

### C2 — Dört durum matrisi
**Çıktı:** `docs/specs/SCREEN-STATES.md`
- Rota × durum matrisi: `dashboard, search, library, dig, studio, recordings, pieces,
  pieces/:id, stats, diary` × `yükleniyor / boş / hata+tekrar dene / izin reddedildi / oturumsuz`.
- Her hücre için: hangi bileşen, hangi metin anahtarı, hangi eylem düğmesi, düğme nereye gider.
- Ortak bileşen API'si tasarlanır: `states.loading(...)`, `states.empty(...)`,
  `states.error(err, retry)`, `states.denied(...)`, `states.signedOut(...)`.
**Kabul:** Matriste boş hücre yok; "bu ekranda izin durumu olamaz" yazan hücreler gerekçeli.

### C3 — Üç dilli metin sözlüğü
**Çıktı:** `docs/specs/I18N-STUDIO.md` + hazır JSON parçaları (tr/en/ku)
- `studio.*`, `recordings.*`, `pieces.*`, `metronome.*`, `metrics.*`, `states.*`,
  `tags.*`, `stats.*`, `diary.*` ad alanları.
- Kürtçe (ku) metinler mevcut `ku.json` üslubuyla tutarlı üretilir; makine çevirisi
  gibi duran ifadeler düzeltilir. Çevirisinden emin olunmayan terim işaretlenir,
  uydurulmaz.
- Terim sözlüğü sabitlenir: recording=kayıt/deneme, take=deneme, piece=eser,
  metronome=metronom, count-in=giriş sayımı, sustain=pedal.
**Kabul:** Codex tek bir Türkçe dizeyi koda gömmek zorunda kalmaz.

### C4 — API sözleşmeleri
**Çıktı:** `docs/specs/API-CONTRACTS.md`
Aşağıdakilerin her biri için istek gövdesi, doğrulama kuralı, başarılı yanıt,
hata kodları (400/401/403/404/409/413/503) ve idempotency davranışı yazılır:
- `PATCH /api/recordings/:id` — başlık, açıklama, etiket, eser bağı (olaylar **değişmez**)
- `DELETE /api/recordings/:id`
- `GET /api/recordings` — `?pieceId=&tag=&q=&sort=&offset=` filtreleri
- `POST /api/recordings/:id/notes` · `DELETE /api/recordings/:id/notes/:noteId` (zaman işaretli not)
- `GET/PATCH/DELETE /api/pieces/:id` — silmede bağlı kayıtların davranışı
- `PUT /api/library/track/:trackId/tags` · `PUT /api/library/track/:trackId/mood`
- `GET /api/library/tracks` — `?tag=&mood=&minRating=&from=&to=&sort=`
- `GET /api/library/diary?from=&to=` — beğeni + puan + kayıt olaylarının birleşimi
- `GET /api/library/stats` genişletmesi — yalnız **elde var olan** alanlar
- `GET /api/library/export` · `POST /api/library/import` (doğrulama ve çakışma politikası)
**Kabul:** Codex hiçbir endpoint için "hangi hata kodu" diye sormaz.

### C5 — Veri modeli ve göç notu
**Çıktı:** `docs/specs/DATA-MODEL.md`
- `Like.tags: [String]` (en fazla 20, her biri ≤ 40 karakter, küçük harfe normalize,
  benzersiz), `Like.mood` için kapalı liste mi serbest metin mi kararı.
- `Recording.notes: [{ id, atMs, text, createdAt }]` — üst sınırlar.
- `Piece` üzerinde `updatedAt`, `archived` alanı; silme yerine arşivleme kararı.
- Yeni indeksler ve **neden** gerektiği; mevcut indekslerle çakışma kontrolü.
- Geriye dönük uyumluluk: alan yokken okuyan eski kayıtlar, mobil istemcinin
  gördüğü yanıt şekli bozulmuyor mu.
- Sahiplik kuralı tekrarı: her yeni uçta `userId` **token'dan**, istemciden asla.
**Kabul:** Codex şema satırlarını kopyalayıp yazabilir; indeks kararı ona bırakılmaz.

### C6 — MIDI metrik dürüstlük kuralları
**Çıktı:** `docs/specs/MIDI-METRICS.md`
Brif §5: her sonuç **değer + güven + geçerlilik koşulu** ile gelir. Bu dosya
her metrik için formülü ve hesaplanmama koşulunu yazar:

| Metrik | Formül kaynağı | Hesaplanmama koşulu |
|---|---|---|
| Süre, etkin çalma süresi | olay zaman damgaları | — |
| Nota sayısı, polifoni tepe değeri | note-on sayımı | — |
| Kullanılan aralık (en pes–en tiz) | nota numaraları | < 3 nota |
| Velocity dağılımı | histogram | < 10 nota |
| Nota süreleri dağılımı | on/off eşleme | eşleşmeyen off oranı > %5 |
| Tempo tahmini | inter-onset aralık histogramı | güven < eşik → "tahmin edilemedi" |
| Zamanlama sapması | tahmini ızgaraya göre ortalama mutlak sapma | tempo tahmini yoksa **üretilmez** |

- **Yasak:** referans dosya olmadan "doğruluk", "başarı puanı", "yanlış çaldın".
- Karşılaştırmada yalnız iki denemenin ölçülen değerleri yan yana konur; hangisinin
  "daha iyi" olduğu **yazılmaz**.
- Metrik sürümü (`metricsVersion`) saklanır ve yeniden hesaplanabilir.
**Kabul:** Codex formülü yorumlamak zorunda kalmaz; eşik değerleri sayı olarak yazılıdır.

### C7 — Yeni kontrol (buton) envanteri
**Çıktı:** `docs/specs/CONTROLS.md`
Senin asıl istediğin madde bu. Eklenecek **her** kontrol için tek satır:
konum · etiket (tr/en/ku) · tip · pasiflik koşulu · onay gerekiyor mu · klavye
kısayolu · dokunma hedefi · hangi API'yi çağırır · başarısızlıkta ne yazar.

Planlanan kontroller (Codex planındaki ticket'larla eşleşir):

**Stüdyo:** Metronom aç/kapa · BPM −/+ · Tap tempo · Ölçü seçimi · Vurgu aç/kapa ·
Metronom seviyesi · Giriş sayımı (0/1/2 ölçü) · Duraklat/Devam · Takılı notaları bırak (var) ·
Tam ekran (var)
**Kayıtlarım:** Ara · Esere göre filtrele · Etikete göre filtrele · Sırala ·
Düzenle · Sil (onaylı) · Yerel taslağı sil (onaylı) · A–B döngüsü kur/temizle ·
Oynatma hızı · Bu ana not ekle · Notu sil · Denemeleri karşılaştır · Metrikleri hesapla
**Çalışmalarım:** Eseri aç · Eseri düzenle · Eseri arşivle/sil · Denemeleri listele
**Arşivim:** Etiket ekle/kaldır · Mood ata (B3'ü kapatır) · Not yaz/düzenle ·
Filtre çubuğu (puan/mood/etiket/tarih) · Sıralama · Filtreyi temizle ·
Tam yedek indir · Yedekten geri yükle · İstatistikler · Günlük
**Kabul:** Listede pasiflik koşulu boş olan kontrol yok. Onay gerektiren her
yıkıcı eylemin onay metni üç dilde yazılı.

### C8 — Ölçüm harness'ı tasarımı
**Çıktı:** `docs/specs/PERF-HARNESS.md`
Brif §7 bütçesi hâlâ ölçülmedi. Ölçüm yöntemi yazılır:
- Tuş → ekran gecikmesi: `performance.now()` damgası MIDI olayında ve ilk çizim
  karesinde; 1.000 örnek, p50/p95 raporlanır. Sentetik giriş **cihaz testi değildir**,
  raporda böyle etiketlenir.
- 500 kayıtlık liste ilk boya < 300 ms: tohumlanmış yerel veritabanıyla ölçüm.
- 10 dakika stüdyo açık → bellek büyümesi (`performance.memory` yerine heap snapshot adımı).
- 10 sesli akorda nota kaçmıyor: `test/midi.test.js` zaten kapsıyor, gerçek cihaz kabulü ayrı.
**Kabul:** Sonuçlar sayı olarak rapora girer; "hızlı hissettiriyor" kabul edilmez.

### C9 — Sprint denetimi (her sprint sonunda)
**Çıktı:** `docs/reviews/SPRINT-N-REVIEW.md`
Denetim listesi:
1. Ekrandaki her yeni kontrol gerçekten çalışıyor mu (elle tıklanarak).
2. Dört durum var mı; hata durumunda **tekrar dene** gerçekten tekrar deniyor mu.
3. Uydurma veri, mock, örnek kayıt var mı.
4. Üç dil tam mı; koda gömülü dize kaldı mı (`grep` ile).
5. Sunucu tarafı sahiplik: ikinci hesapla 404 alınıyor mu.
6. Yeni bağımlılık eklendi mi; eklendiyse gerekçesi yazıldı mı.
7. `npm run check` yeşil mi; yeni ticket'ın regresyon testi var mı.
8. Konsolda kırmızı hata birikiyor mu; rota değişince MIDI/Audio kaynakları kapanıyor mu.
9. Yıkıcı eylemler onaylı mı; yanlışlıkla silme mümkün mü.
10. Rapor iddiaları kanıtlı mı (test çıktısı / ekran görüntüsü / curl).

### C10 — Karar kayıtları
**Çıktı:** `docs/specs/DECISIONS.md` — bkz. §6.

---

## 4. Çalışma döngüsü

```
Claude: sprint spec'lerini yazar  →  docs/specs/*.md
   ↓
Codex:  ticket'ları sırayla uygular, her ticket ayrı commit, npm run check yeşil
   ↓
Claude: denetler  →  docs/reviews/SPRINT-N-REVIEW.md  (bulgu listesi)
   ↓
Codex:  bulguları kapatır
   ↓
Sen:    cihaz testi + gözle kabul  →  sonraki sprint
```

**Sprint başlamadan hazır olması gereken spec'ler:**

| Sprint | Gerekli spec | Hazır mı |
|---|---|---|
| 1 — Faz 1'i kapat | C1, C2, C3 | ✅ |
| 2 — Faz 3'ü kapat | C4 §3–6, C5 §1, C7 §1–6 | ✅ |
| 3 — Faz 6 ilk dilim | C4 §7, C6, C8 | ✅ |
| 4 — Faz 7 arşiv | C4 §8–9, C5 §3–4, C7 §9–11 | ✅ |

---

## 5. Sınırlar — Claude neyi yapmaz

- Cihaz testi uydurmaz. Gerçek piyanoyla 30 dakika, hot-plug ve 10 sesli akor
  kabulü **senin** raporuna bağlıdır; otomatik test bunun yerine geçmez.
- Spotify'ın güncel API yeteneklerini ezberden yazmaz; `audio-features` gibi
  erişimi değişmiş olabilecek uçlar canlı doğrulanmadan plana alınmaz.
- Çalışan bir özelliği "daha temiz olur" diye yeniden yazdırmaz. `js/models`,
  `js/adapters` gibi eski soyutlamalar bu turda da silinmiyor — ayrı ve ölçülü bir iş.
- Mobil istemciye dokunmaz (`mobile/` kapsam dışı).

---

## 6. Kararlar — **hepsi kapandı**, ayrıntısı `docs/specs/DECISIONS.md`

| # | Karar | Seçenekler | Sonuç (onaylandı) |
|---|---|---|---|
| KR-1 | Örnek tabanlı piyano sesi | (a) sentetik kalsın (b) küçük örnek seti + kendi çalıcımız (c) Tone.js + örnek kütüphanesi | **(b)** — tek bağımlılık eklemeden, birkaç MB örnekle. (c) brifin "bağımlılık gerekçesi" kuralını zorlaştırır ve ~1 MB+ kütüphane getirir. Karar senin. |
| KR-2 | Eser silme davranışı | (a) bağlı kayıt varsa 409 (b) kayıtları serbest bırak (c) arşivle, silme | **(c) + (a)** — arşivle varsayılan, gerçek silme yalnız bağlı kayıt yoksa. |
| KR-3 | Mood kaynağı | (a) kullanıcı elle atar (b) Spotify `audio-features` | **(a)** — B3'teki ölü sütunu bugün kapatır ve dış API erişimine bağlı değildir. (b) ancak canlı doğrulamadan sonra. |
| KR-4 | Puan sistemi | 5 yıldız (0,5 adım — mevcut) mi, 10 puan mı | **Mevcut kalsın.** Değişim tüm geçmiş puanların göçünü gerektirir, kazancı yok. |
| KR-5 | Fiziksel koleksiyon (vinyl/CD) | ayrı alan mı, etiket mi | **Etiket** — `Like.tags` ile bedava gelir, şema büyütmez. |
| KR-6 | Ses kaydı (Faz 4) | bu turda başlanmaz | Faz 3 kabulünden sonra ayrı tur. |

---

## 7. Sana düşen — bunlar olmadan Faz 2 kapanmaz

`docs/reports/MIDI_STUDIO_2026-09-05.md` sonundaki 6 adım hâlâ geçerli. Kısaca:
gerçek piyanoyla 30 dakika kesintisiz, çalarken USB çıkar-tak, 10 sesli akor,
sustain pedalı, kaydet → yenile → çıkış/giriş → dinle. Sonuç olarak bana şunu bildir:
cihaz modeli, işletim sistemi, tarayıcı sürümü, hissedilen gecikme, takılı kalan
nota olup olmadığı, hangi adımda ne oldu.

§6'daki kararların hepsi kapandı; başka bir onay beklenmiyor.
