const config = {
  linkDemo: "",
  emailSuporte: "",
  classificacao: "10 anos",
  redes: [],
  criadores: [{ nome: "Ivan" }, { nome: "Ryan" }],
  lancamento: "",
  eventos: [],
  requisitos: "",
  ...window.NEYMAR_WORLD
};
const t = (text, values) => window.NW_I18N?.t(text, values) ?? text;
const localizedText = new Map();

function setLocalizedText(element, text, values) {
  element.textContent = Array.isArray(text) ? text.map((part) => t(part)).join(" ") : t(text, values);
  localizedText.set(element, { text, values });
}

document.addEventListener("nw:languagechange", () => {
  localizedText.forEach(({ text, values }, element) => setLocalizedText(element, text, values));
});

const nav = document.querySelector("#navegacao");
const mobileToggle = document.querySelector(".menu-toggle");
const mobileLayout = matchMedia("(max-width: 1100px)");
const navItems = [...nav.querySelectorAll("details")];

let activeDialog;
let returnFocus;

function closeNavigation() {
  navItems.forEach((item) => { item.open = false; });
  nav.removeAttribute("data-open");
  mobileToggle.setAttribute("aria-expanded", "false");
}

function showDialog(id, trigger) {
  const target = document.getElementById(id);
  if (!(target instanceof HTMLDialogElement) || activeDialog === target) return;

  if (activeDialog) {
    activeDialog.close();
  } else {
    returnFocus = mobileLayout.matches && nav.contains(trigger) ? mobileToggle : trigger;
  }

  closeNavigation();
  activeDialog = target;
  target.querySelector(".dialog-content").scrollTop = 0;
  target.showModal();
}

let checkingDemo = false;

async function enterDemo(trigger) {
  const url = config.linkDemo.trim();
  if (!url) {
    showDialog("demo", trigger);
    return;
  }

  if (checkingDemo) return;
  checkingDemo = true;
  try {
    const available = await checkAccount();
    if (available && accountUser) {
      window.location.assign(url);
      return;
    }

    showAccount(trigger, true);
    if (!available) {
      setAccountStatus(location.protocol === "file:"
        ? "Abra o site pelo servidor para criar uma conta ou entrar."
        : "Não foi possível conectar ao servidor. Tente novamente.", "error");
    }
  } finally {
    checkingDemo = false;
  }
}

mobileToggle.addEventListener("click", () => {
  if (nav.hasAttribute("data-open")) {
    closeNavigation();
    return;
  }

  nav.setAttribute("data-open", "");
  mobileToggle.setAttribute("aria-expanded", "true");
});
mobileLayout.addEventListener("change", closeNavigation);

document.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-demo], [data-dialog]");
  if (trigger?.hasAttribute("data-demo")) {
    enterDemo(trigger);
  } else if (trigger?.dataset.dialog === "conta") {
    showAccount(trigger, false);
    checkAccount().then((available) => {
      if (!available && accountDialog.open) {
        setAccountStatus(location.protocol === "file:"
          ? "Abra o site pelo servidor para criar uma conta ou entrar."
          : "Não foi possível conectar ao servidor. Tente novamente.", "error");
      }
    });
  } else if (trigger) {
    showDialog(trigger.dataset.dialog, trigger);
  } else if (nav.contains(event.target) && event.target.closest("a")) {
    const link = event.target.closest("a");
    const destination = document.getElementById(link.hash.slice(1));
    closeNavigation();
    destination?.setAttribute("tabindex", "-1");
    destination?.focus({ preventScroll: true });
  } else if (!event.target.closest(".header-inner")) {
    closeNavigation();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || activeDialog) return;

  const openItem = navItems.find((item) => item.open);
  if (nav.hasAttribute("data-open")) {
    closeNavigation();
    mobileToggle.focus();
  } else if (openItem) {
    openItem.open = false;
    openItem.querySelector("summary").focus();
  }
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("close", () => {
    dialog.querySelector("video")?.pause();
    if (dialog.open || activeDialog !== dialog) return;

    activeDialog = undefined;
    const focusTarget = returnFocus?.closest("details")?.querySelector("summary") ?? returnFocus;
    focusTarget?.focus({ preventScroll: true });
    returnFocus = undefined;
  });
});

const email = config.emailSuporte.trim();
if (email) {
  const contact = document.querySelector("#contato-suporte");
  contact.href = `mailto:${email}`;
  contact.hidden = false;
}

const rating = document.querySelector("[data-classificacao]");
const classification = config.classificacao || "10 anos";
setLocalizedText(rating, classification);
const ratingAge = document.querySelector(".rating-age");
const ratingNumber = /^(\d+)\s/.exec(classification)?.[1];
ratingAge.hidden = !ratingNumber;
if (ratingNumber) ratingAge.textContent = ratingNumber;

const socialList = document.querySelector("#redes-sociais");
const headerSocial = document.querySelector("#redes-topo");
const headerSocialLinks = new Map(
  [...document.querySelectorAll("#redes-topo [data-rede-topo]")].map((link) => [link.dataset.redeTopo, link])
);

config.redes.filter(({ link }) => link.trim()).forEach(({ nome, link }) => {
  const url = link.trim();
  const item = document.createElement("li");
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.textContent = nome;
  item.append(anchor);
  socialList.append(item);

  const headerLink = headerSocialLinks.get(nome.trim().toLowerCase());
  if (headerLink?.hidden) {
    headerLink.href = url;
    headerLink.hidden = false;
    headerSocial.hidden = false;
  }
});
if (socialList.childElementCount) {
  socialList.hidden = false;
  document.querySelector("#social-status").hidden = true;
}

const banner = document.querySelector("#video-banner");
const videoToggle = document.querySelector(".video-toggle");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

function updateVideoControl() {
  const playing = !banner.paused && !banner.ended;
  videoToggle.classList.toggle("is-playing", playing);
  videoToggle.setAttribute(
    "aria-label",
    t(playing ? "Pausar animação do banner" : "Reproduzir animação do banner")
  );
}

function playBanner() {
  banner.play().catch(updateVideoControl);
}

videoToggle.hidden = false;
videoToggle.addEventListener("click", () => {
  if (banner.paused) {
    playBanner();
  } else {
    banner.pause();
  }
});
banner.addEventListener("play", updateVideoControl);
banner.addEventListener("pause", updateVideoControl);
banner.addEventListener("error", () => { videoToggle.hidden = true; });
reducedMotion.addEventListener("change", ({ matches }) => {
  if (matches) banner.pause();
});
document.addEventListener("nw:languagechange", updateVideoControl);
document.addEventListener("nw:motionchange", ({ detail }) => {
  if (detail.reduced) banner.pause();
});
updateVideoControl();
if (!(window.NW_PREFS?.reducedMotion ?? reducedMotion.matches)) playBanner();

const playButton = document.querySelector("#jogar-demo");
const demoStatus = document.querySelector("#demo-status");
if (config.linkDemo.trim()) {
  playButton.hidden = false;
  setLocalizedText(demoStatus, "A demo está disponível no link abaixo.");
} else {
  setLocalizedText(demoStatus, demoStatus.textContent.trim());
}

const credits = document.querySelector("#lista-creditos");
if (config.criadores.some(({ nome }) => nome?.trim())) {
  credits.replaceChildren();
  config.criadores.forEach(({ nome, funcao }) => {
    if (!nome?.trim()) return;
    const item = document.createElement("li");
    item.textContent = funcao?.trim() ? `${nome} — ${funcao}` : nome;
    credits.append(item);
  });
}

const requirements = document.querySelector("#requisitos-jogo");
setLocalizedText(requirements, config.requisitos.trim() || requirements.textContent.trim());

function formatDate(date) {
  return new Intl.DateTimeFormat(document.documentElement.lang, {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(date);
}

const eventList = document.querySelector("#lista-eventos");
const eventsStatus = document.querySelector("#eventos-status");
setLocalizedText(eventsStatus, eventsStatus.textContent.trim());

function renderEvents() {
  eventList.replaceChildren();
  config.eventos
    .map((event) => ({ ...event, date: new Date(event.data) }))
    .filter(({ date, titulo }) => date.getTime() > Date.now() && titulo?.trim())
    .sort((first, second) => first.date - second.date)
    .forEach(({ date, titulo, descricao }) => {
      const item = document.createElement("li");
      const time = document.createElement("time");
      const title = document.createElement("strong");
      time.dateTime = date.toISOString();
      time.textContent = formatDate(date);
      title.textContent = titulo;
      item.append(time, " — ", title);

      if (descricao?.trim()) {
        const description = document.createElement("p");
        description.textContent = descricao;
        item.append(description);
      }

      eventList.append(item);
    });
  eventList.hidden = !eventList.childElementCount;
  eventsStatus.hidden = !eventList.hidden;
}

renderEvents();
document.addEventListener("nw:languagechange", renderEvents);

const launch = new Date(config.lancamento || "");
const launchStatus = document.querySelector("#lancamento-status");
const launchSummary = document.querySelector("#resumo-lancamento");
if (Number.isFinite(launch.getTime())) {
  const countdown = document.querySelector("#contagem");
  const countdownFields = Object.fromEntries(
    [...countdown.querySelectorAll("[data-unidade]")].map((field) => [field.dataset.unidade, field])
  );
  let countdownTimer;

  function updateLaunchMessage() {
    const arrived = launch <= Date.now();
    const message = arrived
      ? "A data prevista chegou. Confira as notícias para acompanhar a disponibilidade."
      : "Data prevista: {data} (horário de Brasília).";
    const values = arrived ? undefined : { data: formatDate(launch) };
    setLocalizedText(launchStatus, message, values);
    setLocalizedText(launchSummary, message, values);
  }

  function updateCountdown() {
    const secondsLeft = Math.ceil((launch - Date.now()) / 1000);
    if (secondsLeft <= 0) {
      updateLaunchMessage();
      countdown.hidden = true;
      clearInterval(countdownTimer);
      return;
    }

    countdownFields.dias.textContent = Math.floor(secondsLeft / 86400);
    countdownFields.horas.textContent = String(Math.floor(secondsLeft / 3600) % 24).padStart(2, "0");
    countdownFields.minutos.textContent = String(Math.floor(secondsLeft / 60) % 60).padStart(2, "0");
    countdownFields.segundos.textContent = String(secondsLeft % 60).padStart(2, "0");
  }

  document.addEventListener("nw:languagechange", updateLaunchMessage);
  updateLaunchMessage();
  countdown.hidden = false;
  updateCountdown();
  if (!countdown.hidden) countdownTimer = setInterval(updateCountdown, 1000);
} else {
  [launchStatus, launchSummary].forEach((element) => setLocalizedText(element, element.textContent.trim()));
}

const beachAudio = document.querySelector("#audio-ambiente");
const audioToggle = document.querySelector(".audio-toggle");
const audioStatus = document.querySelector("#audio-status");

function updateAudioButton() {
  audioToggle.setAttribute("aria-pressed", String(!beachAudio.paused));
}

audioToggle.hidden = false;
beachAudio.volume = 0.4;
beachAudio.addEventListener("play", updateAudioButton);
beachAudio.addEventListener("pause", updateAudioButton);
audioToggle.addEventListener("click", async () => {
  setLocalizedText(audioStatus, "");
  if (!beachAudio.paused) {
    beachAudio.pause();
    return;
  }

  try {
    await beachAudio.play();
  } catch (error) {
    if (error.name !== "AbortError") {
      setLocalizedText(audioStatus, "O som não conseguiu carregar. Tente novamente.");
    }
    updateAudioButton();
  }
});

const notificationStatus = {
  enviado: "A notificação por e-mail foi enviada.",
  pendente: "A notificação por e-mail está na fila.",
  sem_configuracao: "O envio por e-mail ainda está sendo configurado.",
  falhou: "A notificação por e-mail falhou. A equipe pode consultar a mensagem salva."
};

document.querySelectorAll("[data-mensagem]").forEach((form) => {
  const status = form.querySelector(".form-status");
  const submit = form.querySelector("button[type=submit]");
  const controls = [...form.querySelectorAll("input, textarea, button[type=submit]")];
  let pendingRequest;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    if (location.protocol === "file:") {
      status.dataset.state = "error";
      setLocalizedText(status, "Abra o site pelo servidor para que a mensagem possa ser gravada.");
      return;
    }

    const fields = new FormData(form);
    const body = JSON.stringify({
      tipo: form.dataset.mensagem,
      nome: fields.get("nome").trim(),
      email: fields.get("email").trim(),
      mensagem: fields.get("mensagem").trim(),
      personagem: fields.get("personagem")?.trim()
    });
    if (pendingRequest?.body !== body) {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      const key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      pendingRequest = { body, key };
    }

    status.removeAttribute("data-state");
    setLocalizedText(status, "Enviando…");
    controls.forEach((control) => { control.disabled = true; });
    try {
      const response = await fetch(form.getAttribute("action"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": pendingRequest.key
        },
        body
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.id) {
        const message = response.status === 429 ? "Aguarde um momento e tente novamente."
          : response.status === 400 ? "Revise os campos e tente novamente."
          : "O servidor não recebeu a mensagem. Tente novamente.";
        throw new Error(message);
      }

      const notification = notificationStatus[result.notificacao];
      status.dataset.state = "success";
      setLocalizedText(status, notification ? ["Mensagem salva.", notification] : "Mensagem salva.");
      form.reset();
      pendingRequest = undefined;
    } catch (error) {
      status.dataset.state = "error";
      setLocalizedText(status, error instanceof TypeError
        ? "Falha de conexão. Confira a internet e tente novamente."
        : error.message);
    } finally {
      controls.forEach((control) => { control.disabled = false; });
    }
  });
});

const accountDialog = document.querySelector("#conta");
const accountGuest = document.querySelector("#conta-visitante");
const accountMember = document.querySelector("#conta-logada");
const accountLabel = document.querySelector("#account-label");
const accountButton = document.querySelector(".button-account");
const accountAlert = document.querySelector("#conta-demo-aviso");
const accountStatus = document.querySelector("#conta-status");
const accountGreeting = document.querySelector("#conta-saudacao");
const accountEmail = document.querySelector("#conta-email");
const accountForms = [...accountGuest.querySelectorAll("[data-account]")];
const accountTabs = [...accountGuest.querySelectorAll("[data-account-form]")];
const accountLogout = document.querySelector("#sair-conta");

let accountUser = null;
let accountCheck;
let accountBusy = false;
let demoRequested = false;

function setAccountStatus(text, state) {
  setLocalizedText(accountStatus, text);
  if (state) accountStatus.dataset.state = state;
  else accountStatus.removeAttribute("data-state");
}

function renderAccount() {
  const label = accountUser ? "Minha conta" : "Entrar";
  const accessibleLabel = t(accountUser ? "Minha conta" : "Entrar na conta");
  setLocalizedText(accountLabel, label);
  accountButton.setAttribute("aria-label", accessibleLabel);
  accountButton.title = accessibleLabel;
  accountGuest.hidden = Boolean(accountUser);
  accountMember.hidden = !accountUser;
  accountAlert.hidden = !demoRequested || Boolean(accountUser);
  if (accountUser) {
    setLocalizedText(accountGreeting, "Olá, {nome}!", { nome: accountUser.nome });
    accountEmail.textContent = accountUser.email;
  } else {
    setLocalizedText(accountGreeting, "");
    accountEmail.textContent = "";
  }
}

function showAccount(trigger, wantsDemo) {
  demoRequested = wantsDemo;
  if (!accountDialog.open) setAccountStatus("");
  renderAccount();
  showDialog("conta", trigger);
}

function checkAccount() {
  if (location.protocol === "file:") return Promise.resolve(false);
  if (accountCheck) return accountCheck;

  accountCheck = fetch("/api/conta", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) return false;
      const data = await response.json();
      if (!Object.hasOwn(data, "usuario")) return false;
      accountUser = data.usuario;
      renderAccount();
      return true;
    })
    .catch(() => false)
    .finally(() => { accountCheck = undefined; });
  return accountCheck;
}

accountTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const mode = tab.dataset.accountForm;
    accountForms.forEach((form) => { form.hidden = form.dataset.account !== mode; });
    accountTabs.forEach((option) => {
      option.setAttribute("aria-pressed", String(option === tab));
    });
    setAccountStatus("");
  });
});

const accountErrors = {
  400: "Revise os campos e tente novamente.",
  401: "Confira o e-mail e a senha.",
  409: "Este e-mail já está cadastrado.",
  422: "Revise os campos e tente novamente.",
  429: "Aguarde um momento e tente novamente."
};

async function updateAccount(path, fields, controls, success) {
  if (accountBusy) return false;
  if (location.protocol === "file:") {
    setAccountStatus("Abra o site pelo servidor para criar uma conta ou entrar.", "error");
    return false;
  }

  accountBusy = true;
  controls.forEach((control) => { control.disabled = true; });
  setAccountStatus("Carregando…");
  try {
    await accountCheck;
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !Object.hasOwn(data, "usuario")) {
      setAccountStatus(accountErrors[response.status] ||
        "Os dados da conta não puderam ser atualizados. Tente novamente.", "error");
      return false;
    }

    accountUser = data.usuario;
    renderAccount();
    setAccountStatus(success, "success");
    return true;
  } catch {
    setAccountStatus("Não foi possível conectar ao servidor. Tente novamente.", "error");
    return false;
  } finally {
    accountBusy = false;
    controls.forEach((control) => { control.disabled = false; });
  }
}

accountForms.forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(form));
    const signup = form.dataset.account === "cadastro";
    const saved = await updateAccount(
      form.getAttribute("action"), fields, [...form.elements, ...accountTabs],
      signup ? "Conta criada." : "Você entrou na conta."
    );
    if (!saved) return;

    form.reset();
    if (demoRequested && accountDialog.open && accountUser && config.linkDemo.trim()) {
      window.location.assign(config.linkDemo.trim());
    } else if (accountDialog.open) {
      accountLogout.focus();
    }
  });
});

accountLogout.addEventListener("click", async () => {
  const signedOut = await updateAccount("/api/conta/sair", {}, [accountLogout], "Você saiu da conta.");
  if (signedOut) {
    accountTabs[0].click();
    setAccountStatus("Você saiu da conta.", "success");
    if (accountDialog.open) accountTabs[0].focus();
  }
});

document.addEventListener("nw:languagechange", renderAccount);
renderAccount();
checkAccount();
