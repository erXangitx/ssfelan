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
Kullanıcı karmaşık arayüzden bunaldı → **4 adımlı basit akış** (adım numaraları CSS counter ile otomatik):
1) Ne üretiyorsunuz? (3 kart) → 2) Model ve ölçü (tezgahta hazır model kartları + ⇄, ölçüler, altı gösteren
çubuk, "Özel düzen kur" açılır) → 3) Seçenekler (sırt Arka/Sol/Sağ + yükseklik, açık bölme yan/arka profil +
raf, dolap ara rafı, evye) → 4) Fiyat (kalite, adet, para birimi, işçilik bazlı / kg bazlı).
Her işte değişmeyen ayarlar "Daha fazla ayar" tikinin arkasında (`data-adv`, `body.show-adv`). Yeni sabit
değerli alan eklerken `data-adv` ver; jargon kullanma. Sağ panel: kg + fiyat, ağırlık özeti (sac/profil)
açık; "Parça parça döküm" ve "Seçilen ayarlar" açılır-kapanır (yazdırırken otomatik açılır).
Mobilde altta sabit sonuç çubuğu (kg + fiyat) var.

## Çalışma tezgahı (şu an odak; bölme sistemi)
- Üst: üst tabla (40 mm etek; sırt olan kenarda etek yok, sırt açınımı kullanılır — çift sayım yok) + sırt (30/60/100 mm) + **omega** (tabla altı, derinlik yönünde).
  **Omega boydan boya** (uzunluk yönünde, firma çizimlerindeki gibi): tabla altı uzunluk = L − 80, adet seçilebilir
  (varsayılan 1 — boydan boya tek omega yeter; Gelişmiş ayarlar); raf altı (taban + ara raf) omega da boydan boya, adet 1/2 (varsayılan 1). **Tezgah en fazla 2400 mm.**
- **Sırt üst tablanın parçasıdır** (tek sac, abkant): açınım = yükseklik + **35 mm geri büküm** (100 → 135); ayrı parça yazılmaz,
  "Üst tabla (etek + sırt dahil)" ağırlığına girer. Sırt olan kenarda 40 mm etek yerine sırt açınımı kullanılır (arka/sol/sağ).
- Alt kısım **soldan sağa bölmeler**: Açık / Dolap / Çekmece / Makine. Genişliği boş bölme kalanı alır.
  Üstte **hazır model kartları** (altı boş, taban raflı, dolap çarpma/sürgü, çekmece+açık, çekmece+dolap,
  makine+açık, makine+dolap) + **⇄ ters çevir**; "Detaylı düzenle" ile elle bölme kurulur.
- **Açık bölme:** 40×40×1.2 profil ayak yere kadar. Yan/arka profil **40×40** (ayakların kaymaması için; istif rafında yalpalık 40×20×1 kalır): kenar bazlı
  seçilir (Ön/Arka/Sol/Sağ); varsayılan **arka + sol + sağ** (ön yok; duvara gelen yan kaldırılır).
  Opsiyonel taban rafı **1.0 mm** + altına omega (bölme bazlı veya "hepsine" hızlı anahtar).
- **Kapalı bölme (dolap/çekmece):** profil ayak YOK. Mobilya sacı **0.8 mm** (yan + arka), taban rafı
  1.0 mm + omega. 150 mm **ayarlı ayak** (her yan saca 2 adet; ayak başına 90 mm 40×40×1.2 profil;
  ayarlı ayak fiyatı hazır ürün). Açık bölmenin kapalıya bakan tarafında profil ayak/çevre profili yok;
  kapalı bölmenin yan sacı taşır. Yan yana iki kapalı bölme arasında **tek ortak yan sac**.
- **Dolap derinliği = tabla derinliği − 80 mm** (ön 40 + arka 40 geri çekme; gerçek çizimden: tabla 750 → dolap 670). Ayarlanabilir (`tz_cabRecess`).
- **Ara raflı dolap duvarı = kapak gibi çift cidar:** yan + arka duvar iç içe geçen 2 × 0.8 mm parça (iç sac dış sacın
  25 mm içinde, 15 mm büküm); raf aradaki bölmelere asılır (hem arka hem sağ hem sol). Ara rafsız dolap tek sac. Komşu paneli
  ara raflı dolaba bakan yan saclar çift cidar olur. Seçilebilir (`tz_dblWall`, Gelişmiş ayarlar). Raf asma için ayrı taşıyıcı parça YOK.
- **Dolap:** çarpma kapak = **çift cidar 2×0.8 mm**; sürgü kapak **1.0 mm**; ara raf 0–2 (0.8 mm,
  altına omega: seçilebilir 1/2).
- **Dolap ara raf omega:** kullanıcı "genelde 1, en fazla 2" dedi → seçilebilir (1 / 2 / otomatik: ≤700→1, üstü 2).
  **Ø8 dolu mil çubuk:** dolapta ara raf + taban rafı üstüne boydan boya (adet = ara raf + 1, boy = dolap genişliği − 80 mm), kapaklı/kapaksız fark etmeden hepsinde; seçilebilir (varsayılan var). **Açık bölmenin taban rafına Ø8 çubuk KOYULMAZ** (ürün rahat girsin); orada önden arkaya giden profil (yalpalık) vardır.
- **Sırt:** Arka/Sol/Sağ kenar seçilir (duvara dayanan kenarlar), tek yükseklik (60/100); yan sırt uzunluğu = tabla derinliği.
- Mobilya yan büküm payı **40 mm** (`TZ.panelFlange`, `TZ.shelfFlange`).
- **Çekmece:** 2–5 adet, kutu + çift cidar ön, **tamamı 0.8 mm**.
- **Makine boşluğu:** 600×700×820 mm; tezgah yüksekliği en az 900 (otomatik yükselir); dış yanına sac.
- **Evye:** hazır evye (adet + birim fiyat → hazır ürün) veya imalat hazne (sacdan). Tabla kesiği ağırlıktan DÜŞÜLMEZ.
- Profil ayak/boru "alt raf boru" seçeneği tezgahta YOK (boru raf sadece istif rafında var).

## Firma karşılaştırması (doğrulama notu)
Rakip firma çizimi: 1500×650×900 açık tezgah, 30 mm sırt, 4 ayak, sadece yan alt kayıtlar (150 mm), masa 29.48 kg.
Sistemimiz 1.2 mm sac/profille 20.46 kg verir; fark **hesap hatası değil, kalınlık girdisi**: tabla 1.5 + 40×40×2 ayak ≈ 26.4,
tabla 2.0 + profil 1.5 ≈ 29.1. Çizimdeki "1,5" ölçüsü sac kalınlığı olabilir. Gelişmiş ayarlarda tabla sacı ve
ayak/profil et kalınlığı (1.2/1.5/2.0) seçilebilir. Gerçek tartı veya firma spesifikasyonu gelince kalibre et.

## Duvar dolabı
Ara raf yok/1–3; kapak sürme/çarpma/kapaksız; Ø8 dolu mil yalpalık (ara raflar ve/veya taban, 1–2 sıra).
(Ara raf altı omega kuralını duvar dolabına uygulayıp uygulamama henüz sorulmadı.)

## İstif rafı
3–5 kat; düz / perfore (%20 boşluk düşülür) / ızgara boru raf; 40×40×1.2 dikme + köprüler.
Yalpalık (deniz bağı) 40×20×1: Ön/Arka/Sol/Sağ tek tıkla (varsayılan ön+sol+sağ), her katta.

## Onaylanmamış tahminler (kullanıcı düzeltebilir)
Omega açınımı 120 mm / 1.2 mm sac; büküm payları (`TZ`, `DL`, `RF` sabitleri `script.js` başında);
makine dış yan sacı 0.8 mm; çekmece önü çift cidar; varsayılan işçilik 8 saat × 10 USD ve kg fiyatları.

## Bekleyen konu: tabla ve ara raf büküm geometrisi (kullanıcı çizim/görsel gönderecek)
Kullanıcının anlattığı (henüz kodlanmadı, yorum belirsiz): tabla kenarı serbest uçtan 10-20-40-40 + kalan derinlik
(muhtemelen kapalı kutu kenar, ~110 mm açınım/kenar; şu an 40 mm sayılıyor); ara rafta kapak payı için ~20 mm içeride,
ön kenarda 30-35 mm büküm + altında 10 mm mukavemet bükümü, yanlarda 40 mm. Ara raf sacı 0.8 mm (`tz_shelfT`).
Görselle doğrulanana kadar kodlama; gerçek düz kesim (açınım) ölçüleri iste: tabla 1500×650 sırt 100, ara raf 600×500.

## Kullanıcıdan beklenen sonraki adımlar
Hazır model listesinin gerçek satış modellerine göre netleştirilmesi; duvar dolabı ve istif rafı için
aynı bölme/şablon mantığının uygulanması (kullanıcı şimdilik sadece çalışma tezgahına odaklanmak istiyor).
