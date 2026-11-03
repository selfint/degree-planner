/** Every document inside the console namespace belongs to its installed build.
 * Let that build resolve routes (including its own 404), rather than leaking a
 * newer network shell through trailing slashes or newly deployed route names. */
export function isAppNavigation(pathname: string, base = ''): boolean {
	return pathname === `${base}/app` || pathname.startsWith(`${base}/app/`);
}

/** Only the build's immutable asset namespace can use retained cache entries.
 * SvelteKit shared chunks are hash.js, while nodes are name.hash.js. Do not
 * infer one filename convention; the historical cache must contain the exact URL.
 */
export function isImmutableAppAsset(pathname: string, base = ''): boolean {
	if (base && !pathname.startsWith(`${base}/`)) return false;
	pathname = pathname.slice(base.length);
	return (
		/^\/_app\/immutable\/(?:[\w-]+\/)*[\w.-]+\.[\w]+$/.test(pathname) &&
		!pathname.split('/').includes('..')
	);
}
