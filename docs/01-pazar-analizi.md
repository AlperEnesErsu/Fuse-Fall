# Pazar Analizi — Fuse & Fall

> Tarih: 2026-10-16 · Durum: Taslak v0.1
> Not: Rakamlar üçüncü taraf tahmin servislerinden (AppGoblin, Marlvel, GameAnalytics özetleri) alınmıştır; denetlenmiş veri değildir. Karar verirken yön göstergesi olarak kullanılmalı.

## 1. Pazarın genel durumu

| Gösterge (2025) | Değer | Kaynak |
|---|---|---|
| Mobil oyun IAP geliri | 81,75 milyar $ (+%1,3; enflasyona göre düşüş) | Sensor Tower State of Gaming 2026 |
| Mobil oyun indirmeleri | 50,4 milyar (−%7,2) | Sensor Tower |
| Toplam oynanma süresi | 444,6 milyar saat (+%0,9) | Sensor Tower |
| Oyun pazarında mobil payı | %58 | Ampere Analysis |

**Yorum:** Pazar doymuş durumda. İndirmeler düşüyor ama oynanma süresi korunuyor. Kazanan oyunlar yeni kullanıcı toplamaktan çok **mevcut oyuncuyu tutanlar**. Saf hyper-casual geriliyor, yerine **hybrid-casual** (basit çekirdek + derin ilerleme) yükseliyor.

## 2. Niş: Fizik tabanlı yıkım bulmacaları

| Oyun | Model | Tahmini metrikler | Öğrenilecek ders |
|---|---|---|---|
| Royal Smash! – Physics Puzzle (Cypher Games) | Ağırlıklı IAP (~%77) | ~5,6M kurulum, ~1,2M MAU, aylık 500K$+ gelir | Niş para kazandırıyor; IAP ağırlıklı model reklamdan daha sağlıklı |
| Fake Island: Demolish! (UNICO Studio) | Reklam destekli | 4,5★ / ~116K yorum | Oyuncular yıkım fiziğini "rahatlatıcı" buluyor, **agresif reklamdan** şikâyet ediyor |
| Airstrike Assault | Reklam destekli freemium | Küçük | "Statik fizik" eleştirisi alıyor: fizik kalitesi farklılaştırıcı |
| Smash Fair / Smash Blast (Etermax vb.) | IAP / reklam | ~5K MAU, <10K$/ay | Büyük yayıncı adı tek başına yetmiyor; his ve kalite belirleyici |

## 3. Oyuncu beklentileri (yorumlardan çıkan sinyaller)

1. **Tatmin edici yıkım hissi**: Ana motivasyon "stres atmak" ve "rahatlamak".
2. **Kesintisiz oyun**: En sık şikâyet, seviye arası zorunlu reklamlar.
3. **Gerçekçi fizik**: Statik veya senaryolu yıkım çabuk sıkıcı hale geliyor.
4. **Çevrimdışı oynanabilirlik**: Metro, uçak ve kötü bağlantı senaryoları. Doğrudan pazar payı verisi bulunamadı, ama yorumlarda ve mağaza filtrelerinde ("offline games") sürekli talep görülüyor.

## 4. Elde tutma (retention) hedefleri

| Metrik | Genel medyan | En iyi %10 | Puzzle (ikincil kaynak) | **Bizim hedefimiz** |
|---|---|---|---|---|
| D1 | ~%22 | ~%40 | ~%32 | **≥ %35** |
| D7 | ~%3,4–3,9 | ~%12 | %10–20 (kaynaksız tahmin) | **≥ %12** |
| D30 | ~%0,7–0,8 | — | ~%5 | **≥ %4** |

## 5. Fırsat ve konumlandırma

**Boşluk:** Mevcut yıkım oyunları ya agresif reklamlı ve sığ (hyper-casual), ya da internet bağımlı. **Çevrimdışı, reklamla bölünmeyen, fizik kalitesi yüksek** bir yıkım bulmacası bu nişte belirgin bir fark yaratır.

**Konumlandırma cümlesi:**
> "Tek fitil, tek patlama, sonsuz zincir. İnternet gerekmeyen, 30 saniyede oynanan, bir türlü bırakamadığın yıkım bulmacası."

**Farklılaştırıcılar:**
1. %100 çevrimdışı: hesap yok, sunucu yok, veri toplama yok.
2. Malzemeye özgü gerçekçi parçalanma (ahşap, cam, beton, metal).
3. Patlama hissi ("game juice") birinci sınıf özellik olarak ele alınıyor.
4. Seviye aralarında zorunlu reklam yok.

## 6. Riskler

| Risk | Etki | Azaltma |
|---|---|---|
| Fizik motorunun düşük cihazlarda yavaşlaması | Yüksek | Cisim sayısı bütçesi, enkaz havuzlama, performans testleri (NFR-01) |
| İçerik tüketim hızı (seviyeler çabuk biter) | Yüksek | Günlük tohumlu (seeded) meydan okuma, yıldız hedefleri, sandbox modu |
| Fizik determinizmi (aynı hamle farklı sonuç) | Orta | Sabit zaman adımı, tohumlu rastgelelik |
| Niş küçük, yeni kullanıcı edinme pahalı | Orta | Paylaşılabilir tekrar (replay) GIF'leri, ASO'da "offline" anahtar kelimesi |
| İsim veya marka çakışması | Düşük | Yayın öncesi mağaza ve TÜRKPATENT taraması (henüz yapılmadı) |

## 7. Gelir modeli (karar sonraya bırakıldı)

Veriler IAP ağırlıklı modelin bu nişte daha iyi çalıştığını gösteriyor. Öneri: **ücretsiz + tek seferlik "Premium" satın alma** (tüm dünyalar ve kozmetik patlama efektleri), isteğe bağlı ödüllü reklam yok. Bu MVP kapsamı dışında. Kod, mimaride ödeme ve reklam modülü takılabilecek şekilde tasarlanacak.

## Kaynaklar

- [Sensor Tower: State of Gaming 2026 (özet)](https://gamedevreports.substack.com/p/sensor-tower-state-of-gaming-2026)
- [Ampere Analysis: Games industry in 2025](https://gameindustrylibrary.com/documents/games-industry-in-2025/read)
- [Royal Smash! – AppGoblin](https://www.appgoblin.info/apps/com.cyphergames.royalsmash)
- [Fake Island: Demolish! – Marlvel](https://marlvel.ai/api/llm/apps/games/fake-island-demolish)
- [Airstrike Assault – Marlvel](https://marlvel.ai/apps/airstrike-assault)
- [Smash Fair – AppGoblin](https://appgoblin.info/apps/6782118628)
- [Mobile retention benchmarks 2026 (PDF)](https://investgame.net/wp-content/uploads/2026/01/2026-01-20-Mobile_retention_benchmarks_2026.pdf)
- [Segwise: Retention benchmarks by genre](https://segwise.ai/blog/mobile-gaming-app-user-retention-strategies.md)
