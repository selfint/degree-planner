import adapter from '@sveltejs/adapter-auto';
import adapterStatic from '@sveltejs/adapter-static';
import {
	readBuildIdentity,
	isOfflineShellStaticFile
} from './scripts/buildIdentity.mjs';

const staticBuild = process.env.PAGES_BUILD === 'true';
const base = process.env.BASE_PATH ?? '';
if (base && (!base.startsWith('/') || base.endsWith('/') || /[?#]/.test(base)))
	throw new Error(
		'BASE_PATH must be empty or an absolute path without a trailing slash.'
	);

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: staticBuild ? adapterStatic({ fallback: '404.html' }) : adapter(),
		version: { name: readBuildIdentity() },
		// Offline shell must resolve assets correctly at nested URLs.
		paths: { base, relative: false },
		serviceWorker: {
			register: false,
			files: isOfflineShellStaticFile
		}
	}
};

export default config;
