(function () {
  "use strict";

  const REF_W = 1920;
  const REF_H = 1080;
  const BASE = 1.1;
  const MIN = 0.72;
  const MAX = 1.35;

  function readUiScale() {
    const w = window.innerWidth || REF_W;
    const h = window.innerHeight || REF_H;
    return Math.min(MAX, Math.max(MIN, (Math.min(w / REF_W, h / REF_H) * BASE)));
  }

  function applyViewportScale() {
    const scale = readUiScale();
    const text = String(Number(scale.toFixed(4)));
    document.documentElement.style.setProperty("--labsoft-ui-scale", text);
    window.dispatchEvent(
      new CustomEvent("labsoft-viewport-scale", { detail: { scale: scale } })
    );
  }

  window.LABSOFT_getUiScale = readUiScale;
  applyViewportScale();
  window.addEventListener("resize", applyViewportScale);
  window.addEventListener("orientationchange", applyViewportScale);
})();
