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
- **İşçilik** = Malzeme × % oranı *veya* Toplam ağırlık × kg başına işçilik
- **Toplam tahmini fiyat** = Malzeme + İşçilik

Büküm payları (etek, kenar bükümü vb.) ve imalat varsayımları `script.js` içindeki
`TZ`, `DL`, `RF` sabitlerinden ayarlanabilir. Sonuçlar teorik ağırlıktır; kesim firesi,
kaynak sarfı ve hazır aksesuarlar (ray, menteşe, kulp, ayarlı ayak) dahil değildir.
