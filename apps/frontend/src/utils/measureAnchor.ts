function getComputedStyleNumeric(el: HTMLElement, prop: string) {
  const cs = window.getComputedStyle(el);
  const val = Number.parseFloat(cs.getPropertyValue(prop));
  return Number.isFinite(val) ? val : 0;
}

function buildMirrorDiv(textarea: HTMLTextAreaElement) {
  const div = document.createElement("div");
  const s = div.style;
  const cs = window.getComputedStyle(textarea);
  s.whiteSpace = "pre-wrap";
  s.wordWrap = "break-word";
  s.visibility = "hidden";
  s.position = "absolute";
  s.top = "0";
  s.left = "-9999px";
  s.font = cs.font as string;
  (s as any).letterSpacing = cs.letterSpacing as string;
  (s as any).tabSize = cs.tabSize as unknown as string;
  s.borderStyle = cs.borderStyle as string;
  s.padding = cs.padding as string;
  s.width = cs.width as string;
  s.lineHeight = cs.lineHeight as string;
  s.borderWidth = cs.borderWidth as string;
  s.boxSizing = cs.boxSizing as string;
  document.body.appendChild(div);
  return div;
}

export function measureAnchorPosition(
  textarea: HTMLTextAreaElement,
  fullText: string,
  anchorIndex: number
) {
  const mirror = buildMirrorDiv(textarea);
  const before = fullText.slice(0, anchorIndex);
  const after = fullText.slice(anchorIndex);

  const esc = (s: string) => s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  mirror.innerHTML = esc(before) + '<span id="_caret_anchor"></span>' + esc(after);
  const mark = mirror.querySelector("#_caret_anchor") as HTMLSpanElement | null;
  const rect = mark?.getBoundingClientRect();
  const taRect = textarea.getBoundingClientRect();
  mirror.remove();
  if (!rect) return null;
  return {
    x: rect.left - taRect.left,
    y: rect.top - taRect.top + getComputedStyleNumeric(textarea, "fontSize") * 1.25,
  };
}
