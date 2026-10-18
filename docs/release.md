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

## 7. Reklam ve hurda paketleri (sen)

Kod bağlı: ödüllü reklam `src/infrastructure/rewarded-ads.ts` (AdMob + Google onay ekranı/UMP), paketler `src/infrastructure/play-billing.ts` (Play Billing), seçim `src/main.ts`. Ödeme önce kayda yazılır, sonra Play'de tüketilir; arada uygulama kapanırsa bir sonraki açılışta bir kez eklenir.

Hangi sürüm ne gösterir:

| Sürüm | Reklam | Paketler |
|---|---|---|
| `npm run dev` (tarayıcı) | sahte sağlayıcı | sahte fiyatlar |
| Test APK (`npm run build`) | Google'ın **test** reklamı | Play'de ürün varsa |
| Mağaza (`npm run build:release`) | yalnızca `VITE_ADMOB_REWARDED_ID` verilmişse | Play'de ürün varsa |

Canlıya almak için:

1. **AdMob:** uygulamayı ekle, bir *Ödüllü* reklam birimi aç. Uygulama kimliğini (`~` içerir) `android/gradle.properties` içindeki `admobAppId`'ye, birim kimliğini (`/` içerir) `.env.release` içine `VITE_ADMOB_REWARDED_ID=...` olarak yaz. İkisi de gizli değildir.
2. **AdMob › Gizlilik ve mesajlaşma:** GDPR mesajını oluştur ve yayınla; yoksa AB'de onay ekranı çıkmaz ve reklam istenmez. Gizlilik politikası adresini gir.
3. **Play Console › Ürünler › Uygulama içi ürünler:** `scrap_small`, `scrap_medium`, `scrap_large` kimlikleriyle üç ürün aç, fiyatlarını ver, etkinleştir. Fiyatı oyun Play'den okur. Ödemeler cihazda doğrulanır (sunucu yok); hurda yalnızca görünüm ve Serbest Saha ekstrası aldığı için bu bilinçli bir sadelik.
4. **Satın almayı dene:** Play Console › Lisans testi'ne kendi hesabını ekle, imzalı sürümü *Dahili test*e yükle, Play'den indirip satın al (test kartıyla para çekilmez). Yandan yüklenen APK'da Play ürünleri görünmez.
5. **Hedef kitle:** Play Console'da hedef yaş grubunu **13+** seç. Çocuklara (13 altı) yönelik seçilirse Aileler politikası, sertifikalı reklam ayarları ve AdMob'da çocuk etiketi gerekir; bu sürüm buna göre ayarlı değil.
6. Mağaza listesindeki *Reklam içerir* ve *Uygulama içi satın alma* cevaplarını **Evet** yap ve *Veri güvenliği* formunu [store-listing.md](store-listing.md)'deki tabloya göre doldur.

Emülatörde (Play Store imajı, Android 17) doğrulananlar: onay bilgisi alınıyor, Google test reklamı yükleniyor, sonuna kadar izlenince +60 hurda ekleniyor ve günlük sayaç düşüyor, ardından sıradaki reklam kendiliğinden yükleniyor. Oturum açılmamış emülatörde Play Billing yok; paket bölümü hatasız gizleniyor. Gerçek satın alma ve AB onay ekranı bu adımda denenmedi (4. madde ve AdMob mesajı gerekir).

## 8. Yükleme (sen)

Play Console'da önce *Dahili test* kanalına yükle, birkaç cihazda dene, sonra *Üretim*e geç.
