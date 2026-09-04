(function () {
  "use strict";

  const ADCS_MAGIC = 0x41444353;
  const DEFAULT_VREF = 5;
  // Browser stand-in for USB/WebSocket delivery. Real LABSoft also does not
  // ingest on every display frame; it ingests when an ADCS packet arrives.
  const MIN_FRAME_PERIOD_MS = 50;

  function waveVoltageAt(t, channel) {
    if (!channel || !channel.enabled) return 0;
    const f = channel.frequency;
    const offset = Number.isFinite(channel.offset) ? channel.offset : 0;
    const amp = Number.isFinite(channel.amplitude) ? channel.amplitude : 1;
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

  function voltsToAdc12(volts, vref, dcOffset) {
    const adc = Math.round(((volts + dcOffset) * 4096) / vref);
    return Math.max(0, Math.min(4095, adc));
  }

  function packSample(ch1Volts, ch2Volts, vref, dcOffset) {
    const adc1 = voltsToAdc12(ch1Volts, vref, dcOffset);
    const adc2 = voltsToAdc12(ch2Volts, vref, dcOffset);
    return ((adc1 & 0x0FFF) << 18) | ((adc2 & 0x0FFF) << 2);
  }

  function acquisition() {
    const count = Math.max(16, Math.min(2000, window.LABSOFT_SAMPLE_COUNT || 2000));
    const rate = window.LABSOFT_SAMPLE_RATE > 0 ? window.LABSOFT_SAMPLE_RATE : 0;
    return { count: count, rate: rate };
  }

  function framePeriodMs(count, rate) {
    if (!(rate > 0) || !(count > 0)) return 0;
    return Math.max(MIN_FRAME_PERIOD_MS, Math.round((1000 * count) / rate));
  }

  let packetBuffer = null;
  let packetView = null;
  let sampleIndex = 0;
  let timer = null;

  function ensurePacket(count) {
    const bytes = 16 + count * 4;
    if (!packetBuffer || packetBuffer.byteLength < bytes) {
      packetBuffer = new ArrayBuffer(bytes);
      packetView = new DataView(packetBuffer);
    }
    return packetView;
  }

  function currentFg() {
    return typeof window.LABSOFT_getDemoFgState === "function"
      ? window.LABSOFT_getDemoFgState()
      : { ch1: { enabled: false }, ch2: { enabled: false } };
  }

  function pushDemoFrame() {
    const ingest = window.ingestWebSocketFrame;
    if (typeof ingest !== "function") return;

    const acq = acquisition();
    if (!(acq.rate > 0)) return;

    const fg = currentFg();
    const vref = window.LABSOFT_VREF > 0 ? window.LABSOFT_VREF : DEFAULT_VREF;
    const dcOffset = Number.isFinite(window.LABSOFT_DC_OFFSET)
      ? window.LABSOFT_DC_OFFSET
      : vref / 2;

    const view = ensurePacket(acq.count);
    view.setUint32(0, ADCS_MAGIC, false);
    view.setUint32(4, Math.round(acq.rate), false);
    view.setUint32(8, acq.count, false);
    view.setUint32(12, 0, false);

    for (let i = 0; i < acq.count; i++) {
      const t = (sampleIndex + i) / acq.rate;
      view.setUint32(
        16 + i * 4,
        packSample(waveVoltageAt(t, fg.ch1), waveVoltageAt(t, fg.ch2), vref, dcOffset),
        false
      );
    }
    sampleIndex += acq.count;
    ingest(packetBuffer);
  }

  function armStream() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }

    function tick() {
      pushDemoFrame();
      const acq = acquisition();
      const period = framePeriodMs(acq.count, acq.rate);
      timer = period > 0 ? setTimeout(tick, period) : null;
    }

    const acq = acquisition();
    const period = framePeriodMs(acq.count, acq.rate);
    if (period > 0) {
      timer = setTimeout(tick, 0);
    }
  }

  window.LABSOFT_DEMO_PREVIEW = true;
  armStream();

  ["sampling_rate", "number_of_samples"].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("change", armStream);
    }
  });
  setInterval(function () {
    if (timer === null && framePeriodMs(acquisition().count, acquisition().rate) > 0) {
      armStream();
    }
  }, 500);
})();
