# C1 — Tasarım Token Envanteri ve Dönüşüm Haritası

> **Uygulayan:** Codex, ticket K1.1 · **Karar dayanağı:** KR-7
> **Ölçüm tarihi:** 5 Eylül 2026, `js/styles.css` (1.791 satır), `js/studio.css` (78 satır)

---

## 0. Ölçülen başlangıç durumu

| Ölçüm | Sayı |
|---|---|
| `js/styles.css` içinde token bloğu **dışında** elle yazılmış renk | **13** |
| `js/studio.css` içinde elle yazılmış renk | 2 (ikisi de kasıtlı, bkz. §4) |
| JS dosyalarında `style:` inline özniteliği | **117** (11 dosya) |
| Inline stillerdeki px değeri | **152** kullanım, 25 farklı değer |
| `styles.css` içinde px kullanımı | ~330 kullanım |

**İyi haber:** renk tarafı neredeyse temiz — 13 satır. Asıl iş **boşluk ve tipografi**
ölçeğinde ve **117 inline stilde**.

---

## 1. Adlandırma kararı

`design-tokens.json` tek kaynaktır (KR-7). CSS değişkenleri şu kurala uyar:

- **Boşluk:** `--space-<px>` — sayı doğrudan piksel değeridir. `12px → var(--space-12)`
- **Yarıçap:** `--radius-<px>`, tam yuvarlak için `--radius-full`
- **Tipografi:** `--text-<px>`, akışkan başlıklar için `--text-display-1|2|3`
- **Renk:** mevcut adlar korunur (`--ink`, `--violet-ink`, …) — bunlar zaten iyi
  ve temaya göre yeniden tanımlanıyor. **Yeniden adlandırma yok.**

**Neden sayısal:** dönüşüm mekanik olur. Codex `padding: 12px` görünce
`var(--space-12)` yazar; eşleme tablosuna bakmak zorunda kalmaz. T-shirt
adlandırmasında (`md` 12px mi 16px mi?) her satırda karar vermek gerekir.

`design-tokens.json` içindeki mevcut t-shirt anahtarları (`spacing.md`,
`borderRadius.lg`, `typography.fontSize.base` …) **silinmez** — `mobile/`
onları okuyor olabilir ve mobil bu turun kapsamı dışında. Yanlarına sayısal
anahtarlar eklenir ve dosyaya "web sayısal anahtarları kullanır" notu düşülür.

---

## 2. ⚠️ Ad çakışması — dikkatle yapılacak tek tehlikeli adım

`js/studio.css` bugün şu adları kullanıyor ve **anlamları yeni şemayla çakışıyor**:

| Eski (studio.css) | Eski değer | Yeni ad |
|---|---|---|
| `--space-1` | 0.25rem = **4px** | `--space-4` |
| `--space-2` | 0.5rem = **8px** | `--space-8` |
| `--space-3` | 0.75rem = **12px** | `--space-12` |
| `--space-4` | 1rem = **16px** | `--space-16` |
| `--space-6` | 1.5rem = **24px** | `--space-24` |
| `--space-8` | 2rem = **32px** | `--space-32` |

`--space-4` eski şemada 16px, yeni şemada 4px. **Eski adlar takma ad olarak
bırakılmaz, aynı commit içinde tamamen silinir.** Yarısı dönüşmüş bir dosya
sessizce yanlış boşluk üretir ve bunu göz fark etmez.

**Doğrulama:** dönüşümden sonra
`grep -nE '\-\-space-(1|2|3|6|8)\b' js/` **hiçbir şey döndürmemeli**
(`--space-8` yeni şemada 8px olarak vardır; bu grep'i çalıştırdıktan sonra
sonuçları elle kontrol et — `--space-8: 2rem` kalmışsa dönüşüm eksiktir).
En güvenlisi: studio.css'teki `:root` bloğunu tamamen sil, kullanım yerlerini
tek tek yeni adla yaz.

---

## 3. Eklenecek token'lar

`js/styles.css` içindeki `:root` bloğuna eklenir. **Bu token'lar temadan
bağımsızdır** — `[data-theme]` bloklarında yeniden tanımlanmaz.

```css
/* Boşluk — 4px tabanlı; ad = piksel değeri */
--space-2: 2px;    --space-4: 4px;    --space-6: 6px;    --space-8: 8px;
--space-10: 10px;  --space-12: 12px;  --space-16: 16px;  --space-20: 20px;
--space-24: 24px;  --space-28: 28px;  --space-32: 32px;  --space-36: 36px;
--space-40: 40px;  --space-48: 48px;  --space-64: 64px;  --space-72: 72px;
--space-96: 96px;  --space-104: 104px;

/* Yarıçap */
--radius-4: 4px;   --radius-6: 6px;   --radius-8: 8px;
--radius-12: 12px; --radius-16: 16px; --radius-full: 999px;

/* Tipografi — gövde ölçeği */
--text-10: 10px;   --text-11: 11px;   --text-12: 12px;   --text-13: 13px;
--text-14: 14px;   --text-15: 15px;   --text-17: 17px;   --text-20: 20px;
--text-24: 24px;   --text-26: 26px;

/* Tipografi — akışkan başlıklar (mevcut hero ölçekleri buraya toplanır) */
--text-display-1: clamp(2.25rem, 6vw, 4.5rem);   /* 36 → 72px */
--text-display-2: clamp(1.75rem, 4.5vw, 3.25rem);/* 28 → 52px */
--text-display-3: clamp(1.5rem, 3vw, 2.125rem);  /* 24 → 34px */

/* Dokunma hedefi — brif Faz 1 kabulü: ≥ 44px */
--touch: 44px;

/* Kenarlık kalınlığı */
--hairline: 1px;
```

**Not:** `--container: 1240px` ve `--gutter: 24px` zaten var, korunur.
`--gutter` değeri `--space-24` ile aynıdır ama anlamı farklıdır (sayfa payı);
ikisi ayrı kalır.

---

## 4. Kalıcı istisnalar — token'a çevrilmeyecekler

Bunlar bilerek elle yazılı kalır. Codex bunlara dokunmaz.

| Yer | Değer | Gerekçe |
|---|---|---|
| `studio.css:15` | `--key-white: #f4f4f5` | Canvas'a çizilen piyano tuşu. Tema rengi değil, enstrüman rengi; koyu/açık temada aynı kalmalı. |
| `studio.css:16` | `--key-black: #18181b` | Aynı. |
| `styles.css` `--grad`, `--grad-135`, `--hero-grad` | gradyan içindeki hex'ler | Gradyan tanımının kendisi token. İçindeki duraklar ayrı token olursa okunmaz hale gelir. |
| `--shadow-menu`, `--glow-violet`, `--glow-pink` | `rgba(...)` | Gölge tanımının kendisi token. |
| Her yerdeki `1px` | kenarlık | `--hairline` eklendi ama **mevcut `border: 1px solid var(--border)` satırları dönüştürülmez** — okunabilirlik kaybı, kazanç sıfır. Yeni kodda `--hairline` kullanılabilir. |
| `border-radius: 0` | sıfır | Token gerekmez. |

---

## 5. Dönüşüm tablosu — `js/styles.css`

Aşağıdaki 13 satır token'a taşınır. Satır numaraları 5 Eylül 2026 durumudur;
Codex önce satırı içerikle doğrular, sonra değiştirir.

| Satır | Şu an | Olacak | Not |
|---|---|---|---|
| 132 | `background: rgba(139, 92, 246, .35)` | `background: color-mix(in srgb, var(--violet) 35%, transparent)` | Seçim vurgusu |
| 399 | `border-color: rgba(239, 68, 68, .4)` | `border-color: color-mix(in srgb, var(--err) 40%, transparent)` | Hata kenarlığı |
| 404 | `background: rgba(239, 68, 68, .1)` | `background: color-mix(in srgb, var(--err) 10%, transparent)` | Hata zemini |
| 707 | `color: #0A0A0B` | `color: var(--on-accent)` | Vurgu üstü metin |
| 735 | `color: #0A0A0B` | `color: var(--on-accent)` | Aynı |
| 752 | `box-shadow: 0 0 48px -12px rgba(139, 92, 246, .5)` | yeni token `--glow-violet-lg` | `:root`'a eklenir |
| 881 | `box-shadow: 0 0 32px -8px rgba(244, 114, 182, .18)` | yeni token `--glow-pink-sm` | `:root`'a eklenir |
| 977 | `background: rgba(239, 68, 68, .14)` | `color-mix(in srgb, var(--err) 14%, transparent)` | |
| 1017 | `background: rgba(10, 10, 11, .66)` | yeni token `--scrim` | Modal perdesi; **açık temada da koyu kalmalı** — `[data-theme]` bloğunda yeniden tanımlanmaz |
| 1483 | `background: #0A0A0B` | `var(--page)` | Doğrula: açık temada bu öğe koyu mu kalmalı? Kalmalıysa istisna listesine taşı ve gerekçesini yaz. |
| 1484 | `color: #F472B6` | `var(--pink-ink)` | Aynı doğrulama |
| 1560 | `color: #0A0A0B` | `var(--on-accent)` | |
| 1642 | `background: rgba(10, 10, 11, .72)` | `--scrim-strong` | Aynı mantık |

**`color-mix` uyarısı:** Node 22 hedefli modern tarayıcılarda destekleniyor.
Codex, dönüşümden sonra koyu ve açık temada bu 13 noktanın ekran görüntüsünü
alır ve öncesiyle karşılaştırır. Farklı görünen varsa `rgba()` hâli korunur ve
istisna listesine gerekçeyle eklenir — "biraz farklı ama olsun" kabul edilmez.

---

## 6. Inline stillerin dönüşümü — asıl iş

117 inline `style:` özniteliği var. Hepsi tek seferde dönüşmez; **dosya dosya**
ve her dosya ayrı commit.

| Dosya | Adet | Sıra |
|---|---|---|
| `js/views/SearchView.js` | 29 | 5 |
| `js/views/LibraryView.js` | 18 | 3 |
| `js/views/DashboardView.js` | 17 | 1 |
| `js/views/DigView.js` | 17 | 4 |
| `js/components/Details.js` | 10 | 6 |
| `js/services/search.js` | 9 | 7 |
| `js/core/dom.js` | 6 | 2 |
| `js/components/Navbar.js` | 6 | 8 |
| `js/components/SearchBar.js` | 2 | 9 |
| `js/components/Dashboard.js` | 2 | 10 |
| `js/components/Toast.js` | 1 | 11 |

**Kural:**
1. Inline stil bir **düzen** tanımlıyorsa (`display:flex; gap:12px; …`) →
   `js/styles.css` içinde sınıf olur, JS'te `className` yazılır.
2. Inline stil **tek bir dinamik değer** taşıyorsa (`color:${item.color}`,
   `width:${widths[i]}`) → inline kalır, ama değer bir token'a veya hesaplanmış
   bir CSS değişkenine bağlanır: `style: \`--accent:${item.color}\`` + sınıfta
   `color: var(--accent)`.
3. Inline stil `var(--...)` dışında **renk** içeriyorsa → sınıfa taşınır.
4. Yeni sınıf adı mevcut `ma-` ön ekini kullanır.

**Ölçülebilir bitiş şartı:**
```bash
# Inline stil sayısı 117 → en fazla 12 (yalnız §6.2 kuralına giren dinamik değerler)
grep -roc "style: *['\`]" js/ --include=*.js | awk -F: '{s+=$2} END{print s}'

# Inline stillerde px kalmamalı
grep -rhoE "style: *['\`][^'\`]*['\`]" js/ --include=*.js | grep -E '[0-9]+px' | wc -l   # → 0
```

---

## 7. Tek sayı ("odd") değerlerin eşlemesi

Kodda ölçeğe oturmayan değerler var. Bunlar en yakın ölçek adımına çekilir:

| Bulunan | Olacak | Bulunan | Olacak |
|---|---|---|---|
| 3px | `--space-4` | 17px | `--space-16` |
| 7px | `--space-8` | 18px | `--space-20` |
| 9px | `--space-8` | 22px | `--space-24` |
| 15px | `--space-16` | 34px | `--space-36` |
| | | 52px | `--space-48` |

**İstisna:** `font-size` için 17px gerçek bir ölçek adımıdır
(`design-tokens.json` `fontSize.lg`), `--text-17` olarak korunur. Bu tablo
yalnız **boşluk** değerleri içindir.

Görsel fark 1–2px'tir ama Codex bunu **körlemesine yapmaz**: her dosyanın
dönüşümünden sonra o ekranın önce/sonra görüntüsü alınır. Bir yerde düzen
bozuluyorsa ölçek adımı yerine o değere özel bir token eklenir ve gerekçesi yazılır.

---

## 8. Kabul kriteri

```bash
# 1. Token bloğu dışında elle yazılmış renk yok (istisnalar hariç)
grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(' js/styles.css js/studio.css | grep -vE ':\s*--'
# → yalnız §4 istisna listesindeki satırlar

# 2. JS'te hiç px yok
grep -rhoE "style: *['\`][^'\`]*['\`]" js/ --include=*.js | grep -cE '[0-9]+px'   # → 0

# 3. Eski studio ölçeği tamamen gitti
grep -rn '\-\-space-1:\|--space-2:\|--space-3:\|--space-6:' js/   # → boş

# 4. Inline stil sayısı ≤ 12
```

Ayrıca: koyu ve açık temada `dashboard`, `library`, `search`, `dig`, `studio`,
`recordings`, `pieces` ekranlarının önce/sonra görüntüleri rapora eklenir.
Görsel fark varsa açıklanır. "Fark etmedim" kabul değil.
