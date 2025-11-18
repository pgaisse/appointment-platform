// apps/backend/src/helpers/unifiedRenderer.js
// Unified rendering & linting for templates mixing Liquid and colon tokens.
// Strategy:
// 1. Attempt Liquid parse if Liquid markers exist ({{ or {%)
// 2. If parse succeeds → render Liquid with context, then apply colon substitutions.
// 3. If parse fails but Liquid markers present → surface syntax error.
// 4. If no Liquid markers → skip Liquid, apply colon substitutions only.
// Lint combines: Liquid syntax errors / unknown variables + colon unknown tokens.

const liquid = require('./liquidEngine');
const { applyTemplateTokensBackend, extractColonTokens } = require('./tokenRenderer');
const { DateTime } = require('luxon');

function titleCaseName(value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  return lower.replace(/\b([A-Za-zÀ-ÖØ-öø-ÿ])([A-Za-zÀ-ÖØ-öø-ÿ']*)/g, (m, f, rest) => f.toUpperCase() + rest);
}

// Safer regex grouping for markers to avoid any parser ambiguity
const hasLiquidMarkers = (s) => /({{|{%)/.test(String(s || ''));

function fmtDate(val, withTime = false) {
  try {
    const dt = DateTime.fromJSDate(val instanceof Date ? val : new Date(val), { zone: 'Australia/Sydney' });
    return withTime ? dt.toFormat('dd/LL/yyyy HH:mm') : dt.toFormat('dd/LL/yyyy');
  } catch (_) { return ''; }
}

function replaceBracketPlaceholders(text, ctx) {
  if (!text) return text;
  const patient = ctx?.patient || ctx || {};
  const latest = patient?.latestSlot || (Array.isArray(patient?.selectedAppDates) ? [...patient.selectedAppDates].sort((a,b)=>new Date(a.startDate)-new Date(b.startDate)).slice(-1)[0] : null);
  const org = ctx?.org || {};
  return String(text).replace(/\[([^\]]+)\]/g, (match, rawLabel) => {
    const label = String(rawLabel || '').trim().toLowerCase();
    let value = '';
    switch (label) {
      case 'first name':
        value = titleCaseName(patient?.nameInput || patient?.firstName || '');
        break;
      case 'last name':
        value = titleCaseName(patient?.lastNameInput || patient?.lastName || '');
        break;
      case 'name': {
        const fn = titleCaseName(patient?.nameInput || patient?.firstName || '');
        const ln = titleCaseName(patient?.lastNameInput || patient?.lastName || '');
        value = `${fn}${fn && ln ? ' ' : ''}${ln}`.trim();
        break;
      }
      case 'phone':
        value = patient?.phoneInput || patient?.phone || '';
        break;
      case 'organization name':
      case 'organisation name':
        value = org?.name || org?.org_name || org?.id || '';
        break;
      case 'start date':
        value = latest?.startDate ? fmtDate(latest.startDate) : '';
        break;
      case 'end date':
        value = latest?.endDate ? fmtDate(latest.endDate) : '';
        break;
      case 'start time':
        value = latest?.startDate ? fmtDate(latest.startDate, true) : '';
        break;
      case 'end time':
        value = latest?.endDate ? fmtDate(latest.endDate, true) : '';
        break;
      default:
        return match; // keep original if unknown
    }
    return value || match; // leave placeholder if empty
  });
}

async function unifiedRender({ template, patientInfo, tokens }) {
  const raw = String(template || '');
  let liquidRendered = raw;
  let liquidUsed = false;

  // Build colon token value map (including synthetic) so Liquid can reference them via :Token inside tags
  const patBase = patientInfo?.patient || patientInfo || {};
  const latestSlot = patBase?.latestSlot || (Array.isArray(patBase?.selectedAppDates) && patBase.selectedAppDates.length > 0
    ? [...patBase.selectedAppDates].sort((a,b)=>new Date(a.startDate)-new Date(b.startDate)).slice(-1)[0]
    : null);
  const existingKeys = new Set((tokens || []).map(t => t.key));
  const syntheticDefs = [];
  const pushSyn = (key, resolver) => { if (!existingKeys.has(key)) syntheticDefs.push({ key, resolver }); };
  pushSyn(':Name', () => titleCaseName(patBase?.nameInput || patBase?.firstName || ''));
  pushSyn(':FirstName', () => titleCaseName(patBase?.nameInput || patBase?.firstName || ''));
  pushSyn(':LastName', () => titleCaseName(patBase?.lastNameInput || patBase?.lastName || ''));
  pushSyn(':Phone', () => patBase?.phoneInput || patBase?.phone || '');
  pushSyn(':Clinic', () => patientInfo?.org?.name || patientInfo?.org?.org_name || patientInfo?.org?.id || patBase?.org_name || '');
  pushSyn(':OrgName', () => patientInfo?.org?.name || patientInfo?.org?.org_name || patBase?.org_name || '');
  pushSyn(':StartDate', () => latestSlot?.startDate ? fmtDate(latestSlot.startDate) : '');
  pushSyn(':EndDate', () => latestSlot?.endDate ? fmtDate(latestSlot.endDate) : '');
  pushSyn(':StartTime', () => latestSlot?.startDate ? DateTime.fromJSDate(new Date(latestSlot.startDate), { zone: 'Australia/Sydney' }).toFormat('HH:mm') : '');
  pushSyn(':EndTime', () => latestSlot?.endDate ? DateTime.fromJSDate(new Date(latestSlot.endDate), { zone: 'Australia/Sydney' }).toFormat('HH:mm') : '');
  pushSyn(':SelectedSlotDate', () => latestSlot?.startDate ? DateTime.fromJSDate(new Date(latestSlot.startDate), { zone: 'Australia/Sydney' }).toFormat('ccc, dd LLL yyyy') : '');
  pushSyn(':SelectedSlotRange', () => {
    if (latestSlot?.startDate && latestSlot?.endDate) {
      try {
        const s = DateTime.fromJSDate(new Date(latestSlot.startDate), { zone: 'Australia/Sydney' });
        const e = DateTime.fromJSDate(new Date(latestSlot.endDate), { zone: 'Australia/Sydney' });
        const sameDay = s.hasSame(e, 'day');
        const dayPart = sameDay ? s.toFormat('ccc, dd LLL yyyy') : `${s.toFormat('ccc, dd LLL yyyy')} → ${e.toFormat('ccc, dd LLL yyyy')}`;
        const timePart = `${s.toFormat('h:mm a')} — ${e.toFormat('h:mm a')}`;
          return `${dayPart} • ${timePart}`;
      } catch(_) { return ''; }
    }
    return '';
  });
  pushSyn(':Today', () => fmtDate(new Date()));
  pushSyn(':Time', () => fmtDate(new Date(), true));

  // Calendar slot tokens (independent of patient latest slot)
  const calendarSlot = patBase?.calendarSlot;
  pushSyn(':CalendarSlotDate', () => calendarSlot?.startDate ? DateTime.fromJSDate(new Date(calendarSlot.startDate), { zone: 'Australia/Sydney' }).toFormat('ccc, dd LLL yyyy') : '');
  pushSyn(':CalendarSlotStartTime', () => calendarSlot?.startDate ? DateTime.fromJSDate(new Date(calendarSlot.startDate), { zone: 'Australia/Sydney' }).toFormat('HH:mm') : '');
  pushSyn(':CalendarSlotEndTime', () => calendarSlot?.endDate ? DateTime.fromJSDate(new Date(calendarSlot.endDate), { zone: 'Australia/Sydney' }).toFormat('HH:mm') : '');
  pushSyn(':CalendarSlotRange', () => {
    if (calendarSlot?.startDate && calendarSlot?.endDate) {
      try {
        const s = DateTime.fromJSDate(new Date(calendarSlot.startDate), { zone: 'Australia/Sydney' });
        const e = DateTime.fromJSDate(new Date(calendarSlot.endDate), { zone: 'Australia/Sydney' });
        const sameDay = s.hasSame(e, 'day');
        const dayPart = sameDay ? s.toFormat('ccc, dd LLL yyyy') : `${s.toFormat('ccc, dd LLL yyyy')} → ${e.toFormat('ccc, dd LLL yyyy')}`;
        const timePart = `${s.toFormat('h:mm a')} — ${e.toFormat('h:mm a')}`;
        return `${dayPart} • ${timePart}`;
      } catch(_) { return ''; }
    }
    return '';
  });

  // Build colonTokens object using registry tokens first
  const colonTokens = {};
  for (const t of (tokens || [])) {
    if (!t?.key) continue;
    // Render value using backend apply on isolated token
    try {
      const renderedSingle = applyTemplateTokensBackend(t.key, patBase, [t]);
      colonTokens[t.key.replace(':','')] = renderedSingle === `[${(t.label||t.key.replace(':',''))}]` ? '' : renderedSingle;
    } catch (_) {
      colonTokens[t.key.replace(':','')] = '';
    }
  }
  for (const syn of syntheticDefs) {
    const val = syn.resolver();
    colonTokens[syn.key.replace(':','')] = val || '';
  }

  // Preprocess Liquid markup: replace :Token inside {{ }} and {% %} with colonTokens.Token
  const transformColonInsideLiquid = (source) => {
    return source.replace(/({{|{%)([\s\S]*?)(}}|%})/g, (segment, open, inner, close) => {
      const replacedInner = inner.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, (m, name) => `colonTokens.${name}`);
      return open + replacedInner + close;
    });
  };

  const liquidSource = transformColonInsideLiquid(raw);

  if (hasLiquidMarkers(liquidSource)) {
    try {
      const tpl = await liquid.parse(liquidSource);
      const liquidCtx = { ...(patientInfo || {}), colonTokens };
      liquidRendered = await liquid.render(tpl, liquidCtx);
      liquidUsed = true;
    } catch (e) {
      // Bubble up syntax/unknown variable error
      throw e;
    }
  }

  // Colon substitutions AFTER Liquid so colon placeholders added by Liquid also resolve.
  // Colon substitutions AFTER Liquid so colon placeholders added by Liquid also resolve.
  // Inject synthetic colon tokens if registry missing common ones
  const pat = patientInfo?.patient || patientInfo || {};
  const latest = pat?.latestSlot || (Array.isArray(pat?.selectedAppDates) ? [...pat.selectedAppDates].sort((a,b)=>new Date(a.startDate)-new Date(b.startDate)).slice(-1)[0] : null);
  const synthetic = [];
  const existingKeys2 = new Set((tokens || []).map(t => t.key));
  const pushIfMissing = (key, field, secondLevelField, type, label) => {
    if (!existingKeys2.has(key)) synthetic.push({ key, field: field || null, secondLevelField: secondLevelField || null, type: type || 'string', label });
  };
  pushIfMissing(':Name', 'nameInput', null, 'string', 'Name');
  pushIfMissing(':FirstName', 'nameInput', null, 'string', 'First Name');
  pushIfMissing(':LastName', 'lastNameInput', null, 'string', 'Last Name');
  pushIfMissing(':Phone', 'phoneInput', null, 'phone', 'Phone');
  pushIfMissing(':StartDate', 'selectedAppDates', 'startDate', 'date', 'Start Date');
  pushIfMissing(':EndDate', 'selectedAppDates', 'endDate', 'date', 'End Date');
  pushIfMissing(':StartTime', 'selectedAppDates', 'startDate', 'time', 'Start Time');
  pushIfMissing(':EndTime', 'selectedAppDates', 'endDate', 'time', 'End Time');
  pushIfMissing(':SelectedSlotDate', 'selectedAppDates', 'startDate', 'date', 'Selected Slot Date');
  // :SelectedSlotRange is synthetic only (no direct field mapping) so we skip pushIfMissing here.
  // Combine tokens
  const combinedTokens = (tokens || []).concat(synthetic);
  let final = applyTemplateTokensBackend(liquidRendered, pat, combinedTokens);
  // Manual fallback replacements for clinic/org if still present
  if (/:Clinic/.test(final)) {
    const clinicVal = patientInfo?.org?.name || patientInfo?.org?.org_name || patientInfo?.org?.id || '[Clinic]';
    final = final.split(':Clinic').join(clinicVal);
  }
  // If date/time tokens still unresolved (left as [Label]), attempt direct formatting from latest slot
  const ensureToken = (token, value) => {
    if (final.includes(token)) final = final.split(token).join(value || `[${token.replace(':','')}]`);
  };
  ensureToken(':StartDate', latest?.startDate ? fmtDate(latest.startDate) : '');
  ensureToken(':EndDate', latest?.endDate ? fmtDate(latest.endDate) : '');
  const fmtTime = v => { try { return DateTime.fromJSDate(new Date(v), { zone: 'Australia/Sydney' }).toFormat('HH:mm'); } catch(_) { return ''; } };
  ensureToken(':StartTime', latest?.startDate ? fmtTime(latest.startDate) : '');
  ensureToken(':EndTime', latest?.endDate ? fmtTime(latest.endDate) : '');
  // Fallback Calendar slot ensure
  if (final.includes(':CalendarSlotDate')) {
    let val = '';
    try { val = calendarSlot?.startDate ? DateTime.fromJSDate(new Date(calendarSlot.startDate), { zone: 'Australia/Sydney' }).toFormat('ccc, dd LLL yyyy') : ''; } catch(_) {}
    final = final.split(':CalendarSlotDate').join(val || '[Calendar Slot Date]');
  }
  if (final.includes(':CalendarSlotStartTime')) {
    let val = '';
    try { val = calendarSlot?.startDate ? DateTime.fromJSDate(new Date(calendarSlot.startDate), { zone: 'Australia/Sydney' }).toFormat('HH:mm') : ''; } catch(_) {}
    final = final.split(':CalendarSlotStartTime').join(val || '[Calendar Slot Start Time]');
  }
  if (final.includes(':CalendarSlotEndTime')) {
    let val = '';
    try { val = calendarSlot?.endDate ? DateTime.fromJSDate(new Date(calendarSlot.endDate), { zone: 'Australia/Sydney' }).toFormat('HH:mm') : ''; } catch(_) {}
    final = final.split(':CalendarSlotEndTime').join(val || '[Calendar Slot End Time]');
  }
  if (final.includes(':CalendarSlotRange')) {
    let rangeVal = '';
    if (calendarSlot?.startDate && calendarSlot?.endDate) {
      try {
        const s = DateTime.fromJSDate(new Date(calendarSlot.startDate), { zone: 'Australia/Sydney' });
        const e = DateTime.fromJSDate(new Date(calendarSlot.endDate), { zone: 'Australia/Sydney' });
        const sameDay = s.hasSame(e, 'day');
        const dayPart = sameDay ? s.toFormat('ccc, dd LLL yyyy') : `${s.toFormat('ccc, dd LLL yyyy')} → ${e.toFormat('ccc, dd LLL yyyy')}`;
        const timePart = `${s.toFormat('h:mm a')} — ${e.toFormat('h:mm a')}`;
        rangeVal = `${dayPart} • ${timePart}`;
      } catch(_) { rangeVal = ''; }
    }
    final = final.split(':CalendarSlotRange').join(rangeVal || '[Calendar Slot Range]');
  }
  if (final.includes(':SelectedSlotDate')) {
    const val = latest?.startDate ? DateTime.fromJSDate(new Date(latest.startDate), { zone: 'Australia/Sydney' }).toFormat('ccc, dd LLL yyyy') : '';
    final = final.split(':SelectedSlotDate').join(val || '[Selected Slot Date]');
  }
  if (final.includes(':SelectedSlotRange')) {
    let rangeVal = '';
    if (latest?.startDate && latest?.endDate) {
      try {
        const s = DateTime.fromJSDate(new Date(latest.startDate), { zone: 'Australia/Sydney' });
        const e = DateTime.fromJSDate(new Date(latest.endDate), { zone: 'Australia/Sydney' });
        const sameDay = s.hasSame(e, 'day');
        const dayPart = sameDay ? s.toFormat('ccc, dd LLL yyyy') : `${s.toFormat('ccc, dd LLL yyyy')} → ${e.toFormat('ccc, dd LLL yyyy')}`;
        const timePart = `${s.toFormat('h:mm a')} — ${e.toFormat('h:mm a')}`;
        rangeVal = `${dayPart} • ${timePart}`;
      } catch(_) { rangeVal = ''; }
    }
    final = final.split(':SelectedSlotRange').join(rangeVal || '[Selected Slot Range]');
  }
  // Legacy bracket placeholders (e.g. [First Name]) replacement
  final = replaceBracketPlaceholders(final, patientInfo);
  return { rendered: final, liquidUsed };
}

async function unifiedLint({ template, tokens, orgColonKeys }) {
  const raw = String(template || '');
  const diagnostics = {
    liquid: { syntaxError: null, unknownVariables: [] },
    colon: { used: [], unknown: [] },
    mixed: hasLiquidMarkers(raw) && /:[A-Za-z][A-Za-z0-9_]*/.test(raw),
  };

  // Colon analysis
  const colonUsed = extractColonTokens(raw);
  diagnostics.colon.used = colonUsed;
  const validSet = new Set((orgColonKeys || []).map(String));
  diagnostics.colon.unknown = colonUsed.filter(k => !validSet.has(k));

  // Liquid analysis
  if (hasLiquidMarkers(raw)) {
    let tpl;
    try {
      tpl = await liquid.parse(raw);
    } catch (e) {
      diagnostics.liquid.syntaxError = e?.message || 'Liquid syntax error';
      return diagnostics; // stop further liquid checks
    }
    try {
      // Strict variables: empty patient/org triggers unknown variable errors
      await liquid.render(tpl, { patient: {}, org: {} });
    } catch (e) {
      // LiquidJS may throw a message referencing unknown variable
      diagnostics.liquid.unknownVariables.push(e?.message || 'Unknown variable');
    }
  }

  return diagnostics;
}

module.exports = {
  unifiedRender,
  unifiedLint,
};
