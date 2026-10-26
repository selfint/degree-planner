import adapter from '@sveltejs/adapter-auto';
import {
	readBuildIdentity,
	isOfflineShellStaticFile
} from './scripts/buildIdentity.mjs';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		version: { name: readBuildIdentity() },
		// Offline shell must resolve assets correctly at nested URLs.
		paths: { relative: false },
		serviceWorker: {
			register: false,
			files: isOfflineShellStaticFile
		}
	}
};

export default config;
