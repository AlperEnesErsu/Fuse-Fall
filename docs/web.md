# Web sürümü (portfolyoda)

Oyunun tarayıcı sürümü portfolyo sitesinde barınır: **https://alperenesersu.netlify.app/oyunlar/fuse-and-fall/index.html** (kısa adres: `/fuse-and-fall`). Portfolyonun "Oyunlar" bölümünde ve "Projeler"deki kartında "Oyna" düğmesi buraya gider. "Deneyimle" penceresi de oyunun kendisini gösterir.

## Yayın akışı

1. Oyun değişikliği bu depoda PR olarak gelir ve birleşir (`npm run check`, e2e, CI).
2. `npm run portfolio`: oyunu derler (`VITE_SITE_URL` portfolyodaki adres olur), çıktıyı portfolyonun `public/oyunlar/fuse-and-fall/` klasörüne kopyalar. Klasör her seferinde baştan yazılır; eski dosyalar birikmez. Portfolyo bu deponun yanında değilse `PORTFOLIO_DIR` ile yolu ver.
3. Portfolyo deposunda bir dal açılır ve PR gönderilir. Netlify PR'a bir önizleme adresi yazar (`deploy-preview-<no>--alperenesersu.netlify.app`). Değişiklik orada telefonda ve masaüstünde denenir.
4. **Canlıya çıkış = portfolyo PR'ının birleşmesi.** Portfolyo `main`'den otomatik yayımlanır, bu yüzden birleştirme yalnız onayla yapılır.

## Ayrıntılar

- **Adres `index.html` ile biter.** Next.js klasör adresinin sonundaki `/` işaretini siler (`/oyunlar/fuse-and-fall/` → `/oyunlar/fuse-and-fall`) ve oyunun göreli yolları bozulur. Service worker sayfayı `./index.html` adıyla önbelleğe alır.
- **Güvenlik başlıkları portfolyodan gelir** (`next.config.ts`). Oyun yolunda tek fark, sitenin kendisinin oyunu çerçeveye alabilmesidir (`frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN`). Başka siteler alamaz.
- **Önbellek.** Portfolyonun `netlify.toml` dosyası `sw.js` ve `index.html` için `no-cache`, `assets/` için bir yıllık önbellek ayarlar.
- **Yeni sürüm.** Yeni sürüm yayımlanınca açık oyunda "Yeni sürüm hazır · Yenile · Sonra" çubuğu çıkar. Oyun kendi kendine yenilenmez, süren görev kaybolmaz.
- **Görev bağlantıları.** Web'de "kodu kopyala" bir bağlantı kopyalar (`…/index.html#FF1-…`). Bağlantıyı açan doğrudan göreve girer. Kod adresin `#` kısmındadır ve sunucuya gitmez. Android uygulaması da `VITE_SITE_URL` (`.env.release`) ile aynı adrese bağlantı verir.
- **Paylaşım kartı.** `social.jpg` ve og etiketleri; tam adres `VITE_SITE_URL`'den gelir.
- **İstekler.** Portfolyonun Oyunlar bölümünde Netlify Forms'a giden bir istek formu var (öneri, hata, görev fikri). İsteğe bağlı e-posta yalnız "haber ver" seçilirse sorulur. Çerez ve hesap yoktur. Gönderiler Netlify › Forms › `oyun-istek` altında görünür. Formun çalışması için Netlify'da **Forms › Enable form detection** bir kez açılmalı.
- **Web'de reklam ve satın alma yoktur**; bunlar yalnız Android uygulamasında.

## Yayından önce kontrol

- [ ] Gizlilik sayfasındaki iletişim e-postası dolduruldu (`public/privacy.html`, iki dilde).
- [ ] Önizlemede: menü, bir görev, günlük görev, kodla oyna, görev bağlantısı, Atölye; telefon dikey ve yatay; iPhone (WebKit).
- [ ] Önizlemede çevrimdışı: oyunu bir kez aç, ağı kapat, yenile; oyun açılmalı.
- [ ] İstek formu önizlemede gönderildi ve Netlify › Forms'ta göründü.

## Yerelde deneme

```bash
npm run build
npm run preview    # http://localhost:4173, service worker ve çevrimdışı mod dahil
```

`vite preview` dosya listesini açılışta bir kez okur: yeniden derledikten sonra sunucuyu da yeniden başlat, yoksa yeni dosyalar yerine sayfa döner. Portfolyonun içinde denemek için portfolyoda `npm run build && npm run start`. WebKit oradaki `upgrade-insecure-requests` yüzünden `http://localhost` üzerinden yükleyemez; iPhone denemesini Netlify önizlemesinde yap.
