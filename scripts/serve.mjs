import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import { resolve, relative, extname, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1–65535.');
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.pdf':'application/pdf', '.xml':'application/xml; charset=utf-8', '.txt':'text/plain; charset=utf-8' };
const inside = path => { const rel = relative(root, path); return rel !== '..' && !rel.startsWith('..\\') && !rel.startsWith('../') && !isAbsolute(rel); };
const server = http.createServer(async (req, res) => {
  const fail = (code, message) => { res.writeHead(code, { 'Content-Type':'text/plain; charset=utf-8', 'X-Content-Type-Options':'nosniff' }); res.end(req.method === 'HEAD' ? undefined : message); };
  if (!['GET','HEAD'].includes(req.method)) { res.setHeader('Allow','GET, HEAD'); return fail(405,'Method not allowed'); }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); } catch { return fail(400,'Invalid URL'); }
  if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.') || part.includes(':'))) return fail(403,'Forbidden');
  if (pathname === '/') pathname = '/index.html';
  const path = resolve(root, '.' + pathname);
  if (!inside(path)) return fail(403,'Forbidden');
  try {
    const actual = await realpath(path);
    if (!inside(actual)) return fail(403,'Forbidden');
    const details = await stat(actual);
    if (!details.isFile()) return fail(404,'Not found');
    res.writeHead(200, { 'Content-Type':mime[extname(actual).toLowerCase()] || 'application/octet-stream', 'Content-Length':details.size, 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff' });
    if (req.method === 'HEAD') return res.end();
    const stream = createReadStream(actual);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  } catch (error) { fail(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500,'Not found'); }
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Port '+port+' is in use. Choose another PORT.' : error.message); process.exitCode=1; });
server.listen(port, '127.0.0.1', () => console.log('Portfolio preview: http://127.0.0.1:'+port));
