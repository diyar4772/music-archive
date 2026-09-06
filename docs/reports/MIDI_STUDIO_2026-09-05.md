# MIDI stüdyosu — 5 Eylül 2026

## Teslim kapsamı

Güncel `MUSIC-ARCHIVE-BRIEF.md` incelendi; eski stabilizasyon promptunun artık
geçerli olmayan başlangıç varsayımları uygulanmadı. Faz 0 düzeltmeleri
`b0e670b` commit'indedir. Ardından brifin sonundaki ilk uçtan uca MIDI akışı
isteği uygulandı: giriş → canlı nota → kayıt → kalıcı arşiv → yeniden dinleme.
Bu teslim bütün fazların bittiği anlamına gelmez; yeni ekranlar deneysel işaretlidir.

Mevcut tasarım ve Vanilla JS/Express/Mongoose mimarisi korundu. Bağımlılık
eklenmedi. Motor, mevcut derlemesiz web uygulamasına uygun bağımsız ES modülleri
olarak yazıldı; brifte önerilen TypeScript derleme katmanı bu teslimde eklenmedi.
Çalışmalar ekranı bu ilk akışın eser/kayıt ilişkisini kurar; Faz 6'nın tamamı değildir.

## Envanter ve gerçeklik kontrolü

| Alan | Başlangıç durumu / sonuç |
|---|---|
| Web başlangıcı | Çalışıyor: tek `js/app.js` ESM başlangıcı; Flutter yok |
| Mobil | Expo/React Native; bu teslimde değiştirilmedi |
| API | Express `server.js`: auth, arşiv, listeler, puanlar/notlar, Spotify/iTunes, admin, Dig |
| Mevcut modeller | User, Follow, AlbumFollow, Like, Playlist, PlaylistTrack, Rating, LoginHistory |
| Giriş ve oturum | Mevcut testlerde ve Chrome kayıt/giriş/yenileme akışında doğrulandı |
| CORS / route gölgelemesi | Önceden düzelmiş; mevcut izin listesi ve duplicate route regresyonları geçti |
| Bozuk URL parametresi | Kırık bulundu; URLSearchParams ile düzeltildi ve test eklendi |
| Arşiv hata ekranı | Kısmi bulundu; strict yükleme ve tekrar deneme eklendi |
| Çıkış | Çift çağrı ve bellekte kalan albümler düzeltildi |
| Tasarım | Mevcut koyu/açık palet kullanıldı; yeni stüdyo CSS'i ortak değişkenlerle çalışıyor |
| Stüdyo/kayıtlar | Başlangıçta yoktu; bu teslimde ilk MIDI akışı eklendi |
| `js/models` / `js/adapters` | Eski soyutlamalar korundu; bu teslimde silinmedi |
| Canlı Spotify | Uzak hesaplarla yeniden sınanmadı; mevcut kontrollü API regresyonları geçti |

Geliştirme ve üretim başlangıcı yerel MongoDB ile çalıştırıldı. Web için ayrı
`build` komutu yoktur; HTML/CSS/ES modülleri doğrudan sunulur. Çalıştırma komutları
README'de birleştirildi. Uzak `.env` veritabanı testi otomatik onay denetimince
reddedildi; bunun yerine resmi MongoDB paketi `/tmp` altında, yalnız
`127.0.0.1:27027` üzerinde ve yeni test verileriyle çalıştırıldı. Uzak arşive
doğrulama verisi yazılmadı.

## Çalışan akış

- Web MIDI cihaz seçimi, izin hatası ve hot-plug; 16 kanalda note on/off,
  velocity, sustain CC64, all-notes-off/all-sound-off.
- Canvas üzerinde 88 tuş ve son 8 saniyenin piano roll'u; nota adı/solfej,
  MIDI velocity göstergesi, tam ekran ve takılı notaları bırakma.
- Açıkça etiketli ekran piyanosu; fiziksel klavye ve pointer girişi.
- Başlık, açıklama, etiket, eser ve deneme grubu ilişkileriyle MIDI kaydı.
- Sunucuda yalnız MongoDB kalıcılığı; uçucu veritabanında kayıt uçları 503 verir.
- Hesap kimliğiyle ayrılmış IndexedDB taslakları, saniyelik checkpoint,
  yükleme hatası/yeniden deneme ve `.mid` indirme.
- Sunucuda kullanıcı + kayıt UUID'si için benzersiz indeks; aynı içeriği tekrar
  yükleme idempotent, aynı UUID ile farklı içerik 409.
- Kayıt listesi 50'şer öğe yükler; büyük olay dizileri yalnız kayıt detayında gelir.
- Yeniden oynatma, duraklat/devam, ileri/geri sarma; ses sentetik olarak etiketli.
- Eser ve kişisel not oluşturma; arşivdeki beğenilmiş esere isteğe bağlı bağlama.
- Kaydı yüklerken yeni deneme başlatma engeli; takılı yüklemeye 30 saniye sınırı.

## Veri ve güvenlik

Yeni modeller `Recording` ve `Piece`; eski koleksiyonların yapısı değiştirilmedi.
Kayıt kaynağı `midi`, giriş türü `midi` veya `simulation`, enstrüman `piano`.
Dosya yolu, kullanıcı kimliği ve kalıcılık durumu istemciden kabul edilmez.
API sahibi token'dan alır, kullanıcı varlığını ve eser ilişkisini sunucuda denetler.
Başka kullanıcının kayıt detayına ve eserine erişim 404; oturumsuz erişim 401.
Kullanıcı silme akışına kendi Recording/Piece verilerinin temizliği eklendi.

Olay sayısı en fazla 60.000, süre en fazla 60 dakika; byte değerleri, mesaj türü,
monoton zamanlama, başlık/etiket/açıklama sınırları doğrulanır. MIDI dışı ve SysEx
yükleri reddedilir. Arayüz kullanıcı metinlerini `textContent` ile oluşturur.
Başlıkta `<b>` içeren gerçek tarayıcı kaydıyla HTML enjeksiyonu denetlendi.

## Doğrulama kanıtları

- Başlangıç: ESLint temiz, 41/41 mevcut backend testi.
- Faz 0: 42/42; bozuk URL için yeni regresyon.
- `test/midi.test.js`: 10 sesli sentetik akor, kanal izolasyonu, velocity-zero,
  sustain/retrigger, hot-plug, geç gelen izin sonucu, kaynak temizliği,
  sınırlı piano roll geçmişi, standart MIDI başlığı ve zamanlaması, yük doğrulaması.
- `test/studio-api.test.js`: gerçek yerel MongoDB ile 10 kayıt, eşzamanlı
  tekrar yükleme, değiştirilmiş içerik için 409, ikinci kullanıcı için 404,
  liste ve eser izolasyonu, HTTP/Mongo bağlantılarının kapatılıp açılması,
  tekrar giriş ve DB kapalıyken 503. Bunlar 10 ayrı tarayıcı çıkış/giriş döngüsü değildir.
- `test/browser/studio-smoke.mjs`: gerçek Chrome formuyla hesap açma,
  simülasyonla çalma, kayıt/oynatma, yenileme, çıkış/giriş, ağ kesintisi,
  IndexedDB'den kurtarma, tekrar yükleme, eser seçimi, izin reddi,
  1440/768/375 genişlikleri ve stüdyodan çıkışta kaynak temizliği.
- İzin reddi ve ağ kesintisi kontrollü hata enjeksiyonudur; fiziksel cihaz testi
  olarak sunulmaz. Chrome ses motorunun çalışması doğrulandı; hoparlörden dinleme yapılmadı.
- CI'a izole MongoDB servisi eklendi; yerel ortamda entegrasyon komutu çalıştırıldı.
  GitHub CI'ın sonucu ayrıca uzaktaki iş çalıştıktan sonra görülebilir.

## Sınırlar ve sıradaki işler

Faz 1'in eski ekranlardaki tüm px/renk değerlerinin token'a taşınması, her
ekranın dört durumu ve tam AA denetimi tamamlanmadı. Yeni stüdyo gövdeleri
Türkçe; ana gezinme ve mevcut arşiv TR/EN/KU desteğini korur.

Faz 2: gerçek cihazda 30 dakika, 10 sesli akor ve ~30 ms ekran gecikmesi
ölçülmedi. Örnek tabanlı piyano sesi yerine açıkça belirtilen sentetik önizleme var.
Faz 3: temel MIDI kalıcılığı hazır; count-in, metronom, A–B döngüsü, zaman
işaretli notlar, gerçek ses kaydı ve 10 tam tarayıcı çıkış/giriş döngüsü bekliyor.
Faz 4–8: mikrofon, analiz, akort, PDF/nota ekleri ve gelişmiş çalışma araçları
başlatılmadı. Uydurma analiz, başarı puanı veya demo katalog kaydı eklenmedi.

Checkpoint aralığı bir saniyedir: ani tarayıcı/işletim sistemi çökmesinde son
bir saniye kaybolabilir. Graceful stop son kopyayı yazar. Site verilerini silmek
yerel taslakları siler; önemli denemeleri `.mid` olarak da indirin. Toplam kullanıcı
depolama kotası ve uzun kayıt oynatımında cihaz performansı ayrıca ölçülmelidir.

## Kullanıcının cihaz testi

1. HTTPS veya localhost üzerinde giriş yapın; Stüdyo → MIDI bağla → piyanonuzu seçin.
2. Tek tek notalar, 10 sesli akor ve sustain pedalı deneyin. C–D–E / Do–Re–Mi'yi değiştirin.
3. Tuşlar basılıyken USB'yi çıkarıp takın; takılı nota kalmadığını ve cihazın geri geldiğini kontrol edin.
4. Bir dakika çalıp durdurun; Arşive kaydet → yenile → çıkış/giriş → Kayıtlarım → Dinle.
5. Ağı kapatıp ikinci kayıt yükleyin; ağı açıp Kayıtlarım → Tekrar yükle kullanın.
6. 30 dakika çalışın; sonra stüdyodan çıkın. Cihaz modeli, işletim sistemi,
   tarayıcı sürümü, gecikme/takılı nota olup olmadığı ve sorun adımını bildirin.

Mikrofon yolu henüz eklenmediğinden bu sürümde mikrofon izni istenmez.
