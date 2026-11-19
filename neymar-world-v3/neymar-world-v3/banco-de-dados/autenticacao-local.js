/* ATUALIZAÇÃO 18/11 - LOGIN LOCAL DIDÁTICO SEM SERVIDOR
 * Para abrir index.html por file://. O JSON é o modelo e sua cópia JS permite leitura
 * local; novos cadastros NÃO são escritos no JSON: ficam neste navegador.
 * NÃO protege downloads e NÃO pode receber dados/senhas reais.
 */
(function () {
  "use strict";
  const chave = "neymar_world_contas_demo_v1";
  const sessao = "neymar_world_sessao_demo_v1";
  function ler() {
    try {
      const v = JSON.parse(localStorage.getItem(chave) || "[]");
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  }
  // Resumo simples, deliberadamente não criptográfico: somente para atividade fictícia.
  function resumo(senha, salt) {
    let n = 2166136261;
    for (const c of salt + ":" + senha) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
    return (n >>> 0).toString(16);
  }
  function current() {
    try {
      const u = JSON.parse(sessionStorage.getItem(sessao) || "null");
      return u?.nome && u?.email ? u : null;
    } catch { return null; }
  }
  function save(u) {
    const minimal = {nome:u.nome,email:u.email};
    sessionStorage.setItem(sessao, JSON.stringify(minimal));
    return minimal;
  }
  function run(path, fields) {
    if (path.endsWith("/sair")) {
      sessionStorage.removeItem(sessao);
      return {ok:true,usuario:null};
    }
    const email = String(fields.email || "").trim().toLowerCase();
    const senha = String(fields.senha || "");
    if (!email.includes("@") || senha.length < 8) return {ok:false,code:400};
    const demo = window.NW_USUARIOS_FICTICIOS || [];
    const locais = ler();
    if (path.endsWith("/cadastro")) {
      const nome = String(fields.nome || "").trim();
      if (nome.length < 2 || nome.length > 80) return {ok:false,code:400};
      if (demo.some(x=>x.email.toLowerCase()===email) || locais.some(x=>x.email===email))
        return {ok:false,code:409};
      const salt = "demo-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      locais.push({id:"local-"+Date.now(),nome,email,salt,resumo:resumo(senha,salt)});
      try { localStorage.setItem(chave, JSON.stringify(locais)); }
      catch {return {ok:false,code:500};}
      return {ok:true,usuario:save({nome,email})};
    }
    const local = locais.find(x=>x.email===email);
    const usuario = local
      ? (local.resumo===resumo(senha,local.salt)?local:null)
      : demo.find(x=>x.email.toLowerCase()===email && x.senhaDemo===senha);
    return usuario ? {ok:true,usuario:save(usuario)} : {ok:false,code:401};
  }
  window.NW_AUTH_LOCAL = {current,run};
})();
