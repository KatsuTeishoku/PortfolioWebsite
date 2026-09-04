(function () {
  "use strict";

  const THEME_KEY = "LABSOFT_UI_THEME";
  const CHANNEL = "LABSOFT_UI_THEME";

  function readTheme() {
    try {
      return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
    } catch (e) {
      return "dark";
    }
  }

  function applyTheme(theme) {
    const next = theme === "light" ? "light" : "dark";
    if (next === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }

    const button = document.getElementById("Theme_Toggle");
    if (button) {
      const toLight = next === "dark";
      button.setAttribute("aria-label", toLight ? "Switch to light mode" : "Switch to dark mode");
      button.title = toLight ? "Light mode" : "Dark mode";
    }

    if (typeof window.LABSOFT_fgOnThemeChange === "function") {
      window.LABSOFT_fgOnThemeChange();
    }
  }

  function persistTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      /* ignore */
    }
  }

  let channel = null;
  try {
    channel = new BroadcastChannel(CHANNEL);
  } catch (e) {
    channel = null;
  }

  function setTheme(theme, broadcast) {
    applyTheme(theme);
    persistTheme(theme);
    if (broadcast && channel) {
      channel.postMessage({ type: "theme", theme: theme });
    }
  }

  applyTheme(readTheme());

  window.addEventListener("DOMContentLoaded", function () {
    applyTheme(readTheme());
    const button = document.getElementById("Theme_Toggle");
    if (button) {
      button.addEventListener("click", function () {
        setTheme(readTheme() === "dark" ? "light" : "dark", true);
      });
    }
  });

  window.addEventListener("storage", function (event) {
    if (event.key === THEME_KEY && event.newValue) {
      applyTheme(event.newValue === "light" ? "light" : "dark");
    }
  });

  if (channel) {
    channel.addEventListener("message", function (event) {
      if (event.data && event.data.type === "theme") {
        applyTheme(event.data.theme);
      }
    });
  }

  window.LABSOFT_setUiTheme = setTheme;
  window.LABSOFT_getUiTheme = readTheme;
})();
