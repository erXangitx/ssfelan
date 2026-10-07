# Paslanmaz Mobilya Hesaplayıcı

Endüstriyel paslanmaz çelik mobilyalar (çalışma tezgahı, duvar dolabı, istif rafı) için
canlı **ağırlık ve maliyet** hesaplayan, bağımlılıksız bir web uygulaması.

## Çalıştırma

`index.html` dosyasını tarayıcıda açmanız yeterlidir (sunucu gerekmez).

## Dosyalar

| Dosya        | İçerik |
|--------------|--------|
| `index.html` | Arayüz: sol tarafta parametreler, sağda canlı özet paneli |
| `style.css`  | Koyu tema öncelikli, açık tema destekli, responsive stiller + yazdırma (PDF) stilleri |
| `script.js`  | Sabitler, mobilya hesaplayıcıları, arayüz güncelleme, kopyala/yazdır |

## Hesaplama mantığı

- **Sac ağırlığı (kg)** = Açınım alanı (m²) × Kalınlık (mm) × Yoğunluk (g/cm³)
- **Profil ağırlığı (kg)** = Toplam boy (m) × Metre ağırlığı (kg/m)
  - 40×40×1.2 kutu profil: kesit 186,24 mm² → AISI 304'te ≈ 1,477 kg/m
  - Ø16×1 ızgara borusu: kesit 47,12 mm² → AISI 304'te ≈ 0,374 kg/m
- **Toplam ağırlık** = Birim ağırlık × Adet
- **Malzeme maliyeti** = Toplam ağırlık × Kg fiyatı
- **İşçilik** = İşçilik saati (1 adet) × Saat ücreti × Adet
- **Toplam tahmini fiyat** = Malzeme + İşçilik + Hazır ürünler (ör. evye)

## Opsiyonlar

- **Çalışma tezgahı** — ortak: üst tabla + sırt + tabla altı omega + evye. Altı soldan sağa
  **bölmelerden** oluşur (genişliği boş bırakılan bölme kalanı alır):
  - *Açık:* 40×40×1.2 profil ayak, 40×20×1 yalpalık (ön + dış yanlar, arka yok),
    opsiyonel 1.0 mm taban rafı + omega.
  - *Dolap:* çarpma (çift cidar 2 × 0.8) / sürgü (1.0) / kapaksız, 0–2 ara raf (0.8 + omega).
  - *Çekmece:* 2–5 çekmece, tamamı 0.8 mm.
  - *Makine:* 600 mm boşluk (bulaşık/çamaşır); tezgah yüksekliği en az 900 mm.
  - Kurallar: açık bölmenin kapalı bölmeye bakan tarafında profil ayak ve yalpalık yok;
    iki kapalı bölme arasında tek ortak yan sac; kapalı bölmeler 150 mm ayarlı ayak üzerinde
    (her yan saca 2 ayak, ayak başına 90 mm 40×40×1.2 profil). Ayarlı ayak fiyatı hazır ürün.
  - Omega adedi (tabla / taban rafı): <800 → 1, 800–1300 → 2, 1300–2000 → 3, 2000–2400 → 4;
    dolap ara rafı altı: ≤700 → 1, ≤1500 → 2.
- **Duvar dolabı:** ara raf (yok/1–3), Ø8 dolu mil yalpalık (ara raflar ve/veya taban, 1–2 sıra).
- **İstif rafı:** her katta 40×20×1 mm profil yalpalık (deniz bağı) — ön/arka/sol/sağ tek tıkla.

Büküm payları (etek, kenar bükümü vb.) ve imalat varsayımları `script.js` içindeki
`TZ`, `DL`, `RF` sabitlerinden ayarlanabilir. Sonuçlar teorik ağırlıktır; kesim firesi,
kaynak sarfı ve hazır aksesuarlar (ray, menteşe, kulp, ayarlı ayak) dahil değildir.
