// A local Pages-like static server: no SvelteKit SSR or development fallback.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve('build');
const base = process.env.BASE_PATH ?? '/degree-planner';
const port = Number(process.env.PORT ?? 4178);
const types = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript',
	'.mjs': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.webmanifest': 'application/manifest+json',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.jpg': 'image/jpeg',
	'.avif': 'image/avif',
	'.gif': 'image/gif',
	'.woff2': 'font/woff2',
	'.mp4': 'video/mp4'
};
createServer(async (req, res) => {
	try {
		const url = new URL(req.url, 'http://localhost');
		if (url.pathname === base && base) {
			res.writeHead(301, { Location: `${base}/${url.search}` }).end();
			return;
		}
		if (!url.pathname.startsWith(`${base}/`)) {
			res.writeHead(404).end();
			return;
		}
		const relative = decodeURIComponent(url.pathname.slice(base.length + 1));
		let path = resolve(root, relative || 'index.html');
		if (path !== root && !path.startsWith(root + sep)) {
			res.writeHead(403).end();
			return;
		}
		let exists;
		try {
			exists = await stat(path);
		} catch {}
		if (exists?.isDirectory()) {
			if (!url.pathname.endsWith('/')) {
				res.writeHead(301, { Location: `${url.pathname}/${url.search}` }).end();
				return;
			}
			path = resolve(path, 'index.html');
		} else if (!exists && !extname(path)) {
			try {
				await stat(`${path}.html`);
				path += '.html';
			} catch {}
		}
		let body,
			status = 200;
		try {
			body = await readFile(path);
		} catch {
			path = resolve(root, '404.html');
			body = await readFile(path);
			status = 404;
		}
		res.writeHead(status, {
			'Content-Type': types[extname(path)] ?? 'application/octet-stream',
			'Cache-Control': 'no-cache'
		});
		res.end(req.method === 'HEAD' ? undefined : body);
	} catch {
		res.writeHead(500).end();
	}
}).listen(port, '127.0.0.1', () =>
	console.log(`Pages artifact: http://127.0.0.1:${port}${base}/`)
);
