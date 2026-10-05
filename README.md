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

- **Çalışma tezgahı** — iki model, ortak üst tabla + sırt + omega destek + evye:
  - *Omega adedi* (tabla ve taban rafı altı, boya göre): <800 mm → 1, 800–1300 → 2,
    1300–2000 → 3, sonrası her 700 mm için +1.
  - *Ayaklı:* 4 köşede 40×40×1.2 profil ayak; 40×20×1 yalpalık ön/sol/sağ (tek tıkla);
    opsiyonel 1.0 mm taban rafı + omega.
  - *Dolaplı:* profil ayak yok; yan + arka mobilya sacı (0.8 mm), 1.0 mm taban rafı + omega,
    çarpma kapak çift cidar (2 × 0.8 mm) veya sürgü kapak (1.0 mm), ara raflı/rafsız
    (ara raf altı omega: ≤700 mm → 1, ≤1500 mm → 2), çekmece bloğu (tamamı 0.8 mm)
    ve makine bölümü. En fazla 2400 mm.
  - Evye: hazır evye birim fiyatı (ayrı maliyet satırı) veya imalat hazne ağırlığı.
- **Duvar dolabı:** ara raf (yok/1–3), Ø8 dolu mil yalpalık (ara raflar ve/veya taban, 1–2 sıra).
- **İstif rafı:** her katta 40×20×1 mm profil yalpalık (deniz bağı) — ön/arka/sol/sağ tek tıkla.

Büküm payları (etek, kenar bükümü vb.) ve imalat varsayımları `script.js` içindeki
`TZ`, `DL`, `RF` sabitlerinden ayarlanabilir. Sonuçlar teorik ağırlıktır; kesim firesi,
kaynak sarfı ve hazır aksesuarlar (ray, menteşe, kulp, ayarlı ayak) dahil değildir.
