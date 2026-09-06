# C6 — MIDI Ölçüm Kuralları

> **Uygulayan:** Codex, ticket K3.3–K3.4 · **Metinler:** `metrics.*` (I18N §2–4)
> **Brif §5:** her sonuç **değer + güven + geçerlilik koşulu** ile gelir.

---

## 0. Bu belgenin amacı

Codex burada yazılı olmayan hiçbir metriği hesaplamaz ve buradaki eşikleri
kendi kararıyla değiştirmez. Eşikler §7'deki golden dosyalarla **doğrulanır**;
bir eşik yanlış çıkarsa değiştirilir ve **değişiklik gerekçesiyle rapora yazılır**.

**Mutlak yasaklar:**
- Referans dosya olmadan doğruluk yüzdesi, başarı puanı, harf notu, "yanlış çaldın".
- "Gelişiyorsun", "geçen seferden daha iyi" gibi değerlendirme cümleleri.
- Güven eşiğinin altındaki sonucu "yaklaşık" diye gösterme. Eşiğin altı = gösterilmez.
- Eksik veriyi sıfırla doldurma (0 nota çalınmışsa ortalama velocity "0" değil, "hesaplanamadı").

---

## 1. Ön işleme

Girdi: `{ durationMs, events: [{ at, data: [status, d1, d2] }] }`, `at` artan sıralı.

```
noteOn(e)   = (e.data[0] & 0xF0) === 0x90 && e.data[2] > 0
noteOff(e)  = (e.data[0] & 0xF0) === 0x80
            || ((e.data[0] & 0xF0) === 0x90 && e.data[2] === 0)
channel(e)  = e.data[0] & 0x0F
sustainDown = (e.data[0] & 0xF0) === 0xB0 && e.data[1] === 64 && e.data[2] >= 64
sustainUp   = (e.data[0] & 0xF0) === 0xB0 && e.data[1] === 64 && e.data[2] <  64
```

**Nota eşleştirme:** `(channel, noteNumber)` başına FIFO kuyruk. Bir `noteOff`
aynı anahtarın en eski açık `noteOn`'unu kapatır.

- Kayıt sonunda hâlâ açık kalan notalar `durationMs`'te kapatılır ve
  **`unmatchedOpen`** sayacına eklenir.
- Karşılığı olmayan `noteOff` **`unmatchedClose`** sayacına eklenir.
- `unmatchedRatio = (unmatchedOpen + unmatchedClose) / max(1, noteCount)`

**Sustain, nota süresine dahil edilmez.** Pedal sesin sönümünü uzatır ama
tuşun basılı kalma süresini değiştirmez; ikisini karıştırmak nota sürelerini
yanlış gösterir. Pedal ayrı bir metriktir (§2.10).

**Akor birleştirme (onset kümeleme):** Zaman analizinde eşzamanlı basılan
notalar tek bir *başlangıç* sayılır. **30 ms** içindeki `noteOn`'lar tek onset'e
katlanır; onset zamanı kümedeki **en erken** olayın zamanıdır.

> 30 ms gerekçesi: brifin performans bütçesinde "tuş → ekran ~30 ms" eşiği
> insan algısının sınırı olarak kullanılıyor; akor olarak çalınan notalar
> tipik olarak bu pencereye düşer. Bu değer §7'de doğrulanır.

---

## 2. Metrikler

Her metrik ya `{ value, confidence? }` ya da `{ unavailable: "<sebep anahtarı>" }` döner.
"Sebep anahtarı" `metrics.reason*` çeviri anahtarlarından biridir.

| # | Metrik | Hesap | Hesaplanmama koşulu |
|---|---|---|---|
| 2.1 | `durationMs` | doğrudan | yok |
| 2.2 | `activePlayingMs` | Tüm nota aralıklarının **birleşimi** (örtüşenler tek sayılır) | yok |
| 2.3 | `noteCount` | `noteOn` sayısı | yok |
| 2.4 | `peakPolyphony` | Eşzamanlı açık nota sayısının tepe değeri (pedal sayılmaz) | yok |
| 2.5 | `rangeUsed` | `{ lowest, highest }` MIDI nota numarası + nota adı | `noteCount < 3` → `reasonTooFewNotes` (n=3) |
| 2.6 | `velocityMean`, `velocityStdDev`, `velocityMin`, `velocityMax` | `noteOn`'ların `data[2]` değerleri | `noteCount < 10` → `reasonTooFewNotes` (n=10) |
| 2.7 | `noteLengthMeanMs`, `noteLengthMedianMs` | eşleşmiş nota süreleri | `unmatchedRatio > 0.05` → `reasonUnmatched` |
| 2.8 | `tempoBpm` | §3 | §3'teki koşullar |
| 2.9 | `timingDeviationMs` | §4 | §4'teki koşullar |
| 2.10 | `sustainRatio` | pedalın basılı olduğu sürenin `durationMs`'e oranı | `durationMs < 1000` → `reasonTooFewNotes` |

**Medyan neden var:** Nota süreleri çarpık dağılır (bir uzun pedal notası
ortalamayı kaydırır). Medyan gerçek tipik süreyi gösterir. İkisi birlikte
gösterilir; birini diğerinin yerine koymak yanıltıcıdır.

---

## 3. Tempo tahmini

**Yöntem: onset dizisinin otokorelasyonu.** Histogram/mod yöntemi değil —
histogram, aynı parçadaki iki farklı nota değerinde (çeyrek + sekizlik)
iki tepe üretir ve hangisinin vuruş olduğunu ayırt edemez.

```
1. Onset kümeleme (§1) sonrası onset zamanları: t[0..n-1]
2. n < 16  →  { unavailable: "reasonTooFewNotes" }   (n = 16)
3. 10 ms çözünürlükte impuls dizisi kur:
       x[k] = onset sayısı, k = round(t/10)
4. Lag aralığı: 250 ms – 1500 ms  (240 BPM – 40 BPM)
5. A(lag) = Σ x[k] · x[k+lag]   /   (örtüşen pencere uzunluğu)
6. peak     = max(A) ve onun lag'i
   baseline = A'nın aralıktaki ortalaması
   r        = peak / baseline
7. bpm = 60000 / peakLag
```

**Güven eşikleri (başlangıç değerleri, §7'de doğrulanacak):**

| `r` | Güven | Davranış |
|---|---|---|
| ≥ 3.0 | `high` | gösterilir |
| 2.0 – 3.0 | `medium` | gösterilir |
| 1.5 – 2.0 | `low` | gösterilir, arayüzde açıkça "düşük güven" |
| < 1.5 | — | `{ unavailable: "reasonLowConfidence" }` |

**Oktav belirsizliği:** Otokorelasyon 60 ve 120 BPM'i ayırt edemez (biri
diğerinin katı). Kural: `peakLag`'in yarısı ve iki katı da aralıktaysa,
`A` değeri **%15 içinde** olanlar arasından **80–160 BPM** aralığına düşen
seçilir. Hiçbiri düşmüyorsa en yüksek `A`'lı olan seçilir ve güven **bir
kademe düşürülür**. Bu belirsizlik arayüzde gizlenmez: `low` güvende
`metrics.reasonLowConfidence` metni tempo değerinin yanında görünür.

**Serbest tempolu çalış:** Rubato veya tempo değişimi olan bir kayıtta `r`
doğal olarak düşer ve sonuç üretilmez. Bu **doğru davranıştır** — brif "yeterli
veri yoksa sonuç üretme" diyor. Arayüz bunu bir kusur gibi göstermez.

---

## 4. Zamanlama sapması

**Ön koşul:** `tempoBpm` mevcut **ve** güveni `medium` veya `high`.
Değilse → `{ unavailable: "reasonNoTempo" }`. `low` güvenli tempodan sapma
hesaplamak, uydurma bir ızgaraya göre kullanıcıyı yargılamak olur.

```
1. beat = 60000 / bpm
2. Aday ızgara çözünürlükleri: [beat, beat/2, beat/4]
3. Her çözünürlük g için:
     a. Faz araması: φ ∈ {0, g/20, 2g/20, …, 19g/20}
        her φ için Σ |onset − enYakınIzgaraNoktası(φ, g)| hesapla, en küçüğü seç
     b. hitRate(g) = ±%15·g içinde kalan onset oranı
4. hitRate ≥ 0.80 olan EN İNCE g seçilir
5. Hiçbiri ≥ 0.80 değilse  →  { unavailable: "reasonLowConfidence" }
6. Sonuç: { meanAbsMs, gridMs: g, hitRate, confidence }
```

Güven: `hitRate ≥ 0.95` → `high`, `0.88–0.95` → `medium`, `0.80–0.88` → `low`.

**Arayüz metni:** "Ortalama sapma 24 ms (16'lık ızgara, notaların %91'i)".
"İyi" veya "kötü" kelimesi geçmez. Kullanıcı 24 ms'nin ne anlama geldiğine
kendi karar verir.

---

## 5. Çıktı şekli

```json
{
  "version": 1,
  "computedAt": "2026-09-06T12:00:00.000Z",
  "values": {
    "durationMs":        { "value": 184000 },
    "activePlayingMs":   { "value": 151200 },
    "noteCount":         { "value": 412 },
    "peakPolyphony":     { "value": 6 },
    "rangeUsed":         { "value": { "lowest": 28, "highest": 88 } },
    "velocityMean":      { "value": 74.2 },
    "velocityStdDev":    { "value": 18.6 },
    "velocityMin":       { "value": 31 },
    "velocityMax":       { "value": 118 },
    "noteLengthMeanMs":  { "value": 310 },
    "noteLengthMedianMs":{ "value": 244 },
    "sustainRatio":      { "value": 0.41 },
    "tempoBpm":          { "value": 96.4, "confidence": "medium", "score": 2.41 },
    "timingDeviationMs": { "unavailable": "reasonNoTempo" }
  }
}
```

**Kurallar:**
- Bir anahtar ya `value` ya `unavailable` taşır, **ikisi birden asla**.
- `null` değer yazılmaz. Bilinmeyen = `unavailable` + sebep.
- Yuvarlama: süreler tam sayı ms, oranlar 2 ondalık, BPM 1 ondalık.
- `version` **1**. Formül veya eşik değişirse 2 olur ve eski sonuçlar
  yeniden hesaplanabilir olarak işaretlenir (silinmez).

---

## 6. Worker protokolü

Ağır iş ana thread'de çalışmaz (brif §5).

**Dosya:** `js/studio/metrics.worker.js` — bağımlılıksız, `import` etmez
(klasik worker; proje derlemesiz olduğu için modül worker'ı da olabilir,
Codex hangisini seçtiğini yazar).

```
main → worker : { type: 'compute', id, durationMs, events }
worker → main : { type: 'progress', id, ratio: 0..1 }     // ≥ 100 ms aralıkla
worker → main : { type: 'result', id, metrics }
worker → main : { type: 'error',  id, code }
```

- `id` çağrı kimliği; geç gelen sonuç eşleşmiyorsa **yok sayılır** (rota
  değişmiş olabilir).
- Worker rota değişiminde `terminate()` edilir.
- 60.000 olay için hesap süresi **ölçülür ve rapora yazılır**. 2 saniyeyi
  aşarsa ilerleme göstergesi zorunludur (zaten protokolde var).

---

## 7. Golden doğrulama

**Fixture üretimi:** `test/fixtures/` altına `.mid` dosyaları, deterministik
bir betikle üretilir (`test/fixtures/make-fixtures.mjs`). Rastgele tohum sabit.

| Dosya | İçerik | Beklenen sonuç |
|---|---|---|
| `grid-60.mid` | 60 BPM, tam ızgara, 64 çeyrek nota | `tempoBpm` 60 ± 1, güven `high`, `timingDeviationMs` < 2 ms |
| `grid-120.mid` | 120 BPM, tam ızgara | `tempoBpm` 120 ± 2, güven `high` |
| `grid-144-16th.mid` | 144 BPM, 16'lık akış | `tempoBpm` 144 ± 3; ızgara `beat/4` seçilmeli |
| `human-100-j25.mid` | 100 BPM, her onset'e σ=25 ms Gauss sapma | `tempoBpm` 100 ± 4; `timingDeviationMs` 18–28 ms |
| `chords-90.mid` | 90 BPM, 4 sesli akorlar | `peakPolyphony` = 4; akorlar tek onset sayılmalı |
| `rubato.mid` | tempo 70→130 arası sürekli değişen | `tempoBpm` → `unavailable` **beklenir** |
| `sparse-8.mid` | yalnız 8 nota | `tempoBpm` → `reasonTooFewNotes`; `velocityMean` → `reasonTooFewNotes` |
| `unmatched.mid` | %20 nota kapanışı eksik | `noteLength*` → `reasonUnmatched` |

**Dürüstlük notu:** Bunlar **sentetik** dosyalardır ve yalnız *matematiğin
doğru olduğunu* gösterir. Gerçek piyano çalışının nasıl ölçüldüğünü göstermez.
Rapor bunu bu şekilde yazar; sentetik golden testi "analiz doğrulandı" diye
sunulmaz.

**Eşik ayarı:** Bir golden dosya beklenen sonucu vermiyorsa Codex **önce
formülü kontrol eder**. Formül doğru ama eşik yanlışsa eşik değiştirilir ve
`docs/reports/` içinde şu biçimde yazılır: eski değer, yeni değer, hangi
golden dosyanın gerektirdiği, diğer dosyaların hâlâ geçtiği.
Eşiği "testi geçsin diye" gevşetmek yasak.

---

## 8. Karşılaştırma (K3.4)

İki deneme seçilir; her metrik yan yana ve **fark** sütunuyla gösterilir.

**İzin verilen:** `tempoBpm: 96,4 → 102,1 (+5,7)`
**Yasak:** "daha iyi", "gelişme", ✅/❌, renk kodlu iyi/kötü, toplam puan.

**Kurallar:**
- Bir metrik denemelerden birinde `unavailable` ise fark **hesaplanmaz**,
  o satırda sebep gösterilir.
- İki denemenin `metrics.version` değeri farklıysa karşılaştırma yapılmadan
  önce ikisi de güncel sürümle **yeniden hesaplanır**. Farklı sürümlerin
  sayılarını yan yana koymak yanıltıcıdır.
- Karşılaştırma yalnız **aynı esere bağlı** denemeler arasında sunulur
  (`pieceId` eşit). Farklı eserlerin tempo farkı anlamsızdır.

---

## 9. Kabul kriteri

1. §7'deki 8 golden dosyanın hepsi beklenen sonucu veriyor (`test/metrics.test.js`).
2. `rubato.mid` ve `sparse-8.mid` **sonuç üretmiyor** — bu testler de zorunludur;
   "her zaman bir sayı döndüren" bir analiz motoru brifi ihlal eder.
3. 60.000 olaylık kayıtta hesap süresi ölçülmüş ve raporda.
4. Arayüzde her `unavailable` metriğin yanında **neden** yazıyor.
5. Karşılaştırma ekranında değerlendirme ifadesi yok — denetimde `grep` ile
   ve gözle kontrol edilir.
6. Ana thread bloklanmıyor: hesap sırasında piano roll kaydırması akıcı.
