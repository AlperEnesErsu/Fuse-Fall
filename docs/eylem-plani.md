# Eylem planı

> Başlangıç: 2026-11-15 · Kaynak: 2026-11-12 tarihli tasarım ve kod değerlendirmesi.
> Durum sütunu her PR'da güncellenir. K = küçük, O = orta, B = büyük.

## Değerlendirmenin dayandığı ölçümler

Kayıtlı çözümler gerçek fizikle oynatılarak ölçüldü (`tests/play.ts` ile):

| Ölçüm | Değer |
|---|---|
| Kayıtlı çözümün 3 yıldız verdiği görev | 72 / 90 |
| Kayıtlı çözümün 2 yıldız verdiği görev | 18 / 90 (hepsinde yıkım oranı eşiğin altında) |
| "Cerrahi" tarzının tuttuğu çözüm | 90 / 90 |
| par = azami şarj olan görev | 54 / 90 |
| Zaman aşımıyla biten çözüm (düzeltmeden önce) | 19 / 90 |
| Zaman aşımıyla biten çözüm (düzeltmeden sonra) | 3 / 90 |

## Faz 0 — Yayın engelleri

| İş | Bitiş ölçütü | Efor | Durum |
|---|---|---|---|
| Gizlilik sayfasına iletişim adresi | Yer tutucu kalmadı | K | Adres bekleniyor |
| Android yedeklemesi ile "yalnızca cihazda" ifadesi | Manifest ve metin aynı şeyi söylüyor | K | Karar bekleniyor |
| 360×640'ta menü taşması | Menü kaydırmadan sığıyor | K | Yapıldı |
| Kayıt başarısız olursa oyuncuya bildir | `save()` `false` dönünce uyarı çıkıyor | K | Yapıldı |
| Orta seviye Android'de FPS ölçümü | Ölçülmüş sayı `performance.md` içinde | K | Cihaz bekleniyor |

## Faz 1 — Deneme döngüsü

| İş | Bitiş ölçütü | Efor | Durum |
|---|---|---|---|
| Tekrar denemede yerleşimi koru | Şarjlar yerinde geliyor, ikinci basış temizliyor | K | Yapıldı |
| Durulma tespiti; zaman aşımı son patlamadan | Zaman aşımıyla biten çözüm en çok 2 | O | Yapıldı (19 → 3) |
| Çöküşte "atla" düğmesi | Rapor hemen açılıyor, sonuç değişmiyor | K | Yapıldı |
| Yerleştirme ızgarası; denge eşiği CI'da | Kolay ≥ %80, orta ≥ %65, zor ≥ %50 | O | Yapıldı. Beş görev yeniden düzenlendi; eşik `npm run balance` ile CI'da. En dar pay: Paris 9 (%50) |
| Kesilecek bağları önizlemede göster | Önizleme ile kesim aynı fonksiyon | O | Yapıldı |
| Başarısızlık nedenini sahnede göster | Ayakta kalan hedef vurgulu | O | Yapıldı |
| Çizim ara değerlemesi | 120 Hz ekranda titreme yok | O | Yapıldı; 120 Hz cihazda gözle doğrulanmadı |

**Kapı A:** 5–10 kişiyle oyun testi ([şablon](qa/playtest-template.md)).

## Faz 2 — Gösteri ve şehir

| İş | Bitiş ölçütü | Efor | Durum |
|---|---|---|---|
| Dikey ekranda kamerayı yapıya yaklaştır; son hedefte yakın çekim | Yapı ekran genişliğinin çoğunu dolduruyor | O | Yapıldı; kamera dikeyde 90 görevin 21'inde (ortanca 1,38 kat), yatayda 67'sinde (ortanca 1,43 kat) yaklaşıyor. Kalanlarda yerleştirme çerçevesi zaten dar |
| Simge yapı korunan komşu olsun | Her şehirde en az 2 görev | O | Yapıldı (20 görev; testle doğrulanır) |
| Şehre özgü bina oranları ve dokular | Ekran görüntüsünden şehir anlaşılıyor | B | Çatı, kat süsü ve pencere yapıldı (9 şehir). Bina oranları (dikeye göre dar ve yüksek yapılar) yapılmadı: görev düzeni ve denge işi |
| Yıkım sonrası yenilenen arsa | Raporda ve şehir haritasında görünüyor | O | Yapıldı |
| Şehir sonu gösteri görevi | 25+ blok, ölçülen FPS hedefin üstünde | O | Yapıldı: dokuz finalin hepsi 25+ blok (testle doğrulanır); en büyük yeni finallerde (Roma 33, New York 30) kare hızı Berlin 10'un üstünde |

**Gösteri binası:** hedeflerden ve korunan yapılardan uzakta, kendi parselinde duran, isteğe bağlı yıkılacak bina. Yerleştirme kuralları ve neyin işe yaramadığı: [seviye dengesi](level-balance.md).

**Kapı B:** mağazada kapalı ya da açık test.

## Faz 3 — Ustalık ve geri dönüş

| İş | Bitiş ölçütü | Efor | Durum |
|---|---|---|---|
| Yıldız kuralı: kazanç, par, görevin kendi ustalık hedefi | Kayıtlı çözüm görevlerin en çok yarısında 3 yıldız | B | Yapıldı (testle doğrulanır) |
| Her görev için 3 yıldızlı çözüm ve testi | 90 görevde 3 yıldız kanıtlı | B | Yapıldı: arama aracı `tests/mastery-search.test.ts`, sonuç `src/content/mastery.json` |
| Şehir açılma eşiklerini yeni kurala göre ayarla | Eski kayıtlar şehir kaybetmiyor | K | Yapıldı: görev başına ~1,8 yıldız; hiçbir eşik yükselmedi (testle doğrulanır) |
| Puanı kaldır ya da günlüğe bağla | Karar uygulanmış | K | Yapıldı: yalnız günlük görevde, zincir, domino ve hızı da ölçen puan |
| Günlük görev değiştiricileri | Aynalanmış çözüm testle doğrulanıyor | O | Yapıldı: aynalı (28 görev, testle kanıtlı) ve tasarruf (2 görev; nadir). Trafikli görevler aynalanmaz |
| Kodla meydan okuma | Kod gönderenin sonucunu taşıyor | O | Yapıldı: kod sonucu taşır, açan görev sonunda karşılaştırılır ve sonucunu geri gönderebilir |
| Hurdaya yeni harcama alanları; destekçi paketi | Oynanışı satın alınır kılmıyor | O | Yapıldı. Atölyede görev editörü parçaları: tuğla, cam, patlayıcı varil (1.000 hurda); yalnız oyuncunun kendi görevlerinde. Destekçi paketi: şimdilik yok (karar 2026-11-16) |
| Gönüllü geri bildirim düğmesi | Veri yalnız oyuncu gönderirse çıkıyor | K | Yapıldı: paylaşım menüsü üzerinden, gönderilecek metnin tamamı önceden gösterilir |

## Faz 4 — Kod sağlığı (diğer fazlarla paralel)

| İş | Bitiş ölçütü | Efor | Durum |
|---|---|---|---|
| CI: görev üretici farkı ve duman testi | Ayrışma ya da kırık ekran PR'da yakalanıyor | O | Yapıldı |
| Mobil tarayıcı motorlarında duman testi (Chromium, WebKit) | iPhone ve Android profilleri CI'da geçiyor | O | Yapıldı (`npm run e2e`) |
| Satın alma ve reklam akışına test | Üç dosya %80'in üstünde | O | |
| `session.ts`'i alt sistemlere böl; şarj türü strateji tablosu | Yeni şarj türü tek dosyada ekleniyor | B | |
| `onFinished`'i mod başına rapor stratejisine ayır | Kopya dallar kalmadı | O | |
| Adım başına bellek tahsislerini ölç | Ölçüm belgede | K | |

## Sonraya

Patlamada siper (görüş hattı) mekaniği ve iOS paketi.

## iOS testleri hakkında

iOS simülatörü yalnız macOS üzerinde Xcode ile çalışır; bu proje Windows'ta geliştiriliyor ve depoda iOS projesi yok. O zamana kadar iOS tarafı, Safari'nin motoru olan WebKit'te iPhone ekran profiliyle test edilir. Bu, düzen ve motor farklarını yakalar; gerçek cihazın performansını, dokunma gecikmesini ve çentik davranışını göstermez.
