const canvas = document.getElementById("my_canvas");
const gridCanvas = document.getElementById("grid_canvas");
const acquisitionControls = {
  samples: document.getElementById("number_of_samples"),
  rate: document.getElementById("sampling_rate")
};
const acquisitionInfo = document.getElementById("Acquisition_Info");
const acquisitionSettingsStorageKey = "LABSOFT_ACQUISITION_SETTINGS";
const plotArea = canvas ? canvas.parentElement : null;

let lastSyncedCssWidth = 0;
let lastSyncedCssHeight = 0;
let lastSyncedRatio = 0;

// Measure the black display box (the canvas fills plot_area via inset:0) and
// resize the WebGL + grid backing stores to match, so the trace is never
// stretched/squished when the layout settles or the panel is resized.
function syncScopeCanvasSize() {
  const box = plotArea || canvas;
  const canvasCssWidth = box ? box.clientWidth : canvas.clientWidth;
  const canvasCssHeight = box ? box.clientHeight : canvas.clientHeight;

  // Layout not ready yet; skip so we don't lock in a 1px backing store.
  if (canvasCssWidth <= 0 || canvasCssHeight <= 0) {
    return false;
  }

  const ratio = window.devicePixelRatio || 1;
  const pixelWidth = Math.max(1, Math.round(canvasCssWidth * ratio));
  const pixelHeight = Math.max(1, Math.round(canvasCssHeight * ratio));

  const changed =
    canvasCssWidth !== lastSyncedCssWidth ||
    canvasCssHeight !== lastSyncedCssHeight ||
    ratio !== lastSyncedRatio ||
    canvas.width !== pixelWidth ||
    canvas.height !== pixelHeight;

  if (!changed) {
    return false;
  }

  if (canvas.width !== pixelWidth) {
    canvas.width = pixelWidth;
  }
  if (canvas.height !== pixelHeight) {
    canvas.height = pixelHeight;
  }
  if (gridCanvas.width !== pixelWidth) {
    gridCanvas.width = pixelWidth;
  }
  if (gridCanvas.height !== pixelHeight) {
    gridCanvas.height = pixelHeight;
  }

  canvas.style.width = `${canvasCssWidth}px`;
  canvas.style.height = `${canvasCssHeight}px`;
  gridCanvas.style.width = `${canvasCssWidth}px`;
  gridCanvas.style.height = `${canvasCssHeight}px`;

  lastSyncedCssWidth = canvasCssWidth;
  lastSyncedCssHeight = canvasCssHeight;
  lastSyncedRatio = ratio;
  return true;
}

// Re-sync backing store and everything that depends on it. Returns true when
// a resize actually happened so callers can avoid redundant work.
function resizeScopeIfNeeded(forceLineRebuild = false) {
  const changed = syncScopeCanvasSize();
  if (changed) {
    updateWebglViewport();
    ensurePlotLines(true);
    updateGrid();
  } else if (forceLineRebuild) {
    ensurePlotLines(true);
  }
  return changed;
}

syncScopeCanvasSize();

const MAX_SAMPLE_COUNT = 2000;
const MAX_SAMPLE_RATE = 200000;

function parseSampleCount(value) {
  const sampleCount = parseInt(value, 10);
  if (!Number.isFinite(sampleCount) || sampleCount <= 0) {
    return 0;
  }
  return Math.min(MAX_SAMPLE_COUNT, sampleCount);
}

function parseSamplingRate(value) {
  if (value === undefined || value === null || value === "") {
    return MAX_SAMPLE_RATE;
  }
  const text = String(value).trim().toLowerCase();
  const numeric = parseFloat(text);
  if (!Number.isFinite(numeric)) {
    return MAX_SAMPLE_RATE;
  }
  if (numeric <= 0) {
    // 0 Hz (or below) explicitly stops streaming.
    return 0;
  }
  let hz;
  if (text.includes("mhz")) {
    hz = Math.round(numeric * 1000000);
  } else if (text.includes("khz")) {
    hz = Math.round(numeric * 1000);
  } else {
    hz = Math.round(numeric);
  }
  return Math.min(MAX_SAMPLE_RATE, Math.max(0, hz));
}

function formatSamplingRate(rate) {
  if (!Number.isFinite(rate) || rate <= 0) {
    return "0 Hz";
  }
  if (rate >= 1000000) {
    return `${formatNumber(rate / 1000000)} MHz`;
  }
  if (rate >= 1000) {
    return `${formatNumber(rate / 1000)} kHz`;
  }
  return `${formatNumber(rate)} Hz`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0 s";
  }
  if (seconds >= 1) {
    return `${formatNumber(seconds)} s`;
  }
  if (seconds >= 1e-3) {
    return `${formatNumber(seconds * 1e3)} ms`;
  }
  return `${formatNumber(seconds * 1e6)} us`;
}

// Signed time formatter used by the Horizontal Offset field (can go negative).
function formatOffsetTime(seconds) {
  if (!Number.isFinite(seconds) || seconds === 0) {
    return "0 s";
  }
  const sign = seconds < 0 ? "-" : "";
  const abs = Math.abs(seconds);
  if (abs >= 1) {
    return `${sign}${toSignificant(abs, 5)} s`;
  }
  if (abs >= 1e-3) {
    return `${sign}${toSignificant(abs * 1e3, 5)} ms`;
  }
  if (abs >= 1e-6) {
    return `${sign}${toSignificant(abs * 1e6, 5)} us`;
  }
  return `${sign}${toSignificant(abs * 1e9, 5)} ns`;
}

function toSignificant(value, digits) {
  if (!Number.isFinite(value) || value === 0) {
    return "0";
  }
  // Round to N significant digits, then drop any redundant trailing zeros.
  return Number(value.toPrecision(digits)).toString();
}

function formatTimePerDiv(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0 s/div";
  }
  let scaled;
  let unit;
  if (seconds >= 1) {
    scaled = seconds;
    unit = "s";
  } else if (seconds >= 1e-3) {
    scaled = seconds * 1e3;
    unit = "ms";
  } else if (seconds >= 1e-6) {
    scaled = seconds * 1e6;
    unit = "us";
  } else {
    scaled = seconds * 1e9;
    unit = "ns";
  }
  // Fixed at 5 significant digits so the derived value never runs long.
  return `${toSignificant(scaled, 5)} ${unit}/div`;
}

function formatTriggerVolts(volts) {
  if (!Number.isFinite(volts)) {
    return "0 V";
  }
  const abs = Math.abs(volts);
  if (abs !== 0 && abs < 1) {
    return `${toSignificant(volts * 1e3, 4)} mV`;
  }
  return `${toSignificant(volts, 4)} V`;
}

function computeDisplaySampleCount(sampleCount) {
  // Show ~70% of the acquired buffer regardless of size; the remaining ~30%
  // stays as headroom the software trigger uses to pan the window
  // (pre-/post-trigger). This applies for large captures (e.g. 1000-2000)
  // too, not just small ones.
  return Math.max(2, Math.floor(sampleCount * 0.7));
}

function getAcquisitionSampleCount() {
  const count = window.LABSOFT_SAMPLE_COUNT;
  return Number.isFinite(count) ? count : 2000;
}

function getSampleRate() {
  const rate = window.LABSOFT_SAMPLE_RATE;
  return Number.isFinite(rate) ? rate : 200000;
}

// The device echoes its delivery rate in each frame header (bytes 4-7).
let lastPacketSampleRate = 0;

const displayZoomState = {
  animStart: 0,
  animDuration: 220,
  animFromUs: 0,
  animToUs: 0
};

function getRequestedRateHz() {
  return getSampleRate();
}

function ratesAgree(a, b, tolerance = 0.02) {
  if (!(a > 0) || !(b > 0)) {
    return false;
  }
  return Math.abs(a - b) <= Math.max(1, Math.max(a, b) * tolerance);
}

function getAppliedRateHz() {
  const requested = getRequestedRateHz();
  const statusRate = serverMetrics.appliedRate;
  const packetRate = lastPacketSampleRate;

  // STATUS matches the UI request — prefer it over a stale ADCS header rate.
  if (statusRate > 0 && ratesAgree(statusRate, requested)) {
    return statusRate;
  }

  if (packetRate > 0) {
    if (
      statusRate > 0 &&
      ratesAgree(statusRate, requested) &&
      !ratesAgree(packetRate, requested, 0.05)
    ) {
      return statusRate;
    }
    return packetRate;
  }

  return statusRate > 0 ? statusRate : 0;
}

const HIGH_RATE_WINDOW_HZ = 80000;
let lastKnownCaptureRateHz = 0;

function prefersLiveTrailingWindow() {
  const applied = getAppliedRateHz();
  if (applied >= HIGH_RATE_WINDOW_HZ) {
    return true;
  }
  return !isDisplayZoomMode() && applied > 0 && getMaxRateHz() >= HIGH_RATE_WINDOW_HZ;
}

function getFreeRunWindowStart(maxStartIndex) {
  if (maxStartIndex <= 0) {
    return 0;
  }
  if (prefersLiveTrailingWindow()) {
    return maxStartIndex;
  }
  return Number.isFinite(lastGoodWindowStartIndex) ? lastGoodWindowStartIndex : 0;
}

function onCaptureRateChanged(prevRate, newRate) {
  if (!(newRate > 0)) {
    return;
  }
  const rateJump =
    prevRate > 0 && Math.abs(newRate - prevRate) > Math.max(1, prevRate * 0.05);
  const enteredHighRate = newRate >= HIGH_RATE_WINDOW_HZ && prevRate < HIGH_RATE_WINDOW_HZ;
  if (!rateJump && !enteredHighRate) {
    return;
  }
  resetDisplayZoomState();
  lastGoodWindowStartIndex = 0;
  forcedMarkerFraction = null;
  lastKnownCaptureRateHz = newRate;
  if (isNoneTriggerMode()) {
    resetNoneTriggerViewAnchor();
  } else {
    resetTriggerState();
  }
  syncTimePerDivFromRate();
  updateGrid();
}

function getMaxRateHz() {
  return serverMetrics.maxRate > 0 ? serverMetrics.maxRate : 0;
}

function isDisplayZoomMode() {
  const requested = getRequestedRateHz();
  const maxRate = getMaxRateHz();
  if (maxRate > 0) {
    return requested > maxRate;
  }
  const applied = getAppliedRateHz();
  return applied > 0 && requested > applied * 1.02;
}

function getDisplayRateHz() {
  const requested = getRequestedRateHz();
  if (isDisplayZoomMode()) {
    return requested;
  }
  const maxRate = getMaxRateHz();
  // Achievable request: keep Time/div and x-axis tied to the slider.
  if (requested > 0 && maxRate > 0 && requested <= maxRate) {
    return requested;
  }
  const applied = getAppliedRateHz();
  return applied > 0 ? applied : requested;
}

function captureWindowUsForRate(rateHz, sampleCount) {
  if (!(rateHz > 0) || !(sampleCount > 0)) {
    return 0;
  }
  return (sampleCount * 1e6) / rateHz;
}

function targetCaptureWindowUs() {
  return captureWindowUsForRate(getDisplayRateHz(), getAcquisitionSampleCount());
}

function plotAnimNowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function easeOutCubic(t) {
  const x = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - x, 3);
}

function getAnimatedCaptureWindowUs(nowMs = plotAnimNowMs()) {
  if (!(displayZoomState.animStart > 0)) {
    return targetCaptureWindowUs();
  }
  const elapsed = nowMs - displayZoomState.animStart;
  if (elapsed >= displayZoomState.animDuration) {
    displayZoomState.animStart = 0;
    return displayZoomState.animToUs;
  }
  const t = easeOutCubic(elapsed / displayZoomState.animDuration);
  return displayZoomState.animFromUs + (displayZoomState.animToUs - displayZoomState.animFromUs) * t;
}

function startDisplayWindowAnimation() {
  const now = plotAnimNowMs();
  displayZoomState.animFromUs = getAnimatedCaptureWindowUs(now);
  displayZoomState.animToUs = targetCaptureWindowUs();
  if (Math.abs(displayZoomState.animToUs - displayZoomState.animFromUs) < 1) {
    displayZoomState.animStart = 0;
    return;
  }
  displayZoomState.animStart = now;
}

function getPlotVisibleSpanSeconds() {
  const visibleSamples = Math.max(2, lastVisibleSampleCount || getVisibleSampleCount());
  if (!isDisplayZoomMode()) {
    const displayRate = getDisplayRateHz();
    return displayRate > 0 ? (visibleSamples - 1) / displayRate : 0;
  }
  if (displayZoomState.animStart > 0) {
    const sampleCount = getAcquisitionSampleCount();
    const animWindowUs = getAnimatedCaptureWindowUs();
    if (sampleCount >= 2 && animWindowUs > 0) {
      return (animWindowUs / 1e6) * ((visibleSamples - 1) / (sampleCount - 1));
    }
  }
  const displayRate = getDisplayRateHz();
  return displayRate > 0 ? (visibleSamples - 1) / displayRate : 0;
}

function getEffectiveDisplayRateHz() {
  const visibleSamples = Math.max(2, lastVisibleSampleCount || getVisibleSampleCount());
  const spanSec = getPlotVisibleSpanSeconds();
  if (spanSec > 0 && visibleSamples > 1) {
    return (visibleSamples - 1) / spanSec;
  }
  return getDisplayRateHz();
}

function needsDisplayZoomResample() {
  if (!isDisplayZoomMode()) {
    return false;
  }
  const displayRate = getEffectiveDisplayRateHz();
  const appliedRate = getTriggerSampleRateHz();
  if (!(displayRate > 0) || !(appliedRate > 0)) {
    return false;
  }
  return displayRate > appliedRate * 1.001;
}

function resetDisplayZoomState() {
  displayZoomState.animStart = 0;
  displayZoomState.animFromUs = 0;
  displayZoomState.animToUs = 0;
}

function getTriggerFractionInFrame(frame) {
  if (Number.isFinite(frame.triggerFractionInWindow)) {
    return Math.max(0, Math.min(1, frame.triggerFractionInWindow));
  }
  const windowSamples = Math.max(2, frame.length || 0);
  if (windowSamples > 1 && Number.isFinite(lastTriggerIndexInWindow)) {
    return Math.max(0, Math.min(1, lastTriggerIndexInWindow / (windowSamples - 1)));
  }
  return getTriggerPositionFraction();
}

// Sample-index timing for trigger search, horizontal offset, and window placement.
// Always uses the hardware/applied rate, not the display-zoom rate.
function getTriggerSampleRateHz() {
  const applied = getAppliedRateHz();
  return applied > 0 ? applied : getRequestedRateHz();
}

function getTimebaseSampleRate() {
  return getDisplayRateHz();
}

function getDeviceSampleRate() {
  return getAppliedRateHz() || getRequestedRateHz();
}

function getDisplayRenderCount(nominalRenderCount) {
  return nominalRenderCount;
}

function getAxisLabelSampleRate() {
  if (isStreamStopped() && runState.lastRunningSampleRate > 0) {
    return runState.lastRunningSampleRate;
  }
  const visibleSamples = Math.max(2, lastVisibleSampleCount || getVisibleSampleCount());
  const spanSec = getPlotVisibleSpanSeconds();
  if (spanSec > 0) {
    return (visibleSamples - 1) / spanSec;
  }
  return getDisplayRateHz();
}

function refreshPlotRender() {
  if (!nextFrameBuffer.ch1 || nextFrameBuffer.ch1.length <= 0) {
    return;
  }
  renderFrameBuffer(nextFrameBuffer);
}

function tickDisplayWindowAnimation() {
  if (!(displayZoomState.animStart > 0)) {
    return;
  }
  updateAxisLabels();
  refreshPlotRender();
  updateAcquisitionInfo();
  if (plotAnimNowMs() - displayZoomState.animStart >= displayZoomState.animDuration) {
    displayZoomState.animStart = 0;
  }
}

function isStreamStopped() {
  return getSampleRate() <= 0 || getAcquisitionSampleCount() <= 0;
}

function getMaxDisplaySampleCount() {
  const acquisitionCount = getAcquisitionSampleCount();
  const configuredDisplay = window.LABSOFT_DISPLAY_SAMPLES;
  if (Number.isFinite(configuredDisplay) && configuredDisplay > 0) {
    return Math.min(configuredDisplay, acquisitionCount);
  }
  return computeDisplaySampleCount(acquisitionCount);
}

function applyAcquisitionSettings() {
  const sampleCount = acquisitionControls.samples ? parseSampleCount(acquisitionControls.samples.value) : 2000;
  const sampleRate = acquisitionControls.rate ? parseSamplingRate(acquisitionControls.rate.value) : 200000;

  window.LABSOFT_SAMPLE_COUNT = sampleCount;
  window.LABSOFT_SAMPLE_RATE = sampleRate;
  window.LABSOFT_SAMPLE_RATE_LABEL = acquisitionControls.rate ? acquisitionControls.rate.value : "200 kHz";
  window.LABSOFT_DISPLAY_SAMPLES = computeDisplaySampleCount(sampleCount);
  updateServerSetGlobals();
}

// Rate/count actually sent on the wire — clamped to hw max/applied so the
// server does not log repeated SET clamp warnings on every ping.
function getServerSetRateHz() {
  const requested = getSampleRate();
  if (!(requested > 0)) {
    return 0;
  }
  const maxRate = getMaxRateHz();
  const applied = getAppliedRateHz();
  if (maxRate > 0 && requested > maxRate) {
    return maxRate;
  }
  if (applied > 0 && requested > applied * 1.02) {
    return applied;
  }
  return requested;
}

function updateServerSetGlobals() {
  window.LABSOFT_SET_RATE = getServerSetRateHz();
  window.LABSOFT_SET_COUNT = getAcquisitionSampleCount();
}

// Push the current Samples / Sampling Rate to the device live (no page reload).
// Relies on window.LABSOFT_setAcquisition exported by the WASM client; if that
// isn't available yet it falls back to a page reload so the settings still apply.
let lastStreamAppliedRate = 0;
let lastStreamAppliedCount = 0;

function markUserAcquisitionDirty() {
  userAcquisitionDirty = true;
}

function applyStreamAcquisition() {
  updateServerSetGlobals();
  const rate = getServerSetRateHz();
  const count = getAcquisitionSampleCount();
  const countChanged = lastStreamAppliedCount > 0 && count !== lastStreamAppliedCount;
  lastStreamAppliedRate = rate;
  lastStreamAppliedCount = count;

  ensureFrameBufferCapacity(getMaxDisplaySampleCount() + 1);
  if (countChanged) {
    resetTriggerState();
  }
  updateTriggerSliderRange();
  updateGrid();
  updateTriggerOverlay();
  updateAcquisitionInfo();

  if (typeof window.LABSOFT_setAcquisition === "function") {
    try {
      window.LABSOFT_setAcquisition(rate, count);
    } catch (err) {
      // Ignore transient send failures (e.g. socket not open yet).
    }
    if (isStreamStopped()) {
      setTriggerStatus("Stopped (0 Hz)");
      runState.running = false;
      updateRunButtonUi();
    }
    return;
  }

  // Software demo preview: globals are already updated; keep the page alive
  // so channel offsets and other controls are not reset by a reload.
  if (window.LABSOFT_DEMO_PREVIEW) {
    if (acquisitionControls.rate) {
      acquisitionControls.rate.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (acquisitionControls.samples) {
      acquisitionControls.samples.dispatchEvent(new Event("change", { bubbles: true }));
    }
    refreshDisplayFromLastFrame();
    refreshPlotRender();
    wglp.update();
    return;
  }

  // WASM export missing (older build): fall back to a reload so behaviour
  // still matches the selected settings.
  window.location.reload();
}

function updateRunButtonUi() {
  const btn = runControls.runButton;
  if (!btn) {
    return;
  }
  const running = runState.running && !isStreamStopped();
  btn.textContent = running ? "Stop" : "Run";
  btn.classList.toggle("scope_run_btn_run", running);
  btn.classList.toggle("scope_run_btn_stop", !running);
  btn.setAttribute("aria-pressed", running ? "true" : "false");
  if (runControls.singleButton) {
    runControls.singleButton.classList.toggle("armed", runState.singleArmed);
    runControls.singleButton.setAttribute("aria-pressed", runState.singleArmed ? "true" : "false");
  }
}

function syncRunPanelModeToTrigger() {
  if (!runControls.modeInput || !triggerControls.mode) {
    return;
  }
  if (triggerControls.mode.value === "None") {
    return;
  }
  const runMode = runControls.modeInput.value;
  if (runMode === "Auto" || runMode === "Normal" || runMode === "Single") {
    triggerControls.mode.value = runMode;
  }
}

function syncTriggerModeToRunPanel() {
  if (!runControls.modeInput || !triggerControls.mode) {
    return;
  }
  const triggerMode = triggerControls.mode.value;
  if (triggerMode === "Auto" || triggerMode === "Normal" || triggerMode === "Single") {
    runControls.modeInput.value = triggerMode;
  }
}

function startAcquisitionStream() {
  if (isStreamStopped() && acquisitionControls.rate) {
    acquisitionControls.rate.value = runState.lastRunningRateLabel || "40 kHz";
    applyAcquisitionSettings();
    syncTimePerDivFromRate();
    updateAcquisitionInfo();
    saveAcquisitionSettings();
  }
  runState.running = true;
  runState.singleArmed = false;
  runState.lastRunningSampleRate = getSampleRate();
  updateRunButtonUi();
  markUserAcquisitionDirty();
  scheduleStreamApply();
  if (!isStreamStopped()) {
    const mode = triggerControls.mode ? triggerControls.mode.value : "None";
    setTriggerStatus(mode === "None" ? "Free run" : "Running");
  }
}

function stopAcquisitionStream(statusText) {
  if (!isStreamStopped() && acquisitionControls.rate) {
    runState.lastRunningRateLabel = acquisitionControls.rate.value;
    runState.lastRunningSampleRate = getSampleRate();
    acquisitionControls.rate.value = "0 Hz";
    applyAcquisitionSettings();
    syncTimePerDivFromRate();
    updateAxisLabels();
    updateTriggerOverlay();
    updateAcquisitionInfo();
    saveAcquisitionSettings();
    scheduleStreamApply();
  }
  runState.running = false;
  runState.singleArmed = false;
  runState.resumeStreamOnConnect = false;
  updateRunButtonUi();
  setTriggerStatus(statusText || "Stopped");
}

function armSingleCapture() {
  const triggerWasNone = isNoneTriggerMode();
  if (runControls.modeInput) {
    runControls.modeInput.value = "Single";
  }
  if (triggerControls.mode && !triggerWasNone) {
    triggerControls.mode.value = "Single";
  }
  resetTriggerState();
  startAcquisitionStream();
  runState.singleArmed = true;
  setTriggerStatus(triggerWasNone ? "Single run" : "Single armed");
  updateRunButtonUi();
}

function setupRunControls() {
  // Keep Trigger_Mode as authored in HTML (default None); do not overwrite from
  // the Run panel's Repeated/Screen/Record selector on first load.
  syncTriggerModeToRunPanel();
  if (isNoneTriggerMode()) {
    resetNoneTriggerViewAnchor();
    applyNoneFixedTriggerLevel();
  }
  syncNoneTriggerUi();
  updateTriggerOverlay();

  if (runControls.runButton) {
    runControls.runButton.addEventListener("click", function () {
      if (runState.running && !isStreamStopped()) {
        stopAcquisitionStream("Stopped");
      } else {
        runState.singleArmed = false;
        startAcquisitionStream();
      }
    });
  }

  if (runControls.singleButton) {
    runControls.singleButton.addEventListener("click", function () {
      armSingleCapture();
    });
  }

  if (runControls.modeInput) {
    runControls.modeInput.addEventListener("change", function () {
      syncRunPanelModeToTrigger();
      resetTriggerState();
      updateTriggerOverlay();
      const mode = triggerControls.mode ? triggerControls.mode.value : "None";
      if (mode === "None") {
        setTriggerStatus("Free run");
      } else if (mode === "Single") {
        setTriggerStatus("Single ready");
      } else if (mode === "Normal") {
        setTriggerStatus("Screen (Normal)");
      } else {
        setTriggerStatus("Repeated (Auto)");
      }
    });
  }

  if (!isStreamStopped()) {
    runState.lastRunningRateLabel = acquisitionControls.rate ? acquisitionControls.rate.value : runState.lastRunningRateLabel;
  }
  updateRunButtonUi();
}

function loadAcquisitionSettings() {
  if (!window.localStorage) {
    return;
  }
  try {
    const raw = window.localStorage.getItem(acquisitionSettingsStorageKey);
    if (!raw) {
      return;
    }
    const saved = JSON.parse(raw);
    if (acquisitionControls.samples && Number.isFinite(saved.samples)) {
      acquisitionControls.samples.value = String(saved.samples);
    }
    if (acquisitionControls.rate && typeof saved.rateLabel === "string" && saved.rateLabel) {
      acquisitionControls.rate.value = saved.rateLabel;
    }
  } catch {
    // Ignore malformed persisted settings.
  }
}

function saveAcquisitionSettings() {
  if (!window.localStorage) {
    return;
  }
  try {
    const payload = {
      samples: window.LABSOFT_SAMPLE_COUNT || 2000,
      rateLabel: window.LABSOFT_SAMPLE_RATE_LABEL || (acquisitionControls.rate ? acquisitionControls.rate.value : "200 kHz")
    };
    window.localStorage.setItem(acquisitionSettingsStorageKey, JSON.stringify(payload));
  } catch {
    // Ignore storage failures in private or restricted browsing modes.
  }
}

// Rolling ingest/display FPS counters.
let ingestFpsCount = 0;
let ingestFpsLastSampleTime = 0;
let ingestFpsValue = 0;
let displayFpsCount = 0;
let displayFpsLastSampleTime = 0;
let displayFpsValue = 0;

function recordIngestFps() {
  ingestFpsCount += 1;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (ingestFpsLastSampleTime === 0) {
    ingestFpsLastSampleTime = now;
    return;
  }
  const elapsed = now - ingestFpsLastSampleTime;
  if (elapsed >= 500) {
    ingestFpsValue = (ingestFpsCount * 1000) / elapsed;
    ingestFpsCount = 0;
    ingestFpsLastSampleTime = now;
  }
}

function recordDisplayFps() {
  displayFpsCount += 1;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (displayFpsLastSampleTime === 0) {
    displayFpsLastSampleTime = now;
    return;
  }
  const elapsed = now - displayFpsLastSampleTime;
  if (elapsed >= 500) {
    displayFpsValue = (displayFpsCount * 1000) / elapsed;
    displayFpsCount = 0;
    displayFpsLastSampleTime = now;
  }
}

function formatFpsValue(value) {
  return value > 0 ? value.toFixed(1) : "--";
}

const WS_RX_ROLLING_MS = 500;
let wsRxAdcsBytesAcc = 0;
let wsRxTotalBytesAcc = 0;
let wsRxLastSampleTime = 0;
let wsRxAdcsBps = 0;
let wsRxTotalBps = 0;

function resetWsRxThroughput() {
  wsRxAdcsBytesAcc = 0;
  wsRxTotalBytesAcc = 0;
  wsRxLastSampleTime = 0;
  wsRxAdcsBps = 0;
  wsRxTotalBps = 0;
}

function tickWsRxThroughput(adcsBytes, totalBytes) {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (adcsBytes > 0) {
    wsRxAdcsBytesAcc += adcsBytes;
  }
  if (totalBytes > 0) {
    wsRxTotalBytesAcc += totalBytes;
  }
  if (wsRxLastSampleTime === 0) {
    wsRxLastSampleTime = now;
    return;
  }
  const elapsed = now - wsRxLastSampleTime;
  if (elapsed >= WS_RX_ROLLING_MS) {
    wsRxAdcsBps = (wsRxAdcsBytesAcc * 1000) / elapsed;
    wsRxTotalBps = (wsRxTotalBytesAcc * 1000) / elapsed;
    wsRxAdcsBytesAcc = 0;
    wsRxTotalBytesAcc = 0;
    wsRxLastSampleTime = now;
    updateAcquisitionInfo();
  }
}

function ingestWsRxTotal(byteLength) {
  const n = Number(byteLength);
  if (Number.isFinite(n) && n > 0) {
    tickWsRxThroughput(0, n);
  }
}

function recordWsRxAdcsBytes(byteLength) {
  const n = Number(byteLength);
  if (Number.isFinite(n) && n > 0) {
    tickWsRxThroughput(n, 0);
  }
}

function formatThroughputMbps(bytesPerSec) {
  if (!(bytesPerSec > 0) || !Number.isFinite(bytesPerSec)) {
    return "--";
  }
  return (bytesPerSec * 8 / 1e6).toFixed(2);
}

function formatThroughputKibPerSec(bytesPerSec) {
  if (!(bytesPerSec > 0) || !Number.isFinite(bytesPerSec)) {
    return "--";
  }
  return (bytesPerSec / 1024).toFixed(0);
}

function getTheoreticalAdcsBps(appliedRateHz, sampleCount) {
  if (!(appliedRateHz > 0) || !(sampleCount > 0)) {
    return 0;
  }
  return appliedRateHz * (4 + 48 / sampleCount);
}

const WS_FEAT_RNDIS = 0x80;

const serverMetrics = {
  appliedRate: 0,
  appliedCount: 0,
  flags: 0,
  seq: 0,
  drops: 0,
  overruns: 0,
  vrefMv: 0,
  maxRate: 0,
  maxSamps: 0,
  features: 0,
  rndisTxBps: 0,
  rndisRxBps: 0,
  mode: "--",
  rttMs: 0,
  pingLive: false,
  pingUpdatedAt: 0
};

const packetMetrics = {
  seq: 0,
  lastSeq: null,
  seqGap: 0,
  drops: 0,
  overruns: 0,
  flags: 0,
  periodNs: 0,
  vrefMv: 0,
  lastBatchTime: 0,
  lastBatchUs: 0,
  batchFps: 0,
  rateMismatch: 0
};

const connectionState = {
  connected: false,
  detail: "Connecting",
  attempt: 0
};

let serverStatusSynced = false;
let userAcquisitionDirty = false;
let lastIngestSeq = 0;
let lastDecodeUs = 0;
let lastRenderUs = 0;
let lastMetricsSeq = 0;

function syncAcquisitionUiFromServerStatus() {
  const rate = serverMetrics.appliedRate;
  const count = serverMetrics.appliedCount;
  if (!(rate > 0) || !(count > 0)) {
    return;
  }

  window.LABSOFT_SAMPLE_RATE = rate;
  window.LABSOFT_SAMPLE_COUNT = count;
  window.LABSOFT_SAMPLE_RATE_LABEL = formatSamplingRate(rate);
  window.LABSOFT_DISPLAY_SAMPLES = computeDisplaySampleCount(count);

  if (acquisitionControls.rate) {
    acquisitionControls.rate.value = formatSamplingRate(rate);
  }
  if (acquisitionControls.samples) {
    acquisitionControls.samples.value = String(count);
  }

  lastStreamAppliedRate = rate;
  lastStreamAppliedCount = count;
  syncTimePerDivFromRate();
  updateGrid();
}

function readAdctSeqFromFrame(frameView, byteLength) {
  if (byteLength < 16) {
    return 0;
  }
  const packetCount = frameView.getUint32(8, false);
  const trailerOff = 16 + packetCount * 4;
  if (byteLength < trailerOff + 8) {
    return 0;
  }
  if (frameView.getUint32(trailerOff, false) !== 0x41444354) {
    return 0;
  }
  return frameView.getUint32(trailerOff + 4, false);
}

function reportClientMetrics(decodeUs, renderUs, seq) {
  if (typeof window.LABSOFT_sendMetrics !== "function") {
    return;
  }
  try {
    window.LABSOFT_sendMetrics(
      Math.max(0, Math.round(decodeUs)),
      Math.max(0, Math.round(renderUs)),
      Math.max(0, Math.round(seq))
    );
  } catch {
    // Ignore transient send failures.
  }
}

function serverModeFromFlags(flags) {
  return flags & 0x2 ? "DMA" : "single";
}

function setLiveVrefFromMilliVolts(vrefMv) {
  if (!(vrefMv > 0)) {
    return;
  }
  const prevVref = liveVrefVolts;
  liveVrefVolts = vrefMv / 1000;
  adcToVolts = liveVrefVolts / 4096.0;
  if (!Number.isFinite(window.LABSOFT_DC_OFFSET)) {
    dcOffsetVolts = liveVrefVolts / 2;
  }
  if (Math.abs(prevVref - liveVrefVolts) > 1e-9) {
    if (typeof refreshConfig === "function") {
      refreshConfig();
    }
    if (typeof refreshDisplayFromLastFrame === "function") {
      refreshDisplayFromLastFrame();
    }
  }
}

function formatRttMs(rttMs, live) {
  if (!connectionState.connected) {
    return "Disconnected";
  }
  if (!(rttMs > 0) || !Number.isFinite(rttMs)) {
    return "--";
  }
  const text = `${rttMs.toFixed(1)} ms`;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const age = now - (serverMetrics.pingUpdatedAt || 0);
  const isLive = !!live && age < 6000;
  return isLive ? `${text} (live)` : text;
}

function ingestLivePing(ping) {
  if (!ping) {
    return;
  }
  const rttMs = Number(ping.rttMs);
  if (Number.isFinite(rttMs) && rttMs > 0) {
    serverMetrics.rttMs = rttMs;
    serverMetrics.pingLive = !!ping.live;
    serverMetrics.pingUpdatedAt =
      typeof performance !== "undefined" ? performance.now() : Date.now();
  } else if (!ping.live && serverMetrics.rttMs > 0) {
    serverMetrics.pingLive = false;
  }
  updateAcquisitionInfo();
}

function ingestServerStatus(status) {
  if (!status) {
    return;
  }
  markConnectionAlive("Connected");
  const prevAppliedRate = serverMetrics.appliedRate;
  const prevMaxRate = serverMetrics.maxRate;
  const wasDisplayZoom = isDisplayZoomMode();
  serverMetrics.appliedRate = status.appliedRate || 0;
  serverMetrics.appliedCount = status.appliedCount || 0;
  serverMetrics.flags = status.flags || 0;
  serverMetrics.seq = status.seq || 0;
  serverMetrics.drops = status.drops || 0;
  serverMetrics.overruns = status.overruns || 0;
  serverMetrics.vrefMv = status.vrefMv || 0;
  serverMetrics.maxRate = status.maxRate || 0;
  serverMetrics.maxSamps = status.maxSamps || 0;
  serverMetrics.features = status.features || 0;
  if (serverMetrics.features & WS_FEAT_RNDIS) {
    serverMetrics.rndisTxBps = status.rndisTxBps || 0;
    serverMetrics.rndisRxBps = status.rndisRxBps || 0;
  } else {
    serverMetrics.rndisTxBps = 0;
    serverMetrics.rndisRxBps = 0;
  }
  serverMetrics.mode = serverModeFromFlags(serverMetrics.flags);
  if (Number.isFinite(status.rttMs) && status.rttMs > 0) {
    serverMetrics.rttMs = status.rttMs;
    serverMetrics.pingLive = true;
    serverMetrics.pingUpdatedAt =
      typeof performance !== "undefined" ? performance.now() : Date.now();
  }
  setLiveVrefFromMilliVolts(serverMetrics.vrefMv);
  onCaptureRateChanged(prevAppliedRate, serverMetrics.appliedRate);
  const firstSync =
    !serverStatusSynced && serverMetrics.appliedRate > 0 && serverMetrics.appliedCount > 0;
  if (firstSync) {
    if (!userAcquisitionDirty) {
      syncAcquisitionUiFromServerStatus();
    } else {
      applyAcquisitionSettings();
    }
    serverStatusSynced = true;
    if (typeof window.LABSOFT_ackServerSync === "function") {
      try {
        window.LABSOFT_ackServerSync();
      } catch {
        // Ping loop will start on next successful call.
      }
    }
    const requestedRate = getSampleRate();
    const requestedCount = getAcquisitionSampleCount();
    const needsSet =
      userAcquisitionDirty ||
      requestedRate !== serverMetrics.appliedRate ||
      requestedCount !== serverMetrics.appliedCount;
    if (needsSet) {
      applyStreamAcquisition();
    }
  }
  if (prevMaxRate !== serverMetrics.maxRate && serverMetrics.maxRate > 0) {
    resetDisplayZoomState();
    syncTimePerDivFromRate();
    startDisplayWindowAnimation();
    updateGrid();
    refreshDisplayFromLastFrame();
  } else if (
    wasDisplayZoom &&
    !isDisplayZoomMode()
  ) {
    resetDisplayZoomState();
    syncTimePerDivFromRate();
    startDisplayWindowAnimation();
    updateGrid();
    refreshDisplayFromLastFrame();
  } else if (
    !isDisplayZoomMode() &&
    serverMetrics.appliedRate > 0 &&
    prevAppliedRate !== serverMetrics.appliedRate
  ) {
    resetDisplayZoomState();
    syncTimePerDivFromRate();
    updateGrid();
    refreshDisplayFromLastFrame();
  }
  updateServerSetGlobals();
  updateAcquisitionInfo();
}

function ingestPacketMetrics(metrics) {
  if (!metrics) {
    return;
  }
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const seq = metrics.seq || 0;
  if (packetMetrics.lastSeq != null && seq > packetMetrics.lastSeq) {
    packetMetrics.seqGap = seq - packetMetrics.lastSeq - 1;
  } else {
    packetMetrics.seqGap = 0;
  }
  if (packetMetrics.lastBatchTime > 0 && seq >= (packetMetrics.lastSeq || 0)) {
    const dt = now - packetMetrics.lastBatchTime;
    if (dt > 0) {
      packetMetrics.batchFps = 1000 / dt;
      packetMetrics.lastBatchUs = dt * 1000;
    }
  }
  packetMetrics.lastBatchTime = now;
  packetMetrics.lastSeq = seq;
  packetMetrics.seq = seq;
  packetMetrics.drops = metrics.drops || 0;
  packetMetrics.overruns = metrics.overruns || 0;
  packetMetrics.flags = metrics.flags || 0;
  packetMetrics.periodNs = metrics.periodNs || 0;
  packetMetrics.vrefMv = metrics.vrefMv || 0;
  setLiveVrefFromMilliVolts(packetMetrics.vrefMv);
  updateAcquisitionInfo();
}

function coerceConnected(value) {
  return value === true || value === 1 || value === "true";
}

function normalizeConnectionStatus(a, b, c) {
  if (typeof a === "boolean" || typeof a === "number" || a === "true" || a === "false") {
    return {
      connected: coerceConnected(a),
      detail: typeof b === "string" ? b : "",
      attempt: Number(c) || 0
    };
  }
  if (a && typeof a === "object") {
    let connected = a.connected;
    let detail = a.detail;
    let attempt = a.attempt;
    if (typeof a.get === "function") {
      if (connected === undefined) {
        connected = a.get("connected");
      }
      if (detail === undefined) {
        detail = a.get("detail");
      }
      if (attempt === undefined) {
        attempt = a.get("attempt");
      }
    }
    return {
      connected: coerceConnected(connected),
      detail: detail != null ? String(detail) : "",
      attempt: Number(attempt) || 0
    };
  }
  return { connected: false, detail: "", attempt: 0 };
}

function markConnectionAlive(detail) {
  connectionState.connected = true;
  if (detail) {
    connectionState.detail = detail;
  } else if (!connectionState.detail || connectionState.detail === "Connecting") {
    connectionState.detail = "Connected";
  }
}

function formatConnectionStatus() {
  if (connectionState.connected) {
    if (!serverStatusSynced) {
      return connectionState.detail || "Connected (syncing)";
    }
    return "Online";
  }
  if (connectionState.detail) {
    return connectionState.detail;
  }
  return connectionState.attempt > 0 ? `Reconnecting (${connectionState.attempt})` : "Waiting for server";
}

function restoreTriggerStatusAfterConnect() {
  const mode = triggerControls.mode ? triggerControls.mode.value : "None";
  if (mode === "None") {
    setTriggerStatus(runState.singleArmed ? "Single run" : "Free run");
  } else if (mode === "Single") {
    setTriggerStatus(runState.singleArmed ? "Single armed" : "Single ready");
  } else if (mode === "Normal") {
    setTriggerStatus(triggerState.waitingForTrigger ? "Waiting (Normal)" : "Screen (Normal)");
  } else {
    setTriggerStatus("Repeated (Auto)");
  }
}

function markConnectionLost() {
  serverStatusSynced = false;
  userAcquisitionDirty = false;
  serverMetrics.pingLive = false;
  serverMetrics.rttMs = 0;
  ingestFpsValue = 0;
  ingestFpsCount = 0;
  ingestFpsLastSampleTime = 0;
  lastIngestSeq = 0;
  resetWsRxThroughput();
}

function resumeOscilloscopeAfterReconnect() {
  runState.resumeStreamOnConnect = false;
  runState.running = true;
  serverStatusSynced = true;
  markUserAcquisitionDirty();

  if (isStreamStopped() && acquisitionControls.rate && runState.lastRunningRateLabel) {
    acquisitionControls.rate.value = runState.lastRunningRateLabel;
    applyAcquisitionSettings();
    syncTimePerDivFromRate();
  }

  ensureFrameBufferCapacity(getMaxDisplaySampleCount() + 1);
  if (isNoneTriggerMode()) {
    resetNoneTriggerViewAnchor();
  } else {
    resetTriggerState();
  }
  updateTriggerSliderRange();
  updateGrid();
  updateTriggerOverlay();

  if (typeof window.LABSOFT_setAcquisition === "function") {
    try {
      window.LABSOFT_setAcquisition(getServerSetRateHz(), getAcquisitionSampleCount());
    } catch (err) {
      // WASM onopen also resumes streaming when the socket comes back.
    }
  }

  runState.lastRunningSampleRate = getSampleRate();
  updateRunButtonUi();
  restoreTriggerStatusAfterConnect();
  updateAcquisitionInfo();
}

function ingestConnectionStatus(status, detail, attempt) {
  const parsed = normalizeConnectionStatus(status, detail, attempt);
  connectionState.connected = parsed.connected;
  connectionState.detail = parsed.detail;
  connectionState.attempt = parsed.attempt;
  if (connectionState.connected) {
    if (runState.resumeStreamOnConnect) {
      resumeOscilloscopeAfterReconnect();
    } else {
      restoreTriggerStatusAfterConnect();
    }
  } else {
    markConnectionLost();
    if (runState.running && !isStreamStopped()) {
      runState.resumeStreamOnConnect = true;
      if (acquisitionControls.rate) {
        runState.lastRunningRateLabel = acquisitionControls.rate.value;
      }
      runState.lastRunningSampleRate = getSampleRate();
      setTriggerStatus(formatConnectionStatus());
    }
  }
  updateAcquisitionInfo();
}

window.ingestServerStatus = ingestServerStatus;
window.ingestPacketMetrics = ingestPacketMetrics;
window.ingestLivePing = ingestLivePing;
window.ingestConnectionStatus = ingestConnectionStatus;
window.ingestWsRxTotal = ingestWsRxTotal;

function updateAcquisitionInfo() {
  if (!acquisitionInfo) {
    return;
  }
  const sampleCount = getAcquisitionSampleCount();
  const requestedRate = getRequestedRateHz();
  const appliedRate = getAppliedRateHz() || requestedRate;
  const maxRate = getMaxRateHz();
  const displayRate = getDisplayRateHz();
  const nominalDisplay = getVisibleSampleCount();
  const effectiveDisplay = getDisplayRenderCount(nominalDisplay);
  const maxDisplay = getMaxDisplaySampleCount();
  const headroom = Math.max(0, sampleCount - maxDisplay);
  const captureSeconds = appliedRate > 0 ? sampleCount / appliedRate : 0;
  const visibleWindowSeconds = displayRate > 0 ? (effectiveDisplay - 1) / displayRate : 0;
  const effectiveTimePerDiv = visibleWindowSeconds / horizontalDivisions;
  const displayZoom = isDisplayZoomMode();
  const targetIngestFps = appliedRate > 0 && sampleCount > 0 ? appliedRate / sampleCount : 0;
  const liveCeilingKhz =
    ingestFpsValue > 0 && sampleCount > 0 ? (ingestFpsValue * sampleCount) / 1000 : 0;
  let captureRateText;
  if (displayZoom) {
    captureRateText =
      `${formatSamplingRate(appliedRate)} (display ${formatSamplingRate(requestedRate)}, hw max ${formatSamplingRate(maxRate || appliedRate)})`;
  } else {
    const rateMismatch =
      requestedRate > 0 &&
      appliedRate > 0 &&
      Math.abs(requestedRate - appliedRate) > Math.max(1, requestedRate * 0.02);
    captureRateText = rateMismatch
      ? `${formatSamplingRate(appliedRate)} (requested ${formatSamplingRate(requestedRate)})`
      : formatSamplingRate(appliedRate);
  }
  const dropsText = String(Math.max(serverMetrics.drops, packetMetrics.drops));
  const overrunsText = String(Math.max(serverMetrics.overruns, packetMetrics.overruns));
  const seqText = String(packetMetrics.seq || serverMetrics.seq || 0);
  let lagSuffix = "";
  if (targetIngestFps > 0 && ingestFpsValue > 0 && ingestFpsValue < targetIngestFps * 0.5) {
    lagSuffix =
      `   |   Client lagging (~${liveCeilingKhz.toFixed(1)} kHz live); consider lower rate or smaller N`;
  }
  if (targetIngestFps > 0 && ingestFpsValue > 0) {
    lagSuffix += `   |   Target ingest: ${formatFpsValue(targetIngestFps)} fps`;
  }

  const theoryN = serverMetrics.appliedCount > 0 ? serverMetrics.appliedCount : sampleCount;
  const theoreticalAdcsBps = getTheoreticalAdcsBps(appliedRate, theoryN);
  let utilizationPct = "";
  if (theoreticalAdcsBps > 0 && wsRxAdcsBps > 0) {
    utilizationPct = ` (${Math.min(999, (100 * wsRxAdcsBps) / theoreticalAdcsBps).toFixed(0)}%)`;
  }
  let throughputText =
    `   |   WS RX (ADCS): ${formatThroughputMbps(wsRxAdcsBps)} Mbps (${formatThroughputKibPerSec(wsRxAdcsBps)} KiB/s)` +
    `   |   WS RX (total): ${formatThroughputMbps(wsRxTotalBps)} Mbps (${formatThroughputKibPerSec(wsRxTotalBps)} KiB/s)` +
    `   |   Theory ADCS: ${formatThroughputMbps(theoreticalAdcsBps)} Mbps (${formatThroughputKibPerSec(theoreticalAdcsBps)} KiB/s) @ ${appliedRate} Hz, N=${theoryN}${utilizationPct}`;
  if (serverMetrics.features & WS_FEAT_RNDIS) {
    throughputText +=
      `   |   RNDIS TX (server→client): ${formatThroughputMbps(serverMetrics.rndisTxBps)} Mbps` +
      `   |   RNDIS RX (client→server): ${formatThroughputMbps(serverMetrics.rndisRxBps)} Mbps`;
  }

  const nextText =
    `Server: ${formatConnectionStatus()}` +
    `   |   Capture: ${sampleCount} samples @ ${captureRateText} = ${formatDuration(captureSeconds)}` +
    `   |   Display window: ${effectiveDisplay} samples (${formatDuration(visibleWindowSeconds)}, ${formatTimePerDiv(effectiveTimePerDiv)})` +
    `   |   Trigger headroom: ${headroom} samples (~70% shown, ~30% reserved for triggering)` +
    `   |   Ingest: ${formatFpsValue(ingestFpsValue)} fps` +
    `   |   Display: ${formatFpsValue(displayFpsValue)} fps` +
    throughputText +
    `   |   Seq: ${seqText}` +
    `   |   Drops: ${dropsText}` +
    `   |   Overruns: ${overrunsText}` +
    `   |   Ping: ${formatRttMs(serverMetrics.rttMs, serverMetrics.pingLive)}` +
    `   |   Vref: ${formatVrefVolts()}` +
    lagSuffix;
  if (acquisitionInfo.textContent !== nextText) {
    acquisitionInfo.textContent = nextText;
  }
}

function formatVrefVolts() {
  if (liveVrefVolts > 0) {
    return `${formatNumber(liveVrefVolts)} V (server)`;
  }
  return "--";
}

applyAcquisitionSettings();
loadAcquisitionSettings();
applyAcquisitionSettings();

const acquisitionSampleCount = getAcquisitionSampleCount();
const maxDisplaySampleCount = getMaxDisplaySampleCount();
window.LABSOFT_DISPLAY_POINTS = maxDisplaySampleCount;
if (!window.LABSOFT_SAMPLE_COUNT) {
  window.LABSOFT_SAMPLE_COUNT = acquisitionSampleCount;
}
let liveVrefVolts = window.LABSOFT_VREF || 5.0;
// 10 major divisions => 11 horizontal voltage grid lines (incl. center).
const verticalDivisions = 10;
const TRIGGER_LEVEL_MIN = -25;
const TRIGGER_LEVEL_MAX = 25;
const TRIGGER_LEVEL_STEP = 0.1;
let dcOffsetVolts = Number.isFinite(window.LABSOFT_DC_OFFSET)
  ? window.LABSOFT_DC_OFFSET
  : liveVrefVolts / 2;
const horizontalDivisions = 10;
let adcToVolts = liveVrefVolts / 4096.0;

function rawAdcVoltsFrom12(adc12) {
  return adc12 * adcToVolts;
}

function physicalVolts(rawAdcVolts) {
  return rawAdcVolts - dcOffsetVolts;
}
const wglp = new WebglPlotBundle.WebglPlot(canvas);
const gridMajorColor = "rgba(190, 194, 200, 0.32)";
const gridMinorTickColor = "rgba(190, 194, 200, 0.42)";
const minorDivisionsPerMajor = 9;
const minorTickLengthPx = 5;
const centerTickLengthPx = 10;
const gridMajorDash = [3, 3];
const color1 = new WebglPlotBundle.ColorRGBA(1, 1, 0, 1);
const color2 = new WebglPlotBundle.ColorRGBA(0, 0.808, 0.784, 1);
let line1 = null;
let line2 = null;
let plotPointCount = 0;
let lastRenderedCh1 = null;
let lastRenderedCh2 = null;
const scopeCursorEl = document.getElementById("Scope_Cursor");
const scopeCursorLine = scopeCursorEl ? scopeCursorEl.querySelector(".scope_cursor_line") : null;
const scopeCursorReadout = scopeCursorEl ? scopeCursorEl.querySelector(".scope_cursor_readout") : null;
const scopeCursor = { active: false, fraction: 0.5 };

const ch1Controls = {
  enable: document.getElementById("Ch1_Enable"),
  scale: document.getElementById("Scaling_Input_1"),
  range: document.getElementById("Range_Input_1"),
  offset: document.getElementById("V_Offset_Input_1")
};
const ch2Controls = {
  enable: document.getElementById("Ch2_Enable"),
  scale: document.getElementById("Scaling_Input_2"),
  range: document.getElementById("Range_Input_2"),
  offset: document.getElementById("V_Offset_Input_2")
};
const timePerDivControl = document.getElementById("time_per_div");
const hOffsetControl = document.getElementById("H_Offset_Value");
const runControls = {
  runButton: document.getElementById("Run_Button"),
  singleButton: document.getElementById("Single_Button"),
  modeInput: document.getElementById("Mode_Input")
};
const triggerControls = {
  mode: document.getElementById("Trigger_Mode"),
  source: document.getElementById("Trigger_Source"),
  type: document.getElementById("Trigger_Type"),
  slope: document.getElementById("Trigger_Condition"),
  position: document.getElementById("Trigger_Position"),
  level: document.getElementById("Trigger_Level"),
  hysteresis: document.getElementById("Trigger_Hysteresis"),
  holdoff: document.getElementById("Trigger_Holdoff"),
  autoTimeout: document.getElementById("Trigger_Auto_Timeout"),
  slider: document.getElementById("Trigger_Level_Slider"),
  value: document.getElementById("Trigger_Level_Value"),
  marker: document.getElementById("Trigger_Level_Marker"),
  positionMarker: document.getElementById("Trigger_Position_Marker"),
  status: document.getElementById("Trigger_Status")
};
const yLabelsHeader = document.getElementById("y_labels_header");
const yLabelsLeft = document.getElementById("y_labels_left");
const yLabelsRight = document.getElementById("y_labels_right");
const xLabels = document.getElementById("x_labels");

const channelConfig = {
  ch1: { enabled: true, scale: 1, vPerDiv: 1, offset: 0 },
  ch2: { enabled: true, scale: 1, vPerDiv: 1, offset: 0 }
};

const triggerConfig = {
  hysteresisVolts: 0.02,
  autoFallbackMs: 40,
  holdoffSamples: 12,
  normalWaitMs: 1500
};

const triggerState = {
  armed: false,
  lastTriggerIndex: 0,
  autoSearchStartedAt: 0,
  holdoffRemaining: 0,
  waitingForTrigger: false,
  hasDisplayedFrame: false,
  statusText: "Ready"
};

const runState = {
  running: true,
  singleArmed: false,
  resumeStreamOnConnect: false,
  lastRunningRateLabel: "40 kHz",
  lastRunningSampleRate: 40000
};

const TRIGGER_POSITION_FRACTIONS = {
  Left: 0.1,
  Center: 0.5,
  Right: 0.9
};
const NONE_FIXED_TRIGGER_LEVEL_VOLTS = 0;

let sampleOffset = 0;
let lastVisibleSampleCount = maxDisplaySampleCount;
let lastWindowStartIndex = 0;
let lastTriggerIndexInWindow = 0;
let lastSubSampleOffset = 0;
let lastGoodWindowStartIndex = 0;
let forcedMarkerFraction = null;
let lastIngestedFrameBytes = null;
let lastTriggeredFrameBytes = null;
let renderedFrameSequence = 0;

const nextFrameBuffer = {
  ch1: new Float32Array(Math.max(2, maxDisplaySampleCount + 1)),
  ch2: new Float32Array(Math.max(2, maxDisplaySampleCount + 1)),
  length: 0,
  sourceCount: 0,
  subSampleOffset: 0,
  triggerFractionInWindow: 0.5,
  sequence: 0,
  ready: false
};

window.nextFrameBuffer = nextFrameBuffer;

function getPlotPointCount() {
  const width = canvas && canvas.clientWidth > 0 ? canvas.clientWidth : maxDisplaySampleCount;
  return Math.max(2, Math.round(width));
}

function arrangeLineX(line) {
  const numPoints = line.numPoints;
  if (numPoints <= 1) {
    line.setX(0, 0);
    return;
  }
  for (let i = 0; i < numPoints; i++) {
    line.setX(i, -1 + (2 * i) / (numPoints - 1));
  }
}

function updateWebglViewport() {
  if (wglp && wglp.webgl && canvas) {
    wglp.webgl.viewport(0, 0, canvas.width, canvas.height);
  }
}

function ensurePlotLines(forceRebuild = false) {
  const targetCount = getPlotPointCount();
  if (!forceRebuild && line1 && line2 && plotPointCount === targetCount) {
    return targetCount;
  }
  wglp.removeDataLines();
  line1 = new WebglPlotBundle.WebglLine(color1, targetCount);
  line2 = new WebglPlotBundle.WebglLine(color2, targetCount);
  arrangeLineX(line1);
  arrangeLineX(line2);
  line1.visible = channelConfig.ch1.enabled;
  line2.visible = channelConfig.ch2.enabled;
  wglp.addLine(line1);
  wglp.addLine(line2);
  plotPointCount = targetCount;
  window.LABSOFT_PLOT_POINTS = targetCount;
  return targetCount;
}

function isNoneTriggerMode() {
  return !!(triggerControls.mode && triggerControls.mode.value === "None");
}

function getTriggerPositionFraction() {
  // None always uses Mid-Trigger (50%) for the smoothest free-run roll.
  if (isNoneTriggerMode()) {
    return TRIGGER_POSITION_FRACTIONS.Center;
  }
  const key = triggerControls.position ? triggerControls.position.value : "Center";
  return TRIGGER_POSITION_FRACTIONS[key] != null ? TRIGGER_POSITION_FRACTIONS[key] : 0.5;
}

function resetNoneTriggerViewAnchor() {
  forcedMarkerFraction = null;
}

function syncNoneTriggerUi() {
  if (triggerControls.position) {
    triggerControls.position.disabled = isNoneTriggerMode();
  }
  if (triggerControls.level) {
    triggerControls.level.disabled = isNoneTriggerMode();
  }
}

function applyNoneFixedTriggerLevel() {
  setTriggerLevelVolts(NONE_FIXED_TRIGGER_LEVEL_VOLTS, true);
}

function getNoneModeRollTriggerIndex(sourceLength, postTriggerSamples) {
  if (sourceLength <= 0) {
    return 0;
  }
  const ideal = sourceLength - 1 - postTriggerSamples;
  return Math.max(0, Math.min(sourceLength - 1, ideal));
}

function getVisibleSampleCount() {
  // The visible window is the full ~70% display buffer. Its *time span* is set
  // by the sampling rate (span = samples / rate). Time/Division is a linked
  // view of the same knob: changing Time/div rescales the sampling rate, and
  // changing the rate rescales Time/div (see rateForTimePerDiv / timePerDivForRate).
  const acquisitionCount = getAcquisitionSampleCount();
  const maxDisplay = getMaxDisplaySampleCount();
  return Math.max(2, Math.min(maxDisplay, acquisitionCount));
}

// Time/Division <-> Sampling Rate are two views of the same horizontal zoom for
// the fixed display window: span = (displaySamples - 1) / rate, Time/div = span / divisions.
function timePerDivForRate(rate) {
  const displayCount = getVisibleSampleCount();
  if (!(rate > 0) || displayCount < 2) {
    return 0;
  }
  return (displayCount - 1) / (rate * horizontalDivisions);
}

function rateForTimePerDiv(seconds) {
  const displayCount = getVisibleSampleCount();
  const span = seconds * horizontalDivisions;
  if (!(span > 0) || displayCount < 2) {
    return 0;
  }
  let rate = Math.round((displayCount - 1) / span);
  const maxRate = getMaxRateHz();
  if (maxRate > 0) {
    rate = Math.min(rate, maxRate);
  }
  return Math.min(MAX_SAMPLE_RATE, Math.max(0, rate));
}

let linkedStreamTimer = null;
function scheduleStreamApply() {
  // Debounce the device push so scrolling coalesces into one ctrlSet.
  if (linkedStreamTimer) {
    clearTimeout(linkedStreamTimer);
  }
  linkedStreamTimer = setTimeout(applyStreamAcquisition, 250);
}

function syncTimePerDivFromRate() {
  if (timePerDivControl && document.activeElement !== timePerDivControl) {
    timePerDivControl.value = formatTimePerDiv(timePerDivForRate(getTimebaseSampleRate()));
  }
}

function onSamplingRateCommitted() {
  markUserAcquisitionDirty();
  applyAcquisitionSettings();
  syncTimePerDivFromRate();
  startDisplayWindowAnimation();
  updateGrid();
  if (window.LABSOFT_DEMO_PREVIEW) {
    refreshDisplayFromLastFrame();
  }
  refreshPlotRender();
  updateAcquisitionInfo();
  saveAcquisitionSettings();
  scheduleStreamApply();
}

function syncRateFromTimePerDiv() {
  if (!acquisitionControls.rate || document.activeElement === acquisitionControls.rate) {
    return;
  }
  const info = parseTimePerDiv(timePerDivControl ? timePerDivControl.value : "");
  acquisitionControls.rate.value = formatSamplingRate(rateForTimePerDiv(info.seconds));
}

function getNominalSampleSpan() {
  return Math.max(1, getVisibleSampleCount() - 1);
}

function getEffectiveSampleSpan() {
  return Math.max(1, (lastVisibleSampleCount || getVisibleSampleCount()) - 1);
}

function fractionToOffsetSamples(markerFraction) {
  const nominalSpan = getNominalSampleSpan();
  const preTriggerSamples = Math.round(getTriggerPositionFraction() * nominalSpan);
  const targetIndexNominal = Math.round(markerFraction * nominalSpan);
  return preTriggerSamples - targetIndexNominal;
}

function offsetSamplesToMarkerFraction(offsetSamples) {
  const nominalSpan = getNominalSampleSpan();
  const preTriggerSamples = Math.round(getTriggerPositionFraction() * nominalSpan);
  return (preTriggerSamples - offsetSamples) / nominalSpan;
}

function getHorizontalOffsetSamples() {
  const offsetSeconds = parseTimeValue(hOffsetControl ? hOffsetControl.value : "0 s");
  const sampleRate = getTriggerSampleRateHz();
  if (!(sampleRate > 0) || !Number.isFinite(offsetSeconds)) {
    return 0;
  }
  return Math.round(offsetSeconds * sampleRate);
}

function isZeroHorizontalOffset() {
  const offsetSeconds = parseTimeValue(hOffsetControl ? hOffsetControl.value : "0 s");
  return !Number.isFinite(offsetSeconds) || Math.abs(offsetSeconds) < 1e-12;
}

function getDisplayedMarkerFraction() {
  if (Number.isFinite(forcedMarkerFraction)) {
    return Math.max(0, Math.min(1, forcedMarkerFraction));
  }
  if (isZeroHorizontalOffset()) {
    return getTriggerPositionFraction();
  }
  if (lastVisibleSampleCount > 1 && Number.isFinite(lastTriggerIndexInWindow)) {
    return lastTriggerIndexInWindow / (lastVisibleSampleCount - 1);
  }
  return getTriggerPositionFraction();
}

function getDragVisibleSampleSpan() {
  return getNominalSampleSpan();
}

function applyHorizontalOffsetFromMarkerFraction(target) {
  const offsetSamples = fractionToOffsetSamples(target);
  const sampleRate = getTriggerSampleRateHz();
  if (sampleRate > 0 && hOffsetControl) {
    hOffsetControl.value = formatOffsetTime(offsetSamples / sampleRate);
  }
  return offsetSamples;
}

function computeEffectiveWindow(triggerIndex, preTriggerSamples, hOffsetSamples, renderCount, sourceLength, markerFractionOverride) {
  const nominalSpan = Math.max(1, renderCount - 1);
  let targetFraction;
  if (Number.isFinite(markerFractionOverride)) {
    targetFraction = Math.max(0, Math.min(1, markerFractionOverride));
  } else {
    targetFraction = Math.max(0, Math.min(1, offsetSamplesToMarkerFraction(hOffsetSamples)));
  }
  const targetIndexInWindow = Math.round(targetFraction * nominalSpan);

  let windowStartFloat = triggerIndex - targetIndexInWindow;
  let effectiveRender = renderCount;

  if (windowStartFloat < 0) {
    windowStartFloat = 0;
    if (targetFraction > 0 && triggerIndex > 0) {
      effectiveRender = Math.min(
        sourceLength,
        Math.max(2, Math.round(triggerIndex / targetFraction) + 1)
      );
    }
  } else {
    const desiredEnd = windowStartFloat + effectiveRender;
    if (desiredEnd > sourceLength) {
      effectiveRender = Math.max(2, sourceLength - windowStartFloat);
    }
    const maxNominalStart = Math.max(0, sourceLength - renderCount);
    if (windowStartFloat > maxNominalStart) {
      effectiveRender = Math.max(2, sourceLength - windowStartFloat);
    }
  }

  const maxExtendedStart = Math.max(0, sourceLength - effectiveRender);
  windowStartFloat = Math.min(Math.max(0, windowStartFloat), maxExtendedStart);
  return { windowStartFloat, effectiveRender, targetIndexInWindow, targetFraction };
}

function syncHorizontalOffsetFromAchievedPlacement(preTriggerSamples, triggerIndex, windowStartFloat, effectiveRender) {
  if (!hOffsetControl || document.activeElement === hOffsetControl || Number.isFinite(forcedMarkerFraction)) {
    return;
  }
  const sampleRate = getTriggerSampleRateHz();
  if (!(sampleRate > 0)) {
    return;
  }
  const effectiveSpan = Math.max(1, effectiveRender - 1);
  const achievedFraction = Math.max(0, Math.min(1, (triggerIndex - windowStartFloat) / effectiveSpan));
  const achievedOffsetSamples = fractionToOffsetSamples(achievedFraction);
  const formatted = formatOffsetTime(achievedOffsetSamples / sampleRate);
  if (hOffsetControl.value !== formatted) {
    hOffsetControl.value = formatted;
  }
}

function refreshDisplayFromLastFrame() {
  const mode = triggerControls.mode ? triggerControls.mode.value : "None";
  const frozenWhileWaiting =
    (mode === "Normal" || mode === "Single") && triggerState.waitingForTrigger && lastTriggeredFrameBytes;
  const source = frozenWhileWaiting ? lastTriggeredFrameBytes : lastIngestedFrameBytes;
  if (source && source.byteLength > 0) {
    ingestWebSocketFrame(source);
  }
}

function applyLiveTriggerLevel(volts) {
  setTriggerLevelVolts(volts, true);
  if (isNoneTriggerMode()) {
    return;
  }
  // Re-lock the last acquisition at the new level immediately so dragging the
  // trigger line updates the trace this frame instead of waiting for the next packet.
  refreshDisplayFromLastFrame();
  if (nextFrameBuffer.ready && nextFrameBuffer.sequence !== renderedFrameSequence) {
    refreshPlotRender();
    renderedFrameSequence = nextFrameBuffer.sequence;
    nextFrameBuffer.ready = false;
    wglp.update();
  }
}

function syncTriggerTuningFromUi() {
  if (triggerControls.hysteresis) {
    triggerConfig.hysteresisVolts = Math.max(0, parseVolts(triggerControls.hysteresis.value));
  }
  if (triggerControls.holdoff) {
    const holdoff = parseInt(triggerControls.holdoff.value, 10);
    triggerConfig.holdoffSamples = Number.isFinite(holdoff) && holdoff >= 0 ? holdoff : 12;
  }
  if (triggerControls.autoTimeout) {
    const timeout = parseInt(triggerControls.autoTimeout.value, 10);
    triggerConfig.autoFallbackMs = Number.isFinite(timeout) && timeout > 0 ? timeout : 40;
  }
}

function setTriggerStatus(text) {
  if (triggerState.statusText === text) {
    return;
  }
  triggerState.statusText = text;
  if (triggerControls.status) {
    triggerControls.status.textContent = `Trigger: ${text}`;
  }
}

function getVisibleVoltageSpan(cfg) {
  const voltsPerDiv = cfg && Number.isFinite(cfg.vPerDiv) && cfg.vPerDiv > 0 ? cfg.vPerDiv : 1;
  return voltsPerDiv * (verticalDivisions / 2);
}

function updateTriggerSliderRange() {
  if (!triggerControls.slider) {
    return;
  }
  triggerControls.slider.min = String(TRIGGER_LEVEL_MIN);
  triggerControls.slider.max = String(TRIGGER_LEVEL_MAX);
  triggerControls.slider.step = String(TRIGGER_LEVEL_STEP);

  const currentValue = getTriggerLevelVolts();
  const limited = Math.max(TRIGGER_LEVEL_MIN, Math.min(TRIGGER_LEVEL_MAX, currentValue));
  triggerControls.slider.value = String(limited);

  if (triggerControls.level && document.activeElement !== triggerControls.level) {
    triggerControls.level.value = formatTriggerVolts(limited);
    triggerControls.level.classList.remove("invalid");
  }
}

function unpackSampleVolts(frameView, index, useCh2) {
  const raw = frameView.getUint32(16 + index * 4, false);
  const adc12 = useCh2 ? (((raw & 0xFFFF) >> 2) & 0x0FFF) : ((raw >> 18) & 0x0FFF);
  return physicalVolts(rawAdcVoltsFrom12(adc12));
}

function detectEdgeCrossing(previousSample, sample, slope, thresholdVolts, lowerBand, upperBand, armed) {
  const checkRising = slope === "Rising" || slope === "Either";
  const checkFalling = slope === "Falling" || slope === "Either";

  if (checkRising) {
    if (!armed.rising) {
      if (sample <= lowerBand) {
        armed.rising = true;
      }
    } else if (previousSample < thresholdVolts && sample >= thresholdVolts) {
      return {
        found: true,
        indexHint: "rising",
        threshold: thresholdVolts
      };
    }
  }

  if (checkFalling) {
    if (!armed.falling) {
      if (sample >= upperBand) {
        armed.falling = true;
      }
    } else if (previousSample > thresholdVolts && sample <= thresholdVolts) {
      return {
        found: true,
        indexHint: "falling",
        threshold: thresholdVolts
      };
    }
  }

  return { found: false };
}

function resolveTriggerFallback(mode, count) {
  if (triggerState.holdoffRemaining > 0) {
    triggerState.holdoffRemaining = Math.max(0, triggerState.holdoffRemaining - count);
    return { found: false, holdPrevious: true };
  }

  if (mode === "Normal") {
    return { found: false, holdPrevious: true };
  }

  if (mode === "Auto") {
    const now = (window.performance && typeof window.performance.now === "function") ? window.performance.now() : Date.now();
    if (!triggerState.autoSearchStartedAt) {
      triggerState.autoSearchStartedAt = now;
      return { found: false, holdPrevious: true };
    }
    if (now - triggerState.autoSearchStartedAt >= triggerConfig.autoFallbackMs) {
      triggerState.autoSearchStartedAt = 0;
      return { found: false, fallbackIndex: 0 };
    }
    return { found: false, holdPrevious: true };
  }

  if (mode === "Single") {
    return { found: false, holdPrevious: true };
  }

  return { found: false, fallbackIndex: 0 };
}

// Scans a full acquisition for a stable, phase-locked edge trigger.
// Arming is primed from the start of the buffer (so hysteresis history is
// correct), but a crossing is only ACCEPTED when its index falls inside
// [acceptStart, acceptEnd]. That guarantees there are always exactly the
// requested number of pre-trigger samples, so the window never has to be
// clamped/shifted -> the trace stays put frame to frame.
function findTriggerIndexFromPacket(frameView, sourceLength, acceptStart, acceptEnd, mode, slope, thresholdVolts, hysteresisVolts, sourceConfig) {
  const triggerType = triggerControls.type ? triggerControls.type.value : "Edge";
  if (triggerType !== "Edge") {
    setTriggerStatus(`${triggerType} not supported`);
    return { found: false, fallbackIndex: acceptStart };
  }

  const lowerBand = thresholdVolts - hysteresisVolts;
  const upperBand = thresholdVolts + hysteresisVolts;
  const useCh2 = sourceConfig === channelConfig.ch2;
  // Fresh arming per acquisition avoids carrying stale state between frames.
  const armed = { rising: false, falling: false };

  const scanEnd = Math.min(sourceLength, acceptEnd + 1);
  let previousSample = unpackSampleVolts(frameView, 0, useCh2);

  for (let i = 1; i < scanEnd; i++) {
    const sample = unpackSampleVolts(frameView, i, useCh2);

    const crossing = detectEdgeCrossing(previousSample, sample, slope, thresholdVolts, lowerBand, upperBand, armed);
    if (crossing.found) {
      if (i >= acceptStart) {
        triggerState.armed = false;
        triggerState.autoSearchStartedAt = 0;
        triggerState.holdoffRemaining = triggerConfig.holdoffSamples;
        return {
          found: true,
          index: interpolateTriggerIndex(previousSample, sample, crossing.threshold, i - 1, i)
        };
      }
      // Crossing happened too early (not enough pre-trigger room). Disarm that
      // direction so we lock onto the next equivalent edge instead.
      if (crossing.indexHint === "rising") {
        armed.rising = false;
      } else if (crossing.indexHint === "falling") {
        armed.falling = false;
      }
    }

    previousSample = sample;
  }

  return resolveTriggerFallback(mode, sourceLength);
}

function ingestWebSocketFrame(arrayBuffer) {
  if (!arrayBuffer) {
    return;
  }
  const decodeStart = typeof performance !== "undefined" ? performance.now() : Date.now();
  // Sampling rate 0 (or 0 samples) means "stopped": freeze on the last frame
  // and ignore any straggler packets that arrive before the device halts.
  if (isStreamStopped()) {
    return;
  }

  const frameView = new DataView(arrayBuffer);
  if (frameView.byteLength < 16) {
    return;
  }
  if (frameView.getUint32(0, false) !== 0x41444353) {
    return;
  }

  recordWsRxAdcsBytes(frameView.byteLength);

  const adctSeq = readAdctSeqFromFrame(frameView, frameView.byteLength);
  if (adctSeq > 0 && adctSeq === lastIngestSeq) {
    return;
  }
  if (adctSeq > 0) {
    lastIngestSeq = adctSeq;
    lastMetricsSeq = adctSeq;
  }

  markConnectionAlive("Connected");

  const packetSampleRate = frameView.getUint32(4, false);
  if (packetSampleRate > 0) {
    if (packetSampleRate !== lastPacketSampleRate) {
      onCaptureRateChanged(lastPacketSampleRate, packetSampleRate);
    }
    lastPacketSampleRate = packetSampleRate;
  }

  const packetCount = frameView.getUint32(8, false);
  const configuredAcquisitionCount = getAcquisitionSampleCount();
  const nominalRenderCount = Math.min(packetCount, configuredAcquisitionCount, getVisibleSampleCount());
  const renderCount = getDisplayRenderCount(nominalRenderCount);
  const sourceLength = Math.min(packetCount, configuredAcquisitionCount);
  const maxStartIndex = Math.max(0, sourceLength - renderCount);
  if (renderCount <= 0 || sourceLength <= 0) {
    return;
  }

  // Keep a copy so Horizontal Offset can re-place the last frame immediately
  // instead of waiting for the next WebSocket packet.
  lastIngestedFrameBytes = arrayBuffer.slice(0);

  ensureFrameBufferCapacity(sourceLength + 1);

  const mode = triggerControls.mode ? triggerControls.mode.value : "None";
  const source = triggerControls.source ? triggerControls.source.value : "Ch. 1";
  const slope = triggerControls.slope ? triggerControls.slope.value : "Rising";
  const triggerLevel = getTriggerLevelVolts();
  const sourceConfig = source === "Ch. 2" ? channelConfig.ch2 : channelConfig.ch1;
  const triggerFraction = getTriggerPositionFraction();
  const hOffsetSamples = getHorizontalOffsetSamples();

  // How many samples must sit before/after the trigger so it lands exactly at
  // the requested horizontal position (Post/Mid/Pre-Trigger).
  const preTriggerSamples = Math.round(triggerFraction * Math.max(0, renderCount - 1));
  const postTriggerSamples = Math.max(0, renderCount - 1 - preTriggerSamples);
  // Valid trigger indices keep the whole window inside the acquired buffer.
  const acceptStart = Math.min(preTriggerSamples, maxStartIndex + preTriggerSamples);
  const acceptEnd = Math.max(acceptStart, sourceLength - 1 - postTriggerSamples);

  // startIndexFloat is the (possibly fractional) first sample of the window.
  let startIndexFloat = getFreeRunWindowStart(maxStartIndex);
  let triggerIndex = preTriggerSamples;
  let triggered = false;

  if (mode === "None") {
    // Free-run: roll newest samples at Mid-Trigger; level is visual-only.
    triggerState.waitingForTrigger = false;
    triggerIndex = getNoneModeRollTriggerIndex(sourceLength, postTriggerSamples);
    startIndexFloat = Math.min(maxStartIndex, Math.max(0, triggerIndex - preTriggerSamples));
    triggerState.lastTriggerIndex = triggerIndex;
    setTriggerStatus(runState.singleArmed ? "Single run" : "Free run");
  } else {
    const triggerResult = findTriggerIndexFromPacket(
      frameView,
      sourceLength,
      acceptStart,
      acceptEnd,
      mode,
      slope,
      triggerLevel,
      triggerConfig.hysteresisVolts,
      sourceConfig
    );
    if (triggerResult.found) {
      triggerIndex = triggerResult.index;
      startIndexFloat = triggerIndex - preTriggerSamples;
      triggerState.lastTriggerIndex = triggerIndex;
      triggerState.waitingForTrigger = false;
      triggered = true;
      setTriggerStatus("Triggered");
      if (mode === "Normal" || mode === "Single") {
        lastTriggeredFrameBytes = arrayBuffer.slice(0);
      }
      if (mode === "Single") {
        runState.singleArmed = false;
        updateRunButtonUi();
        setTimeout(function () {
          stopAcquisitionStream("Single captured");
        }, 0);
      }
    } else if (triggerResult.holdPrevious) {
      triggerState.waitingForTrigger = true;
      if (mode === "Normal" || mode === "Single") {
        setTriggerStatus(mode === "Single" ? "Single armed" : "Waiting (Normal)");
        updateTriggerOverlay();
        updateAcquisitionInfo();
        // Freeze the plot on the last triggered frame until the next valid edge.
        return;
      }
      // Reuse the last stable trigger/window but still apply Horizontal Offset.
      triggerIndex = Number.isFinite(triggerState.lastTriggerIndex)
        ? triggerState.lastTriggerIndex
        : preTriggerSamples;
      startIndexFloat = prefersLiveTrailingWindow()
        ? maxStartIndex
        : Number.isFinite(lastGoodWindowStartIndex)
          ? lastGoodWindowStartIndex
          : 0;
      setTriggerStatus(mode === "Auto" ? "Waiting (Auto)" : "Waiting");
    } else {
      // Auto free-run / forced release: at high capture rates keep the trailing
      // window so live DMA batches plot coherently instead of freezing at index 0.
      startIndexFloat = getFreeRunWindowStart(maxStartIndex);
      triggerIndex = startIndexFloat + preTriggerSamples;
      triggerState.lastTriggerIndex = triggerIndex;
      triggerState.waitingForTrigger = mode !== "None";
      setTriggerStatus(mode === "Normal" ? "No trigger (show)" : "Auto roll");
    }
  }

  // Place the visible window from either the dragged marker or Horizontal Offset.
  const placement = computeEffectiveWindow(
    triggerIndex,
    preTriggerSamples,
    hOffsetSamples,
    renderCount,
    sourceLength,
    Number.isFinite(forcedMarkerFraction) ? forcedMarkerFraction : null
  );
  startIndexFloat = placement.windowStartFloat;
  const effectiveRender = placement.effectiveRender;
  const startIndex = Math.floor(startIndexFloat);
  // Sub-sample remainder is applied as a fractional horizontal shift at render
  // time, which is what makes a triggered trace look rock-steady.
  const subSampleOffset = startIndexFloat - startIndex;

  lastVisibleSampleCount = effectiveRender;
  lastWindowStartIndex = startIndexFloat;
  lastTriggerIndexInWindow = triggerIndex - startIndexFloat;
  lastSubSampleOffset = subSampleOffset;
  sampleOffset = hOffsetSamples;
  syncHorizontalOffsetFromAchievedPlacement(preTriggerSamples, triggerIndex, startIndexFloat, effectiveRender);
  if (triggered || mode === "None" || prefersLiveTrailingWindow()) {
    lastGoodWindowStartIndex = Math.min(Math.max(0, startIndexFloat), maxStartIndex);
  }

  // Copy one extra sample so the fractional shift has data to interpolate into.
  const copyCount = Math.min(effectiveRender + 1, sourceLength - startIndex);
  const baseOffset = 16 + startIndex * 4;
  for (let i = 0; i < copyCount; i++) {
    const raw = frameView.getUint32(baseOffset + i * 4, false);
    const adc1 = (raw >> 18) & 0x0FFF;
    const adc2 = ((raw & 0xFFFF) >> 2) & 0x0FFF;
    nextFrameBuffer.ch1[i] = physicalVolts(rawAdcVoltsFrom12(adc1));
    nextFrameBuffer.ch2[i] = physicalVolts(rawAdcVoltsFrom12(adc2));
  }

  nextFrameBuffer.length = effectiveRender;
  nextFrameBuffer.sourceCount = copyCount;
  nextFrameBuffer.subSampleOffset = subSampleOffset;
  nextFrameBuffer.triggerFractionInWindow =
    effectiveRender > 1 ? (triggerIndex - startIndexFloat) / (effectiveRender - 1) : getTriggerPositionFraction();
  nextFrameBuffer.sequence += 1;
  nextFrameBuffer.ready = true;
  triggerState.hasDisplayedFrame = true;
  lastDecodeUs = ((typeof performance !== "undefined" ? performance.now() : Date.now()) - decodeStart) * 1000;
  recordIngestFps();
  updateTriggerOverlay();
  updateAxisLabels();
  updateAcquisitionInfo();

  if (runState.singleArmed && mode === "None") {
    runState.singleArmed = false;
    updateRunButtonUi();
    setTimeout(function () {
      stopAcquisitionStream("Single captured");
    }, 0);
  }
}

window.ingestWebSocketFrame = ingestWebSocketFrame;

function ensureFrameBufferCapacity(count) {
  if (nextFrameBuffer.ch1.length < count) {
    nextFrameBuffer.ch1 = new Float32Array(count);
    nextFrameBuffer.ch2 = new Float32Array(count);
  }
}

function resampleWindow(source, windowSampleCount, startOffset, availableCount, targetCount) {
  const output = new Float32Array(targetCount);
  if (windowSampleCount <= 0 || targetCount <= 0 || availableCount <= 0) {
    return output;
  }
  const maxSourceIndex = availableCount - 1;
  const spanIntervals = Math.max(1, windowSampleCount - 1);
  const maxTargetIndex = Math.max(1, targetCount - 1);
  for (let i = 0; i < targetCount; i++) {
    let position = startOffset + (i / maxTargetIndex) * spanIntervals;
    if (position < 0) {
      position = 0;
    } else if (position > maxSourceIndex) {
      position = maxSourceIndex;
    }
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.min(maxSourceIndex, lowerIndex + 1);
    const fraction = position - lowerIndex;
    output[i] = source[lowerIndex] + (source[upperIndex] - source[lowerIndex]) * fraction;
  }
  return output;
}

// Display zoom: shorter display-time span anchored at the trigger fraction so the
// marker, axis labels, and waveform stay aligned.
function resampleWindowDisplayZoom(
  source,
  subOffset,
  availableCount,
  targetCount,
  windowSampleCount,
  displayRate,
  appliedRate,
  triggerFraction
) {
  const output = new Float32Array(targetCount);
  if (targetCount <= 0 || availableCount <= 0 || windowSampleCount <= 0) {
    return output;
  }
  if (!(displayRate > 0) || !(appliedRate > 0)) {
    return resampleWindow(source, windowSampleCount, subOffset, availableCount, targetCount);
  }
  const windowSpan = Math.max(1, windowSampleCount - 1);
  const maxSourceIndex = availableCount - 1;
  const maxTargetIndex = Math.max(1, targetCount - 1);
  const anchorFraction = Math.max(0, Math.min(1, triggerFraction));
  const visibleSpanDisplaySec = windowSpan / displayRate;

  for (let i = 0; i < targetCount; i++) {
    const plotFraction = i / maxTargetIndex;
    const relativeIndex =
      anchorFraction * windowSpan + (plotFraction - anchorFraction) * visibleSpanDisplaySec * appliedRate;
    let position = subOffset + relativeIndex;
    if (position < 0) {
      position = 0;
    } else if (position > maxSourceIndex) {
      position = maxSourceIndex;
    }
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.min(maxSourceIndex, lowerIndex + 1);
    const fraction = position - lowerIndex;
    output[i] = source[lowerIndex] + (source[upperIndex] - source[lowerIndex]) * fraction;
  }
  return output;
}

function renderFrameBuffer(frame) {
  const windowSampleCount = Math.max(1, frame.length);
  const availableCount = Math.min(frame.sourceCount || frame.length, frame.ch1.length, frame.ch2.length);
  if (availableCount <= 0) {
    return;
  }
  ensurePlotLines();
  const subOffset = Number.isFinite(frame.subSampleOffset) ? frame.subSampleOffset : 0;
  let resampledCh1;
  let resampledCh2;
  if (needsDisplayZoomResample()) {
    const displayRate = getEffectiveDisplayRateHz();
    const appliedRate = getTriggerSampleRateHz();
    const triggerFraction = getTriggerFractionInFrame(frame);
    resampledCh1 = resampleWindowDisplayZoom(
      frame.ch1, subOffset, availableCount, plotPointCount, windowSampleCount, displayRate, appliedRate, triggerFraction
    );
    resampledCh2 = resampleWindowDisplayZoom(
      frame.ch2, subOffset, availableCount, plotPointCount, windowSampleCount, displayRate, appliedRate, triggerFraction
    );
  } else {
    resampledCh1 = resampleWindow(frame.ch1, windowSampleCount, subOffset, availableCount, plotPointCount);
    resampledCh2 = resampleWindow(frame.ch2, windowSampleCount, subOffset, availableCount, plotPointCount);
  }
  lastRenderedCh1 = resampledCh1;
  lastRenderedCh2 = resampledCh2;
  for (let i = 0; i < plotPointCount; i++) {
    line1.setY(i, channelConfig.ch1.enabled ? voltsToY(resampledCh1[i], channelConfig.ch1) : 0);
    line2.setY(i, channelConfig.ch2.enabled ? voltsToY(resampledCh2[i], channelConfig.ch2) : 0);
  }
  line1.visible = channelConfig.ch1.enabled;
  line2.visible = channelConfig.ch2.enabled;
  if (scopeCursor.active) {
    updateScopeCursorUi();
  }
}

function getTriggerLevelVolts() {
  if (isNoneTriggerMode()) {
    return NONE_FIXED_TRIGGER_LEVEL_VOLTS;
  }
  if (triggerControls.slider) {
    const sliderValue = parseFloat(triggerControls.slider.value);
    if (Number.isFinite(sliderValue)) {
      return sliderValue;
    }
  }
  return parseVolts(triggerControls.level ? triggerControls.level.value : "0 V");
}

function setTriggerLevelVolts(volts, syncSelect = true) {
  if (isNoneTriggerMode()) {
    volts = NONE_FIXED_TRIGGER_LEVEL_VOLTS;
    syncSelect = true;
  }
  const limited = Math.max(TRIGGER_LEVEL_MIN, Math.min(TRIGGER_LEVEL_MAX, volts));
  if (triggerControls.slider) {
    triggerControls.slider.value = String(limited);
  }
  // Mirror the continuous level into the Trigger Level text field, unless the
  // user is actively typing in it.
  if (syncSelect && triggerControls.level && document.activeElement !== triggerControls.level) {
    triggerControls.level.value = formatTriggerVolts(limited);
    triggerControls.level.classList.remove("invalid");
  }
  updateTriggerOverlay();
}

function resetTriggerState() {
  triggerState.armed = false;
  triggerState.autoSearchStartedAt = 0;
  triggerState.holdoffRemaining = 0;
  triggerState.waitingForTrigger = false;
  // In None mode keep the rolling window anchor so level/offset tweaks don't jump.
  if (!isNoneTriggerMode()) {
    lastGoodWindowStartIndex = 0;
    lastTriggeredFrameBytes = null;
  }
  forcedMarkerFraction = null;
}

function interpolateTriggerIndex(previousSample, currentSample, thresholdVolts, previousIndex, currentIndex) {
  const delta = currentSample - previousSample;
  if (!Number.isFinite(delta) || delta === 0) {
    return currentIndex;
  }
  const ratio = (thresholdVolts - previousSample) / delta;
  if (!Number.isFinite(ratio)) {
    return currentIndex;
  }
  // Keep the fractional crossing point so the display can be phase-locked to
  // sub-sample precision (rounding here is what makes triggering look jittery).
  const interpolated = previousIndex + ratio;
  return Math.max(previousIndex, Math.min(currentIndex, interpolated));
}

// Map physical input volts to WebGL Y (-1..+1). Range (V/div) sets the graticule;
// Scaling multiplies trace amplitude; Vertical Offset pans the trace.
function voltsToY(physicalV, cfg) {
  const scale = cfg && Number.isFinite(cfg.scale) && cfg.scale > 0 ? cfg.scale : 1;
  const offset = cfg && Number.isFinite(cfg.offset) ? cfg.offset : 0;
  const vPerDiv = cfg && Number.isFinite(cfg.vPerDiv) && cfg.vPerDiv > 0 ? cfg.vPerDiv : 1;
  const halfRange = vPerDiv * (verticalDivisions / 2);
  if (halfRange <= 0) {
    return 0;
  }
  const y = (physicalV * scale + offset) / halfRange;
  return Math.max(-1, Math.min(1, y));
}

function yToVolts(normalizedY, cfg) {
  const scale = cfg && Number.isFinite(cfg.scale) && cfg.scale > 0 ? cfg.scale : 1;
  const offset = cfg && Number.isFinite(cfg.offset) ? cfg.offset : 0;
  const halfRange = getVisibleVoltageSpan(cfg);
  if (halfRange <= 0 || scale <= 0) {
    return 0;
  }
  return (normalizedY * halfRange - offset) / scale;
}

function updateTriggerOverlay() {
  const marker = triggerControls.marker;
  const positionMarker = triggerControls.positionMarker;
  const valueLabel = triggerControls.value;
  const source = triggerControls.source ? triggerControls.source.value : "Ch. 1";
  const triggerLevel = getTriggerLevelVolts();
  const sourceConfig = source === "Ch. 2" ? channelConfig.ch2 : channelConfig.ch1;
  const normalized = voltsToY(triggerLevel, sourceConfig);
  const percentTop = ((1 - normalized) / 2) * 100;
  const mode = triggerControls.mode ? triggerControls.mode.value : "None";
  const fraction = getTriggerPositionFraction();
  const markerFraction = getDisplayedMarkerFraction();
  const startLeftPercent = Math.max(0, Math.min(100, markerFraction * 100));

  if (marker) {
    marker.style.top = `${Math.max(0, Math.min(100, percentTop))}%`;
    if (mode === "None") {
      marker.style.display = "none";
      marker.classList.remove("triangle-only", "fixed", "trigger-start");
    } else {
      marker.style.display = "block";
      marker.classList.remove("triangle-only", "fixed", "trigger-start");
    }
    marker.style.removeProperty("--trigger-start-left");
  }
  if (positionMarker) {
    positionMarker.style.left = `${startLeftPercent}%`;
    if (mode === "None") {
      // None: top triangle handle only (no vertical dashed line) for Horizontal Offset.
      positionMarker.classList.add("visible", "offset-handle-only");
      positionMarker.classList.remove("triangle-only");
    } else {
      positionMarker.classList.add("visible");
      positionMarker.classList.remove("offset-handle-only", "triangle-only");
    }
  }
  if (valueLabel) {
    valueLabel.textContent = `${formatNumber(triggerLevel)} V`;
  }
  syncNoneTriggerUi();
}

// Scaling option value is the trace multiplier (x0.25 … x4).
function parseScale(value) {
  if (!value) {
    return 1;
  }
  const numeric = parseFloat(String(value).trim().replace("x", ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
}

function parseVolts(value) {
  if (!value) {
    return 0;
  }
  const text = value.trim();
  const match = text.match(/-?\d+(\.\d+)?/);
  if (!match) {
    return 0;
  }
  const num = parseFloat(match[0]);
  if (!Number.isFinite(num)) {
    return 0;
  }
  const lower = text.toLowerCase();
  if (lower.includes("uv")) {
    return num * 1e-6;
  }
  if (lower.includes("mv")) {
    return num * 1e-3;
  }
  if (lower.includes("v")) {
    return num;
  }
  return num;
}

function updateChannelConfig(cfg, controls, fallbackVPerDiv) {
  if (!controls.scale || !controls.range || !controls.offset) {
    cfg.scale = 1;
    cfg.vPerDiv = fallbackVPerDiv;
    cfg.offset = 0;
    return;
  }
  cfg.scale = parseScale(controls.scale.value);
  cfg.vPerDiv = parseVolts(controls.range.value) || fallbackVPerDiv;
  cfg.offset = parseVolts(controls.offset.value);
}

function parseTimePerDiv(value) {
  if (!value) {
    return { seconds: 1, unit: "s", unitScale: 1 };
  }
  const text = value.trim().toLowerCase();
  const match = text.match(/-?\d+(\.\d+)?/);
  if (!match) {
    return { seconds: 1, unit: "s", unitScale: 1 };
  }
  const num = parseFloat(match[0]);
  if (!Number.isFinite(num)) {
    return { seconds: 1, unit: "s", unitScale: 1 };
  }
  if (text.includes("ms")) {
    return { seconds: num * 1e-3, unit: "ms", unitScale: 1e-3 };
  }
  if (text.includes("us")) {
    return { seconds: num * 1e-6, unit: "us", unitScale: 1e-6 };
  }
  if (text.includes("ns")) {
    return { seconds: num * 1e-9, unit: "ns", unitScale: 1e-9 };
  }
  return { seconds: num, unit: "s", unitScale: 1 };
}

function parseTimeValue(value) {
  if (!value) {
    return 0;
  }
  // Collapse spaces so "- 5 ms" and "-5 ms" both parse as negative.
  const text = value.trim().toLowerCase().replace(/\s+/g, "");
  const match = text.match(/-?\d+(\.\d+)?/);
  if (!match) {
    return 0;
  }
  const num = parseFloat(match[0]);
  if (!Number.isFinite(num)) {
    return 0;
  }
  if (text.includes("ms")) {
    return num * 1e-3;
  }
  if (text.includes("us")) {
    return num * 1e-6;
  }
  if (text.includes("ns")) {
    return num * 1e-9;
  }
  return num;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const abs = Math.abs(value);
  if (abs >= 100) {
    return value.toFixed(0);
  }
  if (abs >= 10) {
    return value.toFixed(1).replace(/\.0$/, "");
  }
  if (abs >= 1) {
    return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  }
  return value.toFixed(3).replace(/\.?0+$/, "");
}

function chooseTimeUnit(spanSeconds) {
  if (spanSeconds >= 1) {
    return { unit: "s", unitScale: 1 };
  }
  if (spanSeconds >= 1e-3) {
    return { unit: "ms", unitScale: 1e-3 };
  }
  return { unit: "us", unitScale: 1e-6 };
}

function updateGrid() {
  updateGridLines();
  updateAxisLabels();
  updateTriggerOverlay();
  updateAcquisitionInfo();
}

function updateGridLines() {
  if (!gridCanvas) {
    return;
  }
  const ctx = gridCanvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  const ratio = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(cssWidth * ratio);
  const pixelHeight = Math.round(cssHeight * ratio);

  if (gridCanvas.width !== pixelWidth) {
    gridCanvas.width = pixelWidth;
  }
  if (gridCanvas.height !== pixelHeight) {
    gridCanvas.height = pixelHeight;
  }
  gridCanvas.style.width = `${cssWidth}px`;
  gridCanvas.style.height = `${cssHeight}px`;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.lineWidth = 1;

  // Major grid lines — light grey, dashed.
  ctx.strokeStyle = gridMajorColor;
  ctx.setLineDash(gridMajorDash);
  for (let i = 0; i <= verticalDivisions; i++) {
    const y = (i / verticalDivisions) * cssHeight;
    const alignedY = Math.round(y) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, alignedY);
    ctx.lineTo(cssWidth, alignedY);
    ctx.stroke();
  }

  for (let i = 0; i <= horizontalDivisions; i++) {
    const x = (i / horizontalDivisions) * cssWidth;
    const alignedX = Math.round(x) + 0.5;
    ctx.beginPath();
    ctx.moveTo(alignedX, 0);
    ctx.lineTo(alignedX, cssHeight);
    ctx.stroke();
  }

  // Minor border ticks: 9 subdivisions per major division; center tick is tallest.
  ctx.setLineDash([]);
  ctx.strokeStyle = gridMinorTickColor;

  function drawHorizontalBorderTick(x, tickLength) {
    const alignedX = Math.round(x) + 0.5;
    ctx.beginPath();
    ctx.moveTo(alignedX, 0);
    ctx.lineTo(alignedX, tickLength);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(alignedX, cssHeight - tickLength);
    ctx.lineTo(alignedX, cssHeight);
    ctx.stroke();
  }

  function drawVerticalBorderTick(y, tickLength) {
    const alignedY = Math.round(y) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, alignedY);
    ctx.lineTo(tickLength, alignedY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cssWidth - tickLength, alignedY);
    ctx.lineTo(cssWidth, alignedY);
    ctx.stroke();
  }

  for (let major = 0; major < horizontalDivisions; major++) {
    const segLeft = (major / horizontalDivisions) * cssWidth;
    const segWidth = cssWidth / horizontalDivisions;

    for (let k = 1; k < minorDivisionsPerMajor; k++) {
      const x = segLeft + (k / minorDivisionsPerMajor) * segWidth;
      drawHorizontalBorderTick(x, minorTickLengthPx);
    }
    drawHorizontalBorderTick(segLeft + 0.5 * segWidth, centerTickLengthPx);
  }

  for (let major = 0; major < verticalDivisions; major++) {
    const segTop = (major / verticalDivisions) * cssHeight;
    const segHeight = cssHeight / verticalDivisions;

    for (let k = 1; k < minorDivisionsPerMajor; k++) {
      const y = segTop + (k / minorDivisionsPerMajor) * segHeight;
      drawVerticalBorderTick(y, minorTickLengthPx);
    }
    drawVerticalBorderTick(segTop + 0.5 * segHeight, centerTickLengthPx);
  }
}

function gridLineInputVolts(cfg, divisionIndex) {
  const vPerDiv = cfg && Number.isFinite(cfg.vPerDiv) && cfg.vPerDiv > 0 ? cfg.vPerDiv : 1;
  const offset = cfg && Number.isFinite(cfg.offset) ? cfg.offset : 0;
  const halfRange = vPerDiv * (verticalDivisions / 2);
  const yNorm = 1 - (2 * divisionIndex) / verticalDivisions;
  return yNorm * halfRange - offset;
}

function updateAxisLabels() {
  if (yLabelsHeader) {
    yLabelsHeader.innerHTML = "";
    const ch1 = document.createElement("span");
    ch1.textContent = "CH1";
    ch1.style.color = channelConfig.ch1.enabled ? "#ffff00" : "#777";
    const ch2 = document.createElement("span");
    ch2.textContent = "CH2";
    ch2.style.color = channelConfig.ch2.enabled ? "#00cec8" : "#777";
    yLabelsHeader.appendChild(ch1);
    yLabelsHeader.appendChild(ch2);
  }

  if (yLabelsLeft) {
    yLabelsLeft.innerHTML = "";
  }
  if (yLabelsRight) {
    yLabelsRight.innerHTML = "";
  }

  for (let i = 0; i <= verticalDivisions; i++) {
    const valueCh1 = gridLineInputVolts(channelConfig.ch1, i);
    const valueCh2 = gridLineInputVolts(channelConfig.ch2, i);
    const top = `${(i / verticalDivisions) * 100}%`;

    if (yLabelsLeft) {
      const labelLeft = document.createElement("div");
      labelLeft.textContent = formatNumber(Math.abs(valueCh1));
      labelLeft.style.position = "absolute";
      labelLeft.style.left = "0";
      labelLeft.style.top = top;
      labelLeft.style.transform = "translateY(-50%)";
      labelLeft.style.opacity = channelConfig.ch1.enabled ? "1" : "0.35";
      yLabelsLeft.appendChild(labelLeft);
    }

    if (yLabelsRight) {
      const labelRight = document.createElement("div");
      labelRight.textContent = formatNumber(Math.abs(valueCh2));
      labelRight.style.position = "absolute";
      labelRight.style.right = "0";
      labelRight.style.top = top;
      labelRight.style.transform = "translateY(-50%)";
      labelRight.style.opacity = channelConfig.ch2.enabled ? "1" : "0.35";
      yLabelsRight.appendChild(labelRight);
    }
  }

  if (xLabels) {
    xLabels.innerHTML = "";
    const visibleSamples = Math.max(2, lastVisibleSampleCount || getVisibleSampleCount());
    const actualSpanSeconds = getPlotVisibleSpanSeconds();
    const sampleRate =
      actualSpanSeconds > 0
        ? (visibleSamples - 1) / actualSpanSeconds
        : getAxisLabelSampleRate();
    const unitInfo = chooseTimeUnit(actualSpanSeconds || 1e-6);
    const triggerFraction = getTriggerPositionFraction();
    const centerIndex = horizontalDivisions / 2;
    const plotWidth = Math.max(1, canvas.clientWidth || plotPointCount || visibleSamples);
    const estimatedLabelChars = Math.max(5, `${formatNumber(actualSpanSeconds / unitInfo.unitScale)} ${unitInfo.unit}`.length);
    const estimatedLabelWidth = Math.max(42, estimatedLabelChars * 7);
    const divisionSpacing = plotWidth / horizontalDivisions;
    const labelStep = Math.max(1, Math.ceil(estimatedLabelWidth / Math.max(1, divisionSpacing)));
    const mode = triggerControls.mode ? triggerControls.mode.value : "None";
    const triggerSampleIndex = Number.isFinite(triggerState.lastTriggerIndex) ? triggerState.lastTriggerIndex : 0;
    const windowStart = Number.isFinite(lastWindowStartIndex) ? lastWindowStartIndex : 0;
    // On-screen fraction where the trigger (time 0) actually sits, so the "0"
    // label highlight tracks the draggable vertical marker as it pans.
    const markerFraction = getDisplayedMarkerFraction();
    const highlightTolerance = 0.5 / horizontalDivisions;

    for (let i = 0; i <= horizontalDivisions; i++) {
      const shouldShowLabel = i === centerIndex || i === 0 || i === horizontalDivisions || i % labelStep === 0;
      if (!shouldShowLabel) {
        continue;
      }
      // Time relative to the trigger sample (0 at the actual trigger edge).
      const fractionAcrossScreen = i / horizontalDivisions;
      const sampleAtScreen = windowStart + fractionAcrossScreen * (visibleSamples - 1);
      const samplesFromTrigger = sampleAtScreen - triggerSampleIndex;
      const timeValueSeconds = sampleRate > 0 ? samplesFromTrigger / sampleRate : 0;
      const timeValue = timeValueSeconds / unitInfo.unitScale;
      const label = document.createElement("div");
      label.textContent = `${toSignificant(timeValue, 4)} ${unitInfo.unit}`;
      label.style.position = "absolute";
      label.style.bottom = "0";
      label.style.left = `${fractionAcrossScreen * 100}%`;
      // First label is left-tucked so it doesn't spill into the narrow y-axis;
      // the last label stays centered and overflows into the right pad column.
      if (i === 0) {
        label.style.transform = "translateX(0)";
      } else {
        label.style.transform = "translateX(-50%)";
      }
      if (Math.abs(fractionAcrossScreen - markerFraction) < highlightTolerance) {
        label.style.color = "#ffcc7a";
      }
      xLabels.appendChild(label);
    }
  }
}

function setChannelEnabled(channelKey, enabled) {
  const cfg = channelConfig[channelKey];
  const controls = channelKey === "ch1" ? ch1Controls : ch2Controls;
  cfg.enabled = !!enabled;
  if (controls.enable) {
    controls.enable.classList.toggle("active", cfg.enabled);
    controls.enable.setAttribute("aria-pressed", cfg.enabled ? "true" : "false");
  }
  if (line1 && channelKey === "ch1") {
    line1.visible = cfg.enabled;
  }
  if (line2 && channelKey === "ch2") {
    line2.visible = cfg.enabled;
  }
  updateAxisLabels();
}

function presentChannelDisplay() {
  updateTriggerOverlay();
  updateAxisLabels();
  refreshPlotRender();
  wglp.update();
}

function refreshConfig() {
  updateChannelConfig(channelConfig.ch1, ch1Controls, 1);
  updateChannelConfig(channelConfig.ch2, ch2Controls, 1);
  syncTriggerTuningFromUi();
  resetTriggerState();
  updateTriggerSliderRange();
  updateGrid();
  presentChannelDisplay();
}

function applyLiveVerticalOffset() {
  updateChannelConfig(channelConfig.ch1, ch1Controls, 1);
  updateChannelConfig(channelConfig.ch2, ch2Controls, 1);
  // Display-only: shift the traces now. Do not reset trigger search.
  presentChannelDisplay();
}

if (ch1Controls.scale) ch1Controls.scale.addEventListener("change", refreshConfig);
if (ch2Controls.scale) ch2Controls.scale.addEventListener("change", refreshConfig);
setupScopeField(ch1Controls.range, refreshConfig);
setupScopeField(ch1Controls.offset, applyLiveVerticalOffset);
setupScopeField(ch2Controls.range, refreshConfig);
setupScopeField(ch2Controls.offset, applyLiveVerticalOffset);
if (ch1Controls.enable) {
  ch1Controls.enable.addEventListener("click", function () {
    setChannelEnabled("ch1", !channelConfig.ch1.enabled);
  });
}
if (ch2Controls.enable) {
  ch2Controls.enable.addEventListener("click", function () {
    setChannelEnabled("ch2", !channelConfig.ch2.enabled);
  });
}
function scopeFieldToNumber(kind, value) {
  if (value === undefined || value === null || value === "") {
    return NaN;
  }
  if (kind === "samples") {
    const n = parseInt(String(value).replace(/[^0-9-]/g, ""), 10);
    return Number.isFinite(n) ? n : NaN;
  }
  if (kind === "rate") {
    return parseSamplingRate(value);
  }
  if (kind === "time-per-div") {
    return parseTimePerDiv(value).seconds;
  }
  if (kind === "time-signed") {
    return parseTimeValue(value);
  }
  if (kind === "volts") {
    return parseVolts(value);
  }
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : NaN;
}

function findCanonicalStepIndex(current, steps) {
  if (!Number.isFinite(current) || steps.length === 0) {
    return -1;
  }
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < steps.length; i++) {
    const distance = Math.abs(steps[i].num - current);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  return bestIndex;
}

// Turns a <input class="scope_field"> into a typeable + scrollable stepper.
// Typing accepts any parseable value; scrolling (only while focused) steps
// either through the canonical values in data-step-values, or (when
// data-step is present) by a fixed linear increment between data-step-min
// and data-step-max.
function setupScopeField(input, onCommit, fieldOptions) {
  if (!input) {
    return;
  }
  const kind = input.dataset.fieldKind || "";
  const steps = (input.dataset.stepValues || "")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean)
    .map((label) => ({ label, num: scopeFieldToNumber(kind, label) }))
    .filter((entry) => Number.isFinite(entry.num))
    .sort((a, b) => a.num - b.num);

  // Optional linear stepping (e.g. Samples: 0..2000 step 10).
  const linearStep = parseFloat(input.dataset.step);
  const hasLinear = Number.isFinite(linearStep) && linearStep > 0;
  const linearMin = Number.isFinite(parseFloat(input.dataset.stepMin)) ? parseFloat(input.dataset.stepMin) : -Infinity;
  const linearMax = Number.isFinite(parseFloat(input.dataset.stepMax)) ? parseFloat(input.dataset.stepMax) : Infinity;

  // Optional clamp for typed values (e.g. Sampling Rate: 0..200000 Hz).
  const clampMin = Number.isFinite(parseFloat(input.dataset.min)) ? parseFloat(input.dataset.min) : -Infinity;
  const clampMax = Number.isFinite(parseFloat(input.dataset.max)) ? parseFloat(input.dataset.max) : Infinity;

  const isAcquisitionField = !!(fieldOptions && fieldOptions.acquisitionField);
  const debounceMs = fieldOptions && Number.isFinite(fieldOptions.debounceMs) ? fieldOptions.debounceMs : 0;
  let commitTimer = null;

  function formatLinear(num) {
    if (kind === "samples") {
      return String(Math.round(num));
    }
    if (kind === "volts") {
      // Trim float error from 0.1 steps and keep the "V" unit suffix.
      return `${Number(num.toFixed(3))} V`;
    }
    return String(num);
  }

  function markValidity() {
    const num = scopeFieldToNumber(kind, input.value);
    input.classList.toggle("invalid", !Number.isFinite(num));
    return num;
  }

  function clampTyped() {
    const num = scopeFieldToNumber(kind, input.value);
    if (!Number.isFinite(num)) {
      return num;
    }
    const clamped = Math.min(clampMax, Math.max(clampMin, num));
    if (hasLinear) {
      const snapped = Math.min(linearMax, Math.max(linearMin, clamped));
      const formatted = formatLinear(snapped);
      if (formatted !== input.value.trim()) {
        input.value = formatted;
      }
      return snapped;
    }
    return clamped;
  }

  function commit() {
    clampTyped();
    const num = markValidity();
    if (!Number.isFinite(num)) {
      return;
    }
    if (isAcquisitionField) {
      applyAcquisitionSettings();
      updateAcquisitionInfo();
      saveAcquisitionSettings();
      if (commitTimer) {
        clearTimeout(commitTimer);
      }
      // Debounced so scrolling through several values pushes one device
      // update (ctrlSet) instead of many.
      commitTimer = setTimeout(function () {
        applyStreamAcquisition();
      }, 250);
      return;
    }
    if (typeof onCommit === "function") {
      if (debounceMs > 0) {
        // Coalesce rapid scrolls into a single recompute, just like the
        // Sampling Rate field, so stepping feels smooth.
        if (commitTimer) {
          clearTimeout(commitTimer);
        }
        commitTimer = setTimeout(onCommit, debounceMs);
      } else {
        onCommit();
      }
    }
  }

  function step(direction) {
    const current = scopeFieldToNumber(kind, input.value);
    if (hasLinear) {
      let base = Number.isFinite(current) ? current : (direction > 0 ? linearMin : linearMax);
      // Snap to the step grid before moving, so typed values land cleanly.
      base = Math.round(base / linearStep) * linearStep;
      let next = base + direction * linearStep;
      next = Math.min(linearMax, Math.max(linearMin, next));
      input.value = formatLinear(next);
      markValidity();
      commit();
      return;
    }
    if (steps.length === 0) {
      return;
    }
    let targetIndex;
    if (!Number.isFinite(current)) {
      targetIndex = direction > 0 ? 0 : steps.length - 1;
    } else {
      let currentIndex = steps.findIndex((entry) => Math.abs(entry.num - current) < 1e-9);
      if (currentIndex === -1) {
        currentIndex = findCanonicalStepIndex(current, steps);
      }
      if (direction > 0) {
        targetIndex = steps[currentIndex].num <= current + 1e-9
          ? Math.min(steps.length - 1, currentIndex + 1)
          : currentIndex;
      } else {
        targetIndex = steps[currentIndex].num >= current - 1e-9
          ? Math.max(0, currentIndex - 1)
          : currentIndex;
      }
    }
    input.value = steps[targetIndex].label;
    markValidity();
    commit();
  }

  input.addEventListener("wheel", function (event) {
    // Only step when the field is focused/selected, so scrolling the panel
    // over an idle field doesn't change it.
    if (document.activeElement !== input) {
      return;
    }
    event.preventDefault();
    step(event.deltaY < 0 ? 1 : -1);
  }, { passive: false });

  input.addEventListener("change", commit);
  input.addEventListener("input", markValidity);
  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      input.blur();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      step(-1);
    }
  });

  markValidity();
}

// Time/Division scrolls/types just like Sampling Rate: it rescales the sampling
// rate (span = displaySamples / rate) and pushes the new rate to the device.
setupScopeField(timePerDivControl, function () {
  markUserAcquisitionDirty();
  syncRateFromTimePerDiv();
  applyAcquisitionSettings();
  syncTimePerDivFromRate();
  startDisplayWindowAnimation();
  updateGrid();
  refreshPlotRender();
  updateAcquisitionInfo();
  saveAcquisitionSettings();
  scheduleStreamApply();
});
setupScopeField(hOffsetControl, function () {
  forcedMarkerFraction = null;
  updateGrid();
  if (triggerControls.positionMarker) {
    const predicted = offsetSamplesToMarkerFraction(getHorizontalOffsetSamples());
    const clamped = Math.max(0, Math.min(1, predicted));
    triggerControls.positionMarker.style.left = `${clamped * 100}%`;
  }
  updateAxisLabels();
  updateTriggerOverlay();
  refreshDisplayFromLastFrame();
});
setupScopeField(acquisitionControls.samples, function () {
  markUserAcquisitionDirty();
  applyAcquisitionSettings();
  syncTimePerDivFromRate();
  startDisplayWindowAnimation();
  updateGrid();
  refreshPlotRender();
  updateAcquisitionInfo();
  saveAcquisitionSettings();
  scheduleStreamApply();
});
setupScopeField(acquisitionControls.rate, onSamplingRateCommitted);
if (triggerControls.mode) {
  triggerControls.mode.addEventListener("change", function () {
    syncTriggerModeToRunPanel();
    resetTriggerState();
    if (triggerControls.mode.value === "None") {
      resetNoneTriggerViewAnchor();
      lastGoodWindowStartIndex = 0;
      applyNoneFixedTriggerLevel();
    }
    syncNoneTriggerUi();
    updateTriggerOverlay();
    const mode = triggerControls.mode.value;
    if (mode === "None") {
      setTriggerStatus("Free run");
    } else if (mode === "Single") {
      setTriggerStatus("Single ready");
    } else {
      setTriggerStatus(mode === "Normal" ? "Screen (Normal)" : "Repeated (Auto)");
    }
  });
}
setupRunControls();
if (triggerControls.source) {
  triggerControls.source.addEventListener("change", function () {
    updateTriggerSliderRange();
    updateTriggerOverlay();
    resetTriggerState();
  });
}
if (triggerControls.type) {
  triggerControls.type.addEventListener("change", function () {
    resetTriggerState();
    setTriggerStatus(`${triggerControls.type.value} armed`);
  });
}
if (triggerControls.slope) triggerControls.slope.addEventListener("change", resetTriggerState);
if (triggerControls.position) {
  triggerControls.position.addEventListener("change", function () {
    resetTriggerState();
    updateTriggerOverlay();
    updateAxisLabels();
  });
}
if (triggerControls.hysteresis) {
  triggerControls.hysteresis.addEventListener("change", function () {
    syncTriggerTuningFromUi();
    resetTriggerState();
  });
}
if (triggerControls.holdoff) {
  triggerControls.holdoff.addEventListener("change", function () {
    syncTriggerTuningFromUi();
    resetTriggerState();
  });
}
if (triggerControls.autoTimeout) {
  triggerControls.autoTimeout.addEventListener("change", function () {
    syncTriggerTuningFromUi();
    resetTriggerState();
  });
}
setupScopeField(triggerControls.level, function () {
  if (isNoneTriggerMode()) {
    applyNoneFixedTriggerLevel();
    return;
  }
  applyLiveTriggerLevel(parseVolts(triggerControls.level.value));
});
if (triggerControls.slider) {
  triggerControls.slider.addEventListener("input", function () {
    if (isNoneTriggerMode()) {
      return;
    }
    applyLiveTriggerLevel(parseFloat(triggerControls.slider.value));
  });
}

function fractionFromPlotClientX(clientX) {
  if (!plotArea) {
    return getTriggerPositionFraction();
  }
  const rect = plotArea.getBoundingClientRect();
  if (!(rect.width > 0)) {
    return getTriggerPositionFraction();
  }
  return (clientX - rect.left) / rect.width;
}

function isScopeCursorTriggerTarget(target) {
  return !!(target && target.closest && target.closest(".trigger_level_marker, .trigger_position_marker"));
}

function interpolateSampleArray(arr, position) {
  if (!arr || arr.length <= 0) {
    return NaN;
  }
  const maxIndex = arr.length - 1;
  let pos = position;
  if (pos < 0) {
    pos = 0;
  } else if (pos > maxIndex) {
    pos = maxIndex;
  }
  const lower = Math.floor(pos);
  const upper = Math.min(maxIndex, lower + 1);
  const frac = pos - lower;
  return arr[lower] + (arr[upper] - arr[lower]) * frac;
}

function measureAtPlotFraction(fraction) {
  const f = Math.max(0, Math.min(1, fraction));
  if (!lastRenderedCh1 || !lastRenderedCh2 || plotPointCount <= 0) {
    return { ch1V: NaN, ch2V: NaN, timeSeconds: NaN };
  }
  const plotIndex = f * Math.max(1, plotPointCount - 1);
  const ch1V = interpolateSampleArray(lastRenderedCh1, plotIndex);
  const ch2V = interpolateSampleArray(lastRenderedCh2, plotIndex);

  const visibleSamples = Math.max(2, lastVisibleSampleCount || getVisibleSampleCount());
  const actualSpanSeconds = getPlotVisibleSpanSeconds();
  const sampleRate =
    actualSpanSeconds > 0
      ? (visibleSamples - 1) / actualSpanSeconds
      : getAxisLabelSampleRate();
  const triggerSampleIndex = Number.isFinite(triggerState.lastTriggerIndex)
    ? triggerState.lastTriggerIndex
    : 0;
  const windowStart = Number.isFinite(lastWindowStartIndex) ? lastWindowStartIndex : 0;
  const sampleAtScreen = windowStart + f * (visibleSamples - 1);
  const samplesFromTrigger = sampleAtScreen - triggerSampleIndex;
  const timeSeconds = sampleRate > 0 ? samplesFromTrigger / sampleRate : NaN;
  return { ch1V, ch2V, timeSeconds };
}

function formatCursorTime(seconds) {
  if (!Number.isFinite(seconds)) {
    return "--";
  }
  const unitInfo = chooseTimeUnit(Math.abs(seconds) || 1e-6);
  return `${toSignificant(seconds / unitInfo.unitScale, 4)} ${unitInfo.unit}`;
}

function formatCursorVolts(v) {
  if (!Number.isFinite(v)) {
    return "--";
  }
  return `${formatNumber(v)} V`;
}

function updateScopeCursorUi() {
  if (!scopeCursorEl || !scopeCursorLine || !scopeCursorReadout) {
    return;
  }
  if (!scopeCursor.active) {
    scopeCursorEl.hidden = true;
    scopeCursorEl.classList.remove("is-active");
    if (plotArea) {
      plotArea.classList.remove("scope_cursor_active");
    }
    return;
  }
  scopeCursorEl.hidden = false;
  scopeCursorEl.classList.add("is-active");
  if (plotArea) {
    plotArea.classList.add("scope_cursor_active");
  }

  const f = scopeCursor.fraction;
  scopeCursorLine.style.left = `${f * 100}%`;

  const m = measureAtPlotFraction(f);
  scopeCursorReadout.innerHTML =
    `<span class="scope_cursor_ch1">CH1: ${formatCursorVolts(m.ch1V)}</span>` +
    `<span class="scope_cursor_sep"> | </span>` +
    `<span class="scope_cursor_ch2">CH2: ${formatCursorVolts(m.ch2V)}</span>` +
    `<span class="scope_cursor_sep"> | </span>` +
    `<span class="scope_cursor_time">t: ${formatCursorTime(m.timeSeconds)}</span>`;

  scopeCursorReadout.style.left = `${f * 100}%`;
  if (f > 0.72) {
    scopeCursorReadout.style.transform = "translate(calc(-100% - 8px), 0)";
  } else {
    scopeCursorReadout.style.transform = "translate(8px, 0)";
  }
}

function setScopeCursorFraction(fraction) {
  scopeCursor.fraction = Math.max(0, Math.min(1, fraction));
  updateScopeCursorUi();
}

function showScopeCursor(fraction) {
  scopeCursor.active = true;
  setScopeCursorFraction(fraction);
}

function hideScopeCursor() {
  scopeCursor.active = false;
  updateScopeCursorUi();
}

function applyTriggerStartPan(target) {
  target = Math.max(0, Math.min(1, target));
  forcedMarkerFraction = target;
  applyHorizontalOffsetFromMarkerFraction(target);
  updateGrid();
  updateAxisLabels();
  updateTriggerOverlay();
  refreshDisplayFromLastFrame();
  return target;
}

// Click + drag the trigger horizontal line to set the trigger level directly
// on the plot. Works with mouse and touch via pointer events.
if (triggerControls.marker && plotArea) {
  const marker = triggerControls.marker;
  let dragging = false;

  function triggerVoltsFromClientY(clientY) {
    const rect = plotArea.getBoundingClientRect();
    if (!(rect.height > 0)) {
      return getTriggerLevelVolts();
    }
    let fraction = (clientY - rect.top) / rect.height;
    fraction = Math.max(0, Math.min(1, fraction));
    // Top of the plot = +span, bottom = -span (matches updateTriggerOverlay).
    const normalized = 1 - 2 * fraction;
    const source = triggerControls.source ? triggerControls.source.value : "Ch. 1";
    const sourceConfig = source === "Ch. 2" ? channelConfig.ch2 : channelConfig.ch1;
    return yToVolts(normalized, sourceConfig);
  }

  function applyDragLevel(clientY) {
    applyLiveTriggerLevel(triggerVoltsFromClientY(clientY));
  }

  function onMarkerPointerMove(event) {
    if (!dragging) {
      return;
    }
    event.preventDefault();
    applyDragLevel(event.clientY);
  }

  function endMarkerDrag() {
    if (!dragging) {
      return;
    }
    dragging = false;
    marker.classList.remove("dragging");
    window.removeEventListener("pointermove", onMarkerPointerMove);
    window.removeEventListener("pointerup", endMarkerDrag);
    window.removeEventListener("pointercancel", endMarkerDrag);
  }

  marker.addEventListener("pointerdown", function (event) {
    if (isNoneTriggerMode()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragging = true;
    marker.classList.add("dragging");
    applyDragLevel(event.clientY);
    window.addEventListener("pointermove", onMarkerPointerMove);
    window.addEventListener("pointerup", endMarkerDrag);
    window.addEventListener("pointercancel", endMarkerDrag);
  });
}

// Click + drag the vertical trigger line horizontally to pan the trace. Dragging
// it rewrites the Horizontal Offset so the two stay in lock-step.
if (triggerControls.positionMarker && plotArea) {
  const posMarker = triggerControls.positionMarker;
  let draggingPos = false;
  let lastPosTarget = getTriggerPositionFraction();

  // Turn a horizontal screen fraction (0..1) into the matching Horizontal Offset
  // and move the marker there. Only the Horizontal Offset is affected; the
  // Trigger Position setting is left untouched.
  function applyOffsetForFraction(target) {
    lastPosTarget = applyTriggerStartPan(target);
    if (triggerControls.positionMarker) {
      triggerControls.positionMarker.style.left = `${lastPosTarget * 100}%`;
    }
  }

  function fractionFromClientX(clientX) {
    return fractionFromPlotClientX(clientX);
  }

  function onPosPointerMove(event) {
    if (!draggingPos) {
      return;
    }
    event.preventDefault();
    applyOffsetForFraction(fractionFromClientX(event.clientX));
  }

  function endPosDrag() {
    if (!draggingPos) {
      return;
    }
    draggingPos = false;
    posMarker.classList.remove("dragging");
    window.removeEventListener("pointermove", onPosPointerMove);
    window.removeEventListener("pointerup", endPosDrag);
    window.removeEventListener("pointercancel", endPosDrag);
    applyOffsetForFraction(lastPosTarget);
  }

  posMarker.addEventListener("pointerdown", function (event) {
    event.preventDefault();
    draggingPos = true;
    posMarker.classList.add("dragging");
    applyOffsetForFraction(fractionFromClientX(event.clientX));
    window.addEventListener("pointermove", onPosPointerMove);
    window.addEventListener("pointerup", endPosDrag);
    window.addEventListener("pointercancel", endPosDrag);
  });
}

if (plotArea) {
  plotArea.addEventListener("click", function (event) {
    if (isScopeCursorTriggerTarget(event.target)) {
      return;
    }
    showScopeCursor(fractionFromPlotClientX(event.clientX));
  });

  plotArea.addEventListener("pointermove", function (event) {
    if (!scopeCursor.active) {
      return;
    }
    if (event.buttons !== 0) {
      return;
    }
    if (isScopeCursorTriggerTarget(event.target)) {
      return;
    }
    setScopeCursorFraction(fractionFromPlotClientX(event.clientX));
  });

  plotArea.addEventListener("dblclick", function (event) {
    if (isScopeCursorTriggerTarget(event.target)) {
      return;
    }
    hideScopeCursor();
    event.preventDefault();
  });
}

window.addEventListener("resize", function () {
  resizeScopeIfNeeded(true);
});

// Track the actual size of the display box so late layout changes (fonts,
// CSS grid settling, panel resizing) always keep the canvas resolution correct.
if (typeof ResizeObserver !== "undefined" && (plotArea || canvas)) {
  const resizeObserver = new ResizeObserver(function () {
    if (resizeScopeIfNeeded()) {
      wglp.update();
    }
  });
  resizeObserver.observe(plotArea || canvas);
}

function newFrame() {
  tickDisplayWindowAnimation();
  // Safety net: if the box size changed without firing a resize/observer event
  // in time, correct the backing store before drawing so nothing is stretched.
  const resized = resizeScopeIfNeeded();
  let drew = false;
  if (nextFrameBuffer.ready && nextFrameBuffer.sequence !== renderedFrameSequence) {
    const renderStart = typeof performance !== "undefined" ? performance.now() : Date.now();
    renderFrameBuffer(nextFrameBuffer);
    renderedFrameSequence = nextFrameBuffer.sequence;
    nextFrameBuffer.ready = false;
    lastRenderUs = ((typeof performance !== "undefined" ? performance.now() : Date.now()) - renderStart) * 1000;
    recordDisplayFps();
    reportClientMetrics(lastDecodeUs, lastRenderUs, lastMetricsSeq);
    updateAcquisitionInfo();
    drew = true;
  }
  if (drew || resized || displayZoomState.animStart > 0) {
    wglp.update();
  }
  requestAnimationFrame(newFrame);
}
requestAnimationFrame(newFrame);
refreshConfig();
syncScopeCanvasSize();
updateWebglViewport();
ensurePlotLines(true);
updateGrid();
wglp.update();
if (acquisitionControls.samples && window.LABSOFT_SAMPLE_COUNT) {
  acquisitionControls.samples.value = String(window.LABSOFT_SAMPLE_COUNT);
}
if (acquisitionControls.rate && window.LABSOFT_SAMPLE_RATE_LABEL) {
  acquisitionControls.rate.value = window.LABSOFT_SAMPLE_RATE_LABEL;
}
// Show Time/div derived from the initial sampling rate so the two stay linked.
syncTimePerDivFromRate();
setChannelEnabled("ch1", true);
setChannelEnabled("ch2", true);
updateAcquisitionInfo();
saveAcquisitionSettings();
setTriggerLevelVolts(0, true);
setTriggerStatus("Ready");
