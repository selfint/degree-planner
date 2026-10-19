export function getTranscriptImportErrorKind(
	error: unknown
): 'invalid' | 'password' | 'failed' {
	// PDF.js exceptions can cross a worker boundary. Only known PDF failures
	// justify file-specific advice; course-data/network errors must not blame it.
	const name =
		error instanceof Object && 'name' in error ? error.name : undefined;
	if (name === 'InvalidPDFException') return 'invalid';
	if (name === 'PasswordException') return 'password';
	return 'failed';
}
