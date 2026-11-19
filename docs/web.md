# Web sitesi (Netlify)

Oyunun tarayıcı sürümü Netlify'da yayımlanır. Ayarlar [netlify.toml](../netlify.toml) içindedir; buradaki adımlar Netlify arayüzünde bir kez yapılır.

## Nasıl çalışır

- **Her PR'ın kendi önizlemesi var.** Netlify her PR için `deploy-preview-<no>--<site>.netlify.app` adresinde bir derleme açar ve bağlantıyı PR'a yazar. Değişiklik önce orada, telefon ölçüsünde denenir.
- **Canlı site kendiliğinden değişmez.** `main`'e birleşen her değişiklik derlenir ama yayına çıkmaz; "Publish deploy" düğmesine basılana kadar oyuncular eski sürümü görür. Yanlış giden bir yayın, eski bir derlemeyi yeniden "Publish" ederek geri alınır.
- **Oyuncu yeni sürümü kaçırmaz.** Oyun çevrimdışı önbellekle çalışır. Yeni sürüm yayımlanınca açık sayfada "Yeni sürüm hazır · Yenile · Sonra" çubuğu çıkar; oyun kendi kendine yenilenmez, süren görev kaybolmaz.
- **Görev bağlantıları.** Web'de "kodu kopyala" bir bağlantı kopyalar (`https://<site>/#FF1-…`). Bağlantıyı açan doğrudan göreve girer. Kod adresin `#` kısmında durur; sunucuya hiç gitmez. Kodla oyna ekranına bağlantı da, içinde kod geçen bir mesaj da yapıştırılabilir.
- **Paylaşım kartı.** Bağlantı bir sohbete atılınca başlık, açıklama ve `public/social.jpg` görünür. Görselin tam adresi derlemede Netlify'ın verdiği `URL` ile yazılır.
- **Web'de reklam ve satın alma yoktur**; bunlar yalnız Android uygulamasında.

## Kurulum (bir kez, Netlify hesabıyla)

1. [app.netlify.com](https://app.netlify.com) › **Add new site › Import an existing project › GitHub** › `AlperEnesErsu/Fuse-Fall`.
2. Derleme ayarları `netlify.toml`'dan gelir (komut `npm run build`, klasör `dist`, Node `.nvmrc`'den). Ekranda bir şey değiştirme, **Deploy**'a bas.
3. **Site configuration › Change site name**: kısa bir ad seç (ör. `fuse-and-fall`). Adres `https://<ad>.netlify.app` olur.
4. **Deploys › Lock publishing** (bazı arayüzlerde "Stop auto publishing"): canlı site bundan sonra yalnız elle yayımlanır.
5. **Site configuration › Build & deploy › Deploy Previews**: "Any pull request against your production branch" açık kalsın.
6. Adresi bana ver: README'deki "Tarayıcıda oyna" bağlantısını ve deponun **Website** alanını doldururum. Android uygulamasının paylaştığı bağlantılar da bu adrese gitsin diye `.env.release`'e `VITE_SITE_URL=https://<ad>.netlify.app` eklenir.

## Yayına çıkmadan önce

- [ ] Gizlilik sayfasındaki iletişim e-postası dolduruldu (`public/privacy.html`, iki dilde).
- [ ] PR önizlemesinde: menü, bir görev, günlük görev, kodla oyna, görev bağlantısı, Atölye; telefon dikey ve yatay.
- [ ] Önizlemede çevrimdışı: sayfayı bir kez aç, ağı kapat, yenile: oyun açılmalı.
- [ ] Yayımlandıktan sonra eski sürüm açık bir sekmede "Yeni sürüm hazır" çubuğu çıktı.

## Yerelde deneme

```bash
npm run build
npm run preview    # http://localhost:4173, service worker ve çevrimdışı mod dahil
```

`vite preview` dosya listesini açılışta bir kez okur: yeniden derledikten sonra sunucuyu da yeniden başlat, yoksa yeni dosyalar yerine sayfa döner.
