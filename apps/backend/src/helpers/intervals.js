// src/helpers/intervals.js
// Basic interval utilities for UTC Date intervals.
function normalize(a, b) {
  const start = new Date(Math.min(a.getTime(), b.getTime()));
  const end = new Date(Math.max(a.getTime(), b.getTime()));
  return { start, end };
}

function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

function subtractIntervals(baseIntervals, subtractingIntervals) {
  // For each base interval, subtract all subtracting intervals.
  const result = [];
  for (const base of baseIntervals) {
    let fragments = [base];
    for (const sub of subtractingIntervals) {
      const next = [];
      for (const frag of fragments) {
        if (!overlaps(frag, sub)) {
          next.push(frag);
          continue;
        }
        // Four configurations → split
        if (sub.start <= frag.start && sub.end >= frag.end) {
          // fully covered → drop
        } else if (sub.start <= frag.start && sub.end < frag.end) {
          // cut from start
          next.push({ start: sub.end, end: frag.end });
        } else if (sub.start > frag.start && sub.end >= frag.end) {
          // cut at the end
          next.push({ start: frag.start, end: sub.start });
        } else {
          // split in two
          next.push({ start: frag.start, end: sub.start });
          next.push({ start: sub.end, end: frag.end });
        }
      }
      fragments = next;
      if (fragments.length === 0) break;
    }
    result.push(...fragments);
  }
  return result;
}

function intersectIntervals(aIntervals, bIntervals) {
  const out = [];
  for (const a of aIntervals) {
    for (const b of bIntervals) {
      if (overlaps(a, b)) {
        out.push({ start: new Date(Math.max(a.start, b.start)), end: new Date(Math.min(a.end, b.end)) });
      }
    }
  }
  return out;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function floorToStep(date, stepMinutes) {
  const ms = date.getTime();
  const stepMs = stepMinutes * 60000;
  return new Date(Math.floor(ms / stepMs) * stepMs);
}

module.exports = {
  normalize,
  overlaps,
  subtractIntervals,
  intersectIntervals,
  addMinutes,
  floorToStep,
};
