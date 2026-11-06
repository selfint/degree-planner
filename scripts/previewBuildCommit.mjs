// This marker is compiled from Vercel's public Git commit metadata. Reading it
// from the target alias avoids confusing deployments of the same SHA/branches.
export function previewBuildCommit(html) {
	return (
		html.match(
			/<meta\s+name="planit-build"\s+content="([a-f\d]{40})"\s*\/?>/
		)?.[1] ?? null
	);
}
