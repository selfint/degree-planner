import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		// Offline shell must resolve assets correctly at nested URLs.
		paths: { relative: false },
		serviceWorker: {
			register: false,
			files: (file) =>
				file === 'manifest.webmanifest' ||
				file === 'favicon.webp' ||
				file === 'brand/planit-logo.webp' ||
				file === 'brand/planit-wordmark.svg' ||
				file.startsWith('icons/')
		}
	}
};

export default config;
