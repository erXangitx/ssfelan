# Paslanmaz Mobilya Hesaplayıcı — Proje Notları

Endüstriyel/özel imalat paslanmaz çelik mobilya (çalışma tezgahı, duvar dolabı, istif rafı) için
**ağırlık ve maliyet** hesaplayan, bağımlılıksız web uygulaması. Sahibi imalatçıdır; kuralları
atölye pratiğinden verir. **Türkçe konuş.** Kredisi sınırlı: değişiklikleri toplu yap, gereksiz
deneme/soru yapma, tahmin ettiğin ölçüyü koda gömme (ekranda değiştirilebilir alan yap).

- Çalıştırma: `index.html` dosyasını tarayıcıda aç (sunucu yok). Dosyalar: `index.html`, `style.css`, `script.js`.
- Branch: `claude/optimistic-gates-djx2hs` (main'e birleştirilmedi). Teslim: kullanıcıya RAR/ZIP gönderilir.
- Test: headless Chromium + Playwright (global `npm root -g`); ekran görüntüsü + hesap kontrolü yapılır.
- Her ürün için kullanıcı fiyatı iki yöntemle hesaplar (sayfa üstündeki "Fiyat Hesabı" anahtarı):
  **İşçilik bazlı** = ağırlık × malzeme kg fiyatı + işçilik saati × saat ücreti × adet;
  **Kg bazlı** = ağırlık × satış kg fiyatı (işçilik dahil; çok adetli işler). Yüzde/kg-başı işçilik YOK.
  Hazır ürünler (hazır evye, ayarlı ayak) ayrı satır olarak toplama eklenir, ağırlığa girmez.

## Temel formüller
- Sac kg = alan(m²) × kalınlık(mm) × yoğunluk (304: 7.93, 316L: 7.98). Alana kenar büküm payı eklenir.
- Profil kg = boy(m) × kg/m (kesitten hesaplanır). 40×40×1.2 kutu ≈ 1.477 kg/m (304).
- Özet panelinde **Ağırlık Özeti**: sac (kalınlığa göre) ve profil (kesite göre) ayrı kg; altında parça dökümü.

## Arayüz ilkesi
Kullanıcı çok seçenekten bunalıyor: **her işte değişmeyen ayarlar "Gelişmiş ayarlar" tikinin arkasında**
(`data-adv` özniteliği; `body.show-adv` sınıfı). Ana ekranda yalnızca iş başına değişenler görünür:
model kartı, ölçüler, sırt/yan sırt, çevre profili, taban rafı, dolap ara rafı, evye, fiyat/işçilik.
Yeni sabit değerli alan eklerken `data-adv` ver.

## Çalışma tezgahı (şu an odak; bölme sistemi)
- Üst: üst tabla (40 mm etek; sırt olan kenarda etek yok, sırt açınımı kullanılır — çift sayım yok) + sırt (60/100 mm) + **omega** (tabla altı, derinlik yönünde).
  Omega adedi boya göre: <800→1, 800–1300→2, 1300–2000→3, 2000–2400→4. **Tezgah en fazla 2400 mm.**
- Alt kısım **soldan sağa bölmeler**: Açık / Dolap / Çekmece / Makine. Genişliği boş bölme kalanı alır.
  Üstte **hazır model kartları** (altı boş, taban raflı, dolap çarpma/sürgü, çekmece+açık, çekmece+dolap,
  makine+açık, makine+dolap) + **⇄ ters çevir**; "Detaylı düzenle" ile elle bölme kurulur.
- **Açık bölme:** 40×40×1.2 profil ayak yere kadar. Çevre profili 40×20×1 (yalpalık): kenar bazlı
  seçilir (Ön/Arka/Sol/Sağ); varsayılan **arka + sol + sağ** (ön yok; duvara gelen yan kaldırılır).
  Opsiyonel taban rafı **1.0 mm** + altına omega (bölme bazlı veya "hepsine" hızlı anahtar).
- **Kapalı bölme (dolap/çekmece):** profil ayak YOK. Mobilya sacı **0.8 mm** (yan + arka), taban rafı
  1.0 mm + omega. 150 mm **ayarlı ayak** (her yan saca 2 adet; ayak başına 90 mm 40×40×1.2 profil;
  ayarlı ayak fiyatı hazır ürün). Açık bölmenin kapalıya bakan tarafında profil ayak/çevre profili yok;
  kapalı bölmenin yan sacı taşır. Yan yana iki kapalı bölme arasında **tek ortak yan sac**.
- **Dolap:** çarpma kapak = **çift cidar 2×0.8 mm**; sürgü kapak **1.0 mm**; ara raf 0–2 (0.8 mm,
  altına omega: seçilebilir 1/2).
- **Dolap ara raf omega:** kullanıcı "genelde 1, en fazla 2" dedi → seçilebilir (1 / 2 / otomatik: ≤700→1, üstü 2).
  **Ø8 dolu mil çubuk:** dolapta ara raf + taban rafı üstüne boydan boya (adet = ara raf + 1, boy = dolap genişliği − 80 mm), kapaklı/kapaksız fark etmeden hepsinde; seçilebilir (varsayılan var). **Açık bölmenin taban rafına Ø8 çubuk KOYULMAZ** (ürün rahat girsin); orada önden arkaya giden profil (yalpalık) vardır.
- **Yan sırt:** tezgahın sol/sağ yanı duvara geliyorsa seçilir (yok / var; yükseklik = normal sırt yüksekliği; uzunluk = tabla derinliği).
- Mobilya yan büküm payı **40 mm** (`TZ.panelFlange`, `TZ.shelfFlange`).
- **Çekmece:** 2–5 adet, kutu + çift cidar ön, **tamamı 0.8 mm**.
- **Makine boşluğu:** 600×700×820 mm; tezgah yüksekliği en az 900 (otomatik yükselir); dış yanına sac.
- **Evye:** hazır evye (adet + birim fiyat → hazır ürün) veya imalat hazne (sacdan). Tabla kesiği ağırlıktan DÜŞÜLMEZ.
- Profil ayak/boru "alt raf boru" seçeneği tezgahta YOK (boru raf sadece istif rafında var).

## Duvar dolabı
Ara raf yok/1–3; kapak sürme/çarpma/kapaksız; Ø8 dolu mil yalpalık (ara raflar ve/veya taban, 1–2 sıra).
(Ara raf altı omega kuralını duvar dolabına uygulayıp uygulamama henüz sorulmadı.)

## İstif rafı
3–5 kat; düz / perfore (%20 boşluk düşülür) / ızgara boru raf; 40×40×1.2 dikme + köprüler.
Yalpalık (deniz bağı) 40×20×1: Ön/Arka/Sol/Sağ tek tıkla (varsayılan ön+sol+sağ), her katta.

## Onaylanmamış tahminler (kullanıcı düzeltebilir)
Omega açınımı 120 mm / 1.2 mm sac; büküm payları (`TZ`, `DL`, `RF` sabitleri `script.js` başında);
makine dış yan sacı 0.8 mm; çekmece önü çift cidar; varsayılan işçilik 8 saat × 10 USD ve kg fiyatları.

## Kullanıcıdan beklenen sonraki adımlar
Hazır model listesinin gerçek satış modellerine göre netleştirilmesi; duvar dolabı ve istif rafı için
aynı bölme/şablon mantığının uygulanması (kullanıcı şimdilik sadece çalışma tezgahına odaklanmak istiyor).
