import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const root = path.resolve(dist);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8' };
const server = http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!target.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
    if (!(await stat(target)).isFile()) { response.writeHead(404); response.end(); return; }
    const content = await readFile(target);
    response.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? '5173 포트가 사용 중입니다. http://127.0.0.1:5173/ 을 확인하거나 기존 실행 창을 닫고 다시 실행하세요.' : e.message); process.exitCode = 1; });
server.listen(5173, '127.0.0.1', () => console.log('업무달력이 실행되었습니다.\n브라우저에서 http://127.0.0.1:5173/ 을 여세요.\n종료하려면 Ctrl+C를 누르세요.'));
