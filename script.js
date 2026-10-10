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
    drawerT: 0.8,
    footProfile: 90,   // ayarlı ayak için 40×40×1.2 profil parça boyu      // çekmece (kutu + çift cidar ön) sac kalınlığı
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
    calcMode: "labor", kgSalePrice: 9, laborHours: 8, laborRate: 10,
    tz_L: 1200, tz_W: 700, tz_H: 900, tz_t: "1.2", tz_back: "100", tz_backL: "0", tz_backR: "0",
    tz_shelfOmega: "1", tz_rod: "1",
    tz_omegaW: 120, tz_omegaT: "1.2",
    tz_sections: [{ type: "drawer", width: "450", count: 3 }, { type: "open", width: "" }],
    tz_yalFront: "0", tz_yalBack: "1", tz_yalLeft: "1", tz_yalRight: "1", tz_lowShelfT: "1.0",
    tz_bodyT: "0.8", tz_bottomT: "1.0", tz_hingedT: "0.8", tz_slidingT: "1.0", tz_shelfT: "0.8",
    tz_plinth: 150, tz_footPrice: 0,
    tz_sink: "0", tz_sinkSrc: "ready", tz_sinkPrice: 0, tz_sinkA: 500, tz_sinkB: 400, tz_sinkD: 250, tz_sinkN: "1", tz_sinkT: "1.2",
    dl_L: 1200, dl_H: 650, dl_D: 350, dl_t: "1.0", dl_door: "sliding", dl_shelves: "1",
    dl_railShelf: "0", dl_railBase: "0", dl_railRows: "1",
    rf_L: 1200, rf_D: 500, rf_H: 1800, rf_levels: "4", rf_type: "flat", rf_t: "1.2",
    rf_yalFront: "1", rf_yalBack: "0", rf_yalLeft: "1", rf_yalRight: "1",
  };

  const STORAGE_KEY = "ss-furniture-calc:v9";

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
    return { kind: "sac", t, name, detail: `${detail} · ${fmtNum(t, 1)} mm`, area: areaM2, length: 0, kg: sheetKg(areaM2, t, density) };
  }

  function profilePart(name, detail, lengthMm, kgPerM, label) {
    const m = lengthMm / 1000;
    return { kind: "profil", label, name, detail: `${detail} · ${fmtNum(m, 2)} m`, area: 0, length: m, kg: m * kgPerM };
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

  /** Dolap ara rafı altı omega adedi (otomatik): ≤700 → 1, üstü → 2 (en fazla 2) */
  function shelfOmegaCount(len) {
    return len <= 700 ? 1 : 2;
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

  // ---------------------------------------------------------
  // TEZGAH BÖLME SİSTEMİ
  // Tezgahın altı soldan sağa bölmelerden oluşur:
  //   open    → açık, 40×40×1.2 profil ayaklı (opsiyonel taban rafı)
  //   cabinet → dolap (mobilya sacı, kapak, ara raf)
  //   drawer  → çekmece bloğu (mobilya sacı, tamamı 0.8 mm çekmece)
  //   machine → bulaşık/çamaşır makinesi boşluğu (600 mm)
  // ---------------------------------------------------------
  const SECTION_NAMES = { open: "Açık", cabinet: "Dolap", drawer: "Çekmece", machine: "Makine" };
  const isClosed = (sec) => !!sec && (sec.type === "cabinet" || sec.type === "drawer");
  const DOOR_NAMES = { hinged: "çarpma", sliding: "sürgü", none: "kapaksız" };

  function newSection(type) {
    return { type, width: "", shelf: false, door: "hinged", shelves: 1, count: 3, machine: "dish" };
  }

  /** Genişlikleri çözer: makine 600 mm sabit; boş genişlikler kalanı eşit paylaşır */
  function resolveSections(L, sections) {
    const fixedW = (s) => (s.type === "machine" ? MACHINE.w : parseFloat(s.width));
    const autos = sections.filter((s) => !Number.isFinite(fixedW(s)) || fixedW(s) <= 0);
    const used = sections.reduce((a, s) => a + (autos.includes(s) ? 0 : fixedW(s)), 0);
    const autoW = autos.length ? Math.round((L - used) / autos.length) : 0;
    return {
      list: sections.map((s) => ({ ...s, w: autos.includes(s) ? autoW : fixedW(s), auto: autos.includes(s) })),
      used, autoCount: autos.length, autoW,
    };
  }

  function sectionLabel(sec) {
    if (sec.type === "open") return sec.shelf ? "Açık + taban rafı" : "Açık";
    if (sec.type === "cabinet") return `Dolap (${DOOR_NAMES[sec.door]}${sec.shelves ? `, ${sec.shelves} ara raf` : ""})`;
    if (sec.type === "drawer") return `${sec.count}'lü çekmece`;
    return MACHINE_NAMES[sec.machine];
  }

  /** Bölmelere göre alt yapı parçaları */
  function tezgahSections(p, density, ctx) {
    const { W, H, yal } = p;
    const secs = resolveSections(p.L, p.sections).list;
    const parts = [];
    const pf = TZ.panelFlange;
    const boxKgM = boxKgPerM(BOX_PROFILE, density);
    const legLen = H - TZ.edgeFlange;            // açık bölme ayağı: yerden tabla altına
    const sideH = H - TZ.edgeFlange - p.plinth;  // kapalı bölme: ayarlı ayak üstünden tabla altına
    const tag = (i, sec) => `B${i + 1} ${SECTION_NAMES[sec.type]}`;

    // --- Bölme sınırları: profil ayak / kapalı yan sac / makine yan sacı ---
    let legPairs = 0;
    let closedPanels = 0;
    let machineEdgePanels = 0;
    for (let b = 0; b <= secs.length; b++) {
      const left = secs[b - 1];
      const right = secs[b];
      if (isClosed(left) || isClosed(right)) closedPanels++;            // kapalı bölme yan sacı (komşu kapalıyla ortak)
      else if ((left && left.type === "open") || (right && right.type === "open")) legPairs++; // profil ayak çifti
      else machineEdgePanels++;                                          // makinenin dış yanı
    }

    if (legPairs) {
      parts.push(profilePart(`Profil ayaklar (${legPairs * 2} adet)`, `${BOX_PROFILE.label} · ${legPairs * 2}×${legLen}`,
        legPairs * 2 * legLen, boxKgM, BOX_PROFILE.label));
    }

    // Çevre profili (40×20×1): açık bölmelerin arkası/önü + tezgah uçlarındaki açık yanlar
    const sideLen = W - TZ.legInset;
    const first = secs[0];
    const last = secs[secs.length - 1];
    const openSecs = secs.filter((x) => x.type === "open");
    const rails = [];
    if (yal.back) openSecs.forEach((x) => rails.push(["Arka", x.w - BOX_PROFILE.w]));
    if (yal.front) openSecs.forEach((x) => rails.push(["Ön", x.w - BOX_PROFILE.w]));
    if (yal.left && first && first.type === "open") rails.push(["Sol", sideLen]);
    if (yal.right && last && last.type === "open") rails.push(["Sağ", sideLen]);
    if (rails.length) {
      const names = [...new Set(rails.map(([n]) => n))].join(", ");
      parts.push(profilePart(`Çevre profili — ${names}`, `${YAL_PROFILE.label} · ${rails.map(([, l]) => l).join(" + ")}`,
        rails.reduce((acc, [, l]) => acc + l, 0), boxKgPerM(YAL_PROFILE, density), YAL_PROFILE.label));
    }

    if (closedPanels) {
      parts.push(sheetPart(`Kapalı bölme yan sacları (${closedPanels} adet)`, `${closedPanels} × ${W}×${sideH}`,
        closedPanels * flangedArea(W, sideH, pf), p.bodyT, density));
      const feet = closedPanels * 2;
      parts.push(profilePart(`Ayarlı ayak profilleri (${feet} adet)`, `${BOX_PROFILE.label} · ${feet}×${TZ.footProfile}`,
        feet * TZ.footProfile, boxKgM, BOX_PROFILE.label));
      ctx.counts.feet = feet;
    }
    if (machineEdgePanels) {
      parts.push(sheetPart(`Makine dış yan sacı (${machineEdgePanels} adet)`, `${machineEdgePanels} × ${W}×${legLen}`,
        machineEdgePanels * flangedArea(W, legLen, pf), p.bodyT, density));
    }

    // --- Bölme bazında parçalar ---
    secs.forEach((sec, i) => {
      const w = sec.w;
      const t = tag(i, sec);
      if (sec.type === "open") {
        if (sec.shelf) {
          const sw = w - BOX_PROFILE.w;
          parts.push(sheetPart(`${t} · taban rafı`, `${sw}×${W - TZ.legInset} + ${TZ.shelfFlange} mm büküm`,
            flangedArea(sw, W - TZ.legInset, TZ.shelfFlange), p.lowShelfT, density));
          parts.push(omegaPart(`${t} · taban rafı omega`, sw, W - TZ.legInset, p.omega, density));
        }
        return;
      }
      if (sec.type === "machine") {
        if (H < MACHINE.minBenchH) ctx.notices.push(`${MACHINE_NAMES[sec.machine]} (${MACHINE.h} mm) için tezgah yüksekliği en az ${MACHINE.minBenchH} mm olmalı.`);
        if (W < MACHINE.d) ctx.notices.push(`${MACHINE_NAMES[sec.machine]} derinliği ${MACHINE.d} mm; tezgah derinliği (${W} mm) yetersiz.`);
        return;
      }

      // Kapalı bölme: arka sac + taban rafı (+ omega)
      parts.push(sheetPart(`${t} · arka sac`, `${w}×${sideH}`, flangedArea(w, sideH, pf), p.bodyT, density));
      parts.push(sheetPart(`${t} · taban rafı`, `${w}×${W - 20}`, flangedArea(w, W - 20, pf), p.bottomT, density));
      parts.push(omegaPart(`${t} · taban omega`, w, W - 40, p.omega, density));

      if (sec.type === "cabinet") {
        if (sec.shelves > 0) {
          parts.push(sheetPart(`${t} · ara raf (${sec.shelves} adet)`, `${sec.shelves} × ${w - 10}×${W - 60}`,
            sec.shelves * flangedArea(w - 10, W - 60, TZ.shelfFlange), p.shelfT, density));
          const om = omegaPart(`${t} · ara raf omega`, w - 10, W - 60, p.omega, density,
            p.shelfOmega > 0 ? () => p.shelfOmega : shelfOmegaCount);
          if (sec.shelves > 1) {
            om.name = om.name.replace(/\((\d+) adet\)/, (_, n) => `(${sec.shelves} raf × ${n} adet)`);
            om.kg *= sec.shelves; om.area *= sec.shelves;
          }
          parts.push(om);
        }
        if (p.rod) {
          const rods = sec.shelves + 1; // ara raflar + taban rafı
          const rodLen = w - 20;
          parts.push(profilePart(`${t} · Ø8 çubuk (${rods} adet)`, `${RAIL_ROD.label} · ${rods}×${rodLen}`,
            rods * rodLen, rodKgPerM(RAIL_ROD, density), RAIL_ROD.label));
        }
        const doorH = sideH - 10;
        if (sec.door === "sliding") {
          const n = w > 1800 ? 3 : 2;
          const dw = Math.round(w / n + 25);
          parts.push(sheetPart(`${t} · sürgü kapak (${n} adet)`, `${n} × ${dw}×${doorH}`, n * flangedArea(dw, doorH, TZ.doorFlange), p.slidingT, density));
          parts.push(sheetPart(`${t} · sürgü rayları`, `2 × ${w}×${TZ.railStrip}`, 2 * mm2ToM2(w, TZ.railStrip), p.slidingT, density));
        } else if (sec.door === "hinged") {
          const n = Math.max(1, Math.ceil(w / TZ.hingedMaxW));
          const dw = Math.round(w / n - 3);
          parts.push(sheetPart(`${t} · çarpma kapak (${n} adet, çift cidar)`, `${n} × ${dw}×${doorH} dış + iç`,
            n * doubleSkinArea(dw, doorH), p.hingedT, density));
        }
        return;
      }

      // Çekmece bloğu — tamamı 0.8 mm
      const n = sec.count;
      const frontH = Math.floor(sideH / n);
      const boxW = w - 60;
      const boxD = W - 120;
      const boxH = Math.max(80, frontH - 50);
      const box = mm2ToM2(boxW, boxD) + 2 * mm2ToM2(boxD, boxH) + 2 * mm2ToM2(boxW, boxH);
      parts.push(sheetPart(`${t} · çekmece kutuları (${n} adet)`, `${n} × ${boxW}×${boxD}×${boxH}`, n * box, TZ.drawerT, density));
      parts.push(sheetPart(`${t} · çekmece önleri (${n} adet, çift cidar)`, `${n} × ${w - 4}×${frontH - 4} dış + iç`,
        n * doubleSkinArea(w - 4, frontH - 4), TZ.drawerT, density));
      if (frontH < 120) ctx.notices.push(`${t}: çekmece ön yüksekliği ${frontH} mm — adet bu yükseklik için fazla olabilir.`);
    });

    return parts;
  }

  const calculators = {
    /** A) Çalışma tezgahı */
    tezgah(p, density, ctx) {
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

      // Yan sırt: duvara gelen sol/sağ taraf
      [["Sol", p.backL], ["Sağ", p.backR]].forEach(([name, h]) => {
        if (h > 0) {
          parts.push(sheetPart(`${name} yan sırt (H ${h})`, `${W}×${h + TZ.backReturn} açınım`,
            mm2ToM2(W, h + TZ.backReturn), t, density));
        }
      });

      // İmalat evye haznesi sac ağırlığına eklenir; hazır evye fiyatı compute() içinde eklenir
      if (sink && sink.src === "fab") {
        const basin = mm2ToM2(sink.a, sink.b) + 2 * mm2ToM2(sink.a + sink.b, sink.d)
          + 2 * mm2ToM2(sink.a + sink.b, TZ.sinkRim);
        parts.push(sheetPart(`Evye haznesi (${sink.count} adet)`, `${sink.a}×${sink.b}×${sink.d}`,
          sink.count * basin, sink.t, density));
      }

      return parts.concat(tezgahSections(p, density, ctx));
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
          railCount * len, rodKgPerM(RAIL_ROD, density), RAIL_ROD.label));
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

      parts.push(profilePart("Dikmeler (4 adet)", `${BOX_PROFILE.label} · 4×${H}`, 4 * H, boxKgM, BOX_PROFILE.label));
      parts.push(profilePart(`Boy/en köprüleri (${levels} kat)`, `${levels} × (2×${inL} + 2×${inD})`,
        levels * (2 * inL + 2 * inD), boxKgM, BOX_PROFILE.label));

      if (type === "grid") {
        const tubeKgM = tubeKgPerM(GRID_TUBE, density);
        const count = Math.floor(inD / RF.gridPitch) + 1;
        parts.push(profilePart(`Izgara raflar (${levels} kat)`, `${GRID_TUBE.label} · ${levels}×${count}×${inL}`,
          levels * count * inL, tubeKgM, GRID_TUBE.label));
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
          `${YAL_PROFILE.label} · ${levels} × (${detail})`, levels * perLevel, boxKgPerM(YAL_PROFILE, density), YAL_PROFILE.label));
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
      calcMode: getRadio("calcMode"),
      kgSalePrice: Math.max(0, num("kgSalePrice") || 0),
    };

    if (furniture === "tezgah") {
      s.params = {
        L: num("tz_L"), W: num("tz_W"), H: num("tz_H"),
        t: parseFloat(val("tz_t")), back: int("tz_back"), backL: int("tz_backL"), backR: int("tz_backR"),
        shelfOmega: parseInt(val("tz_shelfOmega"), 10) || 0, rod: val("tz_rod") === "1",
        omega: { w: num("tz_omegaW"), t: parseFloat(val("tz_omegaT")) },
        sections: tzSections.map((x) => ({ ...newSection(x.type), ...x })),
        yal: { front: chk("tz_yalFront"), back: chk("tz_yalBack"), left: chk("tz_yalLeft"), right: chk("tz_yalRight") },
        lowShelfT: parseFloat(val("tz_lowShelfT")),
        bodyT: parseFloat(val("tz_bodyT")), bottomT: parseFloat(val("tz_bottomT")),
        hingedT: parseFloat(val("tz_hingedT")), slidingT: parseFloat(val("tz_slidingT")), shelfT: parseFloat(val("tz_shelfT")),
        plinth: num("tz_plinth"), footPrice: Math.max(0, num("tz_footPrice") || 0),
        sink: chk("tz_sink")
          ? {
            src: val("tz_sinkSrc"), count: int("tz_sinkN"), price: Math.max(0, num("tz_sinkPrice") || 0),
            a: num("tz_sinkA"), b: num("tz_sinkB"), d: num("tz_sinkD"), t: parseFloat(val("tz_sinkT")),
          }
          : null,
      };
      s.dims = ["tz_L", "tz_W", "tz_H", "tz_omegaW"];
      if (s.params.sections.some(isClosed)) s.dims.push("tz_plinth");
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
    if (!p.sections.length) errors.push("En az bir alt bölme ekleyin");
    const res = resolveSections(p.L, p.sections);
    if (res.autoCount === 0 && res.used !== p.L) {
      errors.push(`Bölmeler toplamı ${res.used} mm, tezgah eni ${p.L} mm — eşit olmalı (bir bölmenin genişliğini boş bırakırsanız kalanı alır)`);
    } else if (res.autoCount > 0 && res.autoW < 200) {
      errors.push(`Kalan genişlik ${res.autoW} mm — bölmeler tezgah enine sığmıyor`);
    }
    res.list.forEach((sec, i) => {
      if (!sec.auto && sec.type !== "machine" && sec.w < 200) errors.push(`B${i + 1} genişliği en az 200 mm olmalı`);
    });
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
      ...(s.calcMode === "kg"
        ? [["Fiyat yöntemi", `Kg bazlı: ${fmtMoney(s.kgSalePrice, s.currency)}/kg (işçilik dahil)`]]
        : [["Kg fiyatı", `${fmtMoney(s.price, s.currency)}/kg`],
          ["İşçilik", `${fmtNum(s.laborHours, 1)} saat × ${fmtMoney(s.laborRate, s.currency)}/saat`]]),
    ];
    const posText = (pos) => (pos === "left" ? "solda" : "sağda");
    let specific;
    if (s.furniture === "tezgah") {
      const sinkText = !p.sink ? "Yok"
        : p.sink.src === "ready" ? `Hazır, ${p.sink.count} × ${fmtMoney(p.sink.price, s.currency)}`
        : `İmalat, ${p.sink.count} × ${p.sink.a}×${p.sink.b}×${p.sink.d} mm`;
      const secs = resolveSections(p.L, p.sections).list;
      specific = [
        ["Ölçü (L×W×H)", `${p.L}×${p.W}×${p.H} mm`],
        ["Tabla sacı", `${fmtNum(p.t, 1)} mm`],
        ["Sırt", selText("tz_back")],
        ...(p.backL > 0 ? [["Sol yan sırt", `H ${p.backL} mm`]] : []),
        ...(p.backR > 0 ? [["Sağ yan sırt", `H ${p.backR} mm`]] : []),
        ["Omega destek", `${p.omega.w} mm açınım, ${fmtNum(p.omega.t, 1)} mm`],
        ["Bölmeler", secs.map((x) => `${sectionLabel(x)} ${x.w}`).join(" | ")],
      ];
      if (secs.some((x) => x.type === "open")) {
        specific.push(["Çevre profili (40×20×1)", [["Ön", p.yal.front], ["Arka", p.yal.back], ["Sol", p.yal.left], ["Sağ", p.yal.right]]
          .filter(([, on]) => on).map(([n]) => n).join(", ") || "Yok"]);
      }
      if (secs.some(isClosed)) {
        specific.push(
          ["Mobilya sacı", `${fmtNum(p.bodyT, 1)} mm`],
          ["Ayarlı ayak", `${p.plinth} mm`],
          ["Ara raf omega", p.shelfOmega > 0 ? `${p.shelfOmega} adet` : "Otomatik"],
          ["Ø8 çubuk", p.rod ? "Var" : "Yok"],
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
    const ctx = { notices: [], counts: {} };
    const parts = calculators[s.furniture](s.params, density, ctx);
    const notices = ctx.notices;

    const unit = parts.reduce((acc, p) => {
      acc.kg += p.kg;
      if (p.kind === "sac") { acc.sheetKg += p.kg; acc.area += p.area; }
      else { acc.profileKg += p.kg; acc.length += p.length; }
      return acc;
    }, { kg: 0, sheetKg: 0, profileKg: 0, area: 0, length: 0 });

    const totalKg = unit.kg * s.qty;
    const kgMode = s.calcMode === "kg";
    const material = totalKg * (kgMode ? s.kgSalePrice : s.price);
    const labor = kgMode ? 0 : s.laborHours * s.laborRate * s.qty;
    // Hazır alınan ürünler (ağırlığa ve işçilik payına girmez)
    const extras = [];
    const sink = s.furniture === "tezgah" ? s.params.sink : null;
    if (sink && sink.src === "ready") {
      extras.push({ name: `Evye ${sink.count} × ${fmtMoney(sink.price, s.currency)}`, amount: sink.count * sink.price * s.qty });
      if (sink.price === 0) notices.push("Hazır evye fiyatı girilmedi.");
    }
    if (s.furniture === "tezgah" && ctx.counts.feet && s.params.footPrice > 0) {
      extras.push({ name: `Ayarlı ayak ${ctx.counts.feet} × ${fmtMoney(s.params.footPrice, s.currency)}`, amount: ctx.counts.feet * s.params.footPrice * s.qty });
    }
    const extra = extras.reduce((a, e) => a + e.amount, 0);
    const total = material + labor + extra;

    // Ağırlık özeti: sac kalınlığa göre, profil kesite göre
    const sheetBy = new Map();
    const profBy = new Map();
    parts.forEach((q) => {
      const map = q.kind === "sac" ? sheetBy : profBy;
      const key = q.kind === "sac" ? q.t : q.label;
      const g = map.get(key) || { key, qty: 0, kg: 0 };
      g.qty += q.kind === "sac" ? q.area : q.length;
      g.kg += q.kg;
      map.set(key, g);
    });
    const groups = {
      sheet: [...sheetBy.values()].sort((a, b) => a.key - b.key),
      profile: [...profBy.values()],
    };

    return { parts, groups, kgMode, notices, extras, extra, unit, totalKg, material, labor, total, unitTotal: total / s.qty };
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

  /** Tezgah yerleşim önizlemesi: bölmeler soldan sağa */
  function renderLayout(s) {
    const bar = $("#tzLayout");
    if (s.furniture !== "tezgah" || !Number.isFinite(s.params.L) || s.params.L <= 0) { bar.innerHTML = ""; return; }
    const res = resolveSections(s.params.L, s.params.sections);
    const kind = { open: "zone", cabinet: "zone", drawer: "block", machine: "machine" };
    bar.innerHTML = res.list.filter((x) => x.w > 0).map((x, i) => `<div class="layout-seg seg-${kind[x.type]}${x.type === "open" ? " seg-open" : ""}" style="flex:${x.w} 1 0" title="${sectionLabel(x)} — ${x.w} mm">
        <span>B${i + 1} ${sectionLabel(x)}</span><small>${x.w} mm${x.auto ? " (kalan)" : ""}</small></div>`).join("");
    const total = res.list.reduce((a, x) => a + (x.w > 0 ? x.w : 0), 0);
    const tagEl = $("#tzSectionSum");
    tagEl.textContent = `${total} / ${s.params.L} mm`;
    tagEl.classList.toggle("bad", total !== s.params.L);
    updateTemplateActive();
    const cabs = res.list.filter((x) => x.type === "cabinet");
    const shelfVals = [...new Set(cabs.map((x) => x.shelves))];
    $("#cabShelfField").hidden = cabs.length === 0;
    $("#tz_cabShelves").value = shelfVals.length === 1 ? String(shelfVals[0]) : "mixed";
    const opens = res.list.filter((x) => x.type === "open");
    $("#tz_openShelf").checked = opens.length > 0 && opens.every((x) => x.shelf);
    // Sadece kullanılan bölme tiplerinin ayarlarını göster
    $$("[data-needs]").forEach((el) => {
      el.hidden = el.dataset.needs === "open" ? !res.list.some((x) => x.type === "open") : !res.list.some(isClosed);
    });
  }

  // ---------------------------------------------------------
  // TEZGAH BÖLME DÜZENLEYİCİSİ
  // ---------------------------------------------------------
  let tzSections = DEFAULTS.tz_sections.map((x) => ({ ...newSection(x.type), ...x }));

  function optionList(pairs, current) {
    return pairs.map(([v, t]) => `<option value="${v}"${String(v) === String(current) ? " selected" : ""}>${t}</option>`).join("");
  }

  function renderSectionRows() {
    const box = $("#tzSections");
    box.innerHTML = tzSections.map((sec, i) => {
      let extra = "";
      if (sec.type === "open") {
        extra = `<label class="mini-check"><input type="checkbox" data-k="shelf"${sec.shelf ? " checked" : ""} /> Taban rafı</label>`;
      } else if (sec.type === "cabinet") {
        extra = `<select data-k="door" aria-label="Kapak">${optionList([["hinged", "Çarpma kapak"], ["sliding", "Sürgü kapak"], ["none", "Kapaksız"]], sec.door)}</select>
          <select data-k="shelves" aria-label="Ara raf">${optionList([[0, "Ara raf yok"], [1, "1 ara raf"], [2, "2 ara raf"]], sec.shelves)}</select>`;
      } else if (sec.type === "drawer") {
        extra = `<select data-k="count" aria-label="Çekmece adedi">${optionList([[2, "2 çekmece"], [3, "3 çekmece"], [4, "4 çekmece"], [5, "5 çekmece"]], sec.count)}</select>`;
      } else {
        extra = `<select data-k="machine" aria-label="Makine">${optionList([["dish", "Bulaşık makinesi"], ["laundry", "Çamaşır makinesi"]], sec.machine)}</select>`;
      }
      const width = sec.type === "machine"
        ? `<div class="input-group"><input type="number" value="${MACHINE.w}" disabled aria-label="Genişlik" /><span class="addon">mm</span></div>`
        : `<div class="input-group"><input type="number" data-k="width" min="200" step="10" value="${sec.width}" placeholder="kalan" inputmode="numeric" aria-label="Genişlik" /><span class="addon">mm</span></div>`;
      return `<div class="sec-row sec-${sec.type}" data-i="${i}">
        <span class="sec-idx">B${i + 1}</span>
        <select data-k="type" aria-label="Bölme tipi">${optionList([["open", "Açık (ayaklı)"], ["cabinet", "Dolap"], ["drawer", "Çekmece bloğu"], ["machine", "Makine boşluğu"]], sec.type)}</select>
        ${width}
        <div class="sec-extra">${extra}</div>
        <div class="sec-btns">
          <button type="button" data-act="left" aria-label="Sola taşı" title="Sola taşı"${i === 0 ? " disabled" : ""}>◀</button>
          <button type="button" data-act="right" aria-label="Sağa taşı" title="Sağa taşı"${i === tzSections.length - 1 ? " disabled" : ""}>▶</button>
          <button type="button" data-act="del" aria-label="Sil" title="Sil">✕</button>
        </div>
      </div>`;
    }).join("");
  }

  function bindSectionEditor() {
    const box = $("#tzSections");
    const onField = (e) => {
      const k = e.target.dataset.k;
      const row = e.target.closest(".sec-row");
      if (!k || !row) return;
      const sec = tzSections[+row.dataset.i];
      if (k === "type") {
        tzSections[+row.dataset.i] = { ...newSection(e.target.value), width: sec.width };
        if (e.target.value === "machine") ensureMachineHeight();
        renderSectionRows();
      } else if (k === "shelf") sec.shelf = e.target.checked;
      else if (k === "shelves" || k === "count") sec[k] = parseInt(e.target.value, 10);
      else sec[k] = e.target.value;
    };
    box.addEventListener("input", onField);
    box.addEventListener("change", onField);
    box.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const i = +btn.closest(".sec-row").dataset.i;
      if (btn.dataset.act === "del") tzSections.splice(i, 1);
      else {
        const j = btn.dataset.act === "left" ? i - 1 : i + 1;
        [tzSections[i], tzSections[j]] = [tzSections[j], tzSections[i]];
      }
      renderSectionRows();
      render();
    });
    $$("[data-add-section]").forEach((btn) => btn.addEventListener("click", () => {
      tzSections.push(newSection(btn.dataset.addSection));
      if (btn.dataset.addSection === "machine") ensureMachineHeight();
      renderSectionRows();
      render();
    }));
  }

  // Hazır tezgah modelleri (tek tıkla bölme düzeni kurar)
  const TZ_TEMPLATES = [
    { id: "bos", name: "Altı boş", secs: [{ type: "open" }] },
    { id: "raf", name: "Taban raflı", secs: [{ type: "open", shelf: true }] },
    { id: "dolapC", name: "Dolap (çarpma)", secs: [{ type: "cabinet", door: "hinged" }] },
    { id: "dolapS", name: "Dolap (sürgü)", secs: [{ type: "cabinet", door: "sliding" }] },
    { id: "cekAcik", name: "Çekmece + açık", secs: [{ type: "drawer", width: "450" }, { type: "open" }] },
    { id: "cekDolap", name: "Çekmece + dolap", secs: [{ type: "drawer", width: "450" }, { type: "cabinet", door: "hinged" }] },
    { id: "makAcik", name: "Makine + açık", secs: [{ type: "machine" }, { type: "open" }] },
    { id: "makDolap", name: "Makine + dolap", secs: [{ type: "machine" }, { type: "cabinet", door: "hinged" }] },
  ];
  const secSig = (x) => x.type + (x.type === "cabinet" ? `:${x.door}` : "") + (x.type === "open" && x.shelf ? "+" : "");
  const WEIGHT = { open: 2, cabinet: 2, drawer: 1, machine: 1 };

  function renderTemplates() {
    $("#tzTemplates").innerHTML = TZ_TEMPLATES.map((t) => `<button type="button" class="tpl" data-tpl="${t.id}">
        <span class="tpl-bar">${t.secs.map((x) => `<i class="mini-${x.type}${x.shelf ? " shelf" : ""}" style="flex:${WEIGHT[x.type]}"></i>`).join("")}</span>
        <span class="tpl-name">${t.name}</span></button>`).join("");
  }

  function updateTemplateActive() {
    const cur = tzSections.map(secSig);
    const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    $$("#tzTemplates .tpl").forEach((btn) => {
      const sig = TZ_TEMPLATES.find((t) => t.id === btn.dataset.tpl).secs.map((x) => secSig({ ...newSection(x.type), ...x }));
      btn.classList.toggle("active", same(cur, sig) || same(cur, [...sig].reverse()));
    });
  }

  function bindTemplates() {
    $("#tzTemplates").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tpl]");
      if (!btn) return;
      const t = TZ_TEMPLATES.find((x) => x.id === btn.dataset.tpl);
      tzSections = t.secs.map((x) => ({ ...newSection(x.type), ...x }));
      if (tzSections.some((x) => x.type === "machine")) ensureMachineHeight();
      renderSectionRows();
      render();
    });
    $("#tzFlip").addEventListener("click", () => {
      tzSections.reverse();
      renderSectionRows();
      render();
    });
    // Tüm dolaplara ara raf adedi (bölme bazlı ayar "Detaylı düzenle"de)
    $("#tz_cabShelves").addEventListener("input", (e) => {
      const v = parseInt(e.target.value, 10);
      if (Number.isNaN(v)) return;
      tzSections.forEach((x) => { if (x.type === "cabinet") x.shelves = v; });
      renderSectionRows();
    });
    // Açık bölmelerin tamamına taban rafı (bölme bazında ayar "Detaylı düzenle"de)
    $("#tz_openShelf").addEventListener("input", (e) => {
      tzSections.forEach((x) => { if (x.type === "open") x.shelf = e.target.checked; });
      renderSectionRows();
    });
  }

  /** Makine bölmesi eklenince yükseklik 900 mm altındaysa otomatik yükselt */
  function ensureMachineHeight() {
    const h = $("#tz_H");
    if (parseFloat(h.value) < MACHINE.minBenchH) {
      h.value = MACHINE.minBenchH;
      toast(`Makine için tezgah yüksekliği ${MACHINE.minBenchH} mm yapıldı`);
    }
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

    $("#costMaterialLabel").textContent = r.kgMode ? "Ağırlık × satış kg fiyatı (işçilik dahil)" : "Malzeme Maliyeti";
    $("#laborRow").hidden = r.kgMode;
    $("#wsQty").textContent = s.qty > 1 ? `(1 adet · ${s.qty} adet)` : "(1 adet)";
    const wRow = (cls, a, b, c) => `<div class="ws-row ${cls}"><span>${a}</span><span>${b}</span><span>${c}</span></div>`;
    $("#weightSummary").innerHTML = [
      wRow("ws-head", "SAC", "m²", "kg"),
      ...r.groups.sheet.map((g) => wRow("", `${fmtNum(g.key, 1)} mm`, fmtNum(g.qty, 2), fmtNum(g.kg))),
      wRow("ws-sub", "Sac toplamı", fmtNum(r.unit.area, 2), fmtNum(r.unit.sheetKg)),
      wRow("ws-head", "PROFİL", "m", "kg"),
      ...r.groups.profile.map((g) => wRow("", g.key, fmtNum(g.qty, 2), fmtNum(g.kg))),
      wRow("ws-sub", "Profil toplamı", fmtNum(r.unit.length, 2), fmtNum(r.unit.profileKg)),
      wRow("ws-total", "TOPLAM (1 adet)", "", fmtNum(r.unit.kg)),
      ...(s.qty > 1 ? [wRow("ws-total", `TOPLAM (${s.qty} adet)`, "", fmtNum(r.totalKg))] : []),
    ].join("");

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
    data.tz_sections = tzSections;
    return data;
  }

  function applyState(data) {
    if (Array.isArray(data.tz_sections)) {
      tzSections = data.tz_sections.map((x) => ({ ...newSection(x.type), ...x }));
      renderSectionRows();
    }
    Object.entries(data).forEach(([name, value]) => {
      if (name === "tz_sections") return;
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
      ...(r.kgMode ? [] : [`İşçilik / imalat     : ${fmtMoney(r.labor, s.currency)}`]),
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

    bindSectionEditor();
    bindTemplates();

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
  renderTemplates();
  renderSectionRows();
  loadState();
  bindEvents();
  render();
})();
