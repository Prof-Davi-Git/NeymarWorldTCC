import { createReadStream, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { isIP } from "node:net";
import { dirname, extname, join, resolve, sep } from "node:path";
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";

const root = dirname(import.meta.filename);
const dbPath = resolve(root, process.env.SQLITE_PATH?.trim() || "dados/mensagens.sqlite");
const apiKey = process.env.RESEND_API_KEY?.trim();
const sender = process.env.EMAIL_REMETENTE?.trim();
const recipient = process.env.EMAIL_DESTINO?.trim();
const emailConfigured = Boolean(apiKey && sender && recipient);
const retries = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];
const maxBody = 16 * 1024;
const sessionDuration = 7 * 24 * 60 * 60 * 1000;
const sessionName = "nw_sessao";
const originSetting = process.env.SITE_ORIGIN?.trim();
const siteOrigin = originSetting ? new URL(originSetting) : null;
if (siteOrigin && (!["http:", "https:"].includes(siteOrigin.protocol)
    || siteOrigin.username || siteOrigin.password || siteOrigin.pathname !== "/"
    || siteOrigin.search || siteOrigin.hash)) {
  throw new Error("SITE_ORIGIN precisa ser o endereço de origem do site, sem caminho ou credenciais.");
}

mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS mensagens (
    id TEXT PRIMARY KEY,
    chave TEXT UNIQUE,
    tipo TEXT NOT NULL,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    personagem TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    recebida_em TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendente',
    tentativas INTEGER NOT NULL DEFAULT 0,
    proxima_tentativa INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_notificacoes
  ON mensagens (proxima_tentativa) WHERE estado = 'pendente';
  CREATE TABLE IF NOT EXISTS contas (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha_salt BLOB NOT NULL,
    senha_hash BLOB NOT NULL,
    criada_em TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessoes (
    token_hash TEXT PRIMARY KEY,
    conta_id TEXT NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
    expira_em INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessoes_expiracao ON sessoes (expira_em);
`);

function csvCell(value) {
  const text = String(value ?? "");
  // Treat a value that looks like a spreadsheet formula as text.
  const prefix = /^[\s]*[=+@-]/.test(text.normalize("NFKC")) ? "'" : "";
  return `"${prefix}${text.replaceAll('"', '""')}"`;
}

if (process.argv.includes("--mensagens") || process.argv.includes("--feedback-csv")) {
  const rows = db.prepare(`
    SELECT id, tipo, nome, email, personagem, mensagem, recebida_em, estado AS notificacao
    FROM mensagens ORDER BY recebida_em DESC
  `).all();

  if (process.argv.includes("--feedback-csv")) {
    const destination = join(dirname(dbPath), "feedback.csv");
    const temporary = `${destination}.${randomUUID()}.tmp`;
    const header = ["Protocolo", "Tipo", "Nome", "E-mail", "Personagem", "Mensagem", "Recebida em (UTC)", "Notificação"];
    const contents = [header, ...rows.map(Object.values)].map((row) => row.map(csvCell).join(";"));
    writeFileSync(temporary, "\uFEFF" + contents.join("\r\n") + "\r\n", { mode: 0o600, flag: "wx" });
    renameSync(temporary, destination);
    console.log(`Planilha gerada em ${destination}`);
  } else {
    console.log(JSON.stringify(rows, null, 2));
  }
  db.close();
  process.exit();
}

const insert = db.prepare(`
  INSERT INTO mensagens
    (id, chave, tipo, nome, email, personagem, mensagem, recebida_em, proxima_tentativa)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(chave) DO NOTHING
`);
const byId = db.prepare("SELECT * FROM mensagens WHERE id = ?");
const byKey = db.prepare("SELECT * FROM mensagens WHERE chave = ?");
const nextMessage = db.prepare(`
  SELECT id FROM mensagens WHERE estado = 'pendente' AND proxima_tentativa <= ?
  ORDER BY proxima_tentativa LIMIT 1
`);
const claim = db.prepare(`
  UPDATE mensagens SET proxima_tentativa = ?
  WHERE id = ? AND estado = 'pendente' AND proxima_tentativa <= ?
  RETURNING *
`);
const finish = db.prepare(`
  UPDATE mensagens SET estado = ?, tentativas = tentativas + 1, proxima_tentativa = ?
  WHERE id = ?
`);
const accountsByEmail = db.prepare("SELECT * FROM contas WHERE email = ?");
const addAccount = db.prepare(`
  INSERT INTO contas (id, nome, email, senha_salt, senha_hash, criada_em)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(email) DO NOTHING
`);
const accountForSession = db.prepare(`
  SELECT contas.nome, contas.email
  FROM sessoes JOIN contas ON contas.id = sessoes.conta_id
  WHERE sessoes.token_hash = ? AND sessoes.expira_em > ?
`);
const addSession = db.prepare("INSERT INTO sessoes VALUES (?, ?, ?)");
const deleteSession = db.prepare("DELETE FROM sessoes WHERE token_hash = ?");
const expireSessions = db.prepare("DELETE FROM sessoes WHERE expira_em <= ?");

let delivering = false;

async function sendNotification(id) {
  if (!emailConfigured || delivering || !id) return;

  delivering = true;
  try {
    const now = Date.now();
    // If the process stops mid-request, another worker can reclaim the message.
    const message = claim.get(now + 60_000, id, now);
    if (!message) return;

    try {
      const lines = [`Protocolo: ${message.id}`, `Nome: ${message.nome}`];
      if (message.email) lines.push(`E-mail: ${message.email}`);
      if (message.personagem) lines.push(`Personagem: ${message.personagem}`);
      lines.push("", message.mensagem);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(4500),
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `neymar-world/${message.id}`
        },
        body: JSON.stringify({
          from: sender,
          to: [recipient],
          subject: message.tipo === "sugestao"
            ? "Neymar World — nova sugestão"
            : "Neymar World — novo contato",
          text: lines.join("\n"),
          ...(message.email ? { reply_to: message.email } : {})
        })
      });
      await response.body?.cancel();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      const delay = retries[message.tentativas];
      finish.run(delay ? "pendente" : "falhou", delay ? Date.now() + delay : 0, id);
      console.error(`Notificação ${id} pendente ou rejeitada: ${error.message}`);
      return;
    }

    finish.run("enviado", 0, id);
  } finally {
    delivering = false;
  }
}

function json(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

class PublicError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readPayload(request) {
  const contentType = request.headers["content-type"]?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new PublicError(415, "Envie a mensagem no formato JSON.");
  }
  if (Number(request.headers["content-length"]) > maxBody) {
    throw new PublicError(413, "A mensagem é grande demais.");
  }

  const chunks = [];
  let length = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    length += chunk.length;
    if (length > maxBody) throw new PublicError(413, "A mensagem é grande demais.");
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new PublicError(400, "O conteúdo da mensagem é inválido.");
  }
}

function cleanFields(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new PublicError(400, "Preencha os campos do formulário.");
  }
  const tipo = payload.tipo;
  if (tipo !== "contato" && tipo !== "sugestao") {
    throw new PublicError(400, "Selecione um tipo de mensagem válido.");
  }

  function field(name, label, min, max) {
    const input = payload[name] ?? "";
    if (typeof input !== "string" || input.includes("\0")) {
      throw new PublicError(400, `O campo "${label}" é inválido.`);
    }
    const value = input.trim();
    if (value.length < min || value.length > max) {
      throw new PublicError(400, `Revise o tamanho do campo "${label}".`);
    }
    return value;
  }

  const nome = field("nome", "Nome", 2, 80);
  const email = field("email", "E-mail", tipo === "contato" ? 3 : 0, 254);
  const mensagem = field("mensagem", "Mensagem", 10, 2000);
  const personagem = tipo === "sugestao" ? field("personagem", "Personagem", 0, 120) : "";
  if (email && !validEmail.test(email)) {
    throw new PublicError(400, "Informe um endereço de e-mail válido.");
  }
  return { tipo, nome, email, personagem, mensagem };
}

const attempts = new Map();
const limitWindow = 10 * 60_000;
const proxyHops = Number(process.env.PROXY_HOPS || 0);
const validEmail = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

function forwardedValue(request, header) {
  if (Number.isInteger(proxyHops) && proxyHops > 0 && proxyHops <= 5) {
    return request.headers[header]?.split(",").at(-proxyHops)?.trim().toLowerCase();
  }
}

function requestAddress(request) {
  const trusted = forwardedValue(request, "x-forwarded-for");
  if (trusted && isIP(trusted)) return trusted;
  return request.socket.remoteAddress || "desconhecido";
}

function checkOrigin(request) {
  const origin = request.headers.origin;
  const site = request.headers["sec-fetch-site"];
  if (site === "cross-site" || site === "same-site") {
    throw new PublicError(403, "Abra o formulário pelo endereço do site.");
  }
  if (origin) {
    let expectedOrigin = false;
    try {
      const parsed = new URL(origin);
      expectedOrigin = siteOrigin
        ? parsed.origin === siteOrigin.origin
        : ["http:", "https:"].includes(parsed.protocol) && parsed.host === request.headers.host;
    } catch {
      // Malformed or opaque browser origin.
    }
    if (!expectedOrigin) throw new PublicError(403, "Abra o formulário pelo endereço do site.");
  }
}

function limitRequests(key, response, limit) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.expires <= now) {
    attempts.set(key, { count: 1, expires: now + limitWindow });
    return;
  }
  if (current.count >= limit) {
    response.setHeader("Retry-After", String(Math.ceil((current.expires - now) / 1000)));
    throw new PublicError(429, "Muitas tentativas. Aguarde alguns minutos e tente novamente.");
  }
  current.count += 1;
}

async function saveMessage(request, response) {
  checkOrigin(request);
  limitRequests(`mensagens:${requestAddress(request)}`, response, 12);
  const fields = cleanFields(await readPayload(request));
  const key = request.headers["idempotency-key"] || null;
  if (key && !/^[A-Za-z0-9-]{16,100}$/.test(key)) {
    throw new PublicError(400, "O identificador do envio é inválido.");
  }

  const id = randomUUID();
  const result = insert.run(id, key, fields.tipo, fields.nome, fields.email,
    fields.personagem, fields.mensagem, new Date().toISOString(), Date.now());
  const created = result.changes > 0;
  const saved = created ? byId.get(id) : byKey.get(key);
  if (!created && Object.entries(fields).some(([field, value]) => saved[field] !== value)) {
    throw new PublicError(409, "Este identificador já pertence a outra mensagem.");
  }

  await sendNotification(saved.id).catch(logQueueError);
  const { estado } = byId.get(saved.id);
  json(response, created ? 201 : 200, {
    id: saved.id,
    notificacao: !emailConfigured && estado === "pendente" ? "sem_configuracao" : estado
  });
}

const deriveKey = promisify(scrypt);
const scryptOptions = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const dummySalt = randomBytes(16);
const dummyHash = Buffer.alloc(64);
let activeHashes = 0;

async function hashPassword(password, salt, response) {
  if (activeHashes >= 3) {
    response.setHeader("Retry-After", "2");
    throw new PublicError(503, "O acesso está ocupado. Aguarde um instante e tente novamente.");
  }
  activeHashes++;
  try {
    return await deriveKey(password, salt, 64, scryptOptions);
  } finally {
    activeHashes--;
  }
}

function cleanCredentials(payload, register) {
  const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
  const senha = payload?.senha;
  if (email.length > 254 || /[\x00-\x1f\x7f]/.test(email) || !validEmail.test(email)) {
    throw new PublicError(400, "Informe um endereço de e-mail válido.");
  }
  if (typeof senha !== "string" || senha.length < 8 || senha.length > 128
      || !senha.trim() || !senha.isWellFormed()) {
    throw new PublicError(400, "A senha precisa ter entre 8 e 128 caracteres.");
  }
  const nome = typeof payload.nome === "string" ? payload.nome.trim() : "";
  if (register && (nome.length < 2 || nome.length > 80 || /[\x00-\x1f\x7f]/.test(nome))) {
    throw new PublicError(400, "Informe um nome com 2 a 80 caracteres.");
  }
  return { nome, email, senha };
}

function sessionToken(request) {
  const prefix = `${sessionName}=`;
  const value = request.headers.cookie?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))?.slice(prefix.length);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function sessionUser(request) {
  const token = sessionToken(request);
  return token ? accountForSession.get(tokenHash(token), Date.now()) ?? null : null;
}

function clearSession(request) {
  const token = sessionToken(request);
  if (token) deleteSession.run(tokenHash(token));
}

function writeSessionCookie(request, response, token) {
  const secure = siteOrigin?.protocol === "https:" || request.socket.encrypted
    || forwardedValue(request, "x-forwarded-proto") === "https";
  const maxAge = token ? sessionDuration / 1000 : 0;
  response.setHeader("Set-Cookie", `${sessionName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`);
}

function saveSession(request, userId, newAccount) {
  const token = randomBytes(32).toString("base64url");
  db.exec("BEGIN IMMEDIATE");
  try {
    if (newAccount) {
      const { nome, email, salt, hash } = newAccount;
      const result = addAccount.run(userId, nome, email, salt, hash, new Date().toISOString());
      if (!result.changes) {
        throw new PublicError(409, "Não foi possível criar a conta com esses dados. Se já tiver uma, use Entrar.");
      }
    }
    clearSession(request);
    addSession.run(tokenHash(token), userId, Date.now() + sessionDuration);
    db.exec("COMMIT");
    return token;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

async function handleAccount(request, response, action) {
  const isRead = action === "";
  const allowed = isRead ? ["GET", "HEAD"] : ["POST"];
  if (!allowed.includes(request.method)) {
    response.setHeader("Allow", allowed.join(", "));
    throw new PublicError(405, "Método indisponível.");
  }
  if (isRead) {
    json(response, 200, { usuario: sessionUser(request), equipe: false });
    return;
  }

  checkOrigin(request);
  if (action === "sair") {
    request.resume();
    clearSession(request);
    writeSessionCookie(request, response, "");
    json(response, 200, { usuario: null, equipe: false });
    return;
  }

  const register = action === "cadastro";
  limitRequests(`conta:${action}:${requestAddress(request)}`, response, register ? 6 : 20);
  const { nome, email, senha } = cleanCredentials(await readPayload(request), register);
  if (register) {
    const salt = randomBytes(16);
    const hash = await hashPassword(senha, salt, response);
    const token = saveSession(request, randomUUID(), { nome, email, salt, hash });
    writeSessionCookie(request, response, token);
    json(response, 201, { usuario: { nome, email }, equipe: false });
    return;
  }

  limitRequests(`conta:email:${email}`, response, 12);
  const account = accountsByEmail.get(email);
  const hash = await hashPassword(senha, account?.senha_salt ?? dummySalt, response);
  const matches = timingSafeEqual(hash, account?.senha_hash ?? dummyHash);
  if (!account || !matches) throw new PublicError(401, "E-mail ou senha inválidos.");

  const token = saveSession(request, account.id);
  writeSessionCookie(request, response, token);
  json(response, 200, { usuario: { nome: account.nome, email: account.email }, equipe: false });
}

const publicPages = new Set(["index.html", "style.css", "script.js", "configuracao.js"]);
const allowedTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".pck": "application/octet-stream",
  ".data": "application/octet-stream",
  ".bin": "application/octet-stream",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".zip": "application/zip",
  ".ico": "image/x-icon",
  ".cur": "image/x-icon",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function mimeType(name) {
  const extensions = { ".br": "br", ".gz": "gzip" };
  const extension = extname(name);
  const encoding = extensions[extension];
  if (!encoding) return { type: allowedTypes[extension.toLowerCase()] };
  return { type: allowedTypes[extname(name.slice(0, -extension.length)).toLowerCase()], encoding };
}

const realRoot = await realpath(root);
const privatePath = await realpath(dbPath);
async function publicFile(pathname) {
  if (pathname === "/") pathname = "/index.html";
  const parts = pathname.slice(1).split("/");
  if (parts.some((part) => part.startsWith(".") || /[\\\0]/.test(part))) return;
  const folder = parts[0];
  const inFolder = folder === "assets" || folder === "demo";
  if (!inFolder && (parts.length !== 1 || !publicPages.has(folder))) return;

  if (folder === "demo" && parts.at(-1) === "") parts[parts.length - 1] = "index.html";
  if (parts.some((part) => !part)) return;

  const name = parts.at(-1);
  const { type, encoding } = mimeType(name);
  if (!type) return;

  const resolved = await realpath(join(root, ...parts)).catch(() => undefined);
  const scope = inFolder ? join(realRoot, folder) + sep : realRoot + sep;
  if (!resolved?.startsWith(scope) || (!inFolder && resolved !== join(realRoot, folder))
      || [privatePath, privatePath + "-wal", privatePath + "-shm"].includes(resolved)) {
    return;
  }
  const info = await stat(resolved).catch(() => undefined);
  if (info?.isFile()) return { path: resolved, size: info.size, type, encoding };
}

function bytesFor(range, size) {
  if (!range) return { start: 0, end: size - 1 };
  const parts = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!parts || (!parts[1] && !parts[2])) return;
  const parsedEnd = parts[2] ? Number(parts[2]) : size - 1;
  const start = parts[1] ? Number(parts[1]) : Math.max(0, size - parsedEnd);
  const end = parts[1] ? Math.min(parsedEnd, size - 1) : size - 1;
  if (start < size && start <= end) return { start, end };
}

async function serveFile(request, response, pathname) {
  const isDemo = pathname === "/demo" || pathname.startsWith("/demo/");
  if (isDemo && !sessionUser(request)) {
    throw new PublicError(401, "Entre na sua conta do Neymar World para acessar a demo.");
  }
  if (pathname === "/demo") {
    response.writeHead(308, { Location: "/demo/", "Cache-Control": "private, no-store" });
    response.end();
    return;
  }
  const file = await publicFile(pathname);
  if (!file) throw new PublicError(404, "Arquivo não encontrado.");

  const range = request.headers.range;
  const span = bytesFor(range, file.size);
  if (!span) {
    response.setHeader("Content-Range", `bytes */${file.size}`);
    throw new PublicError(416, "Intervalo indisponível.");
  }

  const headers = {
    "Content-Type": file.type,
    "Content-Length": span.end - span.start + 1,
    "Accept-Ranges": "bytes",
    "Cache-Control": isDemo ? "private, no-store"
      : pathname.startsWith("/assets/") ? "public, max-age=3600" : "no-cache"
  };
  if (range) headers["Content-Range"] = `bytes ${span.start}-${span.end}/${file.size}`;
  if (file.encoding) headers["Content-Encoding"] = file.encoding;
  response.writeHead(range ? 206 : 200, headers);
  if (request.method === "HEAD" || file.size === 0) {
    response.end();
    return;
  }
  const stream = createReadStream(file.path, span);
  stream.on("error", () => response.destroy());
  response.on("close", () => stream.destroy());
  stream.pipe(response);
}

function logQueueError(error) {
  console.error("Falha ao processar a fila de notificações:", error.message);
}

const timer = setInterval(() => {
  const now = Date.now();
  for (const [key, window] of attempts) {
    if (window.expires <= now) attempts.delete(key);
  }
  try {
    expireSessions.run(now);
    if (emailConfigured) {
      void sendNotification(nextMessage.get(now)?.id).catch(logQueueError);
    }
  } catch (error) {
    console.error("Falha na manutenção do banco:", error.message);
  }
}, 15_000);

const server = createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");

  try {
    const encodedPath = new URL(request.url, "http://localhost").pathname;
    let pathname;
    try {
      pathname = decodeURIComponent(encodedPath);
    } catch {
      throw new PublicError(400, "Endereço inválido.");
    }

    const accountRoute = /^\/api\/conta(?:\/(cadastro|entrar|sair))?$/.exec(pathname);
    if (accountRoute) {
      await handleAccount(request, response, accountRoute[1] || "");
      return;
    }
    if (pathname === "/api/mensagens") {
      if (request.method !== "POST") {
        response.setHeader("Allow", "POST");
        throw new PublicError(405, "Use o formulário para enviar uma mensagem.");
      }
      await saveMessage(request, response);
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.setHeader("Allow", "GET, HEAD");
      throw new PublicError(405, "Método indisponível.");
    }
    if (pathname === "/api/saude") {
      json(response, 200, { ok: true, emailConfigurado: emailConfigured });
      return;
    }
    await serveFile(request, response, pathname);
  } catch (error) {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    request.resume();
    if (error instanceof PublicError) {
      json(response, error.status, { erro: error.message });
    } else {
      console.error("Erro ao processar a solicitação:", error.message);
      json(response, 500, { erro: "Não foi possível concluir a operação. Tente novamente." });
    }
  }
});

server.requestTimeout = 30_000;
server.listen(Number(process.env.PORT || 3000), process.env.HOST || "127.0.0.1", () => {
  const address = server.address();
  console.log(`Neymar World em http://localhost:${address.port}`);
  if (!emailConfigured) console.log("Formulários gravam no banco. Notificações por e-mail aguardam configuração.");
});

function stop() {
  clearInterval(timer);
  server.close(() => db.close());
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
