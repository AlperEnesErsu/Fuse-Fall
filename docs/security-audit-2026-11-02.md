# Güvenlik ve gizlilik denetimi — 2026-11-02

**Kapsam:** tam (kayıt, satın alma, ödüllü reklam, paylaşım kodları, arayüz, Android paketi, gizlilik politikası, depo).
**Yöntem:** kodu okuyarak; sızma testi yapılmadı. Sürüm: 1.1.0 + `main` (f40920e).

## Özet

| # | Bulgu | Önem | Durum |
|---|---|---|---|
| 1 | Gizlilik politikasında iletişim adresi yok (`[iletişim e-postası]`) | **Yüksek** (yayın engeli) | Açık: adres senin kararın |
| 2 | Gizlilik politikası "yalnızca cihazda, kaldırınca silinir" diyor; `allowBackup="true"` | Orta | Açık: karar gerekli |
| 3 | Hurda paketleri yalnızca cihazda doğrulanıyor | Orta | Açık: karar gerekli |
| 4 | Release derlemesinde R8 kapalı (`minifyEnabled false`) | Düşük | Bilgi |
| 5 | Paylaşım kodları, HTML, sırlar, reklam onayı, WebView | — | Sorun yok |

Yayına engel olan tek madde 1.

## 1. Gizlilik politikasında iletişim adresi yok — Yüksek

[public/privacy.html](../public/privacy.html) iki dilde de iletişim satırını yer tutucu olarak bırakıyor: `[iletişim e-postası]` / `[contact email]`. Google Play gizlilik politikasında geliştiriciye ulaşılabilecek bir yol ister. [release.md](release.md) §4 bunu "(sen)" adımı olarak listeliyor; adım henüz yapılmamış.

**Yapılacak:** yayın için kullanılacak e-posta adresini iki yere yaz ve `Son güncelleme` tarihini değiştir. 2. madde de aynı sayfayı değiştirdiği için ikisi birlikte yapılabilir.

## 2. Yedekleme ile gizlilik politikası çelişiyor — Orta

[AndroidManifest.xml](../android/app/src/main/AndroidManifest.xml) `android:allowBackup="true"` diyor ve yedekleme kuralı (`dataExtractionRules` / `fullBackupContent`) vermiyor. Android'in otomatik yedeği bu durumda uygulama verisini (WebView'in `localStorage`'ı, yani kayıt dahil) kullanıcının Google Drive yedeğine alabilir ve uygulama yeniden yüklenince geri koyar. Gizlilik politikası ise ilerlemenin "yalnızca kendi cihazınızda" saklandığını ve "uygulamayı kaldırınca silindiğini" söylüyor.

Yedek oyuncu için iyi bir şey (telefon değişince ilerleme taşınır) ve Google'a değil kullanıcının kendi hesabına gider. Ama metin bunu söylemiyor. Ayrıca `allowBackup` eski Android sürümlerinde `adb backup` ile kaydı dışarı alıp düzenlemeye izin verir; tek oyunculu bir oyunda bunun etkisi oyuncunun kendi hilesidir.

**Seçenekler (biri seçilmeli):**
- Yedeği koru, politikaya bir cümle ekle: "Android'in yedekleme özelliği açıksa ilerlemeniz Google hesabınızdaki cihaz yedeğine dahil olabilir." (Önerilen.)
- Ya da `allowBackup="false"` yap; o zaman telefon değiştiren oyuncu ilerlemesini kaybeder.

Not: otomatik yedeğin WebView verisini kapsadığını cihazda doğrulamadım; Android'in varsayılan kuralı bunu dışlamıyor.

## 3. Satın alma yalnızca cihazda doğrulanıyor — Orta

[play-billing.ts](../src/infrastructure/play-billing.ts) ve [offer-desk.ts](../src/app/offer-desk.ts): Play Billing'in döndürdüğü satın alma cihazda kabul ediliyor, hurda kayda yazılıyor, sonra tüketiliyor. Sunucuda makbuz kontrolü yok (oyunun sunucusu yok).

**Doğru yapılanlar:** ödeme önce kayda yazılıyor, kayıt tutunca tüketiliyor; aynı jeton iki kez sayılmıyor (son 20 jeton saklanıyor); kapanan uygulama sonraki açılışta ödüyor; bilinmeyen ürün kredilenmiyor; `autoAcknowledgePurchases: false`.

**Risk:** rootlu bir cihazda faturalandırmayı taklit eden araçlar bedava hurda alabilir. Etkisi yalnızca gelir kaybı: hurda tüketilebilir, rütbeye sayılmaz, çok oyunculu bir ekonomi yok, başka oyuncu etkilenmez.

**Seçenekler:**
- Riski kabul et ve Play Console'da iade/satış oranını izle. (Önerilen: oyunun çevrimdışı, hesapsız tasarımıyla uyumlu.)
- Ya da küçük bir sunucu ile Google Play Developer API üzerinden jeton doğrula; bu, oyuna ilk kez bir sunucu ve satın alma sırasında ağ bağımlılığı ekler (NFR-02 ve NFR-06'yı etkiler).

[Gereksinimler §7](02-gereksinimler.md) bunu açık soru olarak tutuyor.

## 4. R8 kapalı — Düşük

`android/app/build.gradle` release için `minifyEnabled false`. Oyunun kodu zaten WebView'deki JavaScript olduğu için gizlenecek bir şey kazandırmaz; açmak yalnızca yerel kütüphaneleri küçültür. Açılırsa AdMob ve Capacitor eklentileri için ProGuard kuralları denenmeli. İşlem gerekmiyor.

## 5. Sorun bulunmayanlar

- **Paylaşım kodları** ([share-code.ts](../src/core/share-code.ts)): güvenilmeyen girdi olarak ele alınıyor. Kod uzunluğu (12 000 karakter) ve açılmış boyut (48 KB, sıkıştırma bombasına karşı) sınırlı; bölüm, kampanya verisiyle aynı doğrulamadan geçiyor: sayılar sonlu ve dünya sınırları içinde, liste uzunlukları sınırlı. `id` her zaman `shared`, kampanya ilerlemesine dokunmuyor.
- **HTML enjeksiyonu:** arayüz metni `textContent` / metin düğümleriyle yazılıyor. Tek `innerHTML` ([icons.ts](../src/presentation/icons.ts)) sabit simge tablosundan besleniyor; oyuncu girdisi ulaşmıyor. `eval` / `new Function` yok.
- **Kayıt** ([local-save.ts](../src/infrastructure/local-save.ts), `parseProgress`): bozuk ya da yeni sürüm kayıt üzerine yazılmıyor, yedekten dönülüyor; her alan tür ve sınır kontrolünden geçiyor.
- **Sırlar:** depoda imza anahtarı, `keystore.properties` ya da API anahtarı yok (`android/.gitignore`). `.env.release` yalnızca `VITE_UNLOCK_ALL=0` içeriyor; release derlemesi bu anahtar açıkken duruyor.
- **Reklam onayı** ([rewarded-ads.ts](../src/infrastructure/rewarded-ads.ts)): Google UMP onayı istenmeden reklam istenmiyor; onay izin vermezse düğme çıkmıyor; ayarlarda gizlilik seçenekleri var.
- **WebView:** Capacitor yapılandırmasında uzak `server.url` ya da `allowNavigation` yok; düz HTTP açılmamış. İzinler yalnızca titreşim (ağ, reklam/ödeme eklentilerinden geliyor).
- **Hata ekranı (#18):** hatalar cihazdan çıkmıyor (NFR-06).
