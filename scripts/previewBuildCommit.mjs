// The marker identifies the checked-out commit used by the production build.
// Local QA checks rendered metadata rather than trusting a server's port alone.
export function previewBuildCommit(html) {
	return (
		html.match(
			/<meta\s+name="planit-build"\s+content="([a-f\d]{40})"\s*\/?>/
		)?.[1] ?? null
	);
}
