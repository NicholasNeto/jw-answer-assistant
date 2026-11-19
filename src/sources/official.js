const ALLOWED_HOSTS = new Set(["wol.jw.org", "www.jw.org", "jw.org"]);

// Só https e hosts oficiais exatos (rejeita wol.jw.org.evil.com, credenciais na URL, etc.).
function isOfficialUrl(value) {
  let u;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  return (
    u.protocol === "https:" &&
    !u.username &&
    !u.password &&
    ALLOWED_HOSTS.has(u.hostname) &&
    (u.port === "" || u.port === "443")
  );
}

// fetch que valida o domínio no pedido inicial e em cada redirecionamento.
async function fetchOfficial(url, { fetchImpl = fetch, maxRedirects = 3 } = {}) {
  let current = url;
  for (let i = 0; i <= maxRedirects; i++) {
    if (!isOfficialUrl(current)) throw new Error(`URL não oficial bloqueado: ${current}`);
    const res = await fetchImpl(current, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (JW Answer Assistant)" },
      signal: AbortSignal.timeout(15000),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location"), current).toString();
      continue;
    }
    if (!res.ok) throw new Error(`Fonte oficial devolveu HTTP ${res.status}`);
    return { url: current, html: await res.text() };
  }
  throw new Error("Demasiados redirecionamentos.");
}

module.exports = { isOfficialUrl, fetchOfficial };
