# Fuse & Fall

Çevrimdışı, hızlı oynanan, fizik tabanlı bir yıkım bulmacası. Tek fitil, tek patlama, sonsuz zincir.

## Çalıştırma

```bash
npm ci
npm run dev        # geliştirme sunucusu
npm run build      # tip kontrolü + üretim derlemesi (dist/, service worker dahil)
npm run preview    # derlemeyi yerelde sun (çevrimdışı mod sadece burada çalışır)
npm run check      # tsc + eslint + testler
npm run coverage   # core + infrastructure kapsamı (eşik %80)
```

## Mimari

```
src/
  core/            Saf oyun kuralları: seviye şeması, oturum, puanlama, ilerleme, portlar
  infrastructure/  Port uygulamaları: Matter.js fizik, localStorage kayıt
  presentation/    Canvas çizimi, efektler (juice), sentez ses, DOM arayüzü
  content/         Seviye verisi (JSON) ve yükleyici
  app/             Bileşim kökü, sabit adımlı oyun döngüsü, ekran akışı
```

Bağımlılıklar içe doğru akar ve ESLint ile zorlanır. `core` Matter.js'i ya da tarayıcıyı bilmez. Efektler oyun olaylarını dinler; kurallar efektleri hiç çağırmaz.

## İçerik

- `src/content/cities.json`: bölümler (başkentler) ve açılma eşikleri. Seviyesi olmayan şehir "Yakında" görünür.
- `src/content/levels/<şehir>.json`: şehrin seviyeleri. Bloklar, variller, arabalar (`cars`: rota `from`/`to`, `speed`) ve bir `solution` (`charges` + ateşleme anı `fireAt`).
- Yeni şehir: `cities.json`'a ekle, seviye paketini `src/content/levels.ts` içindeki `PACKS` listesine ekle, silüetini `src/presentation/scenery.ts` içinde çiz.

`tests/levels.test.ts` her seviyenin ateşlenmeden ayakta durduğunu, çözümünün gerçek fizikle kazandığını ve araba seviyelerinde zamanlamanın gerçekten önemli olduğunu doğrular.

## Belgeler

- [Pazar analizi](docs/01-pazar-analizi.md)
- [Gereksinimler ve mühendislik ilkeleri](docs/02-gereksinimler.md)
