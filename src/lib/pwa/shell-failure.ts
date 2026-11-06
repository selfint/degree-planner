/** Stable, non-sensitive diagnostics. Never render native exception text to users. */
export const shellFailureReasons = [
	'verification',
	'download',
	'storage',
	'build-changed',
	'unsupported',
	'installation',
	'registration',
	'timeout',
	'worker-unavailable'
] as const;
export type ShellFailureReason = (typeof shellFailureReasons)[number];

export function readShellFailureReason(value: unknown): ShellFailureReason {
	return shellFailureReasons.includes(value as ShellFailureReason)
		? (value as ShellFailureReason)
		: 'verification';
}

export class ShellPreparationError extends Error {
	constructor(public readonly reason: ShellFailureReason) {
		super(reason);
	}
}
