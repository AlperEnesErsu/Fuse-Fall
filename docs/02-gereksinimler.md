# Gereksinimler — Fuse & Fall

> Tarih: 2026-10-16 · Durum: Taslak v0.1 · Öncelik: **M** = Must (MVP), **S** = Should, **C** = Could

## 1. Ürün vizyonu

Oyuncu her seviyede sınırlı sayıda patlayıcıyı bir yapının üzerine yerleştirir ve ateşler. Gerçekçi fizik ve zincirleme reaksiyonlarla yapıyı hedefe uygun şekilde yıkar. Bir seviye **15–40 saniye** sürer. Sürükleyicilik ilerleme, ustalık (3 yıldız) ve "bir kez daha" döngüsünden gelir.

### Çekirdek döngü

```
Yapıyı incele → Patlayıcı yerleştir → Ateşle → Yıkımı izle → Puan / yıldız → (Anında tekrar | Sonraki seviye)
```

### Sürükleyicilik katmanları

| Zaman ölçeği | Döngü | Mekanik |
|---|---|---|
| Saniyeler | Patlama hissi | Hit-stop, sarsıntı, enkaz, ses |
| Dakikalar | Seviye ustalığı | 3 yıldız hedefleri, anında yeniden deneme |
| Günler | İlerleme | Dünyalar, yeni malzeme ve patlayıcılar, günlük meydan okuma |
| Haftalar | Koleksiyon | Kozmetik patlama efektleri, başarımlar, sandbox |

## 2. Fonksiyonel gereksinimler

### Oynanış

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-01 | Oyuncu, seviyenin izin verdiği bölgelere patlayıcı yerleştirebilir, taşıyabilir ve kaldırabilir. | M |
| FR-02 | Oyuncu "Ateşle" ile tüm patlayıcıları seviyenin tanımladığı sırayla ve gecikmeyle patlatır. | M |
| FR-03 | Patlamalar yarıçap ve güç parametreleriyle cisimlere radyal itme uygular. | M |
| FR-04 | Malzemeler farklı davranır: **ahşap** (orta dayanım, kırılır), **cam** (düşük dayanım, çok parçaya ayrılır), **beton** (yüksek dayanım, büyük parçalar), **metal** (kırılmaz, ağır). | M (ahşap, beton), S (cam, metal) |
| FR-05 | Hasar alan bloklar dayanım eşiğini aşınca malzemeye özgü sayıda parçaya bölünür. | M |
| FR-06 | Patlayıcı variller ateşlenmeden zincirleme patlama başlatabilir. | S |
| FR-07 | Seviye hedefleri: (a) hedef blokları zemine indir, (b) yapının %X'ini yık, (c) korunan blokları sağlam bırak. | M (a), S (b, c) |
| FR-08 | Fizik durulduğunda (tüm cisimler uyuduğunda) veya zaman aşımında (8 sn) seviye değerlendirilir. | M |
| FR-09 | Yıldız puanlama: 1 = hedef tamamlandı, 2 = patlayıcı limitinin altında kalındı, 3 = bonus hedef (ör. yıkım oranı). | M |
| FR-10 | Tek dokunuşla yeniden deneme, 300 ms içinde. | M |

### İlerleme ve içerik

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-11 | Kampanya **bölümlere (başkentlere)** ayrılır; her bölüm 10 seviyedir. Bir şehir, önceki şehrin tüm seviyeleri bitince ve yıldız eşiği tutunca açılır. Seviyesi olmayan şehirler "Yakında" görünür. | M |
| FR-12 | Seviyeler veri dosyası (JSON) olarak tanımlanır, kod değişikliği gerektirmez. | M |
| FR-13 | Tarih tohumlu (seeded), **çevrimdışı üretilen** günlük meydan okuma. Aynı gün herkese aynı seviye. | S |
| FR-14 | Sandbox modu: sınırsız patlayıcı, hazır yapılar. | C |
| FR-15 | Başarımlar ve kozmetik patlama efektleri (renk, parçacık stili). | C |
| FR-16 | Yıkımın son 3 saniyesinin ağır çekim tekrarı. | S |

### Ayarlar ve erişilebilirlik

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-17 | Ses ve müzik seviyesi ayrı ayrı ayarlanabilir. | M |
| FR-18 | Ekran sarsıntısı ve flaş efektleri kapatılabilir (fotosensitivite). | M |
| FR-19 | Titreşim aç/kapa. | S |
| FR-20 | Türkçe ve İngilizce dil desteği. | S |

## 3. Fonksiyonel olmayan gereksinimler

| ID | Gereksinim | Ölçüt | Öncelik |
|---|---|---|---|
| NFR-01 | Performans | Orta seviye cihazda (ör. 4 yıllık Android) en kötü seviyede ≥ 55 FPS. Aynı anda en fazla 250 aktif fizik cismi. | M |
| NFR-02 | **Çevrimdışı** | İlk yüklemeden sonra hiçbir özellik ağ gerektirmez. Uygulama hiç ağ isteği yapmaz. | M |
| NFR-03 | Açılış süresi | Soğuk başlatmadan oynanabilir duruma ≤ 2 sn. | M |
| NFR-04 | Kalıcılık | İlerleme cihazda saklanır. Bozuk kayıt tespit edilirse yedekten dönülür, oyun çökmez. | M |
| NFR-05 | Determinizm | Aynı seviye, aynı yerleşim ve aynı tohum aynı sonucu verir (sabit zaman adımı 1/60 sn). | S |
| NFR-06 | Gizlilik | Hesap yok, analitik yok, kişisel veri toplanmaz. | M |
| NFR-07 | Paket boyutu | Web derlemesi ≤ 5 MB (sesler dahil). | S |
| NFR-08 | Platform | Masaüstü ve mobil tarayıcı (PWA) öncelikli. Capacitor ile Android/iOS paketi sonra. | M (PWA) |
| NFR-09 | Test edilebilirlik | Oyun mantığı (puanlama, hedefler, kayıt, seviye doğrulama) render'dan bağımsız birim testleriyle ≥ %80 kapsanır. | M |
| NFR-10 | Erişilebilirlik | Tüm oynanış tek dokunuşla/tıklamayla yapılabilir. Renk körlüğü için malzemeler şekil veya doku ile de ayırt edilir. | S |

## 4. Teknoloji kararları

| Karar | Seçim | Gerekçe |
|---|---|---|
| Dil | TypeScript (strict) | Tip güvenliği, refactor kolaylığı |
| Derleme | Vite | Hızlı geliştirme, küçük paket |
| Fizik | Matter.js | Olgun 2D motor, sabit adım desteği, hafif |
| Render | Canvas 2D (gerekirse PixiJS) | Bağımlılığı en aza indirmek; MVP için yeterli |
| Ses | Web Audio API | Düşük gecikme, katmanlı ses |
| Çevrimdışı | Service Worker + Web App Manifest (PWA) | NFR-02 |
| Kayıt | `localStorage` + şema sürümü + yedek anahtar | NFR-04, basitlik |
| Test | Vitest | Vite ile entegre |
| Kalite | ESLint + Prettier + `tsc --noEmit` | Tutarlı kod |

## 5. Yazılım mühendisliği ilkeleri

### Mimari: katmanlar, bağımlılık içe doğru

```
┌──────────────────────────────────────────┐
│ app/        Bootstrap, sahne yönetimi      │  → her şeye bağlı olabilir
├──────────────────────────────────────────┤
│ presentation/  Render, ses, efektler, UI   │  → core'a bağlı
├──────────────────────────────────────────┤
│ infrastructure/  Matter.js, localStorage   │  → core arayüzlerini uygular
├──────────────────────────────────────────┤
│ core/       Oyun kuralları, saf TS          │  → hiçbir şeye bağlı değil
└──────────────────────────────────────────┘
```

- **core** Matter.js, DOM veya tarayıcı API'si bilmez. Fizik dünyasına `PhysicsWorld` arayüzü üzerinden erişir. Bu sayede saf birim testleri yazılabilir ve fizik motoru değiştirilebilir.
- **Olay tabanlı efektler:** Core `ExplosionOccurred`, `BlockShattered`, `LevelCompleted` gibi olaylar yayınlar. Ses, sarsıntı ve parçacık sistemleri bunlara abone olur. Oyun mantığı efektleri bilmez.

### İlkeler

| İlke | Uygulama |
|---|---|
| **SRP** (tek sorumluluk) | Her modülün tek bir işi var: `ScoreCalculator` sadece puan hesaplar, `ScreenShake` sadece kamerayı sarsar. |
| **OCP** (açık/kapalı) | Yeni malzeme veya patlayıcı türü veri ve strateji ekleyerek gelir; mevcut kodu değiştirmeyi gerektirmez. |
| **DIP** (bağımlılığı tersine çevirme) | Core arayüz tanımlar (`PhysicsWorld`, `SaveRepository`, `Clock`), altyapı bunları uygular. |
| **Veri odaklı tasarım** | Seviyeler, malzemeler ve juice parametreleri JSON/sabit tablolardadır. Ayar yapmak için kod derlemek gerekmez. |
| **Sınırda doğrulama** | Seviye JSON'u ve kayıt verisi yüklenirken şema ile doğrulanır. Hatalar `Result` tipiyle döner, istisna fırlatılmaz. |
| **Sabit zaman adımı** | Fizik 1/60 sn sabit adımla, render değişken hızla çalışır (accumulator döngüsü). |
| **Nesne havuzlama** | Parçacık ve enkaz nesneleri yeniden kullanılır, çöp toplayıcı takılmaları önlenir. |
| **YAGNI / KISS** | Gelir, analitik ve bulut kayıt MVP'de yok. Sadece arayüz noktaları bırakılır. |
| **Test piramidi** | Çok sayıda core birim testi, az sayıda fizik entegrasyon testi, elle oynanış testi kontrol listesi. |
| **Sürüm kontrolü** | Git, Conventional Commits, `main` her zaman çalışır durumda. |

### Şehirler, araçlar ve mobil his (v0.2)

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-21 | Her şehrin kendine ait silüeti (simge yapılar) vardır. Arka plan, şehrin ilk seviyesinden sonuncusuna kadar şafaktan geceye ilerler. | M |
| FR-22 | Arabalar rotalarında ileri geri gider. Fitil yerleştirilirken de hareket ederler, böylece oyuncu ATEŞLE anını zamanlar. | M |
| FR-23 | Patlamaya yakalanan arabanın motoru durur. Hasarı dayanımını aşarsa araba hurdaya döner ve yakıt deposu ikinci bir patlama yaratır. | M |
| FR-24 | Hedef araba, hurdaya döndüğünde veya yüksekliğinin çoğunu kaybettiğinde düşmüş sayılır. | M |
| FR-25 | Mobil arayüz: kaydırılabilir şehir haritası, sağ başparmak altında büyük ATEŞLE düğmesi, dokunmatikte geniş seçim alanı, telefonda tam ekran + yatay kilit isteği, dikey telefonda "yan çevir" uyarısı. | M |
| FR-26 | Zamanlama gerektiren araba seviyeleri, aynı yerleşimle hemen ateşlendiğinde kazanılamaz (testle doğrulanır). | S |

### Yıkım mühendisi yönü (v0.3)

**Hedef kitle:** 16–40 yaş arası; bulmaca ve simülasyon seven, kısa ama düşündüren oturumlar arayan oyuncular. Ton profesyonel bir yıkım ekibinin tonudur: kısa, olgusal, hafif kuru. Çizgi film parlaklığı, emoji ve ödül konfetisi yok.

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-27 | **Korunan yapılar:** bazı seviyelerde komşu bina korunur. Herhangi bir patlama çemberi ona değerse, ya da yer değiştirir/eğilir/dayanımının yarısını kaybederse sözleşme iptal olur (görev başarısız). | M |
| FR-28 | Yerleştirme sırasında her şarjın patlama çemberi gösterilir. Korunan yapıya değen çember ve o yapı kırmızıya döner. Önizleme ile hasar kuralı core'daki aynı fonksiyonu kullanır. | M |
| FR-29 | **Yıkım raporu:** sonuç (BAŞARILI/BAŞARISIZ ve nedeni), hedefler, kullanılan şarj/par, yıkım oranı/eşik, korunan yapı durumu, süre, puan, en iyi puan ve üç kriter. | M |
| FR-30 | Puan = 1000 + kullanılmayan şarj başına 300 + 500 × yıkım oranı. Seviye başına en iyi puan cihazda saklanır (eski kayıtlarla uyumlu). | M |
| FR-31 | Endüstriyel görsel dil: kömür/çelik tonları, tek vurgu rengi olarak tehlike sarısı, dar büyük harfli başlıklar, SVG ikonlar, plastik patlayıcı görünümlü şarj, şerit desenli fünye düğmesi. | M |
| FR-32 | Ortam müziği yok; katmanlı patlama sesi (çatlama, gürleme, alt bas, yankı, düşen moloz) ve mekanik arayüz sesleri. | M |

### Sıralama, mobil ve oyuncuyu geri getirme (v0.4)

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-33 | Her şarjın kendi ateşleme gecikmesi vardır (50 ms adım, 0–2000 ms). Yeni şarj varsayılan olarak bir öncekinden 350 ms sonra patlar. | M |
| FR-34 | Gecikme çizelgesi: şarj başına bir şerit, sürükleyerek ayar. Londra'dan itibaren görünür; şarjların altında gecikme etiketi. | M |
| FR-35 | Londra (Bölüm 3): 10 görev. Konvoy görevleri ayrı gecikmeler gerektirir; varsayılan sırayla kazanılamadığı testle doğrulanır. | M |
| FR-36 | Tek yönlü trafik (`flow`) ve sabit altyapı blokları (`anchored`: hareketsiz, yıkılmaz, görev dışı). | M |
| FR-37 | Android uygulaması (Capacitor): yatay, tam ekran, ağ izni yok, titreşim izni var. | M |
| FR-38 | Yeni bir fikir getiren görevlerde adım adım eğitim (ilk görev, ilk korunan yapı, ilk araç, ilk gecikme görevi); görev bir kez geçilene kadar gösterilir, atlanabilir. | S |
| FR-39 | Günlük görev: tarihten seçilir, çevrimdışı; yalnızca par kadar şarj. Tüm çözümlerin par içinde kaldığı testle doğrulanır. Günlük seri (takvim günüyle). | S |
| FR-40 | Başarımlar (9 adet): kayda işlenir, açıldığında bildirilir, menüden listelenir. | S |
| FR-41 | Tekrar izle: aynı girişimin fiziği yeniden simüle edilir ve yavaş çekimde gösterilir. Fizik deterministik olduğu için kayıt gerekmez (testle doğrulanır). | S |

**Performans notu (NFR-01):** Yazılım GPU'lu emülatörde en ağır Ankara görevinde ortalama 23,9 → 35,3 FPS (efekt sprite önbelleği, dokunmatikte 1,5× çözünürlük). Bu sayılar gerçek cihazı temsil etmez; gerçek telefonda ölçüm henüz yapılmadı.

## 6. MVP kapsamı (Sürüm 0.1)

- 1 dünya, 10 seviye
- Malzemeler: ahşap, beton (cam ve metal v0.2'de)
- Tek patlayıcı türü + zincirleme varil
- Hedef tipi: hedef blokları zemine indir
- 3 yıldız puanlama, anında yeniden deneme
- Juice: hit-stop, sarsıntı, flaş, şok dalgası, parçacık, katmanlı sentez sesi
- Yerel kayıt, PWA ile çevrimdışı çalışma
- Ayarlar: ses, sarsıntı/flaş kapatma

**Kabul kriteri:** 10 seviye baştan sona çevrimdışı (uçak modunda) oynanabilir, NFR-01 performans hedefi tutar, core testleri geçer.

### Sürüm 0.2

- 5 bölüm: **Ankara** ve **Paris** oynanabilir (20 seviye); Londra, Roma ve Tokyo "Yakında"
- Paris 4. seviyeden itibaren hareketli arabalar (zamanlama, hurdaya dönme, ikinci patlama)
- Şehre özgü silüetler ve şafaktan geceye ilerleyen gökyüzü
- Mobil arayüz (FR-25)

## 7. Açık sorular

1. Kısa vadede Android/iOS paketi (Capacitor) ne zaman?
2. Londra, Roma, Tokyo için yeni mekanikler: hareketli platform, vinç, tren?
3. Gelir modeli kararı (bkz. pazar analizi §7) ne zaman verilecek?
