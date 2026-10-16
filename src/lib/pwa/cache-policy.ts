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
