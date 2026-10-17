# Yayın kontrol listesi (Android)

Play Store'a çıkmadan önce sırayla:

1. **Test anahtarını kapat.** `.env.local` içindeki `VITE_UNLOCK_ALL=1` satırını sil. Açık kalırsa her şehir ve görev baştan açık gelir.
2. **Sürüm numarası.** `android/app/build.gradle` içinde `versionCode` (her yüklemede +1) ve `versionName`.
3. **İmza anahtarı.** Release build imzalı olmalı. Anahtar deposunu (`.jks`) kendin oluştur ve repo dışında, yedekli sakla; şifreleri koda ya da repoya koyma. Kaybolursa uygulama güncellenemez. Play App Signing kullanmak önerilir.
4. **Release build.** `npm run build`, `npx cap sync android`, sonra Android Studio'da *Build → Generate Signed App Bundle* (AAB).
5. **Gerçek cihaz testi.** Orta sınıf bir telefonda: çöküş anlarında akıcılık (toz bulutları, konfeti stili), dokunma, titreşim, klip paylaşımı (MP4/WebM, ses), uçak modunda tam oynanış.
6. **Gizlilik.** Oyun veri toplamaz, ağ izni yoktur; kayıt yalnızca cihazdadır. Play Console'daki *Veri güvenliği* formu buna göre doldurulur, kısa bir gizlilik politikası sayfası gerekir.
7. **Mağaza sayfası.** İkon (512 px), öne çıkan görsel (1024×500), ekran görüntüleri ve kısa video. Paylaşım klipleri bunun için doğrudan kullanılabilir.
