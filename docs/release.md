# Yayın kontrol listesi (Google Play)

Sırayla. Senin yapman gerekenler **(sen)** ile işaretli; geri kalanı komutlarla hazır.

## 1. İmza anahtarı (bir kez) (sen)

Release paketi imzalı olmalı. Anahtarı kendin oluştur, repo dışında ve yedekli sakla. Kaybolursa uygulama bir daha güncellenemez.

```bash
keytool -genkeypair -v -keystore fuse-and-fall.jks -alias fuse-and-fall -keyalg RSA -keysize 2048 -validity 10000
```

`android/keystore.properties.example` dosyasını `android/keystore.properties` olarak kopyala ve doldur. Bu dosya ve `*.jks` git'e girmez. Play App Signing'i açmak önerilir: Google asıl anahtarı saklar, seninki yükleme anahtarı olur.

## 2. Sürüm numarası

`android/app/build.gradle`: her yüklemede `versionCode` +1; `versionName` görünen sürüm (1.0.0). `package.json` sürümü de aynı tutulur.

## 3. Release derlemesi

```bash
npm run build:release
```

```bash
npx cap sync android
```

```bash
cd android && ./gradlew bundleRelease
```

Çıktı: `android/app/build/outputs/bundle/release/app-release.aab`. `build:release`, `.env.release` sayesinde test anahtarını (`VITE_UNLOCK_ALL`) her zaman kapatır; `.env.local` dursa bile mağaza sürümünde ilerleme gerçektir. Test APK'sı için normal `npm run build` kullanılır.

## 4. Gizlilik politikası adresi (sen)

Play Console herkese açık bir adres ister. Sayfa hazır: `public/privacy.html` (Türkçe ve İngilizce). İletişim e-postasını sayfaya yaz, sonra yayımla. En kolayı GitHub Pages: depo ayarlarından Pages'i aç ve `dist/` içeriğini (ya da yalnızca `privacy.html`) yayımla.

## 5. Mağaza sayfası

- Metinler, veri güvenliği cevapları ve derecelendirme notları: [store-listing.md](store-listing.md).
- Görseller ve tanıtım klibi gerçek oynanıştan üretilir (geliştirme sunucusu açıkken):

```bash
npm run store-shots
```

`BROWSER` ortam değişkeni Chromium tabanlı bir tarayıcıyı göstermeli (örneğin Edge). Çıktı `store-assets/` (git'e girmez): Türkçe ve İngilizce dikey ekran görüntüleri (1080×1920), yatay ekran görüntüsü (1920×1080), öne çıkan görsel (1024×500) ve dikey tanıtım klibi. Uygulama ikonu: `public/icon-1024.png` (Play 512×512 ister; küçültülerek yüklenir).

## 6. Gerçek cihaz testi (sen)

Orta sınıf bir telefonda, uçak modunda: yatay ve dikey oynanış, oyun ortasında döndürme, çöküş anlarında akıcılık (konfeti + buz en ağır görünüm), titreşim, klip paylaşımı. Emülatörde doğrulananlar: ısınmış çöküşte ~59,5 FPS, MP4 klip paylaşım menüsüne ulaşıyor (Ankara 10: 11,8 sn), dikey düzen ve döndürme.

## 7. Reklam ve hurda paketleri (bağlanınca) (sen)

Kod hazır: kurallar `src/core/economy.ts`, paketler `src/content/offers.ts`, port `OfferStore` (`src/core/ports.ts`). Canlıya almak için:

- AdMob hesabı ve uygulama/ödüllü reklam birimi kimlikleri; Play Console'da `scrap_small`, `scrap_medium`, `scrap_large` adlı tek seferlik (tüketilebilir) ürünler.
- Bu kimliklerle gerçek bir `OfferStore` adaptörü (`src/infrastructure/offers.ts` yanında) ve `src/main.ts` içinde onun seçilmesi.
- **Dikkat:** reklam, uygulamaya internet izni ve reklam kimliği ekler. Gizlilik sayfası ("veri toplamaz, ağ izni yok") ve Play'deki *Veri güvenliği* formu buna göre güncellenmeli; reklamlar kişiselleştirilecekse AB/TR için onay ekranı (UMP) gerekir.

## 8. Yükleme (sen)

Play Console'da önce *Dahili test* kanalına yükle, birkaç cihazda dene, sonra *Üretim*e geç.
