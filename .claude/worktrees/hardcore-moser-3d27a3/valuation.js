// Property + comp generation and valuation logic.
//
// Each property (subject + 10 comps) has the same shape:
//   bed, bath, sqft, lotSqft, salePrice, ppsf, saleDate, dom,
//   year, condition, style, amenities (exactly 3)
//
// The estimate is a similarity-weighted mean of comp prices,
// each comp adjusted toward the subject (size, beds/baths, age,
// lot, condition, amenities, neighborhood ppsf).

(function () {
  const NEIGHBORHOODS = [
    { name: "Eastlake Heights", ppsf: 520, vol: 0.06 },
    { name: "Old Town Mill",    ppsf: 410, vol: 0.05 },
    { name: "Cypress Grove",    ppsf: 680, vol: 0.09 },
    { name: "Harborline",       ppsf: 790, vol: 0.11 },
    { name: "Maple Ridge",      ppsf: 340, vol: 0.04 },
    { name: "Brickworks",       ppsf: 615, vol: 0.08 },
    { name: "Northgate Park",   ppsf: 455, vol: 0.05 },
    { name: "Sunset Mesa",      ppsf: 565, vol: 0.07 }
  ];

  const STREETS = [
    "Aspen", "Cedar", "Linden", "Birch", "Walnut", "Sycamore",
    "Magnolia", "Juniper", "Hawthorn", "Larch", "Poplar", "Spruce",
    "Olive", "Willow", "Elm", "Chestnut"
  ];

  const SUFFIXES = ["Ave", "Ln", "St", "Way", "Dr", "Ct", "Pl"];

  // 3 levels only
  const CONDITIONS = [
    { label: "Needs Work", mult: 0.85 },
    { label: "Renovated",  mult: 1.00 },
    { label: "New",        mult: 1.12 }
  ];

  const STYLES = [
    "Craftsman", "Colonial", "Ranch", "Mid-Century",
    "Tudor", "Spanish", "Modern", "Cape Cod",
    "Victorian", "Contemporary"
  ];

  // 12 amenities, each with a dollar contribution to value.
  // Each property gets EXACTLY 3.
  const AMENITIES = [
    { key: "pool",      label: "Pool",            delta: 32000 },
    { key: "garage",    label: "2-car garage",    delta: 18000 },
    { key: "adu",       label: "ADU",             delta: 95000 },
    { key: "view",      label: "View",            delta: 45000 },
    { key: "solar",     label: "Solar",           delta: 14000 },
    { key: "corner",    label: "Corner lot",      delta: 12000 },
    { key: "hardwood",  label: "Hardwood floors", delta: 9000  },
    { key: "openkit",   label: "Open kitchen",    delta: 11000 },
    { key: "smart",     label: "Smart home",      delta: 8000  },
    { key: "roof",      label: "New roof",        delta: 13000 },
    { key: "hottub",    label: "Hot tub",         delta: 7000  },
    { key: "wine",      label: "Wine cellar",     delta: 16000 }
  ];

  // appraiser-style adjustments
  const ADJ = {
    sqft:    180,     // $ per sqft of living-area difference
    bed:     12000,   // $ per bedroom difference
    bath:    9000,    // $ per bathroom difference
    age:     -1100,   // $ per year older (newer = +)
    lot:     6        // $ per sqft of lot difference
  };

  // "today" — used so sale dates feel current
  const TODAY = new Date("2026-05-13");
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function rand(min, max) { return Math.random() * (max - min) + min; }
  function randi(min, max) { return Math.floor(rand(min, max + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function pickN(arr, n) {
    const a = [...arr];
    const out = [];
    for (let i = 0; i < n && a.length; i++) {
      const idx = Math.floor(Math.random() * a.length);
      out.push(a.splice(idx, 1)[0]);
    }
    return out;
  }
  function makeAddress() {
    return `${randi(100, 9999)} ${pick(STREETS)} ${pick(SUFFIXES)}`;
  }
  function fmtDate(d) {
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }
  function dateAgo(days) {
    const d = new Date(TODAY);
    d.setDate(d.getDate() - days);
    return d;
  }

  // Build a base property (used for both subject and comps).
  function makeProperty({ neighborhood, biasFrom, daysAgo }) {
    const hood = neighborhood;
    const sqft  = biasFrom
      ? Math.max(800, Math.round((biasFrom.sqft + rand(-450, 450)) / 50) * 50)
      : Math.round(rand(1100, 3400) / 50) * 50;
    const beds  = biasFrom
      ? Math.max(1, biasFrom.beds + randi(-1, 1))
      : randi(2, 5);
    const baths = biasFrom
      ? Math.max(1, Math.round((biasFrom.baths + rand(-1, 1)) * 2) / 2)
      : Math.round(rand(1.5, beds + 0.5) * 2) / 2;
    const year  = biasFrom
      ? Math.min(2024, Math.max(1930, biasFrom.year + randi(-25, 25)))
      : randi(1948, 2022);
    const lot   = biasFrom
      ? Math.max(1500, Math.round((biasFrom.lot + rand(-2500, 2500)) / 100) * 100)
      : Math.round(rand(2500, 9000) / 100) * 100;

    const cond  = pick(CONDITIONS);
    const style = pick(STYLES);
    const amenities = pickN(AMENITIES, 3);

    // base = neighborhood ppsf * sqft * condition mult + amenities + lot premium
    let value = sqft * hood.ppsf * cond.mult;
    amenities.forEach(a => { value += a.delta; });
    // bed/bath premium relative to "typical" 3/2
    value += (beds - 3) * ADJ.bed * 0.6;
    value += (baths - 2) * ADJ.bath * 0.6;
    // age vs 1990 baseline
    value += (year - 1990) * 600;
    value = Math.max(120000, value);

    const dom = randi(3, 95);
    const saleDays = daysAgo != null ? daysAgo : randi(7, 200);
    const saleDate = dateAgo(saleDays);

    return {
      address: makeAddress(),
      neighborhood: hood,
      sqft, beds, baths, year, lot,
      condition: cond,
      style,
      amenities,
      _baseValue: value,
      dom,
      saleDate,
      saleDays
    };
  }

  // The subject — same shape, but no sale date or DOM (it's the one being valued).
  function makeSubject() {
    const hood = pick(NEIGHBORHOODS);
    const p = makeProperty({ neighborhood: hood });
    return {
      ...p,
      id: "subject",
      saleDate: null,
      dom: null,
      isSubject: true
    };
  }

  // True latent market value for the subject
  function trueValue(subject) {
    // small micro-location wobble
    return Math.round(subject._baseValue * (1 + (Math.random() - 0.5) * 0.02) / 1000) * 1000;
  }

  function makeComp(subject, i) {
    const sameHood = Math.random() < 0.7;
    const hood = sameHood
      ? subject.neighborhood
      : pick(NEIGHBORHOODS.filter(h => h !== subject.neighborhood));

    const p = makeProperty({ neighborhood: hood, biasFrom: subject });

    // Sale price = base value + market noise (wider for volatile neighborhoods)
    let price = p._baseValue * (1 + (Math.random() - 0.5) * 2 * hood.vol);
    price = Math.round(price / 1000) * 1000;

    // List price: sale lands within ±8% of list. Hot markets bid over list more often.
    // Skew slightly so on average list < sale (homes often sell above list in our world).
    const listMult = 1 / (1 + (Math.random() - 0.4) * 0.16); // ~0.92..1.10
    const listPrice = Math.round(price * listMult / 1000) * 1000;

    return {
      id: `comp-${i}`,
      ...p,
      salePrice: price,
      listPrice,
      ppsf: Math.round(price / p.sqft)
    };
  }

  // Adjust comp toward subject (returns adjusted indicated value + breakdown).
  function adjustComp(comp, subject) {
    const adjustments = [];
    let adjusted = comp.salePrice;

    if (comp.neighborhood !== subject.neighborhood) {
      const hoodAdj = (subject.neighborhood.ppsf - comp.neighborhood.ppsf) * comp.sqft;
      adjusted += hoodAdj;
      adjustments.push({ label: "Location", delta: hoodAdj });
    }

    const sqftDelta = (subject.sqft - comp.sqft) * ADJ.sqft;
    if (Math.abs(sqftDelta) > 1) { adjusted += sqftDelta; adjustments.push({ label: "Size", delta: sqftDelta }); }

    const bedDelta = (subject.beds - comp.beds) * ADJ.bed;
    if (bedDelta) { adjusted += bedDelta; adjustments.push({ label: "Beds", delta: bedDelta }); }

    const bathDelta = (subject.baths - comp.baths) * ADJ.bath;
    if (bathDelta) { adjusted += bathDelta; adjustments.push({ label: "Baths", delta: bathDelta }); }

    const ageDelta = (comp.year - subject.year) * ADJ.age;
    if (ageDelta) { adjusted += ageDelta; adjustments.push({ label: "Age", delta: ageDelta }); }

    const lotDelta = (subject.lot - comp.lot) * ADJ.lot;
    if (Math.abs(lotDelta) > 1) { adjusted += lotDelta; adjustments.push({ label: "Lot", delta: lotDelta }); }

    const condDelta = comp.salePrice * (subject.condition.mult / comp.condition.mult - 1);
    if (Math.abs(condDelta) > 1) { adjusted += condDelta; adjustments.push({ label: "Condition", delta: condDelta }); }

    // Amenity adjustments: differences between subject and comp amenity sets
    const cKeys = new Set(comp.amenities.map(a => a.key));
    const sKeys = new Set(subject.amenities.map(a => a.key));
    subject.amenities.forEach(a => {
      if (!cKeys.has(a.key)) { adjusted += a.delta; adjustments.push({ label: `+${a.label}`, delta: a.delta }); }
    });
    comp.amenities.forEach(a => {
      if (!sKeys.has(a.key)) { adjusted -= a.delta; adjustments.push({ label: `-${a.label}`, delta: -a.delta }); }
    });

    const grossAdj = adjustments.reduce((s, a) => s + Math.abs(a.delta), 0);
    const similarity = 1 / (1 + grossAdj / Math.max(comp.salePrice, 1));

    return { adjusted: Math.round(adjusted / 1000) * 1000, grossAdj, similarity, adjustments };
  }

  function estimate(subject, comps) {
    const adj = comps.map(c => ({ comp: c, ...adjustComp(c, subject) }));
    const totalW = adj.reduce((s, a) => s + a.similarity, 0);
    const est = adj.reduce((s, a) => s + a.adjusted * a.similarity, 0) / totalW;
    const variance = adj.reduce((s, a) => s + a.similarity * Math.pow(a.adjusted - est, 2), 0) / totalW;
    const stdev = Math.sqrt(variance);
    return { estimate: Math.round(est / 1000) * 1000, stdev: Math.round(stdev / 1000) * 1000, adj };
  }

  // Quality filter: within 25% ppsf, ±1 bed/bath, adjacent condition
  function isQualityComp(comp, subject) {
    const subjectPpsf = subject._baseValue / subject.sqft;
    if (comp.ppsf < subjectPpsf * 0.75 || comp.ppsf > subjectPpsf * 1.25) return false;
    if (Math.abs(comp.beds - subject.beds) > 1) return false;
    if (Math.abs(comp.baths - subject.baths) > 1) return false;
    if (Math.abs(CONDITIONS.indexOf(comp.condition) - CONDITIONS.indexOf(subject.condition)) > 1) return false;
    return true;
  }

  function makeQualityComp(subject, i) {
    for (let a = 0; a < 40; a++) {
      const comp = makeComp(subject, i);
      if (isQualityComp(comp, subject)) return comp;
    }
    return makeComp(subject, i);
  }

  function makeReplacementComp(subject, usedIds) {
    const uid = `comp-r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const comp = makeQualityComp(subject, usedIds.length);
    return { ...comp, id: uid };
  }

  function buildRound() {
    const subject = makeSubject();
    const comps = Array.from({ length: 8 }, (_, i) => makeQualityComp(subject, i));
    const { estimate: est, stdev, adj } = estimate(subject, comps);
    return { subject, comps, estimate: est, stdev, adj };
  }

  function scoreFor(midpoint, low, high, est) {
    const errPct = Math.abs(midpoint - est) / est * 100;
    let base = 0;
    if (errPct <= 1) base = 100;
    else if (errPct <= 2) base = 80;
    else if (errPct <= 5) base = 50;
    else if (errPct <= 10) base = 20;
    else base = Math.max(0, 10 - (errPct - 10));

    const inRange = est >= low && est <= high;
    const widthPct = (high - low) / est * 100;
    let widthBonus = 0;
    if (inRange) {
      if (widthPct <= 4) widthBonus = 25;
      else if (widthPct <= 8) widthBonus = 15;
      else if (widthPct <= 15) widthBonus = 5;
    }
    return {
      errPct,
      basePoints: Math.round(base),
      inRange,
      widthPct,
      widthBonus,
      total: Math.round(base + widthBonus)
    };
  }

  window.Valuation = {
    buildRound, scoreFor,
    makeReplacementComp,
    recalculate: (subject, comps) => estimate(subject, comps),
    AMENITIES, CONDITIONS, STYLES, NEIGHBORHOODS,
    fmtDate
  };
})();
