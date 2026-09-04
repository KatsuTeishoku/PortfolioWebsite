(function () {
  "use strict";

  const FG_MIN_HZ = 0.1;
  const FG_MAX_HZ = 12500000;
  const FG_MIN_AMP_V = 0;
  const FG_MAX_AMP_V = 5;
  const FG_AMP_STEP_V = 0.1;
  const PREVIEW_OFFSET_V = 0;
  const PREVIEW_UI_SCALE = 1.1;
  const PREVIEW_WINDOW_MIN_SEC = 0.035;
  const CHANNEL_KEYS = ["ch1", "ch2"];
  const TRACE_COLORS = { ch1: "#ffd700", ch2: "#00cec8" };

  const previewCanvases = {
    ch1: document.getElementById("fg_preview_canvas_ch1"),
    ch2: document.getElementById("fg_preview_canvas_ch2")
  };
  const outputLabels = {
    ch1: document.getElementById("fg_ch1_label"),
    ch2: document.getElementById("fg_ch2_label")
  };
  const statusEl = document.getElementById("FG_Status");
  const badges = {
    ch1: document.getElementById("fg_ch1_badge"),
    ch2: document.getElementById("fg_ch2_badge")
  };

  const defaultState = {
    ch1: { enabled: false, waveType: "sine", frequency: 100, amplitude: 1 },
    ch2: { enabled: false, waveType: "square", frequency: 200, amplitude: 1 }
  };

  let state = window.LABSOFT_getDemoFgState
    ? window.LABSOFT_getDemoFgState()
    : JSON.parse(JSON.stringify(defaultState));

  function formatNumber(value) {
    if (!Number.isFinite(value)) return "0";
    const abs = Math.abs(value);
    if (abs >= 100) return value.toFixed(0);
    if (abs >= 10) return value.toFixed(1).replace(/\.0$/, "");
    if (abs >= 1) return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
    return value.toFixed(3).replace(/\.?0+$/, "");
  }

  function parseFrequency(value) {
    if (value === undefined || value === null || value === "") return NaN;
    const text = String(value).trim().toLowerCase().replace(/\s+/g, "");
    const match = text.match(/-?\d+(\.\d+)?/);
    if (!match) return NaN;
    const numeric = parseFloat(match[0]);
    if (!Number.isFinite(numeric) || numeric <= 0) return NaN;
    if (text.includes("mhz")) return numeric * 1e6;
    if (text.includes("khz")) return numeric * 1e3;
    if (text.includes("hz")) return numeric;
    return numeric;
  }

  function formatFrequency(hz) {
    if (!Number.isFinite(hz) || hz <= 0) return "0 Hz";
    if (hz >= 1e6) return formatNumber(hz / 1e6) + " MHz";
    if (hz >= 1e3) return formatNumber(hz / 1e3) + " kHz";
    return formatNumber(hz) + " Hz";
  }

  function parsePeriod(value) {
    if (!value) return NaN;
    const text = String(value).trim().toLowerCase().replace(/\s+/g, "");
    const match = text.match(/-?\d+(\.\d+)?/);
    if (!match) return NaN;
    const num = parseFloat(match[0]);
    if (!Number.isFinite(num) || num <= 0) return NaN;
    if (text.includes("ms")) return num * 1e-3;
    if (text.includes("us")) return num * 1e-6;
    if (text.includes("ns")) return num * 1e-9;
    if (text.includes("s")) return num;
    return num;
  }

  function formatPeriod(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return "0 s";
    if (seconds >= 1) return formatNumber(seconds) + " s";
    if (seconds >= 1e-3) return formatNumber(seconds * 1e3) + " ms";
    if (seconds >= 1e-6) return formatNumber(seconds * 1e6) + " us";
    return formatNumber(seconds * 1e9) + " ns";
  }

  function isFrequencyInRange(hz) {
    return Number.isFinite(hz) && hz >= FG_MIN_HZ && hz <= FG_MAX_HZ;
  }

  function parseAmplitude(value) {
    if (value === undefined || value === null || value === "") return NaN;
    const text = String(value).trim().toLowerCase().replace(/\s+/g, "");
    const match = text.match(/-?\d+(\.\d+)?/);
    if (!match) return NaN;
    const numeric = parseFloat(match[0]);
    if (!Number.isFinite(numeric) || numeric < 0) return NaN;
    if (text.includes("mv")) return numeric * 1e-3;
    if (text.includes("uv")) return numeric * 1e-6;
    if (text.includes("v")) return numeric;
    return numeric;
  }

  function formatAmplitude(volts) {
    if (!Number.isFinite(volts) || volts <= 0) return "0 V";
    if (volts >= 1) return formatNumber(volts) + " V";
    if (volts >= 1e-3) return formatNumber(volts * 1e3) + " mV";
    return formatNumber(volts * 1e6) + " uV";
  }

  function snapAmplitude(volts) {
    if (!Number.isFinite(volts)) return NaN;
    const snapped = Math.round(volts / FG_AMP_STEP_V) * FG_AMP_STEP_V;
    return Math.min(FG_MAX_AMP_V, Math.max(FG_MIN_AMP_V, Number(snapped.toFixed(3))));
  }

  function channelAmplitude(channel) {
    const amp = channel && channel.amplitude;
    if (!Number.isFinite(amp)) return 1;
    return snapAmplitude(amp);
  }

  function isAmplitudeInRange(volts) {
    return Number.isFinite(volts) && volts >= FG_MIN_AMP_V && volts <= FG_MAX_AMP_V;
  }

  function scopeFieldToNumber(kind, value) {
    if (kind === "frequency") return parseFrequency(value);
    if (kind === "period") return parsePeriod(value);
    if (kind === "amplitude") return parseAmplitude(value);
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : NaN;
  }

  function publishState() {
    if (typeof window.LABSOFT_setDemoFgState === "function") {
      window.LABSOFT_setDemoFgState({
        ch1: Object.assign({}, state.ch1, {
          amplitude: channelAmplitude(state.ch1),
          offset: PREVIEW_OFFSET_V
        }),
        ch2: Object.assign({}, state.ch2, {
          amplitude: channelAmplitude(state.ch2),
          offset: PREVIEW_OFFSET_V
        })
      });
    }
  }

  function setupScopeField(input, onCommit) {
    if (!input) return;
    const kind = input.dataset.fieldKind || "";
    const steps = (input.dataset.stepValues || "")
      .split(",")
      .map(function (label) { return label.trim(); })
      .filter(Boolean)
      .map(function (label) { return { label: label, num: scopeFieldToNumber(kind, label) }; })
      .filter(function (entry) { return Number.isFinite(entry.num); })
      .sort(function (a, b) { return a.num - b.num; });
    const clampMin = Number.isFinite(parseFloat(input.dataset.min)) ? parseFloat(input.dataset.min) : -Infinity;
    const clampMax = Number.isFinite(parseFloat(input.dataset.max)) ? parseFloat(input.dataset.max) : Infinity;
    const linearStep = parseFloat(input.dataset.step);
    const hasLinear = Number.isFinite(linearStep) && linearStep > 0;
    const linearMin = Number.isFinite(parseFloat(input.dataset.stepMin)) ? parseFloat(input.dataset.stepMin) : clampMin;
    const linearMax = Number.isFinite(parseFloat(input.dataset.stepMax)) ? parseFloat(input.dataset.stepMax) : clampMax;

    function markValidity() {
      const num = scopeFieldToNumber(kind, input.value);
      let valid = Number.isFinite(num);
      if (kind === "frequency") valid = isFrequencyInRange(num);
      else if (kind === "period") valid = Number.isFinite(num) && num > 0 && isFrequencyInRange(1 / num);
      else if (kind === "amplitude") valid = isAmplitudeInRange(num);
      input.classList.toggle("invalid", !valid);
      return num;
    }

    function clampTyped() {
      const num = scopeFieldToNumber(kind, input.value);
      if (!Number.isFinite(num)) return num;
      let clamped = Math.min(clampMax, Math.max(clampMin, num));
      if (kind === "frequency") {
        clamped = Math.min(FG_MAX_HZ, Math.max(FG_MIN_HZ, clamped));
        input.value = formatFrequency(clamped);
      } else if (kind === "period") {
        if (isFrequencyInRange(1 / clamped)) input.value = formatPeriod(clamped);
      } else if (kind === "amplitude") {
        clamped = snapAmplitude(clamped);
        input.value = formatAmplitude(clamped);
      }
      return scopeFieldToNumber(kind, input.value);
    }

    function commit() {
      clampTyped();
      const num = markValidity();
      if (!Number.isFinite(num)) return;
      if (kind === "frequency" && !isFrequencyInRange(num)) return;
      if (kind === "period" && !isFrequencyInRange(1 / num)) return;
      if (kind === "amplitude" && !isAmplitudeInRange(num)) return;
      onCommit(num);
    }

    function findCanonicalStepIndex(current) {
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

    function step(direction) {
      const current = scopeFieldToNumber(kind, input.value);
      if (hasLinear) {
        const base = Number.isFinite(current) ? current : (direction > 0 ? linearMin : linearMax);
        const snapped = Math.round(base / linearStep) * linearStep;
        let next = snapped + direction * linearStep;
        next = Math.min(linearMax, Math.max(linearMin, Number(next.toFixed(3))));
        if (kind === "amplitude") next = snapAmplitude(next);
        input.value = kind === "amplitude" ? formatAmplitude(next) : String(next);
        markValidity();
        commit();
        return;
      }
      if (steps.length === 0) return;
      let targetIndex;
      if (!Number.isFinite(current)) {
        targetIndex = direction > 0 ? 0 : steps.length - 1;
      } else {
        let currentIndex = steps.findIndex(function (entry) {
          return Math.abs(entry.num - current) < 1e-9;
        });
        if (currentIndex === -1) currentIndex = findCanonicalStepIndex(current);
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
      if (document.activeElement !== input) return;
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

  function waveVoltageAt(t, channel) {
    const f = channel.frequency;
    const offset = PREVIEW_OFFSET_V;
    const amp = channelAmplitude(channel);
    if (channel.waveType === "dc") return offset;
    if (!Number.isFinite(f) || f <= 0) return offset;
    const period = 1 / f;
    const tNorm = ((t % period) + period) % period;
    const frac = tNorm / period;
    if (channel.waveType === "sine") return offset + amp * Math.sin(2 * Math.PI * f * t);
    if (channel.waveType === "triangle") {
      if (frac < 0.5) return offset - amp + (4 * amp * frac);
      return offset + amp - (4 * amp * (frac - 0.5));
    }
    if (channel.waveType === "square") return frac < 0.5 ? offset + amp : offset - amp;
    return offset;
  }

  function getPreviewWindowSec(channel) {
    const f = channel && channel.frequency;
    if (!Number.isFinite(f) || f <= 0) return PREVIEW_WINDOW_MIN_SEC;
    return Math.max(2 / f, PREVIEW_WINDOW_MIN_SEC);
  }

  function chooseTimeUnit(spanSeconds) {
    if (spanSeconds >= 1) return { unit: "s", scale: 1 };
    if (spanSeconds >= 1e-3) return { unit: "ms", scale: 1e-3 };
    return { unit: "us", scale: 1e-6 };
  }

  function updateChannelUi(key) {
    const channel = state[key];
    const panel = document.querySelector('.fg_ch_panel[data-channel="' + key + '"]');
    if (!panel) return;
    const runButton = panel.querySelector(".fg_ch_run");
    if (runButton) {
      runButton.textContent = channel.enabled ? "Stop" : "Run";
      runButton.classList.toggle("scope_run_btn_run", channel.enabled);
      runButton.classList.toggle("scope_run_btn_stop", !channel.enabled);
      runButton.setAttribute("aria-pressed", channel.enabled ? "true" : "false");
    }
    panel.querySelectorAll(".fg_wave_btn").forEach(function (btn) {
      const selected = btn.dataset.wave === channel.waveType;
      btn.classList.toggle("selected", selected);
      btn.classList.toggle("running", channel.enabled && selected);
      btn.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    const freqInput = document.getElementById("FG_Frequency_" + key);
    const periodInput = document.getElementById("FG_Period_" + key);
    const ampInput = document.getElementById("FG_Amplitude_" + key);
    if (freqInput && document.activeElement !== freqInput) {
      freqInput.value = formatFrequency(channel.frequency);
      freqInput.classList.remove("invalid");
    }
    if (periodInput && document.activeElement !== periodInput) {
      periodInput.value = formatPeriod(1 / channel.frequency);
      periodInput.classList.remove("invalid");
    }
    if (ampInput && document.activeElement !== ampInput) {
      ampInput.value = formatAmplitude(channelAmplitude(channel));
      ampInput.classList.remove("invalid");
    }
    const label = outputLabels[key];
    if (label) {
      label.textContent = formatFrequency(channel.frequency) + " · " + formatAmplitude(channelAmplitude(channel));
    }
    const badge = badges[key];
    if (badge) {
      badge.textContent = (key === "ch1" ? "Ch1 " : "Ch2 ") + (channel.enabled ? "Running" : "Stop");
      badge.classList.toggle("fg_state_running", channel.enabled);
      badge.classList.toggle("fg_state_stop", !channel.enabled);
    }
  }

  function updateStatus() {
    if (!statusEl) return;
    statusEl.textContent =
      "Demo preview · CH1 " + (state.ch1.enabled ? "running" : "stopped") +
      " " + state.ch1.waveType + " " + formatFrequency(state.ch1.frequency) +
      " " + formatAmplitude(channelAmplitude(state.ch1)) +
      " → Scope CH1 · CH2 " + (state.ch2.enabled ? "running" : "stopped") +
      " " + state.ch2.waveType + " " + formatFrequency(state.ch2.frequency) +
      " " + formatAmplitude(channelAmplitude(state.ch2)) +
      " → Scope CH2";
  }

  function drawPreview(key) {
    const previewCanvas = previewCanvases[key];
    const channel = state[key];
    if (!previewCanvas || !channel) return;
    const frame = previewCanvas.parentElement;
    const rect = frame ? frame.getBoundingClientRect() : previewCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    if (previewCanvas.width !== Math.floor(width * dpr) || previewCanvas.height !== Math.floor(height * dpr)) {
      previewCanvas.width = Math.floor(width * dpr);
      previewCanvas.height = Math.floor(height * dpr);
      previewCanvas.style.width = width + "px";
      previewCanvas.style.height = height + "px";
    }
    const ctx = previewCanvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    const ui = PREVIEW_UI_SCALE;
    const padLeft = 44 * ui;
    const padRight = 40 * ui;
    const padTop = 44 * ui;
    const padBottom = 28 * ui;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    if (plotW <= 0 || plotH <= 0) return;

    const windowSec = getPreviewWindowSec(channel);
    const timeInfo = chooseTimeUnit(windowSec);
    const amp = channelAmplitude(channel);
    const yMax = Math.max(2.5, Math.ceil(amp + 0.5));
    const PREVIEW_Y_MIN = -yMax;
    const PREVIEW_Y_MAX = yMax;
    const ySpan = PREVIEW_Y_MAX - PREVIEW_Y_MIN;
    function xForTime(t) { return padLeft + (t / windowSec) * plotW; }
    function yForVolts(v) { return padTop + (1 - (v - PREVIEW_Y_MIN) / ySpan) * plotH; }

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const gridColor = isDark ? "rgba(180,180,180,0.35)" : "rgba(120,120,120,0.45)";
    const labelColor = isDark ? "#aaa" : "#888";

    ctx.save();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1 * ui;
    ctx.setLineDash([2, 4]);
    for (let v = PREVIEW_Y_MIN; v <= PREVIEW_Y_MAX + 0.001; v += 0.5) {
      const y = yForVolts(v);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();
    }
    const majorTimeStep = windowSec / 10;
    for (let i = 0; i <= 10; i++) {
      const x = xForTime(i * majorTimeStep);
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + plotH);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    ctx.fillStyle = labelColor;
    ctx.font = (11 * ui) + "px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let v = PREVIEW_Y_MIN; v <= PREVIEW_Y_MAX + 0.001; v += 1) {
      ctx.fillText(v + " V", padLeft - 6 * ui, yForVolts(v));
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let i = 0; i <= 10; i += 2) {
      const t = i * majorTimeStep;
      ctx.fillText(formatNumber(t / timeInfo.scale) + " " + timeInfo.unit, xForTime(t), padTop + plotH + 6 * ui);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(padLeft, padTop, plotW, plotH);
    ctx.clip();
    ctx.strokeStyle = TRACE_COLORS[key];
    ctx.globalAlpha = channel.enabled ? 1 : 0.35;
    ctx.lineWidth = 2 * ui;
    ctx.beginPath();
    const samples = Math.max(200, Math.floor(plotW));
    for (let i = 0; i <= samples; i++) {
      const t = (i / samples) * windowSec;
      const y = yForVolts(waveVoltageAt(t, channel));
      const x = xForTime(t);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1 * ui;
    ctx.strokeRect(padLeft, padTop, plotW, plotH);
  }

  function drawPreviews() {
    CHANNEL_KEYS.forEach(drawPreview);
  }

  function refresh() {
    CHANNEL_KEYS.forEach(updateChannelUi);
    updateStatus();
    drawPreviews();
  }

  CHANNEL_KEYS.forEach(function (key) {
    const panel = document.querySelector('.fg_ch_panel[data-channel="' + key + '"]');
    if (!panel) return;
    const runButton = panel.querySelector(".fg_ch_run");
    if (runButton) {
      runButton.addEventListener("click", function () {
        state[key].enabled = !state[key].enabled;
        publishState();
        refresh();
      });
    }
    panel.querySelectorAll(".fg_wave_btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const wave = btn.dataset.wave;
        if (!wave) return;
        state[key].waveType = wave;
        publishState();
        refresh();
      });
    });
    setupScopeField(document.getElementById("FG_Frequency_" + key), function (hz) {
      state[key].frequency = hz;
      publishState();
      refresh();
    });
    setupScopeField(document.getElementById("FG_Period_" + key), function (seconds) {
      state[key].frequency = 1 / seconds;
      publishState();
      refresh();
    });
    setupScopeField(document.getElementById("FG_Amplitude_" + key), function (volts) {
      state[key].amplitude = volts;
      publishState();
      refresh();
    });
  });

  CHANNEL_KEYS.forEach(function (key) {
    const canvas = previewCanvases[key];
    if (canvas && canvas.parentElement && typeof ResizeObserver !== "undefined") {
      new ResizeObserver(function () { drawPreview(key); }).observe(canvas.parentElement);
    }
  });
  window.addEventListener("resize", drawPreviews);

  window.LABSOFT_fgOnThemeChange = drawPreviews;
  if (typeof window.LABSOFT_onDemoFgState === "function") {
    window.LABSOFT_onDemoFgState(function (next) {
      state = next;
      refresh();
    });
  } else {
    publishState();
    refresh();
  }
})();
