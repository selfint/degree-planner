/** Small, valid, text-only PDFs. No real student records or external fixtures. */
export function transcriptPdf(lines: string[]): Uint8Array {
	const escaped = lines.map((line) => line.replace(/([\\()])/g, '\\$1'));
	const stream =
		[
			'BT',
			'/F1 12 Tf',
			'72 720 Td',
			...escaped.flatMap((line, index) => [
				index ? '0 -20 Td' : '',
				`(${line}) Tj`
			]),
			'ET',
			''
		]
			.filter((line) => line !== '')
			.join('\n') + '\n';
	const objects = [
		'<< /Type /Catalog /Pages 2 0 R >>',
		'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
		'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
		'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
		`<< /Length ${stream.length} >>\nstream\n${stream}endstream`
	];
	let pdf = '%PDF-1.4\n';
	const offsets = [0];
	for (const [index, object] of objects.entries()) {
		offsets.push(pdf.length);
		pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
	}
	const xref = pdf.length;
	pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
		.slice(1)
		.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
		.join(
			''
		)}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	return new TextEncoder().encode(pdf);
}
