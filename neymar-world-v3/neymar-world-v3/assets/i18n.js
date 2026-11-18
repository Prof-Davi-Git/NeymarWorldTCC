(() => {
  "use strict";

  const defaultLanguage = "pt-BR";
  const storageKey = "neymar-world-language";
  const languages = new Set([defaultLanguage, "en", "es", "fr", "de", "it", "ja", "ko", "zh", "ar"]);
  const data = window.NW_LOCALE_DATA ?? {};
  const normalize = (source) => source.trim().replace(/\s+/gu, " ");
  const catalog = new Map(
    (data.source ?? []).map((source, index) => [normalize(source), index])
  );
  const selector = document.querySelector("#pref-idioma");
  const ignored = "#pref-idioma, [data-dynamic-i18n], script, style, template";
  const textBindings = [];
  const attributeBindings = [];
  let language = defaultLanguage;

  function format(source, index) {
    const translation = data[language]?.[index];
    if (typeof translation !== "string" || !translation.trim()) return source;

    const leading = source.match(/^\s*/u)[0];
    const trailing = source.match(/\s*$/u)[0];
    return leading + translation + trailing;
  }

  function t(source, params = {}) {
    const translation = format(source, catalog.get(normalize(source)));
    return translation.replace(/\{([\w-]+)\}/gu, (placeholder, key) =>
      Object.hasOwn(params, key) ? String(params[key]) : placeholder
    );
  }

  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const source = node.data;
    const index = catalog.get(normalize(source));
    if (index === undefined || node.parentElement?.closest(ignored)) continue;
    textBindings.push({ node, source, index });
  }

  const attributeNames = ["aria-label", "title", "alt", "placeholder"];
  const metadata = "meta[name='description']";
  const attributeTargets = [...attributeNames.map((name) => `[${name}]`), metadata].join(", ");
  for (const element of document.querySelectorAll(attributeTargets)) {
    if (element.closest(ignored)) continue;
    const names = element.matches(metadata) ? [...attributeNames, "content"] : attributeNames;
    for (const name of names) {
      const source = element.getAttribute(name);
      if (source === null) continue;
      const index = catalog.get(normalize(source));
      if (index !== undefined) attributeBindings.push({ element, name, source, index });
    }
  }

  function applyLanguage(preference) {
    language = languages.has(preference) ? preference : defaultLanguage;
    document.documentElement.lang = language === "zh" ? "zh-Hans" : language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    if (selector) selector.value = language;

    for (const { node, source, index } of textBindings) {
      if (node.isConnected && !node.parentElement?.closest(ignored)) {
        node.data = format(source, index);
      }
    }
    for (const { element, name, source, index } of attributeBindings) {
      if (element.isConnected && !element.closest(ignored)) {
        element.setAttribute(name, format(source, index));
      }
    }

    document.dispatchEvent(new CustomEvent("nw:languagechange", {
      bubbles: true,
      detail: { language }
    }));
  }

  function storedLanguage() {
    try {
      return window.localStorage.getItem(storageKey);
    } catch {
      return defaultLanguage;
    }
  }

  selector?.addEventListener("change", () => {
    applyLanguage(selector.value);
    try {
      window.localStorage.setItem(storageKey, language);
    } catch {
      // The language still works for the current page.
    }
  });

  window.NW_I18N = {
    t,
    get language() { return language; }
  };
  applyLanguage(storedLanguage());
})();
