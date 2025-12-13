# 🎵 Müzik Arşivi (V3)

Spotify API entegrasyonlu, kullanıcı verilerini yerel veritabanında saklayan modern bir kişisel müzik kütüphanesi uygulaması.

![Screenshot](file:///C:/Users/samed/.gemini/antigravity/brain/f8ba0cdc-9bdd-4173-af7f-73d84d2ea364/v3_artist_page_1765634096984.png)

## Özellikler (V3)

- 🔍 **Akıllı Arama (Autocomplete)**: Yazarken anlık Spotify sonuçları ve kütüphanenizden öneriler.
- 🎧 **Müzik Çalar**: Albüm detaylarında 30 saniyelik şarkı önizlemeleri.
- 📂 **Detaylı Görünüm**: Albüm içeriklerini ve şarkı sürelerini listeleyen modal pencereler.
- 👤 **Kullanıcı Profili**:
  - **Giriş Sistemi**: JWT tabanlı güvenli kimlik doğrulama.
  - **Kütüphanem**: Beğendiğiniz şarkılar ve takip ettiğiniz sanatçılar listesi.
- ❤️ **Kişiselleştirme**: Veriler SQLite veritabanında kalıcı olarak saklanır.
- 🎨 **Modern Arayüz**: Dark mode, responsive tasarım ve Tailwind CSS.

## Başka Bilgisayarda Nasıl Çalıştırılır?

Bu projeyi kendi bilgisayarınızda çalıştırmak için aşağıdaki adımları izleyin.

### 1. Gereksinimler

- [Node.js](https://nodejs.org/) (Sürüm 14 veya üzeri) yüklü olmalıdır.
- [Git](https://git-scm.com/) yüklü olmalıdır.

### 2. Kurulum

Terminali veya Komut İstemi'ni (CMD) açın ve sırasıyla şu komutları girin:

```bash
# 1. Projeyi klonlayın
git clone https://github.com/diyar4772/music-archive.git

# 2. Proje klasörüne girin
cd music-archive

# 3. Gerekli kütüphaneleri yükleyin
npm install
```

### 3. Ayarlar (.env Dosyası)

Bu proje Spotify API kullanır, bu yüzden kendi API anahtarlarınızı oluşturmalısınız.

1.  Proje klasöründe `.env.example` dosyasının adını `.env` olarak değiştirin (veya yeni bir `.env` dosyası oluşturun).
2.  [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/applications) adresine gidin.
3.  "Create an App" diyerek yeni bir uygulama oluşturun.
4.  Size verilen **Client ID** ve **Client Secret** bilgilerini `.env` dosyasına yapıştırın:

```env
SPOTIFY_CLIENT_ID=buraya_client_id_yapistir
SPOTIFY_CLIENT_SECRET=buraya_client_secret_yapistir
JWT_SECRET=rastgele_guvenli_bir_kelime_yaz
```

### 4. Çalıştırma

Her şey hazır! Şimdi sunucuyu başlatın:

```bash
node server.js
```

Tarayıcınızı açıp `http://localhost:3000` adresine gidin.

## Lisans

Bu proje **MIT Lisansı** ile lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakabilirsiniz.

Copyright (c) 2024 Samed Yolcu.
