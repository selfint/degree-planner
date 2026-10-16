export function isAppNavigation(pathname: string): boolean {
	return (
		[
			'/',
			'/en',
			'/plan',
			'/settings',
			'/catalog',
			'/semester',
			'/search',
			'/offline'
		].includes(pathname) ||
		/^\/course\/\d{8}\/?$/.test(pathname) ||
		/^\/preview\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/?$/.test(
			pathname
		)
	);
}
