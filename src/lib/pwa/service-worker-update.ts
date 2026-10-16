/** Capture before installation finishes: clients.claim() can precede the
 * installed event in WebKit, so a controller at that later point is not proof
 * that this was an update. The installing worker itself is never an old build. */
export function replacesExistingWorker(
	installing: object,
	active: object | null,
	controller: object | null
): boolean {
	return (
		(active !== null && active !== installing) ||
		(controller !== null && controller !== installing)
	);
}
