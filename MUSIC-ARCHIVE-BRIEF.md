# Music Archive — Yapım Brifi

> Bu dosya repo kökünde durur. Astra her oturuma **önce bunu okuyarak** başlar.
> `AGENTS.md` ve `Music-Archive-Denetim-ve-Yol-Haritasi.md` varsa onları da oku; çelişki olursa bu dosya günceldir, diğerlerini buna göre güncelle.

---

## 0. Tek cümlelik hedef

**"Enstrümanımı çalıyorum, çaldıklarımı ekranda anlık görüyorum, kaydediyorum, analiz ediyorum ve kişisel arşivimde saklıyorum."**

Bunun yanında dinlediğim müzikler, sanatçılar, albümler, notlarım ve çalıştığım eserler de aynı yerde düzenlenebilir olmalı. Ana çıktı **web sitesi**. Site günlük kullanılacak kalitede olmalı — demo değil.

---

## 1. "Mükemmel" ne demek — kalite çıtası

Bu maddeler pazarlık konusu değil. Bir özellik bunları geçmiyorsa **bitmemiştir**, ekranda görünmez.

1. Görünen her kontrol gerçek bir iş yapar. Ölü buton, ölü menü, ölü sekme yok.
2. Her ekranın dört hali tasarlanmıştır: **yükleniyor / boş / hata / izin reddedildi**.
3. Hiçbir yerde uydurma veri yok. Mock ile demo yapıp "çalışıyor" deme.
4. Sayfa yenilendiğinde ve kullanıcı çıkıp tekrar girdiğinde veri yerinde durur.
5. Bir kullanıcı başkasının kaydına erişemez — kontrol **sunucuda**.
6. Tamamlanmamış özellik varsa arayüzde durumu açıkça yazar ("yakında", "deneysel", "tahmini").
7. Klavye ile gezilebilir, odak görünür, kontrast okunabilir.
8. Konsolda kırmızı hata birikmiyor; stüdyo kapanınca mikrofon/MIDI kaynakları temizleniyor.

**Öncelik sırası:** az sayıda akış kusursuz > çok sayıda akış yarım. Bir fazı bitirmeden diğerine geçme.

---

## 2. Astra'nın çalışma kuralları

- **Önce doğrula, sonra varsay.** Geçmişte giriş/oturum, CORS, birden fazla uygulama başlangıcı ve çalışmayan buton sorunları yaşandı. Bunların *hâlâ var olduğunu varsayma* — kodu oku, uygulamayı çalıştır, gör, sonra konuş.
- **Çalışanı koru.** Teknoloji değişimini veya büyük yeniden yazımı ancak somut ve gerekçeli bir ihtiyaç varsa öner. Mevcut kullanıcı verilerini ve benim elle yaptığım değişiklikleri bozma.
- **Rapor verip durma.** Kısa değerlendirme + uygulanabilir sıra çıkar, sonra **kodla**.
- **Faz faz ilerle.** Her fazın sonunda çalışan bir şey ve kabul kriteri karşılanmış olacak. Her faz sonunda anlamlı bir commit.
- **Rutin kararları kendin ver**, gerekçeni yaz. Gerçekten dış erişim gerektiren bir engel varsa onu somutlaştır ve bağımsız işlere devam et.
- **Donanım testi uyduramazsın.** Gerçek enstrümanla test edemiyorsan bunu açıkça yaz; sentetik/otomatik testi cihaz testi gibi sunma. Bunun yerine bana **kısa, uygulanabilir cihaz testi adımları** ver.
- **Tarayıcıda aç ve bak.** Ekran görüntüsü üzerinden kendi çıktını denetle.

---

## 3. Ürünün iki tarafı

| Taraf | Kim için | Çekirdek |
|---|---|---|
| **Stüdyo** | Müzisyen | Canlı çalma görünümü → kayıt → analiz → çalışma araçları |
| **Arşiv** | Müziksever | Şarkı/albüm/sanatçı, favoriler, listeler, notlar, istatistik |

İkisi birbirine bağlanır: **katalogdaki bir eser ↔ o esere ait kendi performans kayıtlarım.**

Ana gezinme: **Arşivim · Stüdyo · Kayıtlarım · Çalışmalarım**

---

## 4. Faz planı

Her faz: *amaç → iş → kabul kriteri*. Kabul kriteri geçilmeden sonraki faz açılmaz.

### Faz 0 — Envanter ve gerçeklik kontrolü

**Amaç:** Elimizde ne olduğunu tahminle değil ölçerek bilmek.

- Depoyu, dosya yapısını, veritabanı şemasını, API yüzeyini ve frontend başlangıç akışını çıkar.
- Uygulamayı **gerçekten ayağa kaldır** (dev + production build). Ayağa kalkma komutlarını tek yerde yaz.
- Frontend'in ne olduğunu netleştir (Flutter Web mi, JS/TS mi). Bu, ses/MIDI motoru kararını belirler — bkz. §5.
- Bilinen geçmiş sorunları tek tek doğrula: giriş, oturum kalıcılığı, CORS, çoklu app init, tıklanmayan butonlar. Her biri için: **hâlâ var / düzelmiş / kısmen**.
- Envanter tablosu üret: `çalışıyor / kısmen / kırık / ölü kod`.

**Kabul:** Tek komutla ayağa kalkma adımları yazılı; envanter tablosu ve öncelikli düzeltme sırası hazır; kritik kırıklar düzeltilmiş.

---

### Faz 1 — Tasarım sistemi ve gezinme

**Amaç:** Uzun süre açık tutulmak istenen bir yüzey.

- Mevcut görsel kimliği **değerlendir**, sıfırdan atma. Üzerine tutarlı bir sistem kur.
- Token'lar: renk paleti (koyu tema temel), tipografi ölçeği, boşluk skalası, köşe yarıçapı, gölge, tek ikon seti. Ölçülü vurgu rengi; albüm kapakları öne çıksın.
- Bileşenler: buton, alan, seçim, modal, toast, kart, liste, **boş durum**, **skeleton/yükleniyor**, **hata**, **izin reddi**.
- Gezinme sadeleşsin: Arşivim / Stüdyo / Kayıtlarım / Çalışmalarım.
- Masaüstü, tablet, telefon için **ayrı** düzen kararları. Dokunma hedefi ≥ 44px, odak halkası görünür, kontrast AA.

**Kabul:** Hiçbir ekranda elle yazılmış renk/px yok, hepsi token; dört durumu olmayan ekran yok; telefonda stüdyo kullanılabiliyor.

---

### Faz 2 — Canlı stüdyo: MIDI yolu (en kritik faz)

**Amaç:** Piyanoya bastığımda ekranda anında görmek.

Öncelikli enstrüman **piyano**; yapı gitar, keman, flüt, vokal ve vurmalıya genişleyecek şekilde kurulur.

- Web MIDI: cihaz listeleme, seçim, bağlantı durumu, **hot-plug** (cihaz takılıp çıkarılınca kendini toparlama).
- İşlenecekler: note on/off, aynı anda basılı notalar (polifoni), zamanlama, velocity, cihaz gönderiyorsa sustain (CC64).
- Ekranda:
  - Giriş kaynağı ve cihaz seçimi
  - Canlı seviye + bağlantı durumu
  - **88 tuşlu klavye**, basılan tuşlar aydınlanır (velocity yoğunluğa yansır)
  - Nota adı + oktav, **C-D-E ↔ Do-Re-Mi** geçişi
  - **Piano roll**: notalar süreleriyle orantılı akar
  - Belirgin kayıt kontrolü + süre göstergesi
  - Dikkat dağıtmayan **tam ekran çalışma görünümü**, gelişmiş ayarlar katlanır panelde
- Dijital piyano sessiz çalışıyorsa diye örnek tabanlı ses çıkışı (ör. Tone.js).
- **Ekran piyanosu** (donanımsız deneme) olabilir — ama "simülasyon" rozetiyle gerçek cihaz girişinden açıkça ayrılır.
- Arayüz şunu net anlatır: **MIDI olayları ses kaydı değildir.** Enstrümanın sesini kaydetmek için ayrıca ses girişi gerekir. İkisini veri modelinde de karıştırma.

**Kabul:** Gerçek cihazla 30 dk kesintisiz; tuş→ekran gecikmesi hissedilmiyor; cihaz çıkar-tak sonrası çalışmaya devam ediyor; 10 sesli akorda nota kaçmıyor.

---

### Faz 3 — Kayıt ve kalıcılık (uçtan uca)

**Amaç:** "Kaydedildi" yazısı gerçekten kaydedildiği anlamına gelsin.

- Başlat / (destekleniyorsa) duraklat / durdur / dinle.
- MIDI kaydı → standart `.mid`. Ses kaydı → `MediaRecorder.isTypeSupported` ile **çalışma anında** desteklenen biçim seçimi, fallback zinciri.
- Count-in ve metronom entegre.
- Her kayıt için: başlık, tarih, enstrüman, süre, açıklama, etiketler, ilişkili eser/çalışma; varsa MIDI olayları ve analiz sonucu.
- Oynatıcı: dalga biçimi, ileri sarma, **A–B bölüm tekrarı**, belirli saniyeye kişisel not.
- Aynı eserin farklı denemeleri (take) ilişkilenir ve karşılaştırılabilir.
- Durum makinesi doğru çalışır: `kaydediliyor → yükleniyor → kaydedildi → hata/yeniden dene`.
- Tarayıcıdaki geçici kayıt ile sunucuya yüklenmiş kayıt arayüzde **ayrı** gösterilir. Yükleme başarısız olursa kayıt yerelde kurtarılabilir kalır (IndexedDB) ve "kurtar/tekrar yükle" düğmesi çalışır.
- Depolama kalıcı bir çözümle; yüklemede tür ve boyut doğrulaması; kayıtlar varsayılan olarak kullanıcıya özel.
- Desteklenen **gerçek** biçimlerde indirme/dışa aktarma (uydurma format listesi yok).

**Kabul:** Kaydet → yenile → çıkış → giriş → kayıt yerinde ve oynuyor. Bu akış arka arkaya 10 kez sorunsuz. Ağ kesildiğinde kayıt kaybolmuyor.

---

### Faz 4 — Mikrofon yolu ve diğer enstrümanlar

**Amaç:** MIDI'si olmayan her şey.

- `getUserMedia` çağrısında **`echoCancellation`, `noiseSuppression`, `autoGainControl` kapalı** — bunlar müzik sinyalini bozar.
- Güvenli bağlam, cihaz izni ve tarayıcı desteği **çalışma anında** denetlenir; reddedilen izin için gerçek bir ekran vardır.
- Önce **tek sesli** melodiler için güvenilir perde/nota tespiti: nota adı, frekans, **hedef notaya göre cent sapması**, güven skoru. Sessizlik ve gürültü eşiği hesaba katılır; güven düşükse sonuç uydurmaz, "algılanamadı" der.
- Enstrüman seçimi analizi **gerçekten** değiştirir: ses aralığı, akort referansı, transpoze (gitar oktav), uygun görselleştirme. Vurmalılarda ritim odaklı değerlendirme.
- Polifonik piyano ve akor çözümlemesi **ayrı iş kalemidir**: ağır iş worker'da, sonuç "tahmini" etiketiyle, kapsam gerçek ses örnekleriyle doğrulanır.
- Stüdyodan çıkışta stream, track, listener ve AudioContext temizliği eksiksiz.

**Kabul:** En az 3 gerçek kaynakla (ör. gitar, vokal, flüt) test; cent değeri fiziksel akortçuyla tutarlı; 10 dk sonra bellek büyümüyor; stüdyo kapanınca mikrofon ışığı sönüyor.

---

### Faz 5 — Analiz motoru

**Amaç:** Gerçek veriden, dürüst çıkarım.

Ağır analiz **arayüzü dondurmaz** — worker'da veya sunucuda çalışır, ilerleme gösterir.

İlk sürümde sadece güvenilir ölçülebilenler:

- Kayıt süresi ve etkin çalma bölümleri
- Algılanan notalar, kullanılan ses aralığı, nota dağılımı
- Uygun kayıtlarda tempo tahmini ve ritim düzenliliği
- Mikrofon kaydında göreli seviye/dinamik değişimi
- MIDI kaydında nota süreleri, zamanlama sapması, velocity dağılımı
- Uygun enstrüman ve kayıtlarda akort değerlendirmesi

Kurallar:

- Her sonuç **değer + güven + geçerlilik koşulu** ile gelir.
- Yeterli veri yoksa sonuç üretme; bunu anlaşılır şekilde göster.
- **Referans varsa** (hedef MIDI, nota dosyası, tanımlı egzersiz) karşılaştır: kaçırılan/fazla notalar, erken-geç girişler, süre farkları.
- **Referans yoksa** "yanlış çaldın" deme, gerekçesiz başarı puanı üretme.
- Gelişim önerileri ölçülen sonuca bağlanır, genel geçer tavsiye değildir.
- Analizler versiyonlanır ve yeniden çalıştırılabilir.

**Kabul:** Tempo/tonalitesi bilinen referans dosyalarla doğrulama yapılmış ve sapma raporlanmış; yetersiz veri senaryosu ekranda düzgün görünüyor.

---

### Faz 6 — Çalışma araçları

Stüdyoya ve arşive **bağlı** çalışır, ayrı ada olmaz.

- Metronom: BPM, ölçü, vurgu
- Akort cihazı
- Eser ve egzersiz listesi
- Çalışma oturumları ve kişisel hedefler
- Bir bölüm üzerinde tekrar çalışma (A–B loop ile ortak)
- Kayıtları yan yana dinleyip gelişimi karşılaştırma
- Eserlere nota PDF'si, MIDI, ses dosyası ve kişisel çalışma notu iliştirme

Çekirdek akış oturduktan **sonra**: gam, akor, kulak eğitimi.

**Kabul:** Bir eseri açıp → notasını görüp → metronomla çalıp → kaydedip → önceki denemeyle karşılaştırmak tek akışta mümkün.

---

### Faz 7 — Müziksever arşivi

- Şarkı, albüm, sanatçı kayıtları
- Favoriler, puanlar, kişisel yorumlar, dinleme notları
- Çalma listeleri ve özel koleksiyonlar
- Tür, yıl, sanatçı, etiket, puana göre arama / filtreleme / sıralama
- Hazır listeler: "Dinleyeceklerim", "Favori albümlerim", "Çalışacağım eserler"
- Kapak görselleri ve düzenlenebilir metadata
- Mükerrer kayıt tespitine yardımcı araç
- Arşivin içe ve dışa aktarımı
- İstatistikler **gerçek** kullanıcı verisinden
- Katalog eseri ↔ o esere ait kendi performans kayıtlarım ilişkisi

Spotify vb. entegrasyon varsa: güncel API yeteneklerini **doğrula**, eskiden çalışan bir uç noktayı varsayma. **Harici katalog bağlantısı** ile **oynatılabilir ses dosyası** veri modelinde açıkça ayrı alanlardır.

**Kabul:** 500+ kayıtla liste ve arama akıcı; bir albüm eklerken metadata akışı sürtünmesiz.

---

### Faz 8 — Gelişmiş analiz

Akor tanıma, tonalite tespiti, ses kaydını notaya dönüştürme, MusicXML görüntüleme, PDF dışa aktarma.

Kural: **önce doğruluğunu ve cihaz üzerindeki maliyetini ölç**, sonra uygun olanı ürüne al. Ölçülmemiş özellik ekrana gelmez.

---

## 5. Teknik mimari ve sınırlar

- **Sorumlulukları ayır:** ses yakalama · MIDI · analiz · kayıt/depolama · arşiv · arayüz. Biri diğerinin içine gömülmez.
- **Ses/MIDI motoru framework'ten bağımsız bir modül olsun.** Olay yayınlar, UI dinler. Böylece arayüz değişse motor kalır.
  - Frontend **Flutter Web** ise: DSP'yi Dart tarafında yapma. Motoru JS/TS modülü olarak yaz, ince bir interop katmanıyla bağla. Web MIDI + AudioWorklet + 60fps canvas bu şekilde çok daha az acı verir.
  - Frontend **JS/TS** ise: motor doğrudan TS modülü, render canvas üzerinde.
- **Ağır iş asla ana thread'de değil.** Ses işleme AudioWorklet'te, analiz Web Worker'da veya sunucu tarafında kuyrukta.
- Audio thread'inde bellek ayırma yapma (GC duraklaması = ses kesilmesi).
- Klavye ve piano roll **canvas** ile çizilir, 88 DOM elemanı güncellenmez.
- Erişim kontrolü **sunucuda**; istemci kontrolü güvenlik değildir.
- Temel kullanım için ücretli bir yapay zekâ servisini zorunlu kılma.
- Bakımsız/terk edilmiş paket seçme; seçtiğin her yeni bağımlılığın gerekçesini yaz.

**Referans belgeler (güncel hâllerine bak, ezberden yazma):**
Web MIDI API · `MediaDevices.getUserMedia` · `MediaRecorder.isTypeSupported`

---

## 6. Veri modeli (yön gösterici, mevcut şemaya uyarla)

- `users`
- `recordings` — userId, başlık, enstrüman, kaynak (`midi` | `audio` | `both`), süre, dosya referansları, dalga formu özeti, etiketler, açıklama, pieceId, takeGroupId, durum (`local` | `uploading` | `stored` | `failed`)
- `pieces` — eser/çalışma: başlık, besteci, tonalite, zorluk, ekli nota/MIDI/ses dosyaları, kişisel notlar
- `analyses` — recordingId, analiz sürümü, metrikler, her metrik için güven, üretim zamanı
- `sessions` — çalışma oturumu: süre, eserler, kayıtlar, hedefler
- `tracks` / `albums` / `artists` — müziksever kataloğu; **externalLinks** ve **playableFile** ayrı alanlar
- `playlists`, `tags`, `notes`

Kayıt ↔ eser ↔ katalog şarkısı ilişkileri en baştan kurulur, sonradan yamalanmaz.

---

## 7. Performans bütçesi

| Ölçü | Hedef |
|---|---|
| MIDI tuş → ekran | hissedilmez (~30 ms) |
| Mikrofon → tek sesli nota | ~60 ms |
| Polifonik tahmin | en iyi çaba, "tahmini" etiketiyle |
| Arayüz | 60 fps, stüdyoda takılma yok |
| Kayıt listesi (500 kayıt) | ilk boya < 300 ms |

---

## 8. Yapma listesi

- Mock veriyle ekran doldurup "çalışıyor" deme.
- Referans olmadan doğruluk puanı / "yanlış çaldın" üretme.
- MIDI olaylarını ses kaydı gibi sunma.
- Sentetik testi donanım testi gibi raporlama.
- Aynı anda üç faz birden yazma.
- Ağır analizi API isteğinin içinde çalıştırma.
- Mikrofonda AGC/noise suppression açık bırakma.
- Çalışan bir özelliği "daha temiz olur" diye yeniden yazma.
- Belgelemeden bağımlılık ekleme.
- Yarım özelliği durumu belirtilmeden arayüze koyma.

---

## 9. Test ve doğrulama

Her fazda ilgili kullanıcı akışını test et. Özellikle:

- Arka arkaya tekrar kayıt
- Cihaz bağlantısının ortada kesilmesi
- Mikrofon/MIDI izninin reddedilmesi
- Yükleme hatası ve kurtarma
- Sayfa yenileme ve yeniden giriş
- Başka kullanıcının verisine erişim denemesi
- Telefon ve tablet düzeni

Golden test dosyaları tut: tempo/tonalitesi bilinen kısa örnekler, analiz sonuçları bunlara karşı doğrulanır.

---

## 10. Teslim formatı

Her turun sonunda net şekilde yaz:

1. **Çalışan özellikler** (ve nasıl doğrulandı)
2. **Değişen dosyalar**
3. **Doğrulama sonuçları** — neyi gerçekten çalıştırdın, neyi çalıştıramadın
4. **Kalan işler** ve sıradaki faz
5. **Bana düşen cihaz testleri** — kısa, adım adım, sonucu sana nasıl bildireceğim dahil

Yol haritası dosyasını her turda güncel tut.

---

## Şimdi ne yap

Faz 0'ı başlat: mevcut projeyi incele, çalıştır, envanteri ve öncelik sırasını çıkar, kritik kırıkları düzelt — sonra **ilk uçtan uca akışı** (canlı giriş → nota gösterimi → kayıt → kaydetme → yeniden dinleme) çalışır hâle getir.
