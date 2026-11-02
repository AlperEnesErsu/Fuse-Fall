# Değişiklik günlüğü

Fuse & Fall'daki önemli değişiklikler. Sürüm numarası `package.json`'dan gelir (bkz. [yayın kontrol listesi](docs/release.md) §2). Mağazadaki "Yenilikler" metni [store-listing.md](docs/store-listing.md) içindedir; bu dosya ise geliştirici için tam listedir.

Biçim [Keep a Changelog](https://keepachangelog.com/tr-TR/1.1.0/) düzenine yakındır: her sürümde **Eklendi**, **Değişti**, **Düzeltildi**.

## [Yayınlanmadı]

### Eklendi

- Bloklar bina gibi görünür; yıkılacak bina ikaz bandıyla işaretlidir (#13).
- Atölye, hurdanın artık neye yettiğini gösterir: menüde "N yeni", raporda "Atölyede şimdi" satırı, yeni ürünlerde etiket (#14).

### Düzeltildi

- Her derleme `dist/` klasörünü baştan temizler. Node 24'te `fs.rmSync` "Masaüstü" gibi ASCII olmayan yollarda hiçbir şey silmiyordu; eski paketler birikiyor ve `cap sync` 190 dosyayı (18 MB) APK'ya koyuyordu (#15).

## [1.1.0] - 2026-10-31

### Eklendi

- Berlin: vinçlere asılı yıkım gülleleri ve on görev.
- Madrid: raylarda giden tramvaylar ve hareketli hedefli on görev.
- New York ve yeni mekanikler için tanıtım kartları.
- Zorluk eğrisi, ipuçları, Serbest Şantiye'de trafik ve hurda teklifleri.
- Erişilebilirlik ayarları (sarsıntı, flaş, titreşim, hareket azaltma) ve kariyer istatistikleri.
- AdMob ödüllü reklam ve Google Play hurda paketleri.
- Uyarlanan prosedürel müzik ve haftalık sözleşmeler.
- Daha bağışlayıcı yerleştirme, yuvarlanan şarj, yönlü şarj, yükleme seçimi ve dokunmatik katmanlar.
- Ağır çekim tekrarında hız seçimi; atölyede iki yeni patlama stili.
- Görev kurucu: blokları sahaya yerleştir, deneme atışıyla çözümü belirle, malzeme seç; görevler metin koduyla paylaşılır ve yapıştırılan kod kurucuda açılır.
- Her şehrin atölyede kendi patlama stili ve blok teması (şehir setleri) (#11).
- Rapor, işin neden ödeme yapmadığını ve başarısız işte neyin kaldığını söyler (#7).

### Değişti

- Görev yalnızca her hedef yere inince kazanılır (#2); zor görevler bu kurala göre yeniden dengelendi (#9).
- İpucuyla kazanılan görev bir yıldız verir; başarısızlıklar kayıtta kalır (#10).
- `Game` sınıfı ekran akışı ve oyun denetleyicisi olarak ikiye ayrıldı.
- Mağaza sayfası dokuz şehir ve yeni kurallarla güncellendi (#12).

### Düzeltildi

- Görev tekrarıyla hurda ve sözleşme kasılması engellendi (#1).
- Günlük görev herkes için ve gün boyu aynı (#3).
- Park hâlindeki korunan araç, yerinde durduğu için hasar almıyor (#4).
- Okunamayan kayıt dosyası üzerine yazılmıyor, kenara ayrılıyor (#5).
- Başarısız günlük görev hurdasını günde bir kez öder (#6).
- Kurucu, yerleştirme anında düşük hedefi reddeder; görev boyutu sınırlandı (#8).
- Odaktaki düğmede klavye, iki parmakla yakınlaştırma, satın almanın güvenli kapatılması ve release derlemesi korumaları.

## [1.0.0] - 2026-10-17

İlk mağaza paketi: imzalama, release modu, gizlilik politikası, mağaza metni ve görselleri.

### Eklendi

- Dört yeni şehir: gecikme zaman çizelgesi (Londra), hassas şarj ve enkaz alanı (Roma), tren penceresi (Tokyo), serbest düşüşlü bombalar (İstanbul).
- Gerçekçi yapılar: harç bağlantıları, düzensiz kırıklar, malzeme dokuları; toz bulutu, ağır çarpma sesi ve kritik kırılma kamerası.
- İmplozyon şarjı, daha esnek toleranslar ve oyun tarzı yıldızları.
- Kariyer ve atölye: hurda ekonomisi, rütbeler, patlama stilleri.
- Serbest Şantiye kum havuzu.
- Günlük görev, başarımlar ve ağır çekim tekrar.
- Klip paylaşma, devam et ve geri al.
- Kısmi kazanç, kutlama, canlılık işaretleri ve hızlı modlar.
- Dikey ekran düzeni.
- Android uygulaması, görev eğitimleri, uygulama ikonu, açılış ekranı ve İngilizce dil.

### Değişti

- Değişmeyen HUD kareleri atlanır; paylaşım klipleri kısaldı.

### Düzeltildi

- Tuval boyutu sıfırken oyun döngüsü durmuyor.

## [0.1.0] - 2026-10-17

- İlk sürüm: çevrimdışı fizik tabanlı yıkım bulmacası, Ankara ve Paris görevleri.

[Yayınlanmadı]: https://github.com/AlperEnesErsu/Fuse-Fall/compare/0aa94c8...main
[1.1.0]: https://github.com/AlperEnesErsu/Fuse-Fall/compare/b016950...0aa94c8
[1.0.0]: https://github.com/AlperEnesErsu/Fuse-Fall/compare/f4bf03d...b016950
