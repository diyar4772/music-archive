# Karar Kayıtları

> Onaylayan: proje sahibi · 5 Eylül 2026
> Bu dosya kapalı kararları tutar. Codex bir kararı yeniden tartışmaz, uygular.
> Yeni bir karar gerekirse buraya eklenir; koda gömülü örtük karar bırakılmaz.

---

## KR-1 — Piyano sesi: kendi örnek çalıcımız, yeni bağımlılık yok

**Karar:** Sentetik önizleme kalır ve **varsayılan** olur. Üzerine küçük bir örnek
seti eklenir; çalıcı kendi kodumuz olur (`js/studio/SampleSynth.js`), Tone.js veya
benzeri bir kütüphane **eklenmez**.

**Gerekçe:** Tone.js ~1 MB'ın üzerinde ve bize gereken şey onun küçük bir alt kümesi:
bir örneği çalmak, perdeye göre hızını ayarlamak, nota bırakılınca sönümlemek.
`AudioBufferSourceNode.playbackRate` + `GainNode` bunu 100 satırın altında yapar.
Brifin "seçtiğin her yeni bağımlılığın gerekçesini yaz" kuralı karşısında bu
bağımlılık kendini savunamıyor.

**Sınırlar:**
- Örnek seti izin verilebilir lisanslı olacak (CC0 veya benzeri); lisans metni
  `assets/audio/LICENSE.txt` içine konur. Lisansı doğrulanmamış örnek kullanılmaz.
- Toplam boyut ≤ 6 MB. Örnekler **isteğe bağlı yüklenir** (kullanıcı sesi açana
  kadar indirilmez); ilk açılışta ağ maliyeti oluşmaz.
- Oktav başına bir örnek yeterli; aradaki perdeler `playbackRate` ile üretilir.
- Örnek indirilemezse sentetik sese **sessizce değil, bilgilendirerek** düşülür.
- **Bu iş Sprint 2'de değil, Sprint 3 sonunda veya sonraki turda yapılır.** Faz 3'ün
  kayıt araçları önce gelir. Örnek seti bulunana kadar arayüzdeki "sentezlenmiş ses"
  uyarısı olduğu gibi kalır.

---

## KR-2 — Eser silme: varsayılan arşivleme

**Karar:** `Piece.archived: Boolean`. Kullanıcı "Arşivle" der, eser stüdyo seçim
listesinden düşer, mevcut kayıtların bağı **kopmaz**. Gerçek silme
(`DELETE /api/pieces/:id`) yalnız bağlı kayıt yokken çalışır; bağlı kayıt varsa
**409** döner ve arayüz "önce bağlı kayıtları silin veya eseri arşivleyin" der.

**Gerekçe:** Bir eseri silmek, ona bağlı aylarca birikmiş denemeleri sahipsiz
bırakır. Geri alınamaz veri kaybını varsayılan yapmak brifin 4. kalite maddesine aykırı.

---

## KR-3 — Mood'u kullanıcı atar

**Karar:** Mood alanı **kullanıcı tarafından elle** atanır. Spotify
`audio-features` bu turda kullanılmaz.

**Kapalı liste** (serbest metin değil — filtrelenebilir olması için):
`enerjik · melankolik · sakin · yoğun · neşeli · karanlık · nostaljik · odaklanma`
Dokuzuncu seçenek: **mood yok** (`null`).

**Gerekçe:** `LibraryView.js:157` bugün mood sütununu çiziyor ama `js/` içinde
mood **yazan tek bir satır yok** — sütun her hesapta boş. Bu, brifin 1. maddesinin
ihlali ve bugün, dış API'ye hiç dokunmadan kapatılabilir. `audio-features`
erişiminin güncel durumu doğrulanmadan plana alınamaz; doğrulanırsa **öneri**
kaynağı olur, kullanıcının atadığı değeri ezmez.

**Serbest etiket ihtiyacı** `Like.tags` ile karşılanır (bkz. KR-5), mood ile karıştırılmaz.

---

## KR-4 — Puanlama 5 yıldız (0,5 adım) kalır

**Karar:** Değişiklik yok. `ratingSchema` doğrulaması (`min 0.5, max 5`, yarım adım)
olduğu gibi kalır.

**Gerekçe:** 10'luk sisteme geçmek mevcut tüm puanların göçünü gerektirir, geri
dönüşü yoktur ve ürüne ölçülebilir hiçbir şey katmaz. İstatistik ekranı zaten
0,5–5 aralığında 10 kova gösterebiliyor.

---

## KR-5 — Fiziksel koleksiyon = etiket, yeni alan değil

**Karar:** Plak/CD sahipliği, konser deneyimi, "çalışacaklarım" gibi her şey
`Like.tags` içinde serbest etiket olarak durur. Ayrı şema alanı açılmaz.

**Gerekçe:** Her yeni kavram için alan açmak şemayı büyütür ve her biri için ayrı
filtre kodu ister. Tek bir etiket sistemi hepsini karşılar ve kullanıcının
aklına gelen dördüncü kategoriyi de bedava destekler.

---

## KR-6 — Ses kaydı (Faz 4) bu turda açılmıyor

**Karar:** Mikrofon yolu, `getUserMedia`, `MediaRecorder`, perde tespiti — hiçbiri
bu turda başlatılmaz. Arayüzde "mikrofon yakında" gibi ölü bir kontrol de konmaz.

**Gerekçe:** Faz 3 kabulü (10 ardışık tarayıcı döngüsü, kayıt düzenleme/silme,
metronom, A–B) henüz karşılanmadı. Brif: "bir fazı bitirmeden diğerine geçme."

---

## KR-7 — Tasarım token'larının tek kaynağı `design-tokens.json`

**Karar:** `design-tokens.json` tek kaynaktır. CSS değişkenleri onu birebir
yansıtır. `js/studio.css` içindeki paralel `--space-N` ölçeği **kaldırılır**.
Ayrıntı ve dönüşüm tablosu: `docs/specs/DESIGN-TOKENS.md`.

**Gerekçe:** Şu anda iki ölçek yan yana duruyor (`design-tokens.json` t-shirt
adlandırması, `studio.css` sayısal adlandırma). Denetim raporunun ana şikâyeti
tam olarak buydu: "aynı işi yapan iki katman yan yana duruyor, hiçbiri diğerini silmemiş."
