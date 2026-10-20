export function isAppNavigation(pathname: string): boolean {
	return (
		[
			'/app',
			'/app/',
			'/app/plan',
			'/app/settings',
			'/app/catalog',
			'/app/semester',
			'/app/search',
			'/app/offline'
		].includes(pathname) ||
		/^\/app\/course\/\d{8}\/?$/.test(pathname) ||
		/^\/app\/preview\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/?$/.test(
			pathname
		)
	);
}

/** Only the build's immutable asset namespace can use retained cache entries.
 * SvelteKit shared chunks are hash.js, while nodes are name.hash.js. Do not
 * infer one filename convention; the historical cache must contain the exact URL.
 */
export function isImmutableAppAsset(pathname: string): boolean {
	return (
		/^\/_app\/immutable\/(?:[\w-]+\/)*[\w.-]+\.[\w]+$/.test(pathname) &&
		!pathname.split('/').includes('..')
	);
}
