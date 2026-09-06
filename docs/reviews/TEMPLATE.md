# Sprint N Denetimi — <tarih>

> Dolduran: Claude (C9) · Denetlenen: `<commit aralığı>`
> Bu şablon `docs/plans/CLAUDE-PLAN-2026-09-05.md` §C9'un uygulamasıdır.

---

## 0. Mekanik denetim

```bash
npm run audit      # docs/specs/ kabul kriterleri
npm run check      # lint + testler
```

| Kontrol | Taban | Sprint öncesi | Sprint sonrası | Hedef | Durum |
|---|---|---|---|---|---|
| Token dışı renk | 13 | | | 0 | |
| Eski `--space` rem ölçeği | 6 | | | 0 | |
| Inline style özniteliği | 117 | | | ≤ 12 | |
| Inline style içinde px | 90 | | | 0 | |
| Eksik çeviri anahtarı | 0 | | | 0 | |
| Kodda gömülü Türkçe dize | 113 | | | 0 | |
| Boş gövdeli olay işleyici | 0 | | | 0 | |
| `console.log` kalıntısı | 7 | | | 0 | |
| `npm run check` | yeşil | | | yeşil | |

**Not:** `audit` mekanik bir tarayıcıdır, denetimin kendisi değildir. Yeşil
çıkması "iş bitti" demek değil; aşağıdaki gözle kontroller yapılmadan sprint kapanmaz.

---

## 1. Dürüstlük denetimi

Brifin ihlal edilmesi en kolay kuralları. Her satır **kanıtla** doldurulur.

| # | Kontrol | Bulgu | Kanıt |
|---|---|---|---|
| 1 | Eklenen her kontrol gerçekten çalışıyor mu (elle tıklandı mı) | | |
| 2 | Uydurma veri / mock / demo kayıt var mı | | |
| 3 | Referanssız başarı puanı, "daha iyi", ✅/❌ değerlendirmesi var mı | | |
| 4 | Sentetik test cihaz testi gibi mi sunulmuş | | |
| 5 | Yarım özellik durumu belirtilmeden ekranda mı | | |
| 6 | Rapordaki her iddianın kanıtı var mı | | |

---

## 2. Dört durum

`docs/specs/SCREEN-STATES.md` §2 matrisindeki her dolu hücre için ekran görüntüsü.

| Rota | Yükleniyor | Boş | Hata + tekrar dene | İzin | Oturumsuz |
|---|---|---|---|---|---|
| `dashboard` | | | | — | |
| `search` | | | | — | |
| `library` | | | | — | |
| `dig` | | | | — | |
| `studio` | | — | | | |
| `recordings` | | | | | |
| `pieces` | | | | — | |
| `pieces/:id` | | | | — | |
| `stats` | | | | — | |
| `diary` | | | | — | |

**Ayrıca:** hata durumundaki "tekrar dene" gerçekten yeniden istek atıyor mu —
Network sekmesiyle doğrulandı mı?

---

## 3. Kontroller

`docs/specs/CONTROLS.md` §12 kontrol listesi:

```
[ ] Eklenen her kontrolün CONTROLS.md'de satırı var mı
[ ] Pasiflik koşulları kodda uygulanmış mı
[ ] Yıkıcı eylemlerin onayı var mı, varsayılan odak İptal'de mi
[ ] Her düğmenin erişilebilir adı var mı
[ ] Dokunma hedefleri ≥ 44px (DevTools ile ölçüldü mü)
[ ] Klavye ile her kontrole ulaşılıyor, odak halkası görünür mü
[ ] İstek sürerken düğme pasif mi, çift tıklama iki istek üretiyor mu
[ ] Hata sonrası düğme tekrar aktif mi
```

---

## 4. Sunucu tarafı

| # | Kontrol | Sonuç |
|---|---|---|
| 1 | İkinci hesapla her yeni uca erişim → 404 | |
| 2 | Oturumsuz erişim → 401 | |
| 3 | Kalıcı DB kapalıyken → 503 | |
| 4 | `PATCH`'te gönderilmeyen alan değişmiyor | |
| 5 | İkinci `DELETE` → 404 | |
| 6 | Her hata gövdesinde `code` var mı | |
| 7 | Yeni indeksler oluştu mu (`collection.indexes()`) | |
| 8 | Kullanıcı silmede yetim veri kalıyor mu | |

---

## 5. Kaynak temizliği

Rota değişiminde kapanması gerekenler — her biri DevTools ile doğrulanır:

```
[ ] AudioContext (önizleme, metronom, oynatıcı) → close()
[ ] MIDIInput.onmidimessage / MIDIAccess.onstatechange → kaldırıldı
[ ] setInterval / requestAnimationFrame → temizlendi
[ ] Worker → terminate()
[ ] IndexedDB bağlantısı → kapandı
[ ] Konsolda kırmızı hata birikmiyor
```

---

## 6. Performans

`docs/specs/PERF-HARNESS.md` §8 tablosu. Ölçülmeyen satıra "ölçülmedi" ve nedeni yazılır.

| Ölçü | Hedef | Ölçülen | Ortam | Kaynak |
|---|---|---|---|---|
| P1 tuş→ekran p50/p95 | ~30 ms | | | gerçek \| sentetik |
| P2 ortalama fps | ≥ 58 | | | |
| P3 ilk boya (500 kayıt) | < 300 ms | | | |
| P5 bellek farkı | < 5 MB | | | |

---

## 7. Bulgular

Her bulgu: **ne**, **nerede** (dosya:satır), **neden sorun**, **ne yapılmalı**.
Şiddet: 🔴 sprint kapanmaz · 🟠 bu sprintte düzeltilmeli · 🟡 sonraki sprinte taşınabilir.

| # | Şiddet | Bulgu | Yer | Gereken |
|---|---|---|---|---|
| 1 | | | | |

---

## 8. Sonuç

- **Sprint kapandı mı:** evet / hayır
- **Açık 🔴 bulgu sayısı:**
- **Sonraki sprinte taşınanlar:**
- **Spec'te düzeltilmesi gereken boşluklar:**
- **Kullanıcıya düşen:**
