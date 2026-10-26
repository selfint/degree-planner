import { ShellPreparationError } from './shell-failure';

/**
 * Bound the entire download, including body consumption, not just response
 * headers. The operation must use the signal and await every required body read.
 * Promise.race also settles when a stalled implementation ignores abort.
 */
export async function withShellFetchDeadline<T>(
	operation: (signal: AbortSignal) => Promise<T>,
	timeoutMs = 20_000
): Promise<T> {
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const deadline = new Promise<never>((_resolve, reject) => {
		timer = setTimeout(() => {
			// Settle the deadline first so an abort rejection cannot replace the
			// useful timeout reason with a generic download failure.
			reject(new ShellPreparationError('timeout'));
			controller.abort();
		}, timeoutMs);
	});
	// Capture synchronous throws too. Promise.race observes this promise even
	// after the deadline wins, preventing late rejection from going unhandled.
	const pending = Promise.resolve().then(() => operation(controller.signal));
	try {
		return await Promise.race([pending, deadline]);
	} catch (error) {
		throw error instanceof ShellPreparationError
			? error
			: new ShellPreparationError('download');
	} finally {
		clearTimeout(timer);
	}
}
