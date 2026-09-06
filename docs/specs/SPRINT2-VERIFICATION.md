# Sprint 2 Doğrulama Yöntemleri

> **Hazırlayan:** Claude · 6 Eylül 2026 · **Uygulayan:** Codex, Sprint 2
> Sprint 2'nin kabul kriterleri sayı içeriyor ("sapma < 10 ms", "10 kez üst üste")
> ama *nasıl ölçüleceği* hiçbir yerde yazılı değildi. Bu dosya o boşluğu kapatır.
> Ölçüm yöntemi tanımlı değilse sayı da yoktur.

---

## 0. ⚠️ ÖNCE BU — Sprint 1'e acil ekleme

**Bulgu:** `test/browser/studio-smoke.mjs` düğmeleri **görünen Türkçe metne göre**
buluyor:

```js
const click = text => c.run(`[...document.querySelectorAll('button')]
    .find(b => b.textContent === ${JSON.stringify(text)})?.click()`);

click('Kaydı başlat')  ·  click('Kaydı durdur')  ·  click('Arşive kaydet')
click('Dinle')  ·  click('Tekrar yükle')  ·  click('Stüdyoda çalış')  ·  click('MIDI bağla')
```

8 `click()` çağrısı, ayrıca `includes("henüz sunucuya yüklenmedi")` gibi
metne bağlı doğrulamalar.

**Sonuç:** K1.2 (üç dile taşıma) bu testlerin **hepsini kıracak**. Üstelik hata
mesajı "düğme bulunamadı" olmayacak — `?.click()` sessizce hiçbir şey yapmayacak
ve test bir sonraki `c.until(...)` çağrısında zaman aşımına düşecek. Sebebi
görünmeyen bir kırılma.

Sprint 2 bu testi ağır şekilde genişletiyor (V5'te 10 döngü, V3'te A–B, V6'da
silme). Kırık bir temelin üstüne inşa edilemez.

### K1.5 — Test seçicilerini dilden ayır *(Sprint 1'e eklenir)*

Kullanıcıya görünen her kontrol bir `data-testid` alır. Seçici bundan sonra
metne değil kimliğe bakar:

```js
const click = id => c.run(`document.querySelector('[data-testid=${JSON.stringify(id)}]')?.click()`);
```

**Kimlik listesi** (`docs/specs/CONTROLS.md` ile birebir eşleşir, i18n
anahtarının nokta yerine tire hâli):

| Kontrol | `data-testid` |
|---|---|
| Kaydı başlat | `studio-start` |
| Kaydı durdur | `studio-stop` |
| MIDI bağla | `studio-connect` |
| Arşive kaydet | `studio-upload` |
| Yeni deneme | `studio-new-take` |
| Dinle | `recording-play` |
| .mid indir | `recording-download` |
| Tekrar yükle | `recording-reupload` |
| Düzenle / Sil | `recording-edit` · `recording-delete` |
| Taslağı sil | `recording-delete-draft` |
| Stüdyoda çalış | `piece-practice` |
| Metronom aç/kapa | `metronome-toggle` |
| Tap tempo | `metronome-tap` |
| A / B / döngüyü kaldır | `player-loop-a` · `player-loop-b` · `player-loop-clear` |
| Bu ana not ekle | `recording-add-note` |

**Kural:** `data-testid` yalnız testin kullandığı bir kancadır; stil vermez,
kullanıcıya görünmez ve **i18n anahtarıyla karıştırılmaz**. Metne bağlı
doğrulamalar (`includes("henüz sunucuya yüklenmedi")`) da anahtar üzerinden
yeniden yazılır: test, o anahtarın o dildeki karşılığını `js/locales/tr.json`
dosyasından okur.

**Bu ticket Sprint 1'de, K1.2 ile aynı commit'te yapılır.** Ayrı bırakılırsa
arada testler kırık kalır.

---

## 1. V1 — Metronom zamanlama sapması (K2.2)

**Kabul:** 120 BPM'de 5 dakika boyunca sapma < 10 ms.

**Neyin sapması:** Zamanlayıcının ideal ızgaradan sapması. `AudioContext`
zamanlaması örnek hassasiyetindedir; asıl risk **planlayıcı döngüsünün geri
kalması** — `setTimeout` aç kaldığında bir vuruş penceresi kaçar.

**Ölçüm:**

```
Metronome, planladığı her vuruşun AudioContext zamanını `scheduled[]` dizisine yazar.
(Bu bir arayüz kontrolü değil, modülün okunabilir bir özelliğidir —
 üretim arayüzünde görünmez, brif md.1 ihlal edilmez.)

ideal(n)     = scheduled[0] + n * (60 / bpm)
deviation(n) = scheduled[n] - ideal(n)

Rapor: maksimum |deviation|, p95, kaçan vuruş sayısı, toplam vuruş sayısı
```

**İki senaryoda ölçülür — ikincisi asıl testtir:**

| # | Koşul | Beklenen |
|---|---|---|
| 1 | Boşta, sekme önde, 5 dakika | max sapma < 10 ms, kaçan vuruş 0 |
| 2 | **Yük altında:** aynı anda simülasyon klavyesiyle çalarken + piano roll çizerken + kayıt sürerken | max sapma < 10 ms, kaçan vuruş 0 |

**Sekme arka plana alınırsa:** Tarayıcılar arka plan sekmesinde zamanlayıcıları
kısar. Metronom **ileri planlama** yaptığı için (pencere ≥ 100 ms) kısa
kısıtlamalara dayanır, ama uzun süreli arka planda sapma kaçınılmazdır.
Bu bir kusur değil, tarayıcı davranışıdır — **ölçülür ve raporda ayrı satır
olarak yazılır**, kabul kriterine dahil edilmez.

---

## 2. V2 — Giriş sayımı kayda girmiyor (K2.2)

**Kabul:** Sayım süresi `durationMs`'e dahil edilmez.

**Ölçüm:**
```
1. Giriş sayımı = 2 ölçü, 4/4, 60 BPM  →  sayım süresi tam 8 saniye
2. "Kaydı başlat" → sayım biter → hemen 3 nota çal → "Kaydı durdur"
3. assert: durationMs < 3000        (yalnız çalınan kısım)
4. assert: events[0].at < 500       (ilk nota kaydın başında)
5. assert: sayım sırasında engine.recording === false
```

**Ayrıca:** sayım sırasında "Kaydı durdur"a basılırsa kayıt **hiç başlamamış**
olmalı — `Recording` oluşturulmaz, IndexedDB'ye taslak yazılmaz, arayüz
"nota çalınmadı" değil, iptal durumunu gösterir.

---

## 3. V3 — A–B döngüsü ve takılı nota (K2.3)

Döngü başa dönerken açık notalar bırakılmazsa nota takılı kalır. Bu, gözle
fark edilmeyen ama kulakla hemen duyulan bir kusurdur.

| # | Senaryo | Doğrulama |
|---|---|---|
| 1 | A ve B, uzun bir notanın **ortasından** geçecek şekilde konur | Her döngü dönüşünde `engine.notes.size === 0` anı gözlenir; 20 tur sonunda takılı nota yok |
| 2 | B < A seçilir | Değerler sessizce takas edilir, hata gösterilmez |
| 3 | B − A < 500 ms | Döngü kurulmaz, uyarı görünür |
| 4 | Döngü açıkken hız 0,5× → 1,5× | Konum korunur, nota kaçmaz, takılı nota yok |
| 5 | Döngü açıkken "Durdur" | Tüm notalar bırakılır, AudioContext boşta |
| 6 | Döngü açıkken rotadan çıkılır | AudioContext `close()`, takılı nota yok |

**Otomatik kontrol:** 20 tur sonunda
`player.synth.context.state` ve açık nota sayısı okunur.
**Kulakla kontrol:** en az bir kez gerçekten dinlenir ve raporda yazılır —
"takılı nota duyulmadı". Otomatik sayaç sesi duymaz.

---

## 4. V4 — Zaman işaretli notlar (K2.4)

| # | Senaryo | Beklenen |
|---|---|---|
| 1 | Oynatma 45. saniyede, "Bu ana not ekle" | Oynatma **duraklar**, `atMs ≈ 45000` (± 200 ms) |
| 2 | Not kaydedilir, sayfa yenilenir | Not yerinde, aynı `atMs` |
| 3 | Nota tıklanır | Oynatma o saniyeye atlar |
| 4 | 200 not eklenir, 201. denenir | 400 `limit_exceeded`, düğme pasif |
| 5 | 501 karakter metin | İstemcide engellenir; API'ye zorla gönderilirse 400 |
| 6 | İkinci hesap aynı `noteId`'yi siler | 404 |
| 7 | Kayıt silinir | Notları da gider, yetim belge kalmaz |

---

## 5. V5 — Faz 3 kabulü: 10 ardışık döngü

**Brif:** "Kaydet → yenile → çıkış → giriş → kayıt yerinde ve oynuyor.
Bu akış arka arkaya 10 kez sorunsuz."

Mevcut `test/studio-api.test.js` 10 kayıt yüklüyor ama bu **API çağrısıdır**,
tarayıcı döngüsü değil. Teslim raporu bunu zaten dürüstçe belirtmiş
("bunlar 10 ayrı tarayıcı çıkış/giriş döngüsü değildir"). Sprint 2 bunu kapatır.

**Prosedür** — `test/browser/studio-smoke.mjs` içine yeni bölüm:

```
i = 1..10 için:
  1. Stüdyo → simülasyon → başlık "Döngü i" → kaydı başlat
  2. 3 nota çal (a, d, g) → ~1,2 sn bekle → tuşları bırak → kaydı durdur
  3. "Arşive kaydet" → "Kaydedildi" görünene kadar bekle
  4. Sayfayı YENİLE (c.reload)
  5. ÇIKIŞ yap → localStorage'da token yok doğrula
  6. GİRİŞ yap (aynı hesap)
  7. Kayıtlarım → assert: sunucu kaydı sayısı === i
  8. En yeni kaydı aç → "Dinle" → assert: AudioContext state === 'running'
  9. assert: konsolda yeni hata yok
```

**Kabul:** 10 döngünün 10'u da geçer. Bir tanesi bile düşerse **kabul karşılanmadı**;
"9/10 geçti, muhtemelen ağ" kabul edilmez — o bir bulgudur, araştırılır.

**Süre tahmini:** döngü başına ~12–15 sn → toplam ~2,5 dakika. Bu süre
`npm run test:browser` içinde kabul edilebilir; ayrı komut gerekmez.

**Ağ kesintisi ayrı bir senaryodur** (mevcut testte var, korunur): kesinti
sırasında kayıt yerelde kalır, ağ dönünce "Tekrar yükle" çalışır.

---

## 6. V6 — Kayıt yönetimi: veri kaybı senaryoları (K2.1)

Silme geri alınamaz. Bu yüzden testler "çalışıyor mu"dan çok "yanlışlıkla
silinebilir mi"ye bakar.

| # | Senaryo | Beklenen |
|---|---|---|
| 1 | "Sil" → onay diyaloğu açılır | **Varsayılan odak İptal'de**; Enter silmez |
| 2 | Onay diyaloğunda ".mid indir" | Silmeden önce yedek alınabiliyor |
| 3 | İptal | Kayıt duruyor, hiçbir istek gitmemiş (Network ile doğrula) |
| 4 | Onayla | Kayıt gider, liste yerinde güncellenir (tam yeniden yükleme yok) |
| 5 | Aynı kayıt ikinci kez silinir | 404 — sessiz 200 **değil** |
| 6 | İkinci hesap siler | 404, kayıt duruyor |
| 7 | `PATCH` ile `events` gönderilir | 400, MIDI içeriği değişmemiş |
| 8 | `PATCH` ile yalnız `title` gönderilir | `description`, `tags`, `pieceId` **değişmemiş** |
| 9 | Yerel taslak silinir | IndexedDB'den gider, sunucudaki kayıt **etkilenmez** |
| 10 | Silme sırasında ağ kesilir | Hata gösterilir, kayıt listede kalır, düğme tekrar aktif |

**9. satır kritik:** Kullanıcı "taslağı sil" ile "kaydı sil"i karıştırırsa
sunucudaki kopyasını kaybetmemeli. İki eylemin metni de bunu açıkça söylüyor
(`recordings.deleteDraftConfirmBody`), test de bunu koruyor.

---

## 7. V7 — 500 kayıtla liste ölçümü (K2.5)

**Tohumlama betiği hazır:** `test/perf/seed-recordings.mjs`

```bash
# Önce yüklemeyi doğrula (Mongo gerekmez)
node test/perf/seed-recordings.mjs --dry-run

# Sonra gerçek tohumlama
STUDIO_TEST_MONGO=mongodb://127.0.0.1:27017 node test/perf/seed-recordings.mjs
```

Betik 500 kayıt (~1,7 milyon MIDI olayı, ortalama 6,2 dakikalık denemeler),
12 eser ve bir hesap oluşturur; bağlantı bilgilerini ve giriş bilgilerini basar.
Sabit tohumla çalışır — iki çalıştırma aynı veriyi üretir, ölçümler
karşılaştırılabilir. Üretilen yükler `server/studio.js`'in **gerçek
doğrulayıcısından** geçirilerek sınanmıştır.

**Güvenlik:** yalnız `127.0.0.1`/`localhost` kabul eder ve her çalıştırma
rastgele adlı yeni bir veritabanı açar. Kişisel arşive yazmaz.

**Ölçülecekler** (`docs/specs/PERF-HARNESS.md` §3):

| Ölçü | Hedef |
|---|---|
| `GET /api/recordings` sunucu yanıtı (ilk 50) | < 100 ms |
| Rota değişiminden ilk satırın DOM'a girmesine | < 300 ms |
| `?q=` ile arama | < 300 ms |
| `?pieceId=` ile filtre | < 300 ms |
| `?tag=` ile filtre | < 300 ms |

Sunucu tarafı 100 ms'yi aşarsa **önce indeks aranır**
(`docs/specs/DATA-MODEL.md` §1'deki üç yeni indeks kurulmuş mu).

---

## 8. V8 — Tam piano roll (K2.6)

| # | Senaryo | Beklenen |
|---|---|---|
| 1 | 60.000 olaylık kayıt açılır | Çizim ana thread'i bloklamaz, ilk kare < 500 ms |
| 2 | Yatay kaydırma | Ortalama ≥ 58 fps (PERF-HARNESS §2 senaryo 4) |
| 3 | Yakınlaştırma | Nota konumları doğru kalır, kayma yok |
| 4 | Oynatma imleci | Sesle senkron; duraklatınca durur |
| 5 | A–B bölgesi | Gölge doğru aralıkta, hız değişince kaymaz |
| 6 | Rotadan çıkış | `requestAnimationFrame` döngüsü durur (PERF-HARNESS §5) |

---

## 9. Sprint 2 bitiş kontrol listesi

```
[ ] K1.5 Sprint 1'de kapandı; hiçbir test görünen metne bağlı değil
[ ] V1  metronom: iki senaryoda da max sapma < 10 ms, sayılar raporda
[ ] V2  giriş sayımı kayda girmiyor, iptal temiz
[ ] V3  A–B: 20 turda takılı nota yok + kulakla bir kez dinlendi
[ ] V4  zaman işaretli notlar: 7 senaryonun 7'si
[ ] V5  10 ardışık tarayıcı döngüsünün 10'u da geçti
[ ] V6  10 veri kaybı senaryosunun 10'u da geçti
[ ] V7  500 kayıtla beş ölçümün hepsi hedefin altında
[ ] V8  60.000 olaylık piano roll akıcı
[ ] npm run audit — taban değerlerin üstüne çıkan kontrol yok
[ ] npm run check — yeşil
```
