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
  const GRID_TUBE = { d: 16, t: 1.0, label: "Ø16×1 boru" };

  // İmalat varsayımları (mm)
  const TZ = {
    edgeFlange: 40,    // üst tabla ön/yan etek büküm payı
    backReturn: 20,    // sırt üst dönüş büküm payı
    legInset: 80,      // ayaklar arası çerçeve için iç mesafe (2 × profil)
    shelfT: 1.0,       // alt raf sac kalınlığı
    shelfFlange: 30,   // alt raf kenar büküm
    gridPitch: 60,     // ızgara boru aralığı
    drawerW: 450,      // çekmece gövde genişliği
    drawerH: 120,      // çekmece gövde yüksekliği
    drawerT: 1.0,      // çekmece sac kalınlığı
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
    laborMode: "percent", laborPercent: 40, laborPerKg: 2,
    tz_L: 1500, tz_W: 700, tz_H: 900, tz_t: "1.2", tz_back: "100", tz_shelf: "flat", tz_drawers: 0,
    dl_L: 1200, dl_H: 650, dl_D: 350, dl_t: "1.0", dl_door: "sliding", dl_shelves: "1",
    rf_L: 1200, rf_D: 500, rf_H: 1800, rf_levels: "4", rf_type: "flat", rf_t: "1.2",
  };

  const STORAGE_KEY = "ss-furniture-calc:v1";

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
  const calculators = {
    /** A) Çalışma tezgahı */
    tezgah(p, density) {
      const { L, W, H, t, back, shelf, drawers } = p;
      const parts = [];
      const boxKgM = boxKgPerM(BOX_PROFILE, density);
      const tubeKgM = tubeKgPerM(GRID_TUBE, density);
      const inL = L - TZ.legInset;
      const inW = W - TZ.legInset;

      // Üst tabla: ön + iki yan + arka (sırt yoksa) etek bükümü
      parts.push(sheetPart("Üst tabla", `${L}×${W} + ${TZ.edgeFlange} mm etek`,
        flangedArea(L, W, TZ.edgeFlange), t, density));

      // Sırt (arka ankastre büküm)
      if (back > 0) {
        parts.push(sheetPart(`Sırt (H ${back})`, `${L}×${back + TZ.backReturn} açınım`,
          mm2ToM2(L, back + TZ.backReturn), t, density));
      }

      // Ayaklar ve kayıtlar (40×40×1.2)
      const legLen = H - TZ.edgeFlange;
      parts.push(profilePart("Ayaklar (4 adet)", `${BOX_PROFILE.label} · 4×${legLen}`, 4 * legLen, boxKgM));
      parts.push(profilePart("Üst çerçeve kayıtları", `2×${inL} + 2×${inW}`, 2 * inL + 2 * inW, boxKgM));

      if (shelf === "none") {
        // Alt raf yoksa H tipi bağlantı: 2 yan + 1 boy kayıt
        parts.push(profilePart("Alt kayıtlar (H tipi)", `2×${inW} + 1×${inL}`, 2 * inW + inL, boxKgM));
      } else {
        parts.push(profilePart("Alt raf çerçevesi", `2×${inL} + 2×${inW}`, 2 * inL + 2 * inW, boxKgM));
      }

      // Alt raf
      if (shelf === "flat") {
        parts.push(sheetPart("Alt raf (düz sac)", `${inL}×${inW} + ${TZ.shelfFlange} mm büküm`,
          flangedArea(inL, inW, TZ.shelfFlange), TZ.shelfT, density));
      } else if (shelf === "grid") {
        const count = Math.floor(inW / TZ.gridPitch) + 1;
        parts.push(profilePart("Alt raf ızgarası", `${GRID_TUBE.label} · ${count}×${inL}`, count * inL, tubeKgM));
      }

      // Çekmeceler (gövde + ön panel), 1.0 mm sac
      if (drawers > 0) {
        const dw = Math.min(TZ.drawerW, Math.floor(inL / drawers) - 20);
        const dd = W - 150;
        const dh = TZ.drawerH;
        const body = mm2ToM2(dw, dd) + 2 * mm2ToM2(dd, dh) + 2 * mm2ToM2(dw, dh);
        const front = flangedArea(dw + 40, dh + 40, 20);
        const drawerBox = mm2ToM2(dw + 40, dd) * 2 + mm2ToM2(dw + 40, dh + 60); // çekmece kutusu / taşıyıcı
        const area = (body + front + drawerBox) * drawers;
        parts.push(sheetPart(`Çekmece (${drawers} adet)`, `${dw}×${dd}×${dh} gövde + kasa`, area, TZ.drawerT, density));
      }

      return parts;
    },

    /** B) Duvar dolabı */
    dolap(p, density) {
      const { L, H, D, t, door, shelves } = p;
      const parts = [];
      const f = DL.flange;

      parts.push(sheetPart("Tavan + taban", `2 × ${L}×${D}`, 2 * flangedArea(L, D, f), t, density));
      parts.push(sheetPart("Yan paneller", `2 × ${H}×${D}`, 2 * flangedArea(H, D, f), t, density));
      parts.push(sheetPart("Arka panel", `${L}×${H}`, flangedArea(L, H, f / 2), t, density));
      parts.push(sheetPart("Duvar askı laması", `${L}×${DL.hangStrip}`, mm2ToM2(L, DL.hangStrip), t, density));

      parts.push(sheetPart(`Ara raf (${shelves} adet)`, `${shelves} × ${L - 10}×${D - 30}`,
        shelves * flangedArea(L - 10, D - 30, DL.shelfFlange), t, density));

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
      const { L, D, H, levels, type, t } = p;
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

  const getRadio = (name) => (form.querySelector(`input[name="${name}"]:checked`) || {}).value;
  const num = (id) => parseFloat($("#" + id).value);
  const val = (id) => $("#" + id).value;
  const selText = (id) => { const s = $("#" + id); return s.options[s.selectedIndex].text; };

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
      laborMode: getRadio("laborMode"),
      laborPercent: num("laborPercent"),
      laborPerKg: Math.max(0, num("laborPerKg") || 0),
    };

    if (furniture === "tezgah") {
      s.params = {
        L: num("tz_L"), W: num("tz_W"), H: num("tz_H"),
        t: parseFloat(val("tz_t")), back: parseInt(val("tz_back"), 10),
        shelf: val("tz_shelf"), drawers: Math.max(0, Math.min(4, Math.floor(num("tz_drawers")) || 0)),
      };
      s.dims = ["tz_L", "tz_W", "tz_H"];
      s.title = `${s.params.L} × ${s.params.W} × ${s.params.H} mm`;
    } else if (furniture === "dolap") {
      s.params = {
        L: num("dl_L"), H: num("dl_H"), D: num("dl_D"),
        t: parseFloat(val("dl_t")), door: val("dl_door"), shelves: parseInt(val("dl_shelves"), 10),
      };
      s.dims = ["dl_L", "dl_H", "dl_D"];
      s.title = `${s.params.L} × ${s.params.H} × ${s.params.D} mm`;
    } else {
      s.params = {
        L: num("rf_L"), D: num("rf_D"), H: num("rf_H"),
        levels: parseInt(val("rf_levels"), 10), type: val("rf_type"), t: parseFloat(val("rf_t")),
      };
      s.dims = ["rf_L", "rf_D", "rf_H"];
      s.title = `${s.params.L} × ${s.params.D} × ${s.params.H} mm`;
    }
    return s;
  }

  /** Ölçü alanlarını min/max aralığına göre kontrol eder; hata mesajı döndürür */
  function validate(state) {
    const errors = [];
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
    return errors;
  }

  // Seçilen ürünün parametre listesi (özet + kopyalama için)
  function specRows(s) {
    const p = s.params;
    const common = [
      ["Malzeme", GRADES[s.grade].name],
      ["Yoğunluk", `${GRADES[s.grade].density} g/cm³`],
      ["Kg fiyatı", `${fmtMoney(s.price, s.currency)}/kg`],
      ["İşçilik", s.laborMode === "percent" ? `Malzeme × %${s.laborPercent}` : `${fmtMoney(s.laborPerKg, s.currency)}/kg`],
    ];
    let specific;
    if (s.furniture === "tezgah") {
      specific = [
        ["Ölçü (L×W×H)", `${p.L}×${p.W}×${p.H} mm`],
        ["Tabla sacı", `${fmtNum(p.t, 1)} mm`],
        ["Sırt", selText("tz_back")],
        ["Alt raf", selText("tz_shelf")],
        ["Çekmece", `${p.drawers} adet`],
        ["Ayak profili", "40×40×1.2 mm"],
      ];
    } else if (s.furniture === "dolap") {
      specific = [
        ["Ölçü (L×H×D)", `${p.L}×${p.H}×${p.D} mm`],
        ["Sac kalınlığı", `${fmtNum(p.t, 1)} mm`],
        ["Kapak", selText("dl_door")],
        ["Ara raf", `${p.shelves} adet`],
      ];
    } else {
      specific = [
        ["Ölçü (L×D×H)", `${p.L}×${p.D}×${p.H} mm`],
        ["Kat sayısı", `${p.levels} kat`],
        ["Raf tipi", selText("rf_type")],
        ["Raf sacı", p.type === "grid" ? GRID_TUBE.label : `${fmtNum(p.t, 1)} mm`],
        ["Dikme profili", "40×40×1.2 mm"],
      ];
    }
    return [...specific, ...common];
  }

  // ---------------------------------------------------------
  // 6) ANA HESAPLAMA
  // ---------------------------------------------------------
  function compute(s) {
    const density = GRADES[s.grade].density;
    const parts = calculators[s.furniture](s.params, density);

    const unit = parts.reduce((acc, p) => {
      acc.kg += p.kg;
      if (p.kind === "sac") { acc.sheetKg += p.kg; acc.area += p.area; }
      else { acc.profileKg += p.kg; acc.length += p.length; }
      return acc;
    }, { kg: 0, sheetKg: 0, profileKg: 0, area: 0, length: 0 });

    const totalKg = unit.kg * s.qty;
    const material = totalKg * s.price;
    const labor = s.laborMode === "percent"
      ? material * (s.laborPercent / 100)
      : totalKg * s.laborPerKg;
    const total = material + labor;

    return { parts, unit, totalKg, material, labor, total, unitTotal: total / s.qty };
  }

  // ---------------------------------------------------------
  // 7) ARAYÜZ GÜNCELLEME
  // ---------------------------------------------------------
  let lastResult = null;

  /** data-furniture ve data-when ile koşullu alanları göster/gizle */
  function syncVisibility() {
    const furniture = getRadio("furniture");
    $$("[data-furniture]").forEach((el) => { el.hidden = el.dataset.furniture !== furniture; });

    $$("[data-when]").forEach((el) => {
      const m = el.dataset.when.match(/^(\w+)(!?=)(\w+)$/);
      if (!m) return;
      const [, name, op, expected] = m;
      const current = getRadio(name) ?? (document.getElementById(name) || {}).value;
      el.hidden = op === "=" ? current !== expected : current === expected;
    });

    const cur = val("currency");
    $$("[data-currency-suffix]").forEach((el) => { el.textContent = `${cur}/kg`; });

    const range = $("#laborPercent");
    range.style.setProperty("--fill", `${range.value}%`);
    $("#laborPercentOut").textContent = `%${range.value}`;
  }

  function render() {
    syncVisibility();
    const s = readInputs();
    const errors = validate(s);
    const warn = $("#warning");
    warn.hidden = errors.length === 0;
    warn.innerHTML = errors.map((e) => `⚠ ${e}`).join("<br>");

    $("#sumType").textContent = FURNITURE_NAMES[s.furniture];
    $("#sumTitle").textContent = s.title;
    $("#sumGrade").textContent = GRADES[s.grade].name;
    $("#sumQty").textContent = s.qty;

    if (errors.length) {
      lastResult = null;
      ["#kpiWeight", "#kpiTotal", "#costMaterial", "#costLabor", "#costTotal"].forEach((id) => { $(id).textContent = "—"; });
      $("#kpiWeightUnit").textContent = "Ölçüleri kontrol edin";
      $("#kpiTotalUnit").textContent = "";
      $("#partsBody").innerHTML = "";
      return;
    }

    const r = compute(s);
    lastResult = { s, r };

    $("#kpiWeight").textContent = fmtNum(r.totalKg);
    $("#kpiWeightUnit").textContent = `Birim: ${fmtNum(r.unit.kg)} kg`;
    $("#kpiTotal").textContent = fmtMoney(r.total, s.currency);
    $("#kpiTotalUnit").textContent = `Birim: ${fmtMoney(r.unitTotal, s.currency)}`;
    $("#costMaterial").textContent = fmtMoney(r.material, s.currency);
    $("#costLabor").textContent = fmtMoney(r.labor, s.currency);
    $("#costTotal").textContent = fmtMoney(r.total, s.currency);
    $("#laborLabel").textContent = s.laborMode === "percent"
      ? `(%${s.laborPercent})`
      : `(${fmtNum(s.laborPerKg)} ${s.currency}/kg)`;

    const matPct = r.total > 0 ? (r.material / r.total) * 100 : 100;
    $("#barMaterial").style.width = `${matPct}%`;
    $("#barLabor").style.width = `${100 - matPct}%`;

    $("#partsBody").innerHTML = r.parts.map((p) => `
      <tr>
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
      if (el) el.value = value;
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
