export function isAppNavigation(pathname: string): boolean {
	return (
		[
			'/',
			'/en',
			'/app/plan',
			'/app/settings',
			'/app/catalog',
			'/app/semester',
			'/app/search',
			'/offline'
		].includes(pathname) ||
		/^\/course\/\d{8}\/?$/.test(pathname) ||
		/^\/preview\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/?$/.test(
			pathname
		)
	);
}
