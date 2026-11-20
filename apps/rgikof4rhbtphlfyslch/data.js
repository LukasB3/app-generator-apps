// Deterministic sample data: Nov 2025 to Oct 2026, three channels, fourteen products.
const CHANNELS = [
  { id: 'web', name: 'Web shop', color: '#a43524', base: 620, aov: 58, returning: 0.34, grow: 0.018 },
  { id: 'market', name: 'Marketplace', color: '#3d6b7a', base: 410, aov: 41, returning: 0.19, grow: 0.026 },
  { id: 'retail', name: 'Retail', color: '#c79a3b', base: 190, aov: 76, returning: 0.46, grow: 0.004 }
];
const MONTHS = ['Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026'];
const SEASON = [1.18, 1.55, 0.82, 0.86, 0.95, 0.98, 1.04, 0.97, 0.9, 0.93, 1.06, 1.12];

const PRODUCTS = [
  { name: 'Stoneware mug, set of 2', price: 32, w: [9, 7, 8] },
  { name: 'Enamel kettle 1.2 l', price: 59, w: [7, 5, 9] },
  { name: 'Loose-leaf tea sampler', price: 24, w: [10, 12, 6] },
  { name: 'Linen tea towel', price: 14, w: [8, 9, 7] },
  { name: 'Pour-over coffee set', price: 68, w: [6, 4, 8] },
  { name: 'Beeswax candle trio', price: 27, w: [7, 8, 5] },
  { name: 'Cast iron trivet', price: 21, w: [4, 3, 6] },
  { name: 'Ceramic planter, medium', price: 36, w: [5, 6, 4] },
  { name: 'Wool throw blanket', price: 94, w: [3, 2, 5] },
  { name: 'Walnut serving board', price: 48, w: [5, 3, 6] },
  { name: 'Glass storage jars, 4 pack', price: 38, w: [6, 7, 3] },
  { name: 'Herb garden kit', price: 29, w: [4, 5, 2] },
  { name: 'Cotton apron', price: 33, w: [3, 2, 4] },
  { name: 'Spice grinder', price: 26, w: [2, 3, 2] }
];

function rng(seed) {
  return function () {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const SALES = (function () {
  const rand = rng(2026);
  const out = {};
  CHANNELS.forEach((c) => {
    out[c.id] = MONTHS.map((m, i) => {
      const orders = Math.round(c.base * SEASON[i] * (1 + c.grow * i) * (0.94 + rand() * 0.12));
      const aov = c.aov * (0.96 + rand() * 0.08) * (i === 1 ? 1.08 : 1);
      return {
        orders,
        revenue: Math.round(orders * aov),
        returning: Math.round(orders * c.returning * (0.92 + rand() * 0.16))
      };
    });
  });
  return out;
})();

// Products: units per channel follow the channel's orders and product weights.
const PRODUCT_UNITS = (function () {
  const rand = rng(77);
  return PRODUCTS.map((p) => {
    const units = {};
    CHANNELS.forEach((c, ci) => {
      const totalW = PRODUCTS.reduce((s, q) => s + q.w[ci], 0);
      const orders = SALES[c.id].reduce((s, x) => s + x.orders, 0);
      units[c.id] = Math.round(orders * 1.35 * (p.w[ci] / totalW) * (0.9 + rand() * 0.2));
    });
    return units;
  });
})();
