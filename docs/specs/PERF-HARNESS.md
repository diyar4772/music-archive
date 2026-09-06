# C8 — Performans Ölçüm Harness'ı

> **Uygulayan:** Codex, Sprint 2–3 · **Brif §7 bütçesi** bugüne kadar hiç ölçülmedi.
> Bu belge *nasıl ölçüleceğini* tanımlar. "Hızlı hissettiriyor" bir sonuç değildir.

---

## 0. Ölçülecek bütçeler

Brif §7'den birebir:

| # | Ölçü | Hedef | Durum |
|---|---|---|---|
| P1 | MIDI tuş → ekran | ~30 ms, hissedilmez | ölçülmedi |
| P2 | Arayüz | 60 fps, stüdyoda takılma yok | ölçülmedi |
| P3 | Kayıt listesi (500 kayıt) | ilk boya < 300 ms | ölçülmedi |
| P4 | 10 sesli akorda nota kaçmıyor | 0 kayıp | sentetik testte geçiyor, cihazda ölçülmedi |
| P5 | 10 dk stüdyo → bellek büyümüyor | sızıntı yok | ölçülmedi |
| P6 | Metrik hesabı (60.000 olay) | ana thread bloklanmıyor | yeni (C6 §6) |

**Mikrofon (~60 ms tek sesli nota) bu turda ölçülmez** — Faz 4 açılmadı.

---

## 1. P1 — Tuş → ekran gecikmesi

**Yöntem:** İki zaman damgası arasındaki fark.

```
t0 = MIDI olayının alındığı an   → MIDIMessageEvent.timeStamp
                                   (performance.now() ile aynı zaman tabanı)
t1 = o olayın piksele döndüğü an → çizimi yapan rAF geri çağrısının içinde
                                   performance.now()
gecikme = t1 - t0
```

**Kritik ayrıntı:** `t1`, `requestAnimationFrame` geri çağrısının **başında**
değil, o karede olayı işleyen çizim tamamlandıktan sonra alınır. Karenin
gerçekten ekrana ulaşması için ek olarak bir kare süresi (~16 ms) geçer;
bu **ölçüme dahil edilmez ama raporda belirtilir**. Tarayıcı bileşiciye kadar
olan gecikmeyi JS'ten güvenilir okumanın yolu yok — bunu ölçtüğümüzü iddia etmeyiz.

**Örneklem:** En az **1.000** nota. Simülasyon klavyesinden otomatik üretilen
olaylar **kabul edilmez** (aynı görevin içinde üretilir, gerçek girdi kuyruğunu
atlar). İki geçerli kaynak:
1. Gerçek MIDI cihazı — proje sahibinin cihaz testi sırasında toplanır.
2. `test/browser/` içinde Chrome DevTools Protocol ile enjekte edilen olaylar —
   **"sentetik" etiketiyle** raporlanır, cihaz ölçümü yerine geçmez.

**Raporlanan:** p50, p95, p99, maksimum, örneklem sayısı, kaynak (gerçek/sentetik),
cihaz modeli, işletim sistemi, tarayıcı sürümü.

**Ölçüm arayüzü:** Stüdyodaki gelişmiş ayarlar panelinde gizli bir geliştirici
anahtarı **eklenmez**. Ölçüm `test/browser/` içinden yapılır; üretim arayüzünde
ölçüm kontrolü görünmez (brif md.1: ekrandaki her kontrol kullanıcı için bir iş yapar).

---

## 2. P2 — Kare hızı

**Yöntem:** `requestAnimationFrame` aralıklarının kaydı, 60 saniyelik pencere.

```
Ölçülen: kare süreleri dizisi
Rapor:   ortalama fps, p95 kare süresi, > 32 ms süren kare sayısı ("düşen kare")
```

**Senaryolar** — her biri ayrı ayrı ölçülür:
1. Boşta duran stüdyo (nota çalınmıyor).
2. Sürekli çalma, 6 sesli, 2 dakika.
3. Metronom açıkken çalma.
4. 60.000 olaylık kaydın piano roll'unda yatay kaydırma (K2.6).
5. Metrik hesabı sürerken kaydırma (P6 ile birlikte).

**Kabul:** ortalama ≥ 58 fps ve düşen kare oranı < %1. Aşılırsa **hangi
senaryoda** aşıldığı ve nedeni yazılır; "genel olarak akıcı" kabul değil.

---

## 3. P3 — 500 kayıtlık liste

**Tohumlama:** `test/seed-recordings.mjs` — yerel tek kullanımlık MongoDB'ye
500 kayıt yazar. Her kayıt gerçekçi boyutta (**2.000–5.000 MIDI olayı**), başlık,
etiket ve eser bağı ile. Boş kayıtlarla ölçmek anlamsız sonuç verir.

> **Uyarı:** Bu betik yalnız `STUDIO_TEST_MONGO` ile verilen **yerel ve
> tek kullanımlık** veritabanına yazar. Mevcut test altyapısı uzak host'ları
> zaten reddediyor; betik aynı denetimi kullanır. Kişisel arşivin bulunduğu
> veritabanına asla yazılmaz.

**Ölçülen:**
- `GET /api/recordings` sunucu yanıt süresi (ilk 50 kayıt).
- İstemcide ilk boya: rota değişiminden ilk kayıt satırının DOM'a girmesine
  kadar geçen süre (`performance.mark` / `measure`).
- Filtre uygulandığında (`q`, `tag`, `pieceId`) aynı ölçümler.

**Kabul:** ilk boya < 300 ms. Sunucu tarafı > 100 ms ise indeks eksikliği
aranır (bkz. `DATA-MODEL.md` §1).

**Not:** Liste sayfa başına 50 kayıt yüklüyor. 500 kayıt tek seferde
boyanmıyor — ölçüm bunu gizlemez, "ilk 50 kaydın ilk boyası" olarak raporlanır.

---

## 4. P4 — Nota kaybı

**Sentetik kısım (zaten var):** `test/midi.test.js` 10 sesli akoru, kanal
izolasyonunu, velocity-zero'yu ve sustain/retrigger'ı kapsıyor. Bu **motorun
mantığını** doğrular.

**Ölçüm kısmı (yeni):** Kayıt sonrası doğrulama —
```
üretilen note-on sayısı  ==  kayda giren note-on sayısı
üretilen note-off sayısı ==  kayda giren note-off sayısı
eşleşmeyen açık nota == 0
```
60.000 olay sınırına yakın uzun bir oturumda çalıştırılır.

**Cihaz kısmı:** Proje sahibinin gerçek piyanoyla yaptığı testtir. Otomatik
ölçüm **bunun yerine geçmez** ve raporda geçtiği iddia edilmez.

---

## 5. P5 — Bellek

**Yöntem:** Chrome DevTools heap snapshot, üç nokta:
1. Stüdyo açılmadan önce.
2. 10 dakika çalma/kayıt sonrası, stüdyo açıkken.
3. Stüdyodan çıkıp başka bir rotaya gidip **zorlanmış çöp toplama** sonrası.

**Kabul:** (3) ≈ (1). Fark < 5 MB. Fazlaysa tutulan referans aranır.

**Özellikle kontrol edilecek sızıntı kaynakları:**
- `AudioContext` (önizleme sentezi, metronom, oynatıcı) — üçü de ayrı bağlam
  açıyor olabilir; hepsi `close()` ediliyor mu.
- `MIDIInput.onmidimessage` dinleyicileri ve `MIDIAccess.onstatechange`.
- `setInterval` (StudioView'da saniyelik checkpoint), `requestAnimationFrame` döngüleri.
- Worker (`metrics.worker.js`) `terminate()` ediliyor mu.
- IndexedDB bağlantıları.
- Canvas bağlamları ve `PianoCanvas` içindeki olay dinleyicileri.

`performance.memory` **kullanılmaz** — Chrome'a özel, kaba ve yanıltıcı.
Heap snapshot kullanılır.

---

## 6. P6 — Metrik hesabı

**Ölçülen:** `metrics.worker.js`'in 60.000 olaylık kayıt için toplam süresi ve
hesap sırasında ana thread'in kare hızı (§2 senaryo 5).

**Kabul:** Ana thread'de düşen kare oranı < %1. Worker süresi bir hedef değil,
**ölçülen bir gerçek** — 2 saniyeyi aşıyorsa ilerleme göstergesi zorunludur
(C6 §6 zaten öyle tanımlıyor).

---

## 7. Harness'ın yeri ve çalıştırılması

```
test/perf/
  latency.mjs        # P1
  frames.mjs         # P2
  list.mjs           # P3
  memory.md          # P5 — elle yapılan adımlar, otomatikleştirilmez
  seed-recordings.mjs
```

`package.json`'a eklenir:
```json
"test:perf": "node test/perf/run.mjs"
```

**`npm run check`'e dahil edilmez.** Performans ölçümü makineye ve yüke bağlıdır;
CI'da eşik kontrolü yapmak sahte kırmızılar üretir. Ölçüm **elle** çalıştırılır
ve sonucu sprint raporuna girer.

---

## 8. Raporlama biçimi

Her sprint raporunda şu tablo doldurulur. Ölçülmeyen satır **boş bırakılmaz**,
"ölçülmedi" yazılır ve nedeni belirtilir.

| Ölçü | Hedef | Ölçülen | Ortam | Kaynak |
|---|---|---|---|---|
| P1 tuş→ekran p50 / p95 | ~30 ms | | cihaz / OS / tarayıcı | gerçek \| sentetik |
| P2 ortalama fps (senaryo 2) | ≥ 58 | | | |
| P3 ilk boya (500 kayıt) | < 300 ms | | | |
| P4 nota kaybı | 0 | | | sentetik \| cihaz |
| P5 bellek farkı | < 5 MB | | | |
| P6 worker süresi | ölçüm | | | |

**Dürüstlük kuralı:** Sentetik ölçümü cihaz ölçümü gibi sunmak, veya bir
ölçümü atlayıp "sorun görülmedi" yazmak kabul edilmez. Ölçmediysen ölçmedin.
