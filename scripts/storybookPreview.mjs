/** @param {string | undefined} requestUrl @param {string} base */
export function storybookPreviewLocation(requestUrl, base = '') {
	const url = new URL(requestUrl ?? '/', 'http://localhost');
	if (url.pathname !== `${base}/storybook`) return null;
	return `${base}/storybook/index.html${url.search}`;
}

/**
 * Keep Vite's local production preview consistent with the app endpoint.
 * Its static middleware otherwise serves the directory index before Kit can
 * redirect, breaking relative manager assets at the slashless entry URL.
 * @param {{ enabled: boolean, base?: string }} options
 * @returns {import('vite').Plugin}
 */
export function storybookPreviewPlugin({ enabled, base = '' }) {
	return {
		name: 'storybook-local-preview-route',
		configurePreviewServer(server) {
			if (!enabled) return;
			server.middlewares.use((request, response, next) => {
				if (request.method !== 'GET' && request.method !== 'HEAD')
					return next();
				const location = storybookPreviewLocation(request.url, base);
				if (!location) return next();
				response.writeHead(307, { Location: location });
				response.end();
			});
		}
	};
}
