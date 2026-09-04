(function () {
  "use strict";

  const CHANNEL_NAME = "LABSOFT_DEMO_BUS";
  const STORAGE_KEY = "LABSOFT_DEMO_FG_STATE";
  const defaultChannel = {
    enabled: false,
    waveType: "sine",
    frequency: 100,
    amplitude: 1,
    offset: 0
  };

  function cloneState(state) {
    return {
      ch1: Object.assign({}, defaultChannel, state && state.ch1),
      ch2: Object.assign({}, defaultChannel, {
        waveType: "square",
        frequency: 200
      }, state && state.ch2)
    };
  }

  let state = cloneState(null);

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      state = cloneState(JSON.parse(stored));
    }
  } catch (e) {
    /* ignore */
  }

  let channel = null;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch (e) {
    channel = null;
  }

  const listeners = [];

  function notify() {
    listeners.forEach(function (fn) {
      try {
        fn(cloneState(state));
      } catch (e) {
        /* ignore */
      }
    });
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* ignore */
    }
  }

  function publish() {
    persist();
    if (channel) {
      channel.postMessage({ type: "fg.state", channels: cloneState(state) });
    }
    notify();
  }

  window.LABSOFT_getDemoFgState = function () {
    return cloneState(state);
  };

  window.LABSOFT_setDemoFgState = function (next) {
    state = cloneState(next);
    publish();
  };

  window.LABSOFT_onDemoFgState = function (fn) {
    if (typeof fn === "function") {
      listeners.push(fn);
      fn(cloneState(state));
    }
  };

  if (channel) {
    channel.addEventListener("message", function (event) {
      if (event.data && event.data.type === "fg.state") {
        state = cloneState(event.data.channels);
        persist();
        notify();
      }
    });
  }

  window.addEventListener("storage", function (event) {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        state = cloneState(JSON.parse(event.newValue));
        notify();
      } catch (e) {
        /* ignore */
      }
    }
  });
})();
