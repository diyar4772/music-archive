# Admin Paneli ve Güvenlik Sertleştirme — 7 Eylül 2026

> Uygulayan: Codex · Dal: `fix/admin-panel-auth` · Taban: `188474e`
> Ürün commitleri: `865fa64`, `e2c1aaf`, `7c37d3f`, `8a04a85`

## Kök neden

`379f017`, ana uygulamadaki inline olayları temizleyip CSP'yi etkinleştirmişti;
ancak aynı temizlik `panel-4772.html` dosyasına uygulanmamıştı. Panelde kalan
628 satırlık inline script ve 25 inline olay niteliği `script-src` tarafından
engelleniyor, panel çizilse de davranışlar hiç tanımlanmıyordu. Aynı kod
kök admin parolasını Basic başlığı olarak `sessionStorage` içinde tutuyordu.

## Kalemler

| # | Şiddet | Durum | Yer | Kanıt |
|---|---|---|---|---|
| K-A | 🔴 | Tamamlandı | `panel-4772.html:111`, `admin/panel.js:1`, `server.js:183` | Inline script/olay sayısı 0; panel davranışları tek delege dinleyicide. Tarayıcı koşusu: CSP ihlali 0, yakalanmamış istisna 0. |
| K-B | 🔴 | Tamamlandı | `server.js:1579`, `server.js:1887` | Oturumsuz `/admin` ve `/admin.html` 302 ile `/admin/login` sayfasına gidiyor; geçerli oturum paneli açıyor. |
| K-C | 🔴 | Tamamlandı | `server.js:1522-1618`, `admin/login.js:1` | `ma_admin`: 30 dk JWT, `typ: admin`, HttpOnly, SameSite=Strict, Path=/; production'da Secure. Basic kaldırıldı. Cookie ve Bearer sırası korunuyor. |
| K-D | 🟠 | Tamamlandı | `server.js:1896`, `test/routes.test.js` | Fisher–Yates; 10.000 seçimde 10 öğenin her biri beklenen 1.000'in ±%15 bandında. |
| K-E | 🟠 | Tamamlandı | `js/components/Shell.js:53,151,174,243`, `panel-4772.html:366` | Boş `src` yerine `/js/placeholder.svg`; statik regresyon testi geçti. |
| K-F | 🟡 | Ertelendi | `js/styles.css:1108,1211` | `scaleX()` görsel eşdeğerliği ayrı karşılaştırma gerektiriyor; isteğe bağlı kaleme bu turda dokunulmadı. |

## Elle ve gerçek tarayıcı doğrulaması

`npm run test:admin`, geçici in-memory sunucu ve izole headless Chrome profiliyle
42/42 kontrol geçti. Gerçek `.env` değerleri rapora veya loga yazılmadı;
yanlış giriş ekranında sahte `wrong-admin` adı kullanıldı.

- [x] Oturumsuz `/admin` → `/admin/login`.
- [x] Yanlış kimlik bilgisi → hata; cookie yok.
- [x] Doğru kimlik bilgisi → panel.
- [x] Session Storage boş; `adminAuth` yok.
- [x] `ma_admin` HttpOnly, SameSite=Strict, Path=/, 30 dakika.
- [x] `document.cookie` içinde `ma_admin` görünmüyor.
- [x] Logout cookie'yi siliyor ve girişe döndürüyor.
- [x] Süresi geçmiş admin JWT paneli açamıyor.
- [x] Paneldeki tüm erişilebilir kontroller tıklandı; gerçek Spotify/iTunes
  sonucu ile preview açma, oynat/duraklat ve kapat da doğrulandı.
- [x] `admin/*.js` içinde parola, admin kullanıcı adı, `adminAuth` veya
  `sessionStorage` referansı yok.

Ekran kanıtları: [giriş](admin-panel-auth/01-login.png),
[yanlış giriş](admin-panel-auth/02-wrong-password.png),
[panel](admin-panel-auth/03-panel-session.png),
[kullanıcı detayı](admin-panel-auth/04-user-detail.png),
[preview ve kontroller](admin-panel-auth/05-panel-controls.png).

Cookie bayrakları ve CSP, DevTools UI ekran görüntüsü yerine Chrome DevTools
Protocol ile makinece okundu ve assertion ile doğrulandı. Bu ayrım önemli:
rapor bir DevTools Cookies/Console ekran görüntüsü alındığını iddia etmez.

## Mekanik doğrulama

- `npm run check`: 76 testin 74'ü geçti, MongoDB isteyen 2 test atlandı.
- `npm run audit`: 10/10 hedef geçti; 535 anahtar × 3 dil.
- `npm run test:admin`: 42/42; CSP ihlali 0; yakalanmamış istisna 0.
- `git diff --check`: geçti.

## Dürüstlük denetimi

| # | Kontrol | Bulgu | Kanıt |
|---|---|---|---|
| 1 | Eklenen kontroller gerçekten çalışıyor mu? | Evet | 42 adımlı Chrome koşusu ve beş ekran görüntüsü. |
| 2 | Uydurma veri var mı? | Hayır | Kullanıcı yalnız geçici in-memory sunucuda oluşturuldu; preview gerçek arama yanıtından. |
| 3 | Referanssız başarı iddiası var mı? | Hayır | Sayılar test çıktılarına bağlı. |
| 4 | Sentetik test cihaz testi gibi sunuldu mu? | Hayır | Headless Chrome ve CDP açıkça belirtildi. |
| 5 | Yarım özellik gizlendi mi? | Hayır | K-F ve aşağıdaki borçlar açık. |
| 6 | Her iddianın kanıtı var mı? | Evet | Birim/rota testleri, tarayıcı assertion'ları ve ekranlar. |

## Açık borç

- `admin/` sabit Türkçe dizeler ve `data-testid` defteri bakımından mevcut
  `scripts/audit.mjs` kapsamı dışında; i18n + testid ayrı iş.
- Tailwind CDN kaldırılmadı.
- `server.js` bölünmedi.
- K-F genişlik animasyonu ertelendi.
- DevTools Cookies/Console UI ekranı yerine CDP assertion kanıtı kullanıldı.

## Kullanıcıya düşen

`.env` için yeni değişken yok. `ADMIN_USERNAME`, `ADMIN_PASSWORD` ve
`JWT_SECRET` mevcut ve güçlü kalmalı. Production dağıtımı HTTPS olmalı;
kod `Secure` bayrağını production'da ekliyor. Push bu teslimde kullanıcının
açık talimatıyla yapılır; deploy yapılmaz.
