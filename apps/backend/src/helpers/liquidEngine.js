// apps/backend/src/helpers/liquidEngine.js
const { Liquid } = require('liquidjs');
const { DateTime } = require('luxon');

const engine = new Liquid({
  strictVariables: true,
  lenientIf: true,
  ownPropertyOnly: true,
  cache: false,
});

// Filters
engine.registerFilter('date', (input, fmt = 'dd/LL/yyyy', tz = 'Australia/Sydney') => {
  try {
    const dt = DateTime.fromJSDate(input instanceof Date ? input : new Date(input), { zone: tz });
    return dt.toFormat(fmt);
  } catch (_) {
    return '';
  }
});

engine.registerFilter('upcase', (s) => String(s ?? '').toUpperCase());
engine.registerFilter('downcase', (s) => String(s ?? '').toLowerCase());
engine.registerFilter('default', (v, d = '') => (v == null || v === '' ? d : v));
engine.registerFilter('truncate', (s, n = 80) => {
  const str = String(s ?? '');
  if (str.length <= n) return str;
  return str.slice(0, Math.max(0, n - 1)) + '…';
});

module.exports = engine;
