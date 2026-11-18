const config = {
  linkDemo: "",
  emailSuporte: "",
  classificacao: "A confirmar",
  redes: [],
  criadores: [],
  lancamento: "",
  eventos: [],
  requisitos: "",
  ...window.NEYMAR_WORLD
};
const nav = document.querySelector("#navegacao");
const mobileToggle = document.querySelector(".menu-toggle");
const mobileLayout = matchMedia("(max-width: 960px)");
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

function enterDemo(trigger) {
  const url = config.linkDemo.trim();
  if (url) {
    window.location.assign(url);
    return;
  }

  showDialog("demo", trigger);
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

document.querySelector("[data-classificacao]").textContent = config.classificacao;

const socialList = document.querySelector("#redes-sociais");
config.redes.filter(({ link }) => link.trim()).forEach(({ nome, link }) => {
  const item = document.createElement("li");
  const anchor = document.createElement("a");
  anchor.href = link;
  anchor.textContent = nome;
  item.append(anchor);
  socialList.append(item);
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
    playing ? "Pausar animação do banner" : "Reproduzir animação do banner"
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
if (!reducedMotion.matches) playBanner();

const playLink = document.querySelector("#jogar-demo");
if (config.linkDemo.trim()) {
  playLink.href = config.linkDemo.trim();
  playLink.hidden = false;
  document.querySelector("#demo-status").textContent = "A demo está disponível no link abaixo.";
}

const credits = document.querySelector("#lista-creditos");
config.criadores.forEach(({ nome, funcao }) => {
  if (!nome?.trim()) return;
  const item = document.createElement("li");
  item.textContent = funcao?.trim() ? `${nome} — ${funcao}` : nome;
  credits.append(item);
});
if (credits.childElementCount) {
  credits.hidden = false;
  document.querySelector("#creditos-status").hidden = true;
}

if (config.requisitos.trim()) {
  document.querySelector("#requisitos-jogo").textContent = config.requisitos;
}

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo"
});

const eventList = document.querySelector("#lista-eventos");
config.eventos
  .map((event) => ({ ...event, date: new Date(event.data) }))
  .filter(({ date, titulo }) => date.getTime() > Date.now() && titulo?.trim())
  .sort((first, second) => first.date - second.date)
  .forEach(({ date, titulo, descricao }) => {
    const item = document.createElement("li");
    const time = document.createElement("time");
    const title = document.createElement("strong");
    time.dateTime = date.toISOString();
    time.textContent = dateFormat.format(date);
    title.textContent = titulo;
    item.append(time, " — ", title);

    if (descricao?.trim()) {
      const description = document.createElement("p");
      description.textContent = descricao;
      item.append(description);
    }

    eventList.append(item);
  });
if (eventList.childElementCount) {
  eventList.hidden = false;
  document.querySelector("#eventos-status").hidden = true;
}

const launch = new Date(config.lancamento || "");
if (Number.isFinite(launch.getTime())) {
  const countdown = document.querySelector("#contagem");
  const launchStatus = document.querySelector("#lancamento-status");
  const launchSummary = document.querySelector("#resumo-lancamento");
  const countdownFields = Object.fromEntries(
    [...countdown.querySelectorAll("[data-unidade]")].map((field) => [field.dataset.unidade, field])
  );
  const launchText = `Data prevista: ${dateFormat.format(launch)} (horário de Brasília).`;
  let countdownTimer;

  function updateCountdown() {
    const secondsLeft = Math.ceil((launch - Date.now()) / 1000);
    if (secondsLeft <= 0) {
      const text = "A data prevista chegou. Confira as notícias para acompanhar a disponibilidade.";
      launchStatus.textContent = text;
      launchSummary.textContent = text;
      countdown.hidden = true;
      clearInterval(countdownTimer);
      return;
    }

    countdownFields.dias.textContent = Math.floor(secondsLeft / 86400);
    countdownFields.horas.textContent = String(Math.floor(secondsLeft / 3600) % 24).padStart(2, "0");
    countdownFields.minutos.textContent = String(Math.floor(secondsLeft / 60) % 60).padStart(2, "0");
    countdownFields.segundos.textContent = String(secondsLeft % 60).padStart(2, "0");
  }

  launchStatus.textContent = launchText;
  launchSummary.textContent = launchText;
  countdown.hidden = false;
  updateCountdown();
  if (!countdown.hidden) countdownTimer = setInterval(updateCountdown, 1000);
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
  audioStatus.textContent = "";
  if (!beachAudio.paused) {
    beachAudio.pause();
    return;
  }

  try {
    await beachAudio.play();
  } catch (error) {
    if (error.name !== "AbortError") {
      audioStatus.textContent = "O som não conseguiu carregar. Tente novamente.";
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
      status.textContent = "Abra o site pelo servidor para que a mensagem possa ser gravada.";
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
    status.textContent = "Enviando…";
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
        throw new Error(result.erro || "O servidor não recebeu a mensagem. Tente novamente.");
      }

      const notification = notificationStatus[result.notificacao] ?? "";
      status.dataset.state = "success";
      status.textContent = `Mensagem salva. ${notification}`.trim();
      form.reset();
      pendingRequest = undefined;
    } catch (error) {
      status.dataset.state = "error";
      status.textContent = error instanceof TypeError
        ? "Falha de conexão. Confira a internet e tente novamente."
        : error.message;
    } finally {
      controls.forEach((control) => { control.disabled = false; });
    }
  });
});
