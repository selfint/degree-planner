import { createReadStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';

// Render with the compiled production Kit server, just as vite preview does,
// without opening a listening socket. Fresh process per build avoids ESM caches.
const [directory, destination] = process.argv.slice(2);
const { Server } = await import(
	pathToFileURL(join(directory, 'index.js')).href
);
const { manifest } = await import(
	pathToFileURL(join(directory, 'manifest.js')).href
);
const { set_assets } = await import(
	pathToFileURL(join(directory, 'internal.js')).href
);
set_assets('');
const server = new Server(manifest);
await server.init({
	env: process.env,
	read: (file) => Readable.toWeb(createReadStream(join(directory, file)))
});
const html = {};
for (const path of [
	'/',
	'/app/',
	'/app/offline',
	'/app/plan',
	'/app/course/02340124',
	'/app/course/02340141'
]) {
	// Kit removes prerendered routes from its runtime manifest; preview serves
	// these exact generated files before invoking Server.respond.
	const prerendered = join(
		directory,
		'../prerendered/pages',
		path === '/' ? 'index.html' : `${path.slice(1)}.html`
	);
	try {
		html[path] = await readFile(prerendered, 'utf8');
		continue;
	} catch (error) {
		if (error.code !== 'ENOENT') throw error;
	}
	let url = `http://pwa-fixture.invalid${path}`;
	let response;
	for (let redirects = 0; redirects < 5; redirects++) {
		response = await server.respond(new Request(url), {
			getClientAddress: () => '127.0.0.1'
		});
		const location = response.headers.get('location');
		if (!location || response.status < 300 || response.status >= 400) break;
		url = new URL(location, url).href;
	}
	if (!response.ok) throw new Error(`Fixture HTML ${path}: ${response.status}`);
	html[path] = await response.text();
}
await writeFile(destination, JSON.stringify(html));
