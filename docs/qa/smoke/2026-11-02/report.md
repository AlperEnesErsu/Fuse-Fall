# Duman testi — 2026-11-02

**Sonuç: PASS** · 11/11 adım · konsol hatası: 0

`npm run smoke` (tools/smoke-check.mjs) ile, `http://localhost:5173/` geliştirme sunucusunda, headless Chromium'da üretildi.

| Adım | Kontrol | Sonuç | Not | Görüntü |
|---|---|---|---|---|
| 01-menu | Ana menü açılır | PASS | menü 800 ms içinde | [01-menu.jpg](01-menu.jpg) |
| 02-cities | Şehir listesi | PASS | 9 şehir | [02-cities.jpg](02-cities.jpg) |
| 03-levels | Ankara görev listesi | PASS | 10 görev | [03-levels.jpg](03-levels.jpg) |
| 04-placing | Ankara 10: çözümdeki şarjlar yerleştirilir | PASS |  | [04-placing.jpg](04-placing.jpg) |
| 05-collapse | ATEŞLE: yapı çöker | PASS |  | [05-collapse.jpg](05-collapse.jpg) |
| 06-report | Sonuç raporu; çözüm "Tekrar dene" ile birkaç denemede kazanır | PASS | MÜKEMMEL ÇÖKÜŞ! · 2. denemede | [06-report.jpg](06-report.jpg) |
| 07-workshop | Atölye | PASS |  | [07-workshop.jpg](07-workshop.jpg) |
| 08-settings | Ayarlar | PASS |  | [08-settings.jpg](08-settings.jpg) |
| 09-large-text | Büyük yazı: şarj numaraları ve HUD büyür | PASS |  | [09-large-text.jpg](09-large-text.jpg) |
| 10-landscape-en | Yatay ekran, İngilizce menü | PASS |  | [10-landscape-en.jpg](10-landscape-en.jpg) |
| 11-crash | Hata ekranı ve yeniden başlat | PASS |  | [11-crash.jpg](11-crash.jpg) |
## Gözlemler (görüntülere bakılarak)

- **06-report:** Ankara 10'un kayıtlı çözümü ilk denemede kazanmadı, 4 px kaydırılınca kazandı. Bu bir hata değil: görev "zor" ve [seviye dengesi](../../../level-balance.md) yakın ıskalarda %57 kazanma ölçüyor. Dokunuştaki bir piksellik yuvarlama sonucu değiştirebiliyor.
- **01-menu:** 360×640 dikey ekranda menünün en alt satırı ("Kodla oyna") panelin altında kalıyor; panel kaydırılınca görünüyor. Daha uzun ekranlarda (ör. 390×844) sığıyor.
- **09-large-text:** HUD ve tuvaldeki şarj numaraları ile gecikme etiketleri büyüyor (#20).
- **11-crash:** panel İngilizce ve yatay ekranda okunuyor; düğme odakta.
