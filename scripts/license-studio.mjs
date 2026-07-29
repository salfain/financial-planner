import { createPrivateKey, randomUUID, sign } from "node:crypto";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const directory = join(homedir(), ".financial-planner-license");
const privateKeyPath = process.env.FINANCE_LICENSE_PRIVATE_KEY || join(directory, "private.pem");
const historyPath = join(directory, "issued-licenses.json");
const port = Number(process.env.LICENSE_STUDIO_PORT || 4179);
const base64url = (value) => Buffer.from(value).toString("base64url");
const validInstallation = (value) => /^[A-Za-z0-9][A-Za-z0-9_-]{5,127}$/.test(value);

async function history() {
  try { const value = JSON.parse(await readFile(historyPath, "utf8")); return Array.isArray(value) ? value : []; }
  catch { return []; }
}

async function issue(input) {
  const tier = String(input.tier || "").toLowerCase();
  const installationId = String(input.installationId || "").trim();
  const customer = String(input.customer || "").trim().slice(0, 120);
  const expiresAt = input.expiresAt ? new Date(`${input.expiresAt}T23:59:59.000Z`).toISOString() : undefined;
  if (!["pro", "premium"].includes(tier)) throw new Error("Paket harus Pro atau Premium.");
  if (!validInstallation(installationId)) throw new Error("ID instalasi tidak valid.");
  const claims = { product: "financial-planner", version: 1, licenseId: `lic-${randomUUID()}`, tier, installationId, issuedAt: new Date().toISOString(), ...(expiresAt ? { expiresAt } : {}) };
  const signingInput = `FP1.${base64url(JSON.stringify(claims))}`;
  const key = createPrivateKey(await readFile(privateKeyPath, "utf8"));
  const token = `${signingInput}.${sign("RSA-SHA256", Buffer.from(signingInput), key).toString("base64url")}`;
  const rows = await history();
  rows.unshift({ ...claims, customer, token });
  await writeFile(historyPath, JSON.stringify(rows.slice(0, 500), null, 2), { mode: 0o600 });
  return { ...claims, customer, token };
}

const page = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Financial Planner · License Studio</title><style>
:root{font-family:Inter,system-ui,sans-serif;color:#13251f;background:#eef4f1}*{box-sizing:border-box}body{margin:0;padding:32px}.shell{max-width:1040px;margin:auto}.head{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}.brand{display:flex;gap:12px;align-items:center}.mark{display:grid;place-items:center;width:44px;height:44px;border-radius:13px;background:#137a66;color:white;font-weight:800}.badge{padding:8px 12px;border-radius:999px;background:#dff2ec;color:#08715c;font-size:12px;font-weight:700}.grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:18px}.card{background:white;border:1px solid #dbe6e1;border-radius:20px;padding:22px;box-shadow:0 14px 35px #163a2c12}h1,h2{margin:0}h1{font-size:24px}h2{font-size:18px;margin-bottom:18px}.copy{color:#66766f;font-size:13px}.form{display:grid;gap:14px}label{display:grid;gap:7px;font-size:12px;font-weight:700}input,select,textarea{width:100%;border:1px solid #cfddd7;border-radius:12px;padding:12px;background:#f9fbfa;font:inherit}textarea{min-height:124px;resize:vertical}.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}button{border:0;border-radius:12px;padding:13px 16px;background:#137a66;color:white;font-weight:800;cursor:pointer}.secondary{background:white;color:#137a66;border:1px solid #9dcbbf}.actions{display:flex;gap:8px}.history{display:grid;gap:9px;max-height:480px;overflow:auto}.item{padding:12px;border:1px solid #e0e9e5;border-radius:13px;background:#f8fbfa;display:grid;grid-template-columns:1fr auto;gap:5px}.item small{color:#71817a}.tier{text-transform:capitalize;font-weight:800;color:#137a66}.message{min-height:18px;color:#b03c36;font-size:12px}@media(max-width:760px){body{padding:16px}.grid{grid-template-columns:1fr}.head{align-items:flex-start;gap:12px}.row{grid-template-columns:1fr}}</style></head><body><main class="shell"><header class="head"><div class="brand"><span class="mark">FP</span><div><h1>License Studio</h1><span class="copy">Dashboard penjual · hanya berjalan di komputer ini</span></div></div><span class="badge">Private key tetap lokal</span></header><div class="grid"><section class="card"><h2>Terbitkan lisensi</h2><form class="form" id="form"><label>Nama pelanggan<input name="customer" placeholder="Nama pembeli"></label><label>ID instalasi<input name="installationId" placeholder="inst-..." required></label><div class="row"><label>Paket<select name="tier"><option value="pro">Pro</option><option value="premium">Premium</option></select></label><label>Berlaku sampai<input type="date" name="expiresAt"></label></div><button>Terbitkan kode</button><div class="message" id="message"></div><label>Kode lisensi<textarea id="token" readonly placeholder="Kode akan muncul di sini"></textarea></label><div class="actions"><button class="secondary" type="button" id="copy">Salin kode</button></div></form></section><section class="card"><h2>Riwayat penerbitan</h2><div class="history" id="history"><span class="copy">Memuat…</span></div></section></div></main><script>
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function load(){const rows=await fetch('/api/history').then(r=>r.json());history.innerHTML=rows.length?rows.map(x=>'<div class="item"><span><strong>'+esc(x.customer||'Tanpa nama')+'</strong><small>'+esc(x.installationId)+'</small></span><span class="tier">'+esc(x.tier)+'</span><small>'+new Date(x.issuedAt).toLocaleString('id-ID')+'</small><button class="secondary" data-token="'+esc(x.token)+'">Salin</button></div>').join(''):'<span class="copy">Belum ada lisensi diterbitkan.</span>';history.querySelectorAll('button').forEach(b=>b.onclick=()=>navigator.clipboard.writeText(b.dataset.token));}
form.onsubmit=async e=>{e.preventDefault();message.textContent='';const body=Object.fromEntries(new FormData(form));const r=await fetch('/api/issue',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok){message.textContent=data.error;return}token.value=data.token;await navigator.clipboard.writeText(data.token);message.style.color='#137a66';message.textContent='Lisensi berhasil dibuat dan disalin.';load()};copy.onclick=()=>navigator.clipboard.writeText(token.value);load();
</script></body></html>`;

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/") { response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }); return response.end(page); }
    if (request.method === "GET" && request.url === "/api/history") { response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }); return response.end(JSON.stringify(await history())); }
    if (request.method === "POST" && request.url === "/api/issue") { let raw = ""; for await (const chunk of request) { raw += chunk; if (raw.length > 10_000) throw new Error("Permintaan terlalu besar."); } const result = await issue(JSON.parse(raw || "{}")); response.writeHead(201, { "content-type": "application/json", "cache-control": "no-store" }); return response.end(JSON.stringify(result)); }
    response.writeHead(404).end();
  } catch (error) { response.writeHead(400, { "content-type": "application/json" }); response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Permintaan gagal." })); }
});
server.listen(port, "127.0.0.1", () => console.log(`License Studio: http://127.0.0.1:${port}`));
