# Değişiklik günlüğü

Fuse & Fall'daki önemli değişiklikler. Sürüm numarası `package.json`'dan gelir (bkz. [yayın kontrol listesi](docs/release.md) §2). Mağazadaki "Yenilikler" metni [store-listing.md](docs/store-listing.md) içindedir; bu dosya ise geliştirici için tam listedir.

Biçim [Keep a Changelog](https://keepachangelog.com/tr-TR/1.1.0/) düzenine yakındır: her sürümde **Eklendi**, **Değişti**, **Düzeltildi**.

## [Yayınlanmadı]

### Eklendi

- Bloklar bina gibi görünür; yıkılacak bina ikaz bandıyla işaretlidir (#13).
- Atölye, hurdanın artık neye yettiğini gösterir: menüde "N yeni", raporda "Atölyede şimdi" satırı, yeni ürünlerde etiket (#14).
- Oyun açılırken ya da her karede hata verirse "Bir şeyler ters gitti" paneli ve yeniden başlat düğmesi çıkar; tek bir hata oyunu durdurmaz.
- Büyük yazı ayarı sahadaki şarj numaralarını ve gecikme etiketlerini de 1,5 kat büyütür (#20).
- `npm run smoke`: ana ekranları gerçek tarayıcıda oynayıp görüntüleriyle rapor yazar; `npm run perf`: açılış süresini ve en ağır görevde kare hızını ölçer.
- Güvenlik ve gizlilik denetimi (`docs/security-audit-2026-11-02.md`) ve oyun testi şablonu (`docs/qa/playtest-template.md`).
- GitHub Actions her PR'da tip kontrolü, lint, testler, kapsam eşiği ve derlemeyi çalıştırır (#17).

- "Tekrar dene", ateşlenmiş bir denemeden sonra şarjları yerlerinde geri getirir; oyuncu birini kaydırıp yeniden ateşler. Yerleştirirken bir kez daha basmak sahayı temizler. İpucuyla kurulan yerleşim sonraki denemede de ipuçlu sayılır.
- Çöküş sırasında "Atla" düğmesi: kalan fizik adımları izlenmeden çalışır, sonuç aynıdır. Bomba havadayken ve Anında Patlat'ta çıkmaz.
- İlerleme kaydedilemezse (depolama dolu ya da kapalı) oyuncu bir kez uyarılır.
- Yerleştirirken her şarjın keseceği bağlar küçük turuncu çarpılarla işaretlenir. Önizleme, patlamanın kullandığı kuralın kendisidir.
- Başarısız görevde ayakta kalan hedef kırmızı halkayla ve inmesi gereken çizgiyle gösterilir; rapordaki "Sahneyi gör" düğmesi raporu kenara alır.
- Çizim, iki fizik adımı arasını ara değerler: 90 ve 120 Hz ekranlarda ve yavaş çekim tekrarda hareket akıcıdır. Fizik ve sonuçlar değişmez.
- ATEŞLE'den sonra kamera şarj bölgesini bırakıp yapıya yaklaşır (en çok 1,9 kat); zemin ekranda yerinde kalır. Yerleştirme çerçevesinin zaten dar olduğu görevlerde ve Anında Patlat'ta kamera oynamaz; "hareketi azalt" ayarı bunu kapatır.
- Son hedef düşerken kamera ağır çekimle birlikte hedefe doğru kısa bir yakın çekim yapar.
- Şehrin simge yapısı artık görevin içinde, korunan komşu olarak: Ankara'da anıt mezar, Paris'te zafer takı, Londra'da saat kulesi, Roma'da amfitiyatro, Tokyo'da pagoda, İstanbul'da taş kule, Berlin'de kapı, Madrid'de şehir kapısı, New York'ta basamaklı kule. Her şehirde en az iki görevde yer alır; kural aynıdır (patlama değmemeli), yalnız çizim değişir. Madrid 4'e bu amaçla korunan bir yapı eklendi.
- Binalar şehrine göre giyinir: Ankara'da güneş enerjisi deposu ve balkon korkuluğu, Paris'te mansart çatı ve demir korkuluk, Londra'da kırma çatı ve baca, Roma'da kiremit ve çamaşır ipi, Tokyo'da saçaklı çatı ve fener, İstanbul'da kiremit çatı, ahşap payanda ve kafesli pencere, Berlin'de basamaklı alınlık, Madrid'de korkuluklu teras ve tente, New York'ta su deposu ve yangın merdiveni. Yalnız çizim değişir; bloklar ve fizik aynıdır.
- Kazanılan her görevin arsası yenilenir: park, yeni konutlar (şehrin kendi çatısı ve pencereleriyle), meydan ya da oyun parkı. Raporda küçük bir resim ve bir satırla gösterilir; şehir kartının sokağında biten görevlerin arsaları yenilenmiş, bitmeyenler şantiye perdesinin arkasında görünür. Aynı görev hep aynı şeyi bırakır.
- Ankara, Roma, Tokyo, Madrid ve New York finalleri gösteri binası alacak şekilde yeniden düzenlendi; artık dokuz şehrin finali de en az 25 blok (testle doğrulanır). Ankara'da anıt sağ kenara geçti, soldaki kulenin sütunları ahşap oldu ve ortadaki kulenin zemin katı uzadı; Madrid'de şehir kapısı sola geçti; New York'ta iki korunan komşu ve aradaki blok 100 px sağa kaydı; Roma'da enkaz alanı oranı, standart şarjın gerçekten kaybettiği yere çekildi.
- Enkaz alanı kuralı gösteri binasını saymaz: bina alanın dışında kendi parselinde durur, ne durduğu yer ne enkazının düştüğü yer görevi etkiler.
- Paris ve Londra finallerinde gösteri binası: açık zemin katın üstünde tuğla dolu, hedef olmayan, yıkılacak bir bina. Görev onsuz kazanılır; yedek şarj onu yıkar, çöküşü büyütür ve "tam yıkım" yıldızını getirir, ama "cerrahi" yıldızına mal olur. İki final 25 ve 26 bloğa çıktı. Londra finaline bunun için dördüncü şarj eklendi.
- `npm run perf` başka görevi de ölçebilir (`PERF_JOB=w2-10`); gösteri binası olan finalde yedek şarjı da ateşler.
- Eylem planı: `docs/eylem-plani.md`.
- `npm run e2e`: oyunu dokunmatik telefon profilleriyle iki mobil motorda oynar (Chromium: Android, WebKit: iOS; dikey, yatay ve 360×640). CI her PR'da çalıştırır. CI ayrıca görev JSON'unun üreticisiyle aynı olduğunu doğrular.

### Değişti

- Şarjlar 5 piksellik ızgaraya oturur: aynı görünen yerleşim aynı yerleşimdir ve aynı sonucu verir. Kayıtlı çözümler ızgaraya taşındı; Ankara 7, Paris 9 ve New York 8'in çözümü çevresi en sağlam ızgara noktasına alındı.
- Beş görev yakın ıskalarda fazla kırılgandı ve yeniden düzenlendi: Roma 3 (çözümü, öğretilen içe çöken şarj oldu; %59 → %82), Roma 7 (şantiye sağa genişledi; %57 → %80), Roma Finali (kulenin zemin katı uzadı, şantiye genişledi, çözüm sağlam noktalara taşındı; %48 → %74), İstanbul 2 (korunan evler uzaklaştı; %63 → %71), Berlin Finali (korunan komşu uzaklaştı; %40 → %54).
- `npm run balance` ve CI: her görev, zorluğuna göre bir yakın ıska eşiğini tutmak zorunda (kolay %80, orta %65, zor ve uzman %50).
- Durulma tespiti: kaynaklı blokların yerinde titremesi ve molozun saniyede birkaç piksel sürünmesi artık "hâlâ çöküyor" sayılmaz; henüz düşmemiş bir hedef kımıldadıkça hüküm bekler. Kayıtlı çözümlerde zaman aşımıyla biten görev 19'dan 3'e indi.
- Zaman aşımı ateşlemeden değil son patlamadan sayılır: fitiliyle geç patlayan bomba ya da arabalı şarj da çöküşü için tam süreyi alır.

### Düzeltildi

- 360×640 dikey ekranda ana menü kaydırmadan sığar.
- Web Audio bulunmayan ya da ses bağlamı açamayan tarayıcıda her düğme dokunuşu hata verip hiçbir şey yapmıyordu; oyun artık sessiz çalışır. Eski Safari'nin `webkitAudioContext` adı da tanınır.
- Küçük dikey ekranda yıkım raporunun düğmeleri panelin altında kesiliyor ve ulaşılamıyordu; düğmeler artık hep görünür, "Sonraki görev" en üstte ve tam genişlikte.
- Görev bitince "Atla" düğmesi raporun arkasında görünür kalmaz.
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
