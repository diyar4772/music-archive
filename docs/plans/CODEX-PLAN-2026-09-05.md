# Codex Planı — Uygulama

> **Tarih:** 5 Eylül 2026 · **Branch:** `fix/backend-data-auth-hardening`
> **Bu plan tek başına yeterli değildir.** Her ticket'ın sözleşmesi
> `docs/specs/` altındaki spec dosyasındadır; spec yoksa ticket'a başlama.
> **Üstün belge:** `MUSIC-ARCHIVE-BRIEF.md`. Çelişki olursa brif kazanır.

---

## 0. BAŞLAMADAN ÖNCE — spec'ler hazır

Bütün sözleşmeler yazıldı (6 Eylül 2026). Sıradaki adım **kod yazmak**;
başka bir karar veya onay beklenmiyor.

| Spec | Ne verir | Hangi ticket |
|---|---|---|
| `docs/specs/DECISIONS.md` | Kapalı kararlar KR-1…KR-7 | hepsi |
| `docs/specs/DESIGN-TOKENS.md` | Token listesi + satır satır dönüşüm tablosu | K1.1 |
| `docs/specs/SCREEN-STATES.md` | 10 rota × 5 durum matrisi, `States.js` API'si | K1.3 |
| `docs/specs/I18N-STUDIO.md` | 287 anahtar × tr/en/ku, kopyalanmaya hazır JSON | K1.2 |
| `docs/specs/API-CONTRACTS.md` | 12 uç: gövde, doğrulama, hata kodu, test listesi | K2.1–K4.7 |
| `docs/specs/DATA-MODEL.md` | Yeni alanlar, indeksler, göç riskleri | K2.1–K4.7 |
| `docs/specs/MIDI-METRICS.md` | Formüller, eşikler, golden dosyalar | K3.3–K3.4 |
| `docs/specs/CONTROLS.md` | ~70 kontrol: pasiflik, onay, klavye, hata | K2.x–K4.x |
| `docs/specs/PERF-HARNESS.md` | P1–P6 ölçüm yöntemleri | K2.5, K2.6, K3.3 |
| `docs/specs/SPRINT2-VERIFICATION.md` | Sprint 2 doğrulama prosedürleri + K1.5 | K1.5, K2.1–K2.6 |
| `docs/specs/TESTIDS.md` | 138 kontrolün `data-testid` kayıt defteri (✅ var / ⏳ planlı) | hepsi |
| `test/perf/seed-recordings.mjs` | 500 kayıtlık tohumlama (hazır, çalışıyor) | K2.5 |
| `scripts/audit.mjs` → `npm run audit` | Mekanik kabul kriteri sayacı | hepsi |

**Spec'te olmayan bir şeye ihtiyaç duyarsan uydurma — sor.** Eksik anahtar,
eksik hata kodu, eksik eşik: hepsi bir spec boşluğudur, bir tasarım fırsatı değil.

**⚠️ İlk okunacak üç tehlikeli ayrıntı:**
1. `DESIGN-TOKENS.md` §2 — `--space-4` eski şemada 16px, yenisinde 4px.
   Yarım dönüşüm sessizce yanlış boşluk üretir.
2. `DATA-MODEL.md` §2 — `Piece.archived` sorgusu `{ $ne: true }` olmalı,
   `{ archived: false }` eski belgeleri kaybettirir.
3. `DATA-MODEL.md` §1 — bir koleksiyonda tek text index olabilir; baştan
   bileşik kurulmazsa sonradan eklenemez.

---

## 1. ROLÜN

Bu turda **restorasyon değil, yapım** işi yapıyorsun. Faz 0 kapandı, Faz 1
kısmi, Faz 3'ün ilk dilimi çalışıyor. Senin işin: Faz 1'i kapatmak, Faz 3'ü
tamamlamak, Faz 6'nın ilk dilimini ve Faz 7'nin arşiv yüzeyini açmak.

Kod tabanı: Node 22 / Express 4 / Mongoose 8 / derlemesiz vanilla ESM frontend.
**Derleme adımı yok.** `npm run build` diye bir şey yaratma.

---

## 2. DEĞİŞMEZ KURALLAR

İhlal edersen iş reddedilir.

1. **`npm run check` her commit'ten önce yeşil.** Lint + testler. Kırıksa dur, düzelt.
   Ek olarak **`npm run audit`** spec'lerin ölçülebilir kabul kriterlerini sayar
   (token dışı renk, inline px, eksik çeviri anahtarı, gömülü Türkçe dize, ölü
   işleyici, `console.log`). Teslimden önce çalıştır; sayılar taban değerin
   altına inmeli, üstüne çıkmamalı. Bu betik denetimin **yerine geçmez**,
   sadece mekanik kısmını otomatikleştirir.
2. **Mevcut güvenlik sertleştirmelerini geri alma.** `requireSecret()`, fail-closed
   mock auth, production'da MongoDB fail-fast, CORS allowlist, rate limit — bilinçli.
3. **Sahiplik sunucuda.** Her yeni uçta `userId` token'dan gelir. İstemciden gelen
   `userId`, `state`, dosya yolu asla kabul edilmez. Başkasının kaydına erişim **404**.
4. **`mobile/` klasörüne dokunma.** Kapsam dışı.
5. **Koda Türkçe (veya herhangi bir dilde) dize gömme.** Her kullanıcı metni
   `t()` üzerinden ve **tr/en/ku üçünde birden** var olacak. Eksik dil = bitmemiş ticket.
6. **Elle renk/px yazma.** Her değer token. İstisnalar `docs/specs/DESIGN-TOKENS.md`'de yazılı.
7. **Dört durum zorunlu.** Yeni her ekran/liste: yükleniyor · boş · hata(+tekrar dene) ·
   izin/oturum. Spec: `docs/specs/SCREEN-STATES.md`.
8. **Ölü buton yok.** Ekrana koyduğun her kontrol gerçek bir iş yapar veya
   ekrana hiç gelmez. "Yakında" etiketi ancak brifin md.6'sına uygun, açık yazıldığında.
9. **Uydurma veri yok.** Mock kayıt, örnek eser, demo şarkı, sahte istatistik yok.
   Veri yoksa boş durum gösterilir.
10. **Referanssız başarı puanı yok.** `docs/specs/MIDI-METRICS.md` dışında metrik üretme.
11. **Yıkıcı eylem onaysız çalışmaz.** Silme = onay adımı + geri bildirim.
12. **Bağımlılık eklemeden önce gerekçe yaz.** Tercih: sıfır yeni bağımlılık.
13. **Her ticket ayrı commit.** Tek dev commit yok. Commit mesajı ne yaptığını söyler.
14. **Tahmin ettiğini "düzelttim" diye raporlama.** Her iddia test / curl / ekran görüntüsü.
15. **Kaynak temizliği.** Rota değişince AudioContext, MIDI portu, worker, interval kapanır.

---

## 3. SPRINT 1 — Faz 1'i kapat (tasarım sistemi + dil)

**Gerekli spec:** C1 (`DESIGN-TOKENS.md`), C2 (`SCREEN-STATES.md`), C3 (`I18N-STUDIO.md`)

### K1.1 — Token dönüşümü
`js/styles.css` ve `js/studio.css` içindeki elle yazılmış hex/rgb/px değerleri
spec tablosuna göre token'a taşı. `DashboardView.js` içindeki gömülü `style="..."`
dizeleri (ör. satır ~104, ~117) sınıfa dönüşür.
**Kabul:** `grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(' js/*.css js/**/*.js` çıktısında
yalnız spec'te istisna işaretli satırlar kalır. Görsel regresyon: koyu ve açık
temada ana ekranların önce/sonra ekran görüntüsü.

### K1.2 — Stüdyo ekranlarını üç dile taşı
`studio.*`, `recordings.*`, `pieces.*` ad alanlarını `js/locales/{tr,en,ku}.json`
içine ekle (metinler C3 spec'inde hazır). `StudioView.js`, `RecordingsView.js`,
`PiecesView.js`, `js/studio/ui.js` içindeki gömülü dizeleri `t()` ile değiştir.
Canvas'a çizilen etiketler (nota adları, solfej) de dile bağlanır.
**Kabul:** Dil değiştirince stüdyo ekranı tamamen değişir. Üç locale dosyası
**aynı anahtar kümesine** sahiptir — bunu doğrulayan bir test ekle (`test/i18n.test.js`).

### K1.3 — Ortak durum bileşenleri
`js/components/States.js`: `loading()`, `empty()`, `error(err, retry)`,
`denied()`, `signedOut()`. C2 matrisindeki her hücreyi bu bileşenlerle doldur.
Mevcut ad-hoc `notice(...)` kullanımları buna taşınır.
**Kabul:** Matristeki her rota-durum kombinasyonu elle tetiklenebiliyor ve
doğru ekranı veriyor. Hata durumundaki "tekrar dene" gerçekten yeniden istek atıyor.

### K1.4 — Erişilebilirlik geçişi
Görünür odak halkası, dokunma hedefi ≥ 44px, kontrast AA, klavye ile tam gezinme,
navbar'ın telefonda kullanılabilir hali, canvas'ların ekran okuyucu karşılığı.
**Kabul:** Klavyeyle her ekranın her kontrolüne ulaşılıyor; odak görünür;
375px genişlikte stüdyo kullanılabiliyor.

### K1.5 — Test seçicilerini dilden ayır ✅ **KAPANDI (Claude, 6 Eylül 2026)**
Bu ticket Codex'e kalmadı; Sprint 2'nin ön koşulu olduğu için Claude kapattı.
Yapılanlar: 138 kontrole `data-testid` verildi, `el()` bir `testid` seçeneği
aldı, `js/studio/ui.js` yardımcıları kimliği **zorunlu ilk argüman** olarak
istiyor, tarayıcı testi kimliğe göre seçiyor ve beklenen metinleri
`js/locales/*.json` üzerinden okuyor.
**Kayıt defteri:** `docs/specs/TESTIDS.md` — yeni kontrolün kimliği oradan alınır.
**Koruma:** `npm run audit` → "Kimliksiz kontrol" = 0 · `test/testids.test.js` (5 test).
**Rapor:** `docs/reports/K1.5_TESTIDS_2026-09-06.md`.

**Sprint 1 durumu:** K1.1–K1.5 kapandı. Kalan tek kalem C9 denetimi
(`npm run test:browser`, yerel MongoDB + Chrome ile — bkz. §0 handoff notu).

**Sprint 1 bitiş şartı:** `npm run check` yeşil · `npm run audit` taban altında ·
üç dilde tam · token dışı değer yok · dört durum matrisi dolu ·
`npm run test:browser` geçiyor · Claude denetimi (C9) bulgusuz kapandı.

---

## 4. SPRINT 2 — Faz 3'ü kapat (stüdyo kayıt araçları)

**Gerekli spec:** C4 (kayıt uçları), C5, C7 (stüdyo + kayıtlar bölümü)
**Doğrulama yöntemleri:** `docs/specs/SPRINT2-VERIFICATION.md` — bu sprintin
kabul kriterleri sayı içeriyor ("sapma < 10 ms", "10 kez üst üste"); ölçümün
nasıl yapılacağı orada tanımlı. Kendi ölçüm yöntemini uydurma.
**Tohumlama hazır:** `test/perf/seed-recordings.mjs` (500 kayıt, ~1,7M olay).
Bu sprint kullanıcının istediği **yeni butonların çoğunu** getirir.

### K2.1 — Kayıt yönetimi (EN ÖNCELİKLİ — bugün kayıt silinemiyor)
Sunucu: `PATCH /api/recordings/:id` (başlık, açıklama, etiket, `pieceId`;
MIDI olayları **değiştirilemez**), `DELETE /api/recordings/:id`.
İstemci: Kayıtlarım satırında **Düzenle** ve **Sil** (onaylı); yerel taslak için
**Taslağı sil** (onaylı).
**Test:** sahiplik (ikinci hesap → 404), olay değiştirme denemesi → 400,
silinen kaydın listeden ve detaydan kalkması, yerel taslağın IndexedDB'den silinmesi.

### K2.2 — Metronom + giriş sayımı
`js/studio/Metronome.js` — Web Audio, ana thread'de zamanlayıcı değil,
`AudioContext.currentTime` üzerinden ileri planlama (scheduler penceresi ≥ 100 ms).
Kontroller: aç/kapa · BPM 30–240 (−/+ ve sayı girişi) · **Tap tempo** ·
ölçü 2/4, 3/4, 4/4, 6/8 · vurgu aç/kapa · seviye · giriş sayımı 0/1/2 ölçü.
Kayıt "Başlat"a basıldığında giriş sayımı seçiliyse önce sayım çalar, kayıt
sayım bittiğinde başlar; sayım süresi kayda dahil edilmez.
**Kabul:** 120 BPM'de 5 dakika boyunca sapma < 10 ms (ölçülüp raporlanır).
Stüdyodan çıkınca AudioContext kapanır. MIDI kaydı metronomdan etkilenmez.

### K2.3 — Oynatıcı: A–B döngüsü, hız, kısayollar
`RecordingPlayer.js`: A noktası koy · B noktası koy · döngüyü temizle ·
oynatma hızı 0,5× / 0,75× / 1× / 1,25× / 1,5× (perde MIDI olduğu için doğal olarak korunur —
bunu arayüzde belirt) · boşluk = oynat/duraklat · sol/sağ ok = ±5 sn.
**Kabul:** A > B seçilirse otomatik takas; döngü sırasında takılı nota kalmaz;
hız değişimi sırasında nota kaçmaz.

### K2.4 — Zaman işaretli notlar
Sunucu: `POST /api/recordings/:id/notes`, `DELETE /api/recordings/:id/notes/:noteId`.
İstemci: oynatıcıda **Bu ana not ekle**; not listesi zaman sırasıyla; nota
tıklayınca o saniyeye atlar; notu sil (onaylı).
**Kabul:** Not sayısı ve uzunluğu sunucuda sınırlı; ikinci hesap 404; yenileme
sonrası notlar yerinde.

### K2.5 — Kayıtlarım: arama, filtre, sıralama, deneme grupları
`GET /api/recordings?q=&pieceId=&tag=&sort=` sunucu tarafı filtre (istemci
tarafında 500 kaydı süzme). Arayüzde arama kutusu, eser ve etiket filtresi,
sıralama (tarih / süre / başlık). Aynı `takeGroupId` denemeleri katlanabilir grup.
Filtre durumu URL'ye yazılır (geri tuşu ve paylaşılabilir bağlantı çalışır).
**Kabul:** 500 kayıt tohumlanmış veritabanında ilk boya < 300 ms (C8 harness'ıyla ölçülür).

### K2.6 — Kayıt sonrası tam piano roll
`PianoCanvas.js`'e kayıt görüntüleme kipi: tüm kaydın piano roll'u, yatay
kaydırma/yakınlaştırma, oynatma imleci, A–B bölgesi gölgesi.
**Kabul:** 60.000 olaylık kayıtta kaydırma 60 fps; çizim ana thread'i bloklamıyor.

**Sprint 2 bitiş şartı:** Brif Faz 3 kabulü — kaydet → yenile → çıkış → giriş →
kayıt yerinde ve oynuyor, **10 kez üst üste** (bu sefer gerçekten 10 tarayıcı döngüsü,
`test/browser/` senaryosuna eklenir) · ağ kesildiğinde kayıt kaybolmuyor ·
kayıt düzenlenebiliyor ve silinebiliyor.

---

## 5. SPRINT 3 — Faz 6 ilk dilim + dürüst MIDI metrikleri

**Gerekli spec:** C4 (eser uçları), C6 (`MIDI-METRICS.md`), C8 (`PERF-HARNESS.md`)

### K3.1 — Eser detay rotası
`#/pieces/:id` → `js/views/PieceDetailView.js`. Eser künyesi, kişisel not,
bağlı katalog şarkısı, o esere ait denemeler zaman sırasıyla, her denemeye
hızlı erişim. Butonlar: **Stüdyoda çalış** · **Eseri düzenle** · **Arşivle/Sil**
· **Denemeleri karşılaştır**.

### K3.2 — Eser yönetimi API
`GET/PATCH/DELETE /api/pieces/:id`. Silme davranışı C5/KR-2 kararına göre
(varsayılan: arşivle; bağlı kayıt varken gerçek silme 409).
**Test:** sahiplik, arşivlenen eserin stüdyo seçim listesinden düşmesi ama
eski kayıtların bağının kopmaması.

### K3.3 — MIDI metrikleri (worker'da)
`js/studio/metrics.worker.js` — C6'daki formüller birebir. Kayıt detayında
metrik kartı: her değerin yanında **güven** ve hesaplanamadıysa **neden**.
Ana thread bloklanmaz; ilerleme gösterilir; `metricsVersion` saklanır.
**Kabul:** Tempo/nota içeriği bilinen golden `.mid` dosyalarıyla doğrulama
(`test/fixtures/` altında), sapma raporlanır. Yetersiz veri senaryosu ekranda düzgün.

### K3.4 — İki denemeyi karşılaştırma
Aynı eserin iki denemesi seçilir; yan yana metrik tablosu + iki piano roll +
ortak zaman ekseni. **Hangisinin daha iyi olduğu yazılmaz**; yalnız ölçülen
değerler ve fark gösterilir.

### K3.5 — Çalışma oturumu sayacı (opsiyonel, sprint sonu kalırsa)
Stüdyoda geçen süre, o oturumda kaydedilen deneme sayısı, çalışılan eserler.
Sunucuda `sessions` koleksiyonu. Hedef/başarım **yok** — yalnız ölçülen gerçek.

**Sprint 3 bitiş şartı:** Brif Faz 6 kabulünün ilk yarısı — bir eseri açıp,
metronomla çalıp, kaydedip, önceki denemeyle karşılaştırmak tek akışta mümkün.
(Nota PDF'i eki bu sprintte yok, açıkça belirtilir.)

---

## 6. SPRINT 4 — Faz 7 arşiv yüzeyi

**Gerekli spec:** C4 (arşiv uçları), C5 (`Like.tags`), C7 (arşiv bölümü)

### K4.1 — Etiket sistemi
`Like.tags` alanı + indeks. `PUT /api/library/track/:trackId/tags`.
Arayüz: şarkı satırında/detayında etiket ekle-kaldır, etiket önerisi (kullanıcının
mevcut etiketlerinden), etikete tıklayınca o etiketle filtreleme.
Fiziksel koleksiyon (`plak`, `cd`), konser (`konserde-izledim`) bu sistemle karşılanır —
ayrı alan açma.

### K4.2 — Mood ataması (ölü sütunu kapatır)
`LibraryView` bugün mood sütununu gösteriyor ama mood'u **yazan hiçbir kontrol yok**.
`PUT /api/library/track/:trackId/mood` + arayüzde mood seçici (KR-3 kararına göre
kapalı liste veya serbest). Karar (a) ise Spotify `audio-features`'a bağımlılık yok.
**Kabul:** Sütun artık gerçek kullanıcı verisiyle doluyor; boşsa "mood atanmadı"
görünür ve tıklanabilir.

### K4.3 — Not / inceleme düzenleyici
`userNote` zaten şemada var. Düzgün düzenleyici: karakter sayacı, kaydet/iptal,
son güncelleme tarihi, "notlarım" listesi (notu olan tüm kayıtlar tek ekranda).

### K4.4 — Filtre ve sıralama çubuğu
`GET /api/library/tracks?tag=&mood=&minRating=&from=&to=&sort=` sunucu tarafı.
Arayüzde tek çubuk: puan · mood · etiket · tarih aralığı · sıralama · **Filtreyi temizle**.
Durum URL'ye yazılır.
**Kabul:** 500+ kayıtla liste ve arama akıcı (C8 ile ölçülür).

### K4.5 — İstatistik ekranı `#/stats`
**Yalnız elde gerçekten olan veriden**: puan dağılımı, zaman içinde ekleme
grafiği, en çok eklenen sanatçılar, mood dağılımı, etiket dağılımı, notlu kayıt
oranı, kayıt/deneme istatistikleri (stüdyo tarafı).
**Tür ve yıl grafiği bu ticket'ta YOK** — çünkü `Like` üzerinde tür/yıl alanı
saklanmıyor. İstenirse K4.5b ayrı ticket: mevcut `enrich-previews` desenini
tekrar kullanarak tür/çıkış yılını doldurma, **sonra** grafik.

### K4.6 — Günlük (Diary) görünümü
`GET /api/library/diary?from=&to=` — beğeni, puan ve **stüdyo kaydı** olaylarının
tarih ekseninde birleşimi. Arşiv ↔ stüdyo bağlantısının kullanıcıya göründüğü ekran budur.
Boş günler boş görünür; uydurma özet cümlesi üretilmez.

### K4.7 — Tam yedek: dışa ve içe aktarma
`GET /api/library/export` — beğeniler, puanlar, notlar, etiketler, listeler,
eserler ve kayıt üstverisi (MIDI olayları dahil, sürüm damgalı JSON).
`POST /api/library/import` — şema doğrulaması, boyut sınırı, çakışma politikası
(spec C4), kısmi başarısızlıkta ne olduğu raporlanır.
Mevcut CSV dışa aktarma korunur.
**Kabul:** Dışa aktar → boş hesaba içe aktar → veri birebir yerinde.

**Sprint 4 bitiş şartı:** Brif Faz 7 kabulü — 500+ kayıtla liste ve arama akıcı;
albüm ekleme akışı sürtünmesiz; istatistikler gerçek kullanıcı verisinden.

---

## 7. YAPMA LİSTESİ

- Mikrofon yolu (Faz 4), akor/tonalite tanıma (Faz 8), MusicXML, PDF export —
  **bu turda hiçbiri açılmıyor.**
- Rozet, başarım, streak, "seviye" — brifin "gerekçesiz puan üretme" kuralına yakın.
- Spotify'a playlist yazma — ayrı OAuth kapsamı, doğrulanmadan planlanamaz.
- `js/models`, `js/adapters` eski soyutlamalarını silme veya yeniden yazma.
- `panel-4772.html` dosya adını değiştirme.
- Aynı anda iki sprint'e girme.
- Ağır analizi API isteğinin içinde çalıştırma — worker veya kuyruk.
- Yeni bir frontend katmanı, framework, derleme adımı önerme.

---

## 8. TESLİM FORMATI

Her sprint sonunda `docs/reports/` altına rapor:

1. **Çalışan özellikler** — ve her biri nasıl doğrulandı (test adı / curl / ekran görüntüsü)
2. **Değişen dosyalar** — commit listesiyle
3. **Ölçüm sonuçları** — C8 harness'ının sayıları; ölçülemeyeni "ölçülemedi" yaz
4. **Doğrulanamayan iddialar** — spec'te yazıp uygulayamadıkların ve nedeni
5. **Kalan işler ve sıradaki sprint**
6. **Kullanıcıya düşen cihaz testleri** — adım adım, sonucu nasıl bildireceği dahil

`Music-Archive-Denetim-ve-Yol-Haritasi.md` içindeki "Güncel durum" bölümünü
her sprint sonunda güncelle.

---

## 9. BİTİŞ ŞARTLARI (tüm tur)

- `npm run check` yeşil; CI (lint + test + CRLF işi) yeşil.
- Faz 1 kabulü karşılandı: token dışı değer yok, dört durum tam, üç dil tam, AA.
- Faz 3 kabulü karşılandı: 10 ardışık tarayıcı döngüsü, ağ kesintisinde kayıp yok,
  kayıt düzenlenebilir ve silinebilir, metronom + count-in + A–B + zaman işaretli not çalışıyor.
- Faz 6 ilk dilimi: eser → metronom → kayıt → önceki denemeyle karşılaştırma tek akışta.
- Faz 7: filtre/sıralama/etiket/mood/not/istatistik/günlük/yedek çalışıyor, hepsi gerçek veriden.
- Ekranda ölü buton yok; hiçbir yerde uydurma veri yok.
- Faz 2 kabulü **kullanıcının cihaz raporuna** bağlı olarak açık kalır — otomatik
  testle kapatılmış sayılmaz.
