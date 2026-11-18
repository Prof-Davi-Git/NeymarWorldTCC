import { createReadStream, mkdirSync } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { isIP } from "node:net";
import { dirname, extname, join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const root = dirname(import.meta.filename);
const dbPath = resolve(root, process.env.SQLITE_PATH?.trim() || "dados/mensagens.sqlite");
const apiKey = process.env.RESEND_API_KEY?.trim();
const sender = process.env.EMAIL_REMETENTE?.trim();
const recipient = process.env.EMAIL_DESTINO?.trim();
const emailConfigured = Boolean(apiKey && sender && recipient);
const retries = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];
const maxBody = 16 * 1024;

mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
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
`);

if (process.argv.includes("--mensagens")) {
  const rows = db.prepare(`
    SELECT id, tipo, nome, email, personagem, mensagem, recebida_em, estado AS notificacao
    FROM mensagens ORDER BY recebida_em DESC
  `).all();
  console.log(JSON.stringify(rows, null, 2));
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
  if (email && !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(email)) {
    throw new PublicError(400, "Informe um endereço de e-mail válido.");
  }
  return { tipo, nome, email, personagem, mensagem };
}

const attempts = new Map();
const limitWindow = 10 * 60_000;
const proxyHops = Number(process.env.PROXY_HOPS || 0);

function requestAddress(request) {
  if (Number.isInteger(proxyHops) && proxyHops > 0 && proxyHops <= 5) {
    const forwarded = request.headers["x-forwarded-for"]?.split(",");
    const trusted = forwarded?.at(-proxyHops)?.trim();
    if (trusted && isIP(trusted)) return trusted;
  }
  return request.socket.remoteAddress || "desconhecido";
}

function checkRequest(request, response) {
  const origin = request.headers.origin;
  const site = request.headers["sec-fetch-site"];
  if (origin) {
    let sameHost = false;
    try {
      const parsed = new URL(origin);
      sameHost = ["http:", "https:"].includes(parsed.protocol) && parsed.host === request.headers.host;
    } catch {
      // Malformed or opaque browser origin.
    }
    if (!sameHost) throw new PublicError(403, "Abra o formulário pelo endereço do site.");
  }
  if (site === "cross-site") throw new PublicError(403, "Abra o formulário pelo endereço do site.");

  const address = requestAddress(request);
  const now = Date.now();
  const current = attempts.get(address);
  if (!current || current.expires <= now) {
    attempts.set(address, { count: 1, expires: now + limitWindow });
    return;
  }
  if (current.count >= 12) {
    response.setHeader("Retry-After", String(Math.ceil((current.expires - now) / 1000)));
    throw new PublicError(429, "Muitas tentativas. Aguarde alguns minutos e tente novamente.");
  }
  current.count += 1;
}

async function saveMessage(request, response) {
  checkRequest(request, response);
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
  if (pathname === "/demo") {
    response.writeHead(308, { Location: "/demo/" });
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
    "Cache-Control": pathname.startsWith("/assets/") ? "public, max-age=3600" : "no-cache"
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
  for (const [address, window] of attempts) {
    if (window.expires <= Date.now()) attempts.delete(address);
  }
  if (emailConfigured) {
    try {
      void sendNotification(nextMessage.get(Date.now())?.id).catch(logQueueError);
    } catch (error) {
      logQueueError(error);
    }
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
