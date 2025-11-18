// apps/backend/src/helpers/tokenRenderer.js
// Backend token renderer compatible with the current frontend semantics

const { DateTime } = require('luxon');

function titleCaseName(value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  // Lowercase everything, then uppercase first letter of each word (supports accents),
  // also after hyphens or apostrophes.
  const lower = s.toLowerCase();
  return lower.replace(/\b([A-Za-zÀ-ÖØ-öø-ÿ])([A-Za-zÀ-ÖØ-öø-ÿ']*)/g, (m, f, rest) => f.toUpperCase() + rest);
}

function formatDateSingle(date, includeTime = false) {
  try {
    const dt = DateTime.fromJSDate(date instanceof Date ? date : new Date(date), { zone: 'Australia/Sydney' });
    return includeTime ? dt.toFormat('dd/LL/yyyy HH:mm') : dt.toFormat('dd/LL/yyyy');
  } catch (_) {
    return '';
  }
}

function formatIfNeeded(value, type) {
  if (value == null) return '';
  if (type === 'date' || type === 'time') {
    return formatDateSingle(value, type === 'time');
  }
  return String(value);
}

function getLatestSelectedAppDate(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  return arr.reduce((acc, cur) => {
    const a = new Date(acc?.startDate || 0).getTime();
    const b = new Date(cur?.startDate || 0).getTime();
    return b > a ? cur : acc;
  }, arr[0]);
}

/**
 * Apply TemplateToken registry to a raw template content.
 * - template: string with tokens like :Name, :Start, etc.
 * - patientInfo: appointment/contact document (lean object)
 * - tokens: [{ key, field, secondLevelField, type, label }]
 */
function applyTemplateTokensBackend(template, patientInfo, tokens, opts = {}) {
  let finalText = String(template ?? '');
  const list = Array.isArray(tokens) ? tokens : [];

  const isLikelyNameToken = (t) => {
    const key = String(t?.key || '').toLowerCase();
    const label = String(t?.label || '').toLowerCase();
    const field = String(t?.field || '').toLowerCase();
    // Heuristics: token key/label mentions first/last/name, or field is a typical name field
    const keyHit = /(^:?(first)?name$)|(^:?(last)?name$)|(^:?[a-z]*patient[a-z]*name$)/.test(key);
    const labelHit = /(^first\s*name$)|(^last\s*name$)|(^name$)/.test(label);
    const fieldHit = /(nameinput|firstname|lastname|lastNameInput|givenname|familyname|name)$/.test(field);
    return keyHit || labelHit || fieldHit;
  };

  for (const token of list) {
    const { key, field, secondLevelField, type, label } = token;

    let replacement = '';
    let hasValue = false;

    if (field && secondLevelField) {
      const firstLevel = patientInfo?.[field];
      if (Array.isArray(firstLevel) && firstLevel.length > 0) {
        const targetObj = field === 'selectedAppDates'
          ? (opts?.selectedSlot && (opts.selectedSlot.startDate || opts.selectedSlot.endDate)
              ? opts.selectedSlot
              : (getLatestSelectedAppDate(firstLevel) ?? firstLevel[firstLevel.length - 1]))
          : (typeof firstLevel[0] === 'object' ? firstLevel[0] : undefined);
        if (targetObj && typeof targetObj === 'object') {
          const nestedValue = targetObj[secondLevelField];
          replacement = formatIfNeeded(nestedValue, type);
          hasValue = !!replacement;
        }
      }
    } else if (field && !secondLevelField) {
      replacement = formatIfNeeded(patientInfo?.[field], type);
      hasValue = !!replacement;
    } else if (!field) {
      // Synthetic tokens without field or mapped by key
      const latestSlot = (opts?.selectedSlot && (opts.selectedSlot.startDate || opts.selectedSlot.endDate))
        ? opts.selectedSlot
        : (Array.isArray(patientInfo?.selectedAppDates) && patientInfo.selectedAppDates.length > 0
          ? patientInfo.selectedAppDates.reduce((acc, cur) => (new Date(cur.startDate).getTime() > new Date(acc.startDate).getTime() ? cur : acc), patientInfo.selectedAppDates[0])
          : null);
      switch (key) {
        case ':Today':
          replacement = formatDateSingle(new Date());
          hasValue = true;
          break;
        case ':Time':
          replacement = formatDateSingle(new Date(), true);
          hasValue = true;
          break;
        case ':SelectedSlotRange': {
          if (latestSlot?.startDate && latestSlot?.endDate) {
            try {
              const s = DateTime.fromJSDate(new Date(latestSlot.startDate), { zone: 'Australia/Sydney' });
              const e = DateTime.fromJSDate(new Date(latestSlot.endDate), { zone: 'Australia/Sydney' });
              const sameDay = s.hasSame(e, 'day');
              const dayPart = sameDay
                ? s.toFormat('ccc, dd LLL yyyy')
                : `${s.toFormat('ccc, dd LLL yyyy')} → ${e.toFormat('ccc, dd LLL yyyy')}`;
              const timePart = `${s.toFormat('h:mm a')} — ${e.toFormat('h:mm a')}`;
                replacement = `${dayPart} • ${timePart}`;
              hasValue = true;
            } catch (_) {
              replacement = '';
            }
          }
          break;
        }
        case ':SelectedSlotDate': {
          if (latestSlot?.startDate) {
            try {
              const s = DateTime.fromJSDate(new Date(latestSlot.startDate), { zone: 'Australia/Sydney' });
              replacement = s.toFormat('ccc, dd LLL yyyy');
              hasValue = true;
            } catch(_) { replacement=''; }
          }
          break;
        }
        case ':CalendarSlotDate': {
          const cal = patientInfo?.calendarSlot;
          if (cal?.startDate) {
            try {
              const s = DateTime.fromJSDate(new Date(cal.startDate), { zone: 'Australia/Sydney' });
              replacement = s.toFormat('ccc, dd LLL yyyy');
              hasValue = true;
            } catch(_) { replacement=''; }
          }
          break;
        }
        case ':CalendarSlotStartTime': {
          const cal = patientInfo?.calendarSlot;
          if (cal?.startDate) {
            try {
              const s = DateTime.fromJSDate(new Date(cal.startDate), { zone: 'Australia/Sydney' });
              replacement = s.toFormat('HH:mm');
              hasValue = true;
            } catch(_) { replacement=''; }
          }
          break;
        }
        case ':CalendarSlotEndTime': {
          const cal = patientInfo?.calendarSlot;
          if (cal?.endDate) {
            try {
              const e = DateTime.fromJSDate(new Date(cal.endDate), { zone: 'Australia/Sydney' });
              replacement = e.toFormat('HH:mm');
              hasValue = true;
            } catch(_) { replacement=''; }
          }
          break;
        }
        case ':CalendarSlotRange': {
          const cal = patientInfo?.calendarSlot;
          if (cal?.startDate && cal?.endDate) {
            try {
              const s = DateTime.fromJSDate(new Date(cal.startDate), { zone: 'Australia/Sydney' });
              const e = DateTime.fromJSDate(new Date(cal.endDate), { zone: 'Australia/Sydney' });
              const sameDay = s.hasSame(e, 'day');
              const dayPart = sameDay ? s.toFormat('ccc, dd LLL yyyy') : `${s.toFormat('ccc, dd LLL yyyy')} → ${e.toFormat('ccc, dd LLL yyyy')}`;
              const timePart = `${s.toFormat('h:mm a')} — ${e.toFormat('h:mm a')}`;
              replacement = `${dayPart} • ${timePart}`;
              hasValue = true;
            } catch(_) { replacement=''; }
          }
          break;
        }
        case ':Clinic':
        case ':OrgName':
        case ':Organisation':
        case ':Organization':
          replacement = patientInfo?.org_name || patientInfo?.clinicName || patientInfo?.clinic || patientInfo?.org?.name || patientInfo?.org?.org_name || patientInfo?.org?.id || '';
          hasValue = !!replacement;
          break;
        case ':Name':
        case ':FirstName':
          replacement = titleCaseName(patientInfo?.nameInput || patientInfo?.firstName || '');
          hasValue = !!replacement;
          break;
        case ':LastName':
          replacement = titleCaseName(patientInfo?.lastNameInput || patientInfo?.lastName || '');
          hasValue = !!replacement;
          break;
        case ':Phone':
          replacement = patientInfo?.phoneInput || patientInfo?.phone || '';
          hasValue = !!replacement;
          break;
        case ':StartDate':
          replacement = latestSlot?.startDate ? formatDateSingle(latestSlot.startDate) : '';
          hasValue = !!replacement;
          break;
        case ':EndDate':
          replacement = latestSlot?.endDate ? formatDateSingle(latestSlot.endDate) : '';
          hasValue = !!replacement;
          break;
        case ':StartTime':
          replacement = latestSlot?.startDate ? formatDateSingle(latestSlot.startDate, true) : '';
          hasValue = !!replacement;
          break;
        case ':EndTime':
          replacement = latestSlot?.endDate ? formatDateSingle(latestSlot.endDate, true) : '';
          hasValue = !!replacement;
          break;
        default:
          // leave for bracket fallback below
          break;
      }
    }

    if (isLikelyNameToken(token)) {
      replacement = titleCaseName(replacement);
    }

    if (!hasValue && replacement === '') {
      const tokenName = label || String(key || '').replace(':', '');
      replacement = `[${tokenName}]`;
    }

    if (key && typeof key === 'string') {
      // Replace all occurrences
      finalText = finalText.split(key).join(replacement);
    }
  }
  return finalText;
}

/**
 * Extract tokens used in a template by colon syntax (e.g., :Name, :StartDate)
 */
function extractColonTokens(template) {
  const rx = /:[A-Za-z][A-Za-z0-9_]*/g;
  const s = String(template ?? '');
  const set = new Set();
  let m;
  while ((m = rx.exec(s)) !== null) {
    set.add(m[0]);
  }
  return Array.from(set);
}

module.exports = {
  applyTemplateTokensBackend,
  extractColonTokens,
};
