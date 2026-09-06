# C2 — Dört Durum Matrisi

> **Uygulayan:** Codex, ticket K1.3 · **Brif kabulü:** "dört durumu olmayan ekran yok"
> **Metinler:** `docs/specs/I18N-STUDIO.md` (`states.*` ad alanı)

---

## 0. Başlangıç durumu

`js/core/dom.js` bugün üç yardımcı sunuyor: `emptyState(icon, title, body, action)`,
`errorState(title, body)`, `loadingState(rows)`. `js/studio/ui.js` ise bunlardan
habersiz kendi `notice(text, error)` fonksiyonunu kullanıyor. İki paralel yol.

Ayrıca `errorState`'in **tekrar dene eylemi yok** — brif "hata" durumunun
kurtarılabilir olmasını istiyor, sadece hatayı yazmasını değil.

**Karar:** Tek modül — `js/components/States.js`. `dom.js`'teki üç yardımcı
oraya taşınır ve `dom.js`'ten silinir (`dom.js` DOM kurma işine geri döner).
`studio/ui.js`'teki `notice()` korunur ama yalnız **satır içi bildirim** için
kullanılır (ör. "Kaydediliyor…"), tam ekran durum için kullanılmaz.

---

## 1. Bileşen API'si

```js
// js/components/States.js
export function loading({ rows = 4, label = t('states.loading') })        // iskelet + aria-busy
export function empty({ icon, title, body = '', action = null })          // action: { label, onClick }
export function error({ error, retry, title = null })                     // retry ZORUNLU
export function denied({ title, body, action = null })                    // izin reddi
export function signedOut({ body, next = null })                          // oturumsuz; next: giriş sonrası rota
```

**Kurallar:**

1. `error()` çağrısında `retry` **zorunlu parametredir**. Tekrar denenemeyen bir
   hata varsa `denied()` veya `empty()` kullanılır. "Bir hata oluştu" yazıp
   kullanıcıyı çıkmaza sokan ekran yasak.
2. `error()` kullanıcıya **ham hata nesnesini** göstermez. `err.message`
   sunucudan gelen çevrilmiş mesajsa gösterilir; değilse `states.errorGeneric`.
   Yığın izi asla ekrana gelmez.
3. `loading()` `aria-busy="true"` ve `aria-live="polite"` taşır.
4. `error()` `role="alert"` taşır.
5. Boş durum ile hata durumu **asla** birbirinin yerine geçmez. Ağ hatasını boş
   liste gibi göstermek Faz 0'da bulunan kusurdu (`b0e670b`), tekrarlanamaz.
6. Her durum ekranı **en az bir eyleme** sahiptir. Çıkışsız ekran yok.

---

## 2. Matris

`—` = bu durum bu ekranda oluşamaz (gerekçesiyle).

| Rota | Yükleniyor | Boş | Hata (+tekrar dene) | İzin reddi | Oturumsuz |
|---|---|---|---|---|---|
| `dashboard` | `loading(rows:3)` bento iskeleti | `empty` → "ilk şarkını ekle" → `search` | `error` → verileri yeniden çek | — (izin gerekmez) | Karşılama ekranı (mevcut `landing()`) |
| `search` | `loading(rows:6)` sonuç iskeleti | `empty` → "farklı bir terim dene" | `error` → aynı sorguyu tekrarla. **Spotify yapılandırılmamışsa** ayrı metin: `states.searchUnavailable` | — | Arama açık; beğenmek için `signedOut` |
| `library` | `loading(rows:8)` | Sekme başına ayrı boş metin (beğeni / takip / liste) | `error` → `getLikedTracks({strict:true})` tekrar | — | `signedOut` → giriş |
| `dig` | `loading(rows:1)` kart iskeleti | `empty` → "kuyruk bitti, sonra tekrar bak" | `error` → kuyruğu tekrar çek | — | `signedOut` |
| `studio` | `loading` cihaz listesi beklenirken | — (stüdyo boş olamaz, klavye hep var) | `error` → MIDI bağlantısını tekrar dene | **`denied`** → MIDI izni reddedildi; eylem: "Ekran piyanosuna geç" | Çalmak serbest; **kaydetmek** için `signedOut` |
| `recordings` | `loading(rows:5)` | `empty` → "stüdyoyu aç" → `studio` | `error` → listeyi tekrar çek. Yerel ve sunucu hataları **ayrı** gösterilir | **`denied`** → IndexedDB okunamadı (depolama izni) | `signedOut` |
| `pieces` | `loading(rows:4)` | `empty` → "ilk eserini ekle" (form odaklanır) | `error` → tekrar çek | — | `signedOut` |
| `pieces/:id` **(yeni)** | `loading(rows:3)` | `empty` → "bu esere ait deneme yok" → `studio?pieceId=` | `error` → tekrar çek. **404 → `empty` değil, "eser bulunamadı" + eserlere dön** | — | `signedOut` |
| `stats` **(yeni)** | `loading(rows:4)` grafik iskeleti | `empty` → "istatistik için önce şarkı ekle" | `error` → tekrar çek | — | `signedOut` |
| `diary` **(yeni)** | `loading(rows:6)` | `empty` → "bu aralıkta olay yok" + aralığı genişlet eylemi | `error` → tekrar çek | — | `signedOut` |

**Kritik ayrım — `recordings` satırı:** Bu ekran iki kaynaktan okuyor
(IndexedDB + sunucu). `Promise.allSettled` sonucunda **biri başarısız olursa
diğeri yine gösterilir**; başarısız olan kaynak kendi hata satırını alır.
Bugünkü davranış zaten böyle, korunur ve `States.js` bileşenlerine taşınır.

---

## 3. İzin reddi ekranları — tam metin davranışı

Brif bunu ayrı bir durum olarak sayıyor. Üç yerde gerçekten oluşur:

### 3.1 MIDI izni reddi (`studio`)
Tetik: `navigator.requestMIDIAccess()` → `NotAllowedError` / `SecurityError`.
Ekran: `denied()` — başlık `states.midiDeniedTitle`, gövde tarayıcı ayarından
nasıl açılacağını **adım adım** anlatır, eylem: **"Ekran piyanosuna geç"**
(giriş kaynağını `simulation`'a çevirir ve odağı klavyeye taşır).
Kullanıcı burada çıkmaza girmez — simülasyonla çalışmaya devam edebilir.

### 3.2 Güvenli olmayan bağlam (`studio`)
Tetik: `!window.isSecureContext`. Web MIDI HTTPS/localhost ister.
Ekran: `denied()` — `states.insecureContext`; eylem yok, açıklama var.
Bu durum "tekrar dene" ile düzelmez, o yüzden `error()` değil `denied()`.

### 3.3 Depolama reddi (`studio`, `recordings`)
Tetik: IndexedDB açılamıyor (özel sekme, dolu disk, izin).
Ekran: `recordings`'te `denied()` satırı; `studio`'da kayıt **başlatılmaz**
(mevcut davranış korunur) ve `states.storageDeniedRecording` gösterilir,
eylem: **".mid indir"** — kullanıcı yine de verisini kurtarabilir.

---

## 4. Oturumsuz durum

Tek desen: `signedOut({ body, next })` → tek birincil düğme, `window.openAuthModal?.()`.
`next` verilirse giriş başarılı olduğunda o rotaya dönülür (bugün dönmüyor —
kullanıcı `recordings`'ten giriş yapınca `dashboard`'a düşüyor). Bu **düzeltilecek**.

`dashboard` istisnadır: orada `signedOut` yerine mevcut karşılama ekranı gösterilir.

---

## 5. Yükleniyor durumu — iki ayrı şey

| Tip | Ne zaman | Görünüm |
|---|---|---|
| **İlk yükleme** | Ekranda hiç veri yokken | `loading()` iskelet |
| **Yenileme** | Ekranda veri varken tekrar çekiliyor | Veri **yerinde kalır**, üstte ince ilerleme çubuğu + ilgili düğme pasif |

Ekranda duran veriyi iskeletle değiştirmek gözde titremeye yol açar ve
kullanıcının okuduğu şeyi elinden alır. `recordings` "Yenile" düğmesi bugün
tam olarak bunu yapıyor — düzeltilecek.

---

## 6. Kabul kriteri

Codex her durumu **elle tetikleyip** doğrular ve rapora kanıt koyar:

| Durum | Nasıl tetiklenir |
|---|---|
| Yükleniyor | DevTools → Network → Slow 3G |
| Boş | Yeni hesap aç |
| Hata | DevTools → Network → Offline; veya sunucuyu durdur |
| MIDI izni reddi | Chrome site ayarlarından MIDI'yi "Engelle" |
| Güvensiz bağlam | `http://` (localhost olmayan) adresten aç |
| Depolama reddi | Gizli pencere + site verilerini engelle |
| Oturumsuz | Çıkış yap, rotaya doğrudan git |

**Bitiş şartı:** §2 matrisinde `—` olmayan **her hücre** için bir ekran
görüntüsü. 10 rota × 5 durum − `—` hücreleri = **41 hücre**.
Ayrıca otomatik kontrol: `test/states.test.js` her `States.js` fonksiyonunun
erişilebilirlik özniteliklerini (`role`, `aria-busy`, `aria-live`) ve
`error()`'ın `retry` olmadan çağrıldığında **hata fırlattığını** doğrular.
