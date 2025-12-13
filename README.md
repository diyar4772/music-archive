# Müzik Arşivi

Modern, modüler ve genişletilebilir müzik arşivi web uygulaması.

## Özellikler

- 🎵 Sanatçı kartları grid görünümü
- 📱 Mobil-öncelikli responsive tasarım
- 🎨 Modern dark tema
- 💾 JSON veri yapısı + localStorage desteği
- 🔌 ES Modules ile modüler mimari
- 📦 Hiçbir build adımı gerektirmez

## Çalıştırma

### Yöntem 1: Doğrudan Açma
`index.html` dosyasını tarayıcıda açın.

> ⚠️ Not: Chrome'da file:// protokolü ES modüllerini engelleyebilir. 
> Firefox'ta veya yerel sunucu ile deneyin.

### Yöntem 2: Yerel Sunucu (Önerilen)
```bash
cd "Music Library"
npx -y serve .
```
Ardından http://localhost:3000 adresine gidin.

## Proje Yapısı

```
Music Library/
├── index.html              # Ana sayfa
├── manifest.json           # PWA manifest
├── css/
│   ├── main.css           # Tasarım sistemi
│   └── components.css     # Bileşen stilleri
└── js/
    ├── app.js             # Uygulama giriş noktası
    ├── components/        # UI bileşenleri
    │   ├── ArtistCard.js
    │   ├── Modal.js
    │   └── AddArtistForm.js
    ├── services/          # Data servisleri
    │   └── dataService.js
    └── data/
        └── artists.json   # Sanatçı veritabanı
```

## Sanatçı Ekleme

1. Sağ üstteki "Sanatçı Ekle" butonuna tıklayın
2. Formu doldurun
3. Sanatçı otomatik olarak grid'e eklenir

## Gelecek Planlar

- [ ] Service Worker (offline destek)
- [ ] Arama ve filtreleme
- [ ] PWA yükleme
- [ ] Mobil uygulama (WebView)

## Lisans

MIT
