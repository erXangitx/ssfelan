/* =========================================================
   Paslanmaz Mobilya Hesaplayıcı — Hesaplama & Arayüz
   ---------------------------------------------------------
   Birimler: ölçüler mm, yoğunluk g/cm³, alan m², ağırlık kg
   Sac ağırlığı  (kg) = Alan (m²) × Kalınlık (mm) × Yoğunluk (g/cm³)
   Profil ağırlığı(kg) = Boy (m) × Metre ağırlığı (kg/m)
   ========================================================= */
(() => {
  "use strict";

  // ---------------------------------------------------------
  // 1) SABİTLER
  // ---------------------------------------------------------
  const GRADES = {
    "304": { name: "AISI 304", density: 7.93 },
    "316L": { name: "AISI 316L", density: 7.98 },
  };

  const CURRENCIES = {
    USD: { symbol: "$", locale: "en-US" },
    EUR: { symbol: "€", locale: "de-DE" },
    TRY: { symbol: "₺", locale: "tr-TR" },
  };

  const FURNITURE_NAMES = {
    tezgah: "Çalışma Tezgahı",
    dolap: "Duvar Dolabı",
    raf: "İstif Rafı",
  };

  // Kesitler (mm)
  const BOX_PROFILE = { w: 40, h: 40, t: 1.2, label: "40×40×1.2 kutu" };
  const YAL_PROFILE = { w: 40, h: 20, t: 1.0, label: "40×20×1 profil" };
  const GRID_TUBE = { d: 16, t: 1.0, label: "Ø16×1 boru" };
  const RAIL_ROD = { d: 8, label: "Ø8 dolu mil" };

  // Ankastre makine boşluğu (bulaşık / çamaşır) — G × D × Y (mm)
  const MACHINE = { w: 600, d: 700, h: 820, minBenchH: 900 };
  const MACHINE_NAMES = { dish: "Bulaşık makinesi", laundry: "Çamaşır makinesi" };

  // İmalat varsayımları (mm)
  const TZ = {
    edgeFlange: 40,    // üst tabla ön/yan etek büküm payı
    backReturn: 20,    // sırt üst dönüş büküm payı
    legInset: 80,      // ayaklar arası çerçeve için iç mesafe (2 × profil)
    shelfFlange: 30,   // alt raf kenar büküm
    panelFlange: 20,   // gövde panelleri büküm payı
    doorFlange: 25,    // kapak kenar büküm payı
    innerFlange: 15,   // çift cidar kapak iç sacı büküm payı
    drawerT: 0.8,      // çekmece (kutu + çift cidar ön) sac kalınlığı
    railStrip: 60,     // sürgü kapak ray şeridi açınım genişliği
    hingedMaxW: 600,   // çarpma kapak maksimum kanat genişliği
    sinkRim: 20,       // imalat evye haznesi kaynak/kenar payı
    sinkMargin: 100,   // hazne çevresinde bırakılacak minimum tabla
  };

  const DL = {
    flange: 20,        // gövde panelleri büküm payı
    doorFlange: 25,    // kapak kenar büküm payı
    shelfFlange: 25,   // ara raf büküm payı
    railStrip: 60,     // sürme kapak ray şeridi açınım genişliği
    hangStrip: 80,     // duvar askı laması genişliği
  };

  const RF = {
    shelfFlange: 35,   // raf sac kenar büküm payı
    perforatedOpen: 0.20, // perfore sacta delik boşluk oranı (~%20)
    stiffenerEvery: 600,  // her 600 mm'de bir omega takviye
    stiffenerStrip: 100,  // takviye açınım genişliği
    gridPitch: 50,     // ızgara boru aralığı
  };

  const DEFAULTS = {
    furniture: "tezgah", grade: "304", qty: 1, price: 4.2, currency: "USD",
    laborHours: 8, laborRate: 10,
    tz_model: "ayakli", tz_L: 1500, tz_W: 700, tz_H: 900, tz_t: "1.2", tz_back: "100",
    tz_omegaW: 120, tz_omegaT: "1.2",
    tz_yalFront: "1", tz_yalLeft: "1", tz_yalRight: "1", tz_shelf: "none", tz_lowShelfT: "1.0",
    tz_bodyT: "0.8", tz_plinth: 100, tz_bottom: "1", tz_bottomT: "1.0",
    tz_door: "hinged", tz_hingedT: "0.8", tz_slidingT: "1.0", tz_inShelves: "1", tz_shelfT: "0.8",
    tz_block: "0", tz_blockW: 450, tz_blockN: 3, tz_blockPos: "right",
    tz_sink: "0", tz_sinkSrc: "ready", tz_sinkPrice: 0, tz_sinkA: 500, tz_sinkB: 400, tz_sinkD: 250, tz_sinkN: "1", tz_sinkT: "1.2",
    tz_machine: "0", tz_machineType: "dish", tz_machinePos: "left",
    dl_L: 1200, dl_H: 650, dl_D: 350, dl_t: "1.0", dl_door: "sliding", dl_shelves: "1",
    dl_railShelf: "0", dl_railBase: "0", dl_railRows: "1",
    rf_L: 1200, rf_D: 500, rf_H: 1800, rf_levels: "4", rf_type: "flat", rf_t: "1.2",
    rf_yalFront: "1", rf_yalBack: "0", rf_yalLeft: "1", rf_yalRight: "1",
  };

  const STORAGE_KEY = "ss-furniture-calc:v6";

  // ---------------------------------------------------------
  // 2) TEMEL HESAP FONKSİYONLARI
  // ---------------------------------------------------------
  const mm2ToM2 = (a, b) => (a * b) / 1e6;

  /** Kenarlarına büküm payı eklenmiş sac açınım alanı (m²) */
  const flangedArea = (a, b, flange) => mm2ToM2(a + 2 * flange, b + 2 * flange);

  /** Sac ağırlığı (kg) */
  const sheetKg = (areaM2, thicknessMm, density) => areaM2 * thicknessMm * density;

  /** Kutu profil metre ağırlığı (kg/m) — kesit alanı(mm²) × yoğunluk / 1000 */
  const boxKgPerM = ({ w, h, t }, density) => ((w * h - (w - 2 * t) * (h - 2 * t)) * density) / 1000;

  /** Dolu yuvarlak mil metre ağırlığı (kg/m) */
  const rodKgPerM = ({ d }, density) => ((Math.PI / 4) * d * d * density) / 1000;

  /** Boru metre ağırlığı (kg/m) */
  const tubeKgPerM = ({ d, t }, density) => ((Math.PI / 4) * (d * d - (d - 2 * t) ** 2) * density) / 1000;

  // Parça listesi oluşturucular
  function sheetPart(name, detail, areaM2, t, density) {
    return { kind: "sac", name, detail: `${detail} · ${fmtNum(t, 1)} mm`, area: areaM2, length: 0, kg: sheetKg(areaM2, t, density) };
  }

  function profilePart(name, detail, lengthMm, kgPerM) {
    const m = lengthMm / 1000;
    return { kind: "profil", name, detail: `${detail} · ${fmtNum(m, 2)} m`, area: 0, length: m, kg: m * kgPerM };
  }

  // ---------------------------------------------------------
  // 3) MOBİLYA HESAPLAYICILARI
  //    Her biri 1 adet ürün için parça listesi döndürür.
  // ---------------------------------------------------------
  /** Omega destek adedi (boya göre): <800 → 1, 800–1300 → 2, 1300–2000 → 3, sonra her 700 mm'de +1 */
  function omegaCount(len) {
    if (len < 800) return 1;
    if (len < 1300) return 2;
    if (len <= 2000) return 3;
    return 3 + Math.ceil((len - 2000) / 700);
  }

  /** Dolap ara rafı altı omega adedi: ≤700 → 1, ≤1500 → 2, üstü → 3 */
  function shelfOmegaCount(len) {
    if (len <= 700) return 1;
    if (len <= 1500) return 2;
    return 3;
  }

  /** Omega destek parçası: derinlik yönünde (dikine), verilen boya göre adet */
  function omegaPart(name, spanL, depth, omega, density, countFn = omegaCount) {
    const n = countFn(spanL);
    return sheetPart(`${name} (${n} adet)`, `${n} × ${depth}×${omega.w} açınım`,
      n * mm2ToM2(depth, omega.w), omega.t, density);
  }

  /** Çarpma kapak: çift cidar (dış + iç sac) */
  function doubleSkinArea(w, h) {
    return flangedArea(w, h, TZ.doorFlange) + flangedArea(w - 2 * TZ.doorFlange, h - 2 * TZ.doorFlange, TZ.innerFlange);
  }

  /**
   * Tezgahın önden görünüşte boy yönündeki bölümleri (soldan sağa).
   * Çekmece bloğu ve makine boşluğu, kapak/raf bölgesinin eninden düşülür.
   */
  function tezgahZones(p) {
    const left = [];
    const right = [];
    // Aynı taraftaysa makine en dışta, blok iç tarafta kalır
    if (p.machine) (p.machine.pos === "left" ? left : right).push({ kind: "machine", w: MACHINE.w });
    if (p.block) (p.block.pos === "left" ? left : right).unshift({ kind: "block", w: p.block.width });
    if (p.machine && p.block && p.machine.pos === "left" && p.block.pos === "left") left.reverse();
    const used = [...left, ...right].reduce((a, z) => a + z.w, 0);
    const zone = { kind: "zone", w: p.L - used };
    return { segments: [...left, zone, ...right], zoneL: zone.w };
  }

  /** Ayaklı tezgah: 4 köşede 40×40×1.2 profil ayak, 40×20×1 yalpalık, opsiyonel taban rafı */
  function tezgahAyakli(p, density) {
    const { L, W, H, shelf, lowShelfT, yal } = p;
    const parts = [];
    const inL = L - TZ.legInset;
    const inW = W - TZ.legInset;
    const legLen = H - TZ.edgeFlange;

    parts.push(profilePart("Ayaklar (4 adet)", `${BOX_PROFILE.label} · 4×${legLen}`, 4 * legLen, boxKgPerM(BOX_PROFILE, density)));

    // Yalpalık: ön / sol / sağ (arka yok)
    const sides = [["Ön", yal.front, inL], ["Sol", yal.left, inW], ["Sağ", yal.right, inW]].filter(([, on]) => on);
    if (sides.length) {
      const len = sides.reduce((a, [, , l]) => a + l, 0);
      parts.push(profilePart(`Yalpalık — ${sides.map(([n]) => n).join(", ")}`,
        `${YAL_PROFILE.label} · ${sides.map(([, , l]) => l).join(" + ")}`, len, boxKgPerM(YAL_PROFILE, density)));
    }

    if (shelf === "flat") {
      parts.push(sheetPart("Taban rafı", `${inL}×${inW} + ${TZ.shelfFlange} mm büküm`,
        flangedArea(inL, inW, TZ.shelfFlange), lowShelfT, density));
      parts.push(omegaPart("Taban rafı omega", inL, inW, p.omega, density));
    }
    return parts;
  }

  /** Dolaplı tezgah: profil ayak yok; çevresi mobilya sacı ile kapatılır */
  function tezgahDolapli(p, density, notices) {
    const { L, W, H, door, block, machine, bodyT, hingedT, slidingT, shelfT, inShelves, bottom, bottomT, plinth } = p;
    const parts = [];
    const pf = TZ.panelFlange;
    const { zoneL } = tezgahZones(p);
    const sideH = H - TZ.edgeFlange;          // yerden tabla altına
    const innerH = sideH - plinth;            // taban üstünden tabla altına
    const bodyLen = L - (machine ? MACHINE.w : 0); // arka ve taban boyu (makine bölmesi hariç)

    // --- Gövde: mobilya sacı ---
    parts.push(sheetPart("Yan paneller (2 adet)", `2 × ${W}×${sideH}`, 2 * flangedArea(W, sideH, pf), bodyT, density));
    if (bodyLen > 0) {
      parts.push(sheetPart("Arka panel", `${bodyLen}×${sideH}`, flangedArea(bodyLen, sideH, pf), bodyT, density));
      if (bottom) {
        parts.push(sheetPart("Taban rafı", `${bodyLen}×${W - 20}`, flangedArea(bodyLen, W - 20, pf), bottomT, density));
        parts.push(omegaPart("Taban rafı omega", bodyLen, W - 40, p.omega, density));
      }
    }

    // --- Ara raflar (kapak bölgesinde) ---
    if (inShelves > 0 && zoneL > 0) {
      parts.push(sheetPart(`Ara raf (${inShelves} adet)`, `${inShelves} × ${zoneL - 10}×${W - 60}`,
        inShelves * flangedArea(zoneL - 10, W - 60, TZ.shelfFlange), shelfT, density));
      const shelfOmega = omegaPart("Ara raf omega", zoneL - 10, W - 60, p.omega, density, shelfOmegaCount);
      if (inShelves > 1) { // her raf için aynı sayıda omega
        shelfOmega.name = shelfOmega.name.replace(/\((\d+) adet\)/, (_, n) => `(${inShelves} raf × ${n} adet)`);
        shelfOmega.kg *= inShelves; shelfOmega.area *= inShelves;
      }
      parts.push(shelfOmega);
    }

    // --- Kapaklar ---
    if (door !== "none" && zoneL <= 0) {
      notices.push("Blok/makine tüm eni kapladığı için kapak bölgesi kalmadı; kapak hesaplanmadı.");
    } else if (door !== "none") {
      const doorH = innerH - 10;
      if (door === "sliding") {
        const n = zoneL > 1800 ? 3 : 2;
        const dw = Math.round(zoneL / n + 25);
        parts.push(sheetPart(`Sürgü kapak (${n} adet)`, `${n} × ${dw}×${doorH}`, n * flangedArea(dw, doorH, TZ.doorFlange), slidingT, density));
        parts.push(sheetPart("Sürgü rayları (alt + üst)", `2 × ${zoneL}×${TZ.railStrip}`, 2 * mm2ToM2(zoneL, TZ.railStrip), slidingT, density));
      } else {
        const n = Math.max(1, Math.ceil(zoneL / TZ.hingedMaxW));
        const dw = Math.round(zoneL / n - 3);
        parts.push(sheetPart(`Çarpma kapak (${n} adet, çift cidar)`, `${n} × ${dw}×${doorH} dış + iç`,
          n * doubleSkinArea(dw, doorH), hingedT, density));
      }
    }

    // --- Çekmece bloğu ---
    if (block) {
      const bw = block.width;
      if (zoneL > 0) {
        parts.push(sheetPart("Blok ara paneli", `${W}×${innerH}`, flangedArea(W, innerH, pf), bodyT, density));
      }
      const frontH = Math.floor(innerH / block.count);
      const boxW = bw - 60;
      const boxD = W - 120;
      const boxH = Math.max(80, frontH - 50);
      const box = mm2ToM2(boxW, boxD) + 2 * mm2ToM2(boxD, boxH) + 2 * mm2ToM2(boxW, boxH);
      parts.push(sheetPart(`Çekmece kutuları (${block.count} adet)`, `${block.count} × ${boxW}×${boxD}×${boxH}`,
        block.count * box, TZ.drawerT, density));
      parts.push(sheetPart(`Çekmece önleri (${block.count} adet, çift cidar)`, `${block.count} × ${bw - 4}×${frontH - 4} dış + iç`,
        block.count * doubleSkinArea(bw - 4, frontH - 4), TZ.drawerT, density));
      if (frontH < 120) notices.push(`Çekmece ön yüksekliği ${frontH} mm — adet bu yükseklik için fazla olabilir.`);
    }

    // --- Makine bölümü ---
    if (machine) {
      if (bodyLen > 0) {
        parts.push(sheetPart("Makine bölmesi ara paneli", `${W}×${sideH}`, flangedArea(W, sideH, pf), bodyT, density));
      }
      if (H < MACHINE.minBenchH) {
        notices.push(`${MACHINE_NAMES[machine.type]} (${MACHINE.h} mm) için tezgah yüksekliği en az ${MACHINE.minBenchH} mm olmalı.`);
      }
      if (W < MACHINE.d) {
        notices.push(`${MACHINE_NAMES[machine.type]} derinliği ${MACHINE.d} mm; tezgah derinliği (${W} mm) yetersiz.`);
      }
    }

    return parts;
  }

  const calculators = {
    /** A) Çalışma tezgahı */
    tezgah(p, density, notices) {
      const { L, W, H, t, back, sink } = p;
      const parts = [];

      // ===== Ortak: üst tabla, sırt, omega destek, evye =====
      parts.push(sheetPart("Üst tabla", `${L}×${W} + ${TZ.edgeFlange} mm etek`,
        flangedArea(L, W, TZ.edgeFlange), t, density));

      if (back > 0) {
        parts.push(sheetPart(`Sırt (H ${back})`, `${L}×${back + TZ.backReturn} açınım`,
          mm2ToM2(L, back + TZ.backReturn), t, density));
      }

      // Tabla altına derinlik yönünde (dikine) omega büküm destekler
      parts.push(omegaPart("Tabla altı omega", L, W - 20, p.omega, density));

      // İmalat evye haznesi sac ağırlığına eklenir; hazır evye fiyatı compute() içinde eklenir
      if (sink && sink.src === "fab") {
        const basin = mm2ToM2(sink.a, sink.b) + 2 * mm2ToM2(sink.a + sink.b, sink.d)
          + 2 * mm2ToM2(sink.a + sink.b, TZ.sinkRim);
        parts.push(sheetPart(`Evye haznesi (${sink.count} adet)`, `${sink.a}×${sink.b}×${sink.d}`,
          sink.count * basin, sink.t, density));
      }

      return parts.concat(p.model === "dolapli"
        ? tezgahDolapli(p, density, notices)
        : tezgahAyakli(p, density));
    },

    /** B) Duvar dolabı */
    dolap(p, density) {
      const { L, H, D, t, door, shelves, railShelf, railBase, railRows } = p;
      const parts = [];
      const f = DL.flange;

      parts.push(sheetPart("Tavan + taban", `2 × ${L}×${D}`, 2 * flangedArea(L, D, f), t, density));
      parts.push(sheetPart("Yan paneller", `2 × ${H}×${D}`, 2 * flangedArea(H, D, f), t, density));
      parts.push(sheetPart("Arka panel", `${L}×${H}`, flangedArea(L, H, f / 2), t, density));
      parts.push(sheetPart("Duvar askı laması", `${L}×${DL.hangStrip}`, mm2ToM2(L, DL.hangStrip), t, density));

      if (shelves > 0) {
        parts.push(sheetPart(`Ara raf (${shelves} adet)`, `${shelves} × ${L - 10}×${D - 30}`,
          shelves * flangedArea(L - 10, D - 30, DL.shelfFlange), t, density));
      }

      // Yalpalık: Ø8 dolu mil, raf önünde boydan boya
      const railCount = ((railShelf ? shelves : 0) + (railBase ? 1 : 0)) * railRows;
      if (railCount > 0) {
        const len = L - 10;
        const where = [railShelf && shelves > 0 ? `${shelves} ara raf` : "", railBase ? "taban" : ""].filter(Boolean).join(" + ");
        parts.push(profilePart(`Yalpalık (${where})`, `${RAIL_ROD.label} · ${railCount}×${len}`,
          railCount * len, rodKgPerM(RAIL_ROD, density)));
      }

      if (door === "sliding") {
        const dw = Math.round(L / 2 + 25);
        const dh = H - 70;
        parts.push(sheetPart("Sürme kapak (2 adet)", `2 × ${dw}×${dh}`, 2 * flangedArea(dw, dh, DL.doorFlange), t, density));
        parts.push(sheetPart("Kapak rayları (alt + üst)", `2 × ${L}×${DL.railStrip}`, 2 * mm2ToM2(L, DL.railStrip), t, density));
      } else if (door === "hinged") {
        const n = L <= 600 ? 1 : 2;
        const dw = Math.round(L / n - 3);
        const dh = H - 6;
        parts.push(sheetPart(`Çarpma kapak (${n} adet)`, `${n} × ${dw}×${dh}`, n * flangedArea(dw, dh, DL.doorFlange), t, density));
      }

      return parts;
    },

    /** C) İstif rafı */
    raf(p, density) {
      const { L, D, H, levels, type, t, yal } = p;
      const parts = [];
      const boxKgM = boxKgPerM(BOX_PROFILE, density);
      const inL = L - 2 * BOX_PROFILE.w;
      const inD = D - 2 * BOX_PROFILE.w;

      parts.push(profilePart("Dikmeler (4 adet)", `${BOX_PROFILE.label} · 4×${H}`, 4 * H, boxKgM));
      parts.push(profilePart(`Boy/en köprüleri (${levels} kat)`, `${levels} × (2×${inL} + 2×${inD})`,
        levels * (2 * inL + 2 * inD), boxKgM));

      if (type === "grid") {
        const tubeKgM = tubeKgPerM(GRID_TUBE, density);
        const count = Math.floor(inD / RF.gridPitch) + 1;
        parts.push(profilePart(`Izgara raflar (${levels} kat)`, `${GRID_TUBE.label} · ${levels}×${count}×${inL}`,
          levels * count * inL, tubeKgM));
      } else {
        const ratio = type === "perforated" ? 1 - RF.perforatedOpen : 1;
        const label = type === "perforated" ? "Perfore raf" : "Düz sac raf";
        const area = levels * flangedArea(L, D, RF.shelfFlange) * ratio;
        const note = type === "perforated" ? ` · %${RF.perforatedOpen * 100} boşluk düşüldü` : "";
        parts.push(sheetPart(`${label} (${levels} kat)`, `${levels} × ${L}×${D}${note}`, area, t, density));

        const stiff = Math.max(1, Math.floor(L / RF.stiffenerEvery));
        parts.push(sheetPart("Raf altı takviyeleri", `${levels}×${stiff} × ${inD}×${RF.stiffenerStrip}`,
          levels * stiff * mm2ToM2(inD, RF.stiffenerStrip), t, density));
      }

      // Yalpalık / deniz bağı: seçilen kenarlarda, her katta 40×20×1 profil
      const sides = [
        ["Ön", yal.front, inL], ["Arka", yal.back, inL], ["Sol", yal.left, inD], ["Sağ", yal.right, inD],
      ].filter(([, on]) => on);
      if (sides.length) {
        const perLevel = sides.reduce((a, [, , len]) => a + len, 0);
        const detail = sides.map(([, , len]) => len).join(" + ");
        parts.push(profilePart(`Yalpalık — ${sides.map(([n]) => n).join(", ")}`,
          `${YAL_PROFILE.label} · ${levels} × (${detail})`, levels * perLevel, boxKgPerM(YAL_PROFILE, density)));
      }

      return parts;
    },
  };

  // ---------------------------------------------------------
  // 4) DOM YARDIMCILARI
  // ---------------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const form = $("#calcForm");

  function fmtNum(n, digits = 2) {
    return new Intl.NumberFormat("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
  }

  function fmtMoney(n, cur) {
    try {
      return new Intl.NumberFormat("tr-TR", { style: "currency", currency: cur, minimumFractionDigits: 2 }).format(n);
    } catch {
      return `${fmtNum(n)} ${CURRENCIES[cur].symbol}`;
    }
  }

  const getRadio = (name) => (form.querySelector(`input[type="radio"][name="${name}"]:checked`) || {}).value;
  const num = (id) => parseFloat($("#" + id).value);
  const int = (id) => parseInt($("#" + id).value, 10);
  const val = (id) => $("#" + id).value;
  const chk = (id) => $("#" + id).checked;
  const selText = (id) => { const s = $("#" + id); return s.options[s.selectedIndex].text; };

  /** data-when koşulları için alan değeri: radio → seçili değer, checkbox → "1"/"0" */
  function fieldValue(name) {
    const radio = getRadio(name);
    if (radio !== undefined) return radio;
    const el = document.getElementById(name);
    if (!el) return undefined;
    return el.type === "checkbox" ? (el.checked ? "1" : "0") : el.value;
  }

  // ---------------------------------------------------------
  // 5) GİRDİ OKUMA & DOĞRULAMA
  // ---------------------------------------------------------
  function readInputs() {
    const furniture = getRadio("furniture");
    const s = {
      furniture,
      grade: val("grade"),
      qty: Math.max(1, Math.floor(num("qty")) || 1),
      price: Math.max(0, num("price") || 0),
      currency: val("currency"),
      laborHours: Math.max(0, num("laborHours") || 0),
      laborRate: Math.max(0, num("laborRate") || 0),
    };

    if (furniture === "tezgah") {
      const model = getRadio("tz_model");
      const dolapli = model === "dolapli";
      s.params = {
        model, L: num("tz_L"), W: num("tz_W"), H: num("tz_H"),
        t: parseFloat(val("tz_t")), back: int("tz_back"),
        omega: { w: num("tz_omegaW"), t: parseFloat(val("tz_omegaT")) },
        // Ayaklı
        yal: { front: chk("tz_yalFront"), left: chk("tz_yalLeft"), right: chk("tz_yalRight") },
        shelf: val("tz_shelf"), lowShelfT: parseFloat(val("tz_lowShelfT")),
        // Dolaplı
        bodyT: parseFloat(val("tz_bodyT")), plinth: num("tz_plinth"),
        bottom: val("tz_bottom") === "1", bottomT: parseFloat(val("tz_bottomT")),
        door: val("tz_door"), hingedT: parseFloat(val("tz_hingedT")), slidingT: parseFloat(val("tz_slidingT")),
        inShelves: int("tz_inShelves"), shelfT: parseFloat(val("tz_shelfT")),
        block: dolapli && chk("tz_block")
          ? { width: num("tz_blockW"), count: Math.max(1, Math.min(6, int("tz_blockN") || 1)), pos: val("tz_blockPos") }
          : null,
        machine: dolapli && chk("tz_machine") ? { type: val("tz_machineType"), pos: val("tz_machinePos") } : null,
        sink: chk("tz_sink")
          ? {
            src: val("tz_sinkSrc"), count: int("tz_sinkN"), price: Math.max(0, num("tz_sinkPrice") || 0),
            a: num("tz_sinkA"), b: num("tz_sinkB"), d: num("tz_sinkD"), t: parseFloat(val("tz_sinkT")),
          }
          : null,
      };
      s.dims = ["tz_L", "tz_W", "tz_H", "tz_omegaW"];
      if (dolapli) s.dims.push("tz_plinth");
      if (s.params.block) s.dims.push("tz_blockW");
      if (s.params.sink && s.params.sink.src === "fab") s.dims.push("tz_sinkA", "tz_sinkB", "tz_sinkD");
      s.title = `${s.params.L} × ${s.params.W} × ${s.params.H} mm`;
    } else if (furniture === "dolap") {
      s.params = {
        L: num("dl_L"), H: num("dl_H"), D: num("dl_D"),
        t: parseFloat(val("dl_t")), door: val("dl_door"), shelves: int("dl_shelves"),
        railShelf: chk("dl_railShelf"), railBase: chk("dl_railBase"), railRows: int("dl_railRows"),
      };
      s.dims = ["dl_L", "dl_H", "dl_D"];
      s.title = `${s.params.L} × ${s.params.H} × ${s.params.D} mm`;
    } else {
      s.params = {
        L: num("rf_L"), D: num("rf_D"), H: num("rf_H"),
        levels: int("rf_levels"), type: val("rf_type"), t: parseFloat(val("rf_t")),
        yal: { front: chk("rf_yalFront"), back: chk("rf_yalBack"), left: chk("rf_yalLeft"), right: chk("rf_yalRight") },
      };
      s.dims = ["rf_L", "rf_D", "rf_H"];
      s.title = `${s.params.L} × ${s.params.D} × ${s.params.H} mm`;
    }
    return s;
  }

  /** Ölçü alanlarını min/max aralığına ve ürün kurallarına göre kontrol eder */
  function validate(state) {
    const errors = [];
    $$("input.is-invalid", form).forEach((el) => el.classList.remove("is-invalid"));
    state.dims.forEach((id) => {
      const el = $("#" + id);
      const v = parseFloat(el.value);
      const min = parseFloat(el.min);
      const max = parseFloat(el.max);
      const bad = !Number.isFinite(v) || v < min || v > max;
      el.classList.toggle("is-invalid", bad);
      if (bad) {
        const label = $(`label[for="${id}"]`).textContent;
        errors.push(`${label}: ${min}–${max} mm aralığında olmalı`);
      }
    });
    if (errors.length || state.furniture !== "tezgah") return errors;

    const p = state.params;
    const { zoneL } = tezgahZones(p);
    if (zoneL < 0) {
      const used = [p.block && `blok ${p.block.width}`, p.machine && `makine ${MACHINE.w}`].filter(Boolean).join(" + ");
      errors.push(`Ek bölümler (${used} mm) tezgah enini (${p.L} mm) aşıyor`);
    }
    if (p.sink && p.sink.src === "fab") {
      const needL = p.sink.count * p.sink.a + (p.sink.count + 1) * TZ.sinkMargin;
      if (needL > p.L) errors.push(`Evye hazneleri için en az ${needL} mm tezgah eni gerekir`);
      if (p.sink.b + 2 * TZ.sinkMargin > p.W) errors.push(`Hazne boyu için tezgah derinliği en az ${p.sink.b + 2 * TZ.sinkMargin} mm olmalı`);
    }
    return errors;
  }

  // Seçilen ürünün parametre listesi (özet + kopyalama için)
  function specRows(s) {
    const p = s.params;
    const common = [
      ["Malzeme", GRADES[s.grade].name],
      ["Yoğunluk", `${GRADES[s.grade].density} g/cm³`],
      ["Kg fiyatı", `${fmtMoney(s.price, s.currency)}/kg`],
      ["İşçilik", `${fmtNum(s.laborHours, 1)} saat × ${fmtMoney(s.laborRate, s.currency)}/saat`],
    ];
    const posText = (pos) => (pos === "left" ? "solda" : "sağda");
    let specific;
    if (s.furniture === "tezgah") {
      const sinkText = !p.sink ? "Yok"
        : p.sink.src === "ready" ? `Hazır, ${p.sink.count} × ${fmtMoney(p.sink.price, s.currency)}`
        : `İmalat, ${p.sink.count} × ${p.sink.a}×${p.sink.b}×${p.sink.d} mm`;
      specific = [
        ["Model", p.model === "dolapli" ? "Dolaplı tezgah" : "Ayaklı tezgah"],
        ["Ölçü (L×W×H)", `${p.L}×${p.W}×${p.H} mm`],
        ["Tabla sacı", `${fmtNum(p.t, 1)} mm`],
        ["Sırt", selText("tz_back")],
        ["Omega destek", `${p.omega.w} mm açınım, ${fmtNum(p.omega.t, 1)} mm`],
      ];
      if (p.model === "dolapli") {
        specific.push(
          ["Mobilya sacı", `${fmtNum(p.bodyT, 1)} mm`],
          ["Taban rafı", p.bottom ? `${fmtNum(p.bottomT, 1)} mm, yerden ${p.plinth} mm` : "Yok"],
          ["Kapak", p.door === "none" ? "Kapaksız"
            : p.door === "hinged" ? `Çarpma, çift cidar 2 × ${fmtNum(p.hingedT, 1)} mm`
            : `Sürgü, ${fmtNum(p.slidingT, 1)} mm`],
          ["Ara raf", p.inShelves > 0 ? `${p.inShelves} adet, ${fmtNum(p.shelfT, 1)} mm` : "Yok"],
          ["Çekmece bloğu", p.block ? `${p.block.count}'lü, ${p.block.width} mm, ${posText(p.block.pos)}` : "Yok"],
          ["Makine bölümü", p.machine ? `${MACHINE_NAMES[p.machine.type]}, ${posText(p.machine.pos)}` : "Yok"],
        );
      } else {
        specific.push(
          ["Ayaklar", "4 × 40×40×1.2 mm"],
          ["Yalpalık (40×20×1)", [["Ön", p.yal.front], ["Sol", p.yal.left], ["Sağ", p.yal.right]]
            .filter(([, on]) => on).map(([n]) => n).join(", ") || "Yok"],
          ["Taban rafı", p.shelf === "flat" ? `Var, ${fmtNum(p.lowShelfT, 1)} mm` : "Yok"],
        );
      }
      specific.push(["Evye", sinkText]);
    } else if (s.furniture === "dolap") {
      const rails = [p.railShelf && p.shelves > 0 && "ara raflar", p.railBase && "taban"].filter(Boolean);
      specific = [
        ["Ölçü (L×H×D)", `${p.L}×${p.H}×${p.D} mm`],
        ["Sac kalınlığı", `${fmtNum(p.t, 1)} mm`],
        ["Kapak", selText("dl_door")],
        ["Ara raf", p.shelves > 0 ? `${p.shelves} adet` : "Yok"],
        ["Yalpalık (Ø8)", rails.length ? `${rails.join(" + ")}, ${p.railRows} sıra` : "Yok"],
      ];
    } else {
      const yal = [["Ön", p.yal.front], ["Arka", p.yal.back], ["Sol", p.yal.left], ["Sağ", p.yal.right]]
        .filter(([, on]) => on).map(([n]) => n);
      specific = [
        ["Ölçü (L×D×H)", `${p.L}×${p.D}×${p.H} mm`],
        ["Kat sayısı", `${p.levels} kat`],
        ["Raf tipi", selText("rf_type")],
        ["Raf sacı", p.type === "grid" ? GRID_TUBE.label : `${fmtNum(p.t, 1)} mm`],
        ["Dikme profili", "40×40×1.2 mm"],
        ["Yalpalık (40×20×1)", yal.length ? yal.join(", ") : "Yok"],
      ];
    }
    return [...specific, ...common];
  }

  // ---------------------------------------------------------
  // 6) ANA HESAPLAMA
  // ---------------------------------------------------------
  function compute(s) {
    const density = GRADES[s.grade].density;
    const notices = [];
    const parts = calculators[s.furniture](s.params, density, notices);

    const unit = parts.reduce((acc, p) => {
      acc.kg += p.kg;
      if (p.kind === "sac") { acc.sheetKg += p.kg; acc.area += p.area; }
      else { acc.profileKg += p.kg; acc.length += p.length; }
      return acc;
    }, { kg: 0, sheetKg: 0, profileKg: 0, area: 0, length: 0 });

    const totalKg = unit.kg * s.qty;
    const material = totalKg * s.price;
    const labor = s.laborHours * s.laborRate * s.qty;
    // Hazır alınan ürünler (ağırlığa ve işçilik payına girmez)
    const extras = [];
    const sink = s.furniture === "tezgah" ? s.params.sink : null;
    if (sink && sink.src === "ready") {
      extras.push({ name: `Evye ${sink.count} × ${fmtMoney(sink.price, s.currency)}`, amount: sink.count * sink.price * s.qty });
      if (sink.price === 0) notices.push("Hazır evye fiyatı girilmedi.");
    }
    const extra = extras.reduce((a, e) => a + e.amount, 0);
    const total = material + labor + extra;

    return { parts, notices, extras, extra, unit, totalKg, material, labor, total, unitTotal: total / s.qty };
  }

  // ---------------------------------------------------------
  // 7) ARAYÜZ GÜNCELLEME
  // ---------------------------------------------------------
  let lastResult = null;

  /** data-furniture ve data-when ile koşullu alanları göster/gizle.
   *  data-when: "alan=değer", "alan!=değer"; "|" ile VEYA bağlanabilir. */
  function syncVisibility() {
    const furniture = getRadio("furniture");
    $$("[data-furniture]").forEach((el) => { el.hidden = el.dataset.furniture !== furniture; });

    $$("[data-when]").forEach((el) => {
      el.hidden = !el.dataset.when.split("|").some((cond) => {
        const m = cond.trim().match(/^(\w+)(!?=)(\w+)$/);
        if (!m) return true;
        const [, name, op, expected] = m;
        const current = fieldValue(name);
        return op === "=" ? current === expected : current !== expected;
      });
    });

    const cur = val("currency");
    $$("[data-currency-suffix]").forEach((el) => { el.textContent = `${cur}/kg`; });
    $$("[data-currency-code]").forEach((el) => { el.textContent = cur; });
    $$("[data-currency-hour]").forEach((el) => { el.textContent = `${cur}/saat`; });
  }

  /** Tezgah yerleşim önizlemesi: blok, makine ve kapak/raf bölgesi oranları */
  function renderLayout(s) {
    const bar = $("#tzLayout");
    if (s.furniture !== "tezgah" || s.params.model !== "dolapli" || !Number.isFinite(s.params.L) || s.params.L <= 0) { bar.innerHTML = ""; return; }
    const p = s.params;
    const label = {
      zone: p.door === "none" ? "Açık bölüm" : p.door === "sliding" ? "Sürgü kapaklı" : "Çarpma kapaklı",
      block: p.block ? `${p.block.count}'lü çekmece` : "",
      machine: p.machine ? MACHINE_NAMES[p.machine.type] : "",
    };
    bar.innerHTML = tezgahZones(p).segments
      .filter((z) => z.w > 0)
      .map((z) => `<div class="layout-seg seg-${z.kind}" style="flex:${z.w} 1 0" title="${label[z.kind]} — ${z.w} mm">
          <span>${label[z.kind]}</span><small>${z.w} mm</small></div>`)
      .join("");
  }

  function render() {
    syncVisibility();
    const s = readInputs();
    const errors = validate(s);
    const warn = $("#warning");
    warn.hidden = errors.length === 0;
    warn.innerHTML = errors.map((e) => `⚠ ${e}`).join("<br>");
    renderLayout(s);

    $("#sumType").textContent = FURNITURE_NAMES[s.furniture];
    $("#sumTitle").textContent = s.title;
    $("#sumGrade").textContent = GRADES[s.grade].name;
    $("#sumQty").textContent = s.qty;

    if (errors.length) {
      lastResult = null;
      ["#kpiWeight", "#kpiTotal", "#costMaterial", "#costLabor", "#costExtra", "#costTotal"].forEach((id) => { $(id).textContent = "—"; });
      $("#kpiWeightUnit").textContent = "Ölçüleri kontrol edin";
      $("#kpiTotalUnit").textContent = "";
      $("#partsBody").innerHTML = "";
      $("#notices").hidden = true;
      return;
    }

    const r = compute(s);
    lastResult = { s, r };

    const notes = $("#notices");
    notes.hidden = r.notices.length === 0;
    notes.innerHTML = r.notices.map((n) => `ℹ ${n}`).join("<br>");

    $("#kpiWeight").textContent = fmtNum(r.totalKg);
    $("#kpiWeightUnit").textContent = `Birim: ${fmtNum(r.unit.kg)} kg`;
    $("#kpiTotal").textContent = fmtMoney(r.total, s.currency);
    $("#kpiTotalUnit").textContent = `Birim: ${fmtMoney(r.unitTotal, s.currency)}`;
    $("#costMaterial").textContent = fmtMoney(r.material, s.currency);
    $("#costLabor").textContent = fmtMoney(r.labor, s.currency);
    $("#costTotal").textContent = fmtMoney(r.total, s.currency);
    $("#extraRow").hidden = r.extras.length === 0;
    $("#costExtra").textContent = fmtMoney(r.extra, s.currency);
    $("#extraLabel").textContent = r.extras.length ? `(${r.extras.map((e) => e.name).join(", ")})` : "";
    $("#laborLabel").textContent = `(${fmtNum(s.laborHours, 1)} saat × ${fmtMoney(s.laborRate, s.currency)}${s.qty > 1 ? ` × ${s.qty} adet` : ""})`;

    const pct = (v) => (r.total > 0 ? (v / r.total) * 100 : 0);
    $("#barMaterial").style.width = `${r.total > 0 ? pct(r.material) : 100}%`;
    $("#barLabor").style.width = `${pct(r.labor)}%`;
    $("#barExtra").style.width = `${pct(r.extra)}%`;

    $("#partsBody").innerHTML = r.parts.map((p) => `
      <tr${p.kg < 0 ? ' class="is-deduction"' : ""}>
        <td><span class="tag tag-${p.kind}">${p.kind === "sac" ? "SAC" : "PRF"}</span>${p.name}</td>
        <td>${p.detail}</td>
        <td class="num">${fmtNum(p.kg)}</td>
      </tr>`).join("");

    $("#sheetArea").textContent = `${fmtNum(r.unit.area, 3)} m²`;
    $("#sheetKg").textContent = fmtNum(r.unit.sheetKg);
    $("#profileLen").textContent = `${fmtNum(r.unit.length, 2)} m`;
    $("#profileKg").textContent = fmtNum(r.unit.profileKg);

    $("#specList").innerHTML = specRows(s)
      .map(([k, v]) => `<li><span>${k}</span><b>${v}</b></li>`).join("");

    saveState();
  }

  // ---------------------------------------------------------
  // 8) DURUM KAYDI (localStorage — yalnızca kolaylık amaçlı)
  // ---------------------------------------------------------
  function collectState() {
    const data = {};
    $$("input, select", form).forEach((el) => {
      if (!el.name) return;
      if (el.type === "radio") { if (el.checked) data[el.name] = el.value; }
      else if (el.type === "checkbox") data[el.name] = el.checked ? "1" : "0";
      else data[el.name] = el.value;
    });
    return data;
  }

  function applyState(data) {
    Object.entries(data).forEach(([name, value]) => {
      const radios = $$(`input[type="radio"][name="${name}"]`, form);
      if (radios.length) {
        radios.forEach((r) => { r.checked = r.value === String(value); });
        return;
      }
      const el = form.elements[name];
      if (!el) return;
      if (el.type === "checkbox") el.checked = String(value) === "1";
      else el.value = value;
    });
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(collectState())); } catch { /* yok say */ }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) applyState(JSON.parse(raw));
    } catch { /* yok say */ }
  }

  // ---------------------------------------------------------
  // 9) TEKLİF ÖZETİ: KOPYALA & YAZDIR
  // ---------------------------------------------------------
  function buildSummaryText() {
    if (!lastResult) return "";
    const { s, r } = lastResult;
    const line = "─".repeat(44);
    const rows = [
      "PASLANMAZ MOBİLYA — TEKLİF ÖZETİ",
      `Tarih: ${new Date().toLocaleDateString("tr-TR")}`,
      line,
      `Ürün   : ${FURNITURE_NAMES[s.furniture]} (${s.title})`,
      `Adet   : ${s.qty}`,
      ...specRows(s).map(([k, v]) => `${k.padEnd(14)}: ${v}`),
      line,
      "PARÇA DÖKÜMÜ (1 adet)",
      ...r.parts.map((p) => `• ${p.name} — ${p.detail} → ${fmtNum(p.kg)} kg`),
      `Sac toplamı    : ${fmtNum(r.unit.area, 3)} m² / ${fmtNum(r.unit.sheetKg)} kg`,
      `Profil toplamı : ${fmtNum(r.unit.length, 2)} m / ${fmtNum(r.unit.profileKg)} kg`,
      line,
      `Birim ağırlık        : ${fmtNum(r.unit.kg)} kg`,
      `Toplam ağırlık       : ${fmtNum(r.totalKg)} kg`,
      `Malzeme maliyeti     : ${fmtMoney(r.material, s.currency)}`,
      `İşçilik / imalat     : ${fmtMoney(r.labor, s.currency)}`,
      ...r.extras.map((e) => `${e.name}: ${fmtMoney(e.amount, s.currency)}`),
      `TOPLAM TAHMİNİ FİYAT : ${fmtMoney(r.total, s.currency)}`,
      `Birim fiyat          : ${fmtMoney(r.unitTotal, s.currency)}`,
      line,
      "Not: Teorik ağırlıktır; fire, kaynak sarfı ve hazır aksesuarlar dahil değildir.",
    ];
    return rows.join("\n");
  }

  async function copySummary() {
    const text = buildSummaryText();
    if (!text) { toast("Önce geçerli ölçüler girin"); return; }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    toast("Teklif özeti panoya kopyalandı");
  }

  function printSummary() {
    if (!lastResult) { toast("Önce geçerli ölçüler girin"); return; }
    const now = new Date();
    $("#printDate").textContent = now.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
    $("#quoteNo").textContent = `PM-${now.toISOString().slice(2, 10).replace(/-/g, "")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    window.print();
  }

  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  // ---------------------------------------------------------
  // 10) TEMA
  // ---------------------------------------------------------
  const THEME_KEY = "ss-furniture-calc:theme";

  function initTheme() {
    let theme = "dark"; // koyu tema öncelikli
    try { theme = localStorage.getItem(THEME_KEY) || theme; } catch { /* yok say */ }
    document.documentElement.dataset.theme = theme;
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* yok say */ }
  }

  // ---------------------------------------------------------
  // 11) OLAYLAR
  // ---------------------------------------------------------
  function bindEvents() {
    form.addEventListener("input", render);
    form.addEventListener("change", render);
    form.addEventListener("submit", (e) => e.preventDefault());

    $$("[data-step]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = $("#" + btn.dataset.target);
        const next = (parseInt(input.value, 10) || 0) + parseInt(btn.dataset.step, 10);
        input.value = Math.max(+input.min, Math.min(+input.max, next));
        render();
      });
    });

    // Makine bölümü açılınca yükseklik 900 mm altındaysa otomatik yükselt
    $("#tz_machine").addEventListener("change", (e) => {
      const h = $("#tz_H");
      if (e.target.checked && parseFloat(h.value) < MACHINE.minBenchH) {
        h.value = MACHINE.minBenchH;
        render();
        toast(`Makine için tezgah yüksekliği ${MACHINE.minBenchH} mm yapıldı`);
      }
    });

    $("#resetBtn").addEventListener("click", () => {
      applyState(DEFAULTS);
      render();
      toast("Varsayılan değerler yüklendi");
    });

    $("#copyBtn").addEventListener("click", copySummary);
    $("#printBtn").addEventListener("click", printSummary);
    $("#themeToggle").addEventListener("click", toggleTheme);
  }

  // ---------------------------------------------------------
  // BAŞLAT
  // ---------------------------------------------------------
  initTheme();
  loadState();
  bindEvents();
  render();
})();
