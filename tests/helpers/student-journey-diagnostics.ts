export type BrowserDiagnostic = {
	name: string;
	message: string;
	stack?: string;
};

/** Return the matching intentionally aborted URL, never an unrelated error. */
export function intentionalWebKitFetchDiagnostic(
	browserName: string,
	error: BrowserDiagnostic,
	abortedUrls: ReadonlySet<string>
): string | undefined {
	if (browserName !== 'webkit' || error.name !== 'Fetch API cannot load https')
		return undefined;
	const firstLine = error.stack?.split('\n')[0];
	if (
		!firstLine ||
		error.message !== firstLine.slice(firstLine.indexOf(':') + 2)
	)
		return undefined;
	const match = firstLine.match(
		/^Fetch API cannot load (https:\/\/firebase\.googleapis\.com\/v1alpha\/projects\/-\/apps\/[^/\s]+\/webConfig) due to access control checks\.$/
	);
	return match && abortedUrls.has(match[1]) ? match[1] : undefined;
}
