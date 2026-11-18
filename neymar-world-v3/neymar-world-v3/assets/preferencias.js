(() => {
  const storageKey = "nw-preferencias";
  const fields = {
    tema: document.querySelector("#pref-tema"),
    contraste: document.querySelector("#pref-contraste"),
    texto: document.querySelector("#pref-texto"),
    movimento: document.querySelector("#pref-movimento"),
    cursor: document.querySelector("#pref-cursor")
  };
  const themes = ["sistema", "claro", "escuro"];
  const root = document.documentElement;
  const systemDark = matchMedia("(prefers-color-scheme: dark)");
  const systemReducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let saved;

  try {
    saved = JSON.parse(localStorage.getItem(storageKey));
  } catch {
    saved = null;
  }

  const preferences = {
    tema: themes.includes(saved?.tema) ? saved.tema : "sistema",
    contraste: saved?.contraste === true,
    texto: saved?.texto === true,
    movimento: saved?.movimento === true,
    cursor: saved?.cursor === true
  };

  window.NW_PREFS = {
    get reducedMotion() {
      return preferences.movimento || systemReducedMotion.matches;
    }
  };

  let previousMotion;
  function applyPreferences() {
    root.dataset.tema = preferences.tema === "sistema"
      ? (systemDark.matches ? "escuro" : "claro")
      : preferences.tema;
    root.toggleAttribute("data-contraste", preferences.contraste);
    root.toggleAttribute("data-texto", preferences.texto);
    root.toggleAttribute("data-cursor-padrao", preferences.cursor);

    const reduced = window.NW_PREFS.reducedMotion;
    root.toggleAttribute("data-movimento", reduced);
    if (reduced !== previousMotion) {
      previousMotion = reduced;
      document.dispatchEvent(new CustomEvent("nw:motionchange", { detail: { reduced } }));
    }
  }

  for (const [name, field] of Object.entries(fields)) {
    if (!field) continue;
    const setting = name === "tema" ? "value" : "checked";
    field[setting] = preferences[name];
    field.addEventListener("change", () => {
      preferences[name] = field[setting];
      applyPreferences();
      try {
        localStorage.setItem(storageKey, JSON.stringify(preferences));
      } catch {
        // Os ajustes continuam valendo na aba atual quando o armazenamento está indisponível.
      }
    });
  }

  systemDark.addEventListener("change", applyPreferences);
  systemReducedMotion.addEventListener("change", applyPreferences);
  applyPreferences();

  const dialog = document.querySelector("#preferencias");
  const playButton = document.querySelector("#pref-narrar");
  const stopButton = document.querySelector("#pref-parar");
  const status = document.querySelector("#narrador-status");
  if (!dialog || !playButton || !stopButton || !status) return;

  const speech = window.speechSynthesis;
  let statusText = "";
  let playback = 0;
  let currentPhrase;

  function announce(text) {
    statusText = text;
    status.textContent = window.NW_I18N?.t(text) ?? text;
  }

  document.addEventListener("nw:languagechange", () => {
    if (currentPhrase) {
      stopNarration();
      announce("Narração parada.");
    } else if (statusText) {
      announce(statusText);
    }
  });

  if (!speech || typeof SpeechSynthesisUtterance !== "function") {
    playButton.disabled = true;
    stopButton.disabled = true;
    announce("A narração não está disponível neste navegador.");
    return;
  }

  function currentReadingSection() {
    const openDialog = document.querySelector("dialog[open]:not(#preferencias)");
    if (openDialog) return openDialog.querySelector(".dialog-content") || openDialog;

    const headerBottom = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0;
    let section;
    let visibleHeight = 0;

    for (const candidate of document.querySelectorAll("main > section, .site-footer")) {
      const bounds = candidate.getBoundingClientRect();
      const height = Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, headerBottom);
      if (height > visibleHeight) {
        visibleHeight = height;
        section = candidate;
      }
    }
    return section;
  }

  function readingPhrases(section) {
    const selector = "h1, h2, h3, h4, h5, h6, p, summary, li, figcaption, dt, dd";
    const phrases = [];
    for (const block of section?.querySelectorAll(selector) ?? []) {
      if (block.closest("[hidden], [aria-hidden='true'], .visually-hidden, form")) continue;
      if (!block.getClientRects().length || getComputedStyle(block).visibility !== "visible") continue;
      if (block.parentElement.closest(selector)) continue;

      const collapsed = block.closest("details:not([open])");
      if (collapsed && !collapsed.querySelector(":scope > summary")?.contains(block)) continue;

      const text = block.innerText.trim() || block.querySelector("img[alt]")?.alt.trim();
      if (!text) continue;
      phrases.push(...(text.replace(/\s+/g, " ").match(/.{1,240}(?:\s|$)|\S+/g) ?? []));
    }
    return phrases;
  }

  function stopNarration() {
    playback += 1;
    currentPhrase = undefined;
    speech.cancel();
    if (dialog.open && document.activeElement === stopButton) playButton.focus();
    stopButton.disabled = true;
  }

  playButton.addEventListener("click", () => {
    const phrases = readingPhrases(currentReadingSection());
    stopNarration();
    if (!phrases.length) {
      announce("Nenhum texto para narrar.");
      return;
    }

    const session = playback;
    const language = root.lang || "pt-BR";
    function speak(index) {
      if (session !== playback) return;
      if (index >= phrases.length) {
        stopNarration();
        announce("Narração finalizada.");
        return;
      }

      const phrase = new SpeechSynthesisUtterance(phrases[index]);
      currentPhrase = phrase;
      phrase.lang = language;
      phrase.onend = () => speak(index + 1);
      phrase.onerror = () => {
        if (session !== playback) return;
        stopNarration();
        announce("Não foi possível iniciar a narração.");
      };
      speech.speak(phrase);
    }

    stopButton.disabled = false;
    announce("Narrando…");
    speak(0);
  });

  stopButton.addEventListener("click", () => {
    stopNarration();
    announce("Narração parada.");
  });

  dialog.addEventListener("close", () => {
    if (dialog.open || !currentPhrase) return;
    stopNarration();
    announce("Narração parada.");
  });

  window.addEventListener("pagehide", stopNarration);
})();
