# Performans ölçümü

NFR-01 (en kötü seviyede ≥ 55 FPS) ve NFR-03 (soğuk açılıştan oynanabilir duruma ≤ 2 sn) için `npm run perf` ([tools/perf-probe.mjs](../tools/perf-probe.mjs)) kullanılır.

## Nasıl ölçülür

```bash
npm run build && npx vite preview --port 4173   # açılış süresi mağaza derlemesinde ölçülür
npm run dev                                     # kare hızı geliştirme derlemesinde (dünya koordinatları gerekir)
BROWSER="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" npm run perf
```

- **Soğuk açılış:** önbellek kapalı, 360×640 telefon ekranı; sayfanın açılmasından menüdeki ilk düğmenin çıkmasına kadar geçen süre, üç denemenin ortancası.
- **Kare hızı:** Berlin 10 (28 blok ve yıkım güllesi; bloklar düşerken parçalanır), kayıtlı çözüm yerleştirilip ateşlenir, `requestAnimationFrame` ile 6 saniye kare süresi kaydedilir.
- CPU 1× ve 4× yavaşlatılarak ölçülür. 4×, Lighthouse'un orta seviye telefon varsayımıdır.

## Sonuçlar — 2026-11-02

Masaüstü Edge (headless), iki çalıştırma:

| CPU | Soğuk açılış | Ort. FPS | %5 en düşük FPS | En uzun kare |
|---|---|---|---|---|
| 1× | 81–89 ms | 59,0 | 59,2–59,5 | 117 ms |
| 4× | 304–311 ms | 55,9–57,5 | 48,3–59,2 | 117–167 ms |

**NFR-03:** sağlanıyor, büyük payla (4×'te 0,3 sn).

**NFR-01:** 4× yavaş CPU'da ortalama sınırda (56–57 FPS); en yavaş karelerin %5'i bir çalıştırmada 48 FPS'e iniyor. En uzun kare, ateşlemedeki "hit-stop" anına denk geliyor ve bilerek yapılıyor.

## Sınırlar

- Bu bir telefon değil: masaüstü işlemcinin yavaşlatılmış hâli. GPU, bellek ve ısınma telefondan farklıdır. Sayılar gerilemeyi yakalamak içindir; hedefin sağlandığını söylemek için orta seviye bir Android cihazda ölçmek gerekir (bkz. [gereksinimler §7](02-gereksinimler.md)).
- Kare hızı küçültülmemiş geliştirme derlemesinde ölçülür; mağaza derlemesi biraz daha hızlı olabilir.
- Headless tarayıcı ekran yenileme hızını 60 Hz'e sabitler; 60'ın üstü ölçülemez.
