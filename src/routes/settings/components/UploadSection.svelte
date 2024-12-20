<script>
	import * as pdfjs from 'pdfjs-dist';
	import { getCourseData } from '$lib/courseData';

	pdfjs.GlobalWorkerOptions.workerSrc =
		'../../../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs';

	let extractedText = $state('');
	let pdfFile = $state(null);

	async function extractTextFromPDF(file) {
		if (!file) return;

		const fileReader = new FileReader();

		fileReader.onload = async (event) => {
			const typedArray = new Uint8Array(event.target.result);
			const pdf = await pdfjs.getDocument(typedArray).promise;
			let text = '';

			for (let i = 1; i <= pdf.numPages; i++) {
				const page = await pdf.getPage(i);
				const textContent = await page.getTextContent();
				console.log(textContent);
				text += textContent.items.map((item) => item.str).join(' ') + '\n';
			}

			extractedText = text;
		};

		fileReader.readAsArrayBuffer(file);
	}

	function handleFileUpload(event) {
		pdfFile = event.target.files[0];
		extractTextFromPDF(pdfFile);
	}

	// yyyy-yyyy regex
	const yearRegex = /(?:\d{4})-(?:\d{4})/g;

	// course code regex - 6 to 8 digits
	const courseRegex = /(\d{6,8})/g;

	const semesters = $derived.by(() => {
		if (extractedText === '') {
			return [];
		}

		// separate text by yearRegex
		const parts = extractedText.split(yearRegex);

		console.log(parts);

		// get all course regex in each part
		const courses = parts.map((part) =>
			[...new Set(part.match(courseRegex))]
				// left pad with zeros to 8 digits
				.map((c) => c.padStart(8, '0'))
				.filter((c) => getCourseData(c).name !== undefined)
		);

		return courses;
	});
</script>

<main class="mx-auto mt-10 max-w-xl rounded-lg bg-white p-6 shadow-md">
	<h1 class="mb-4 text-center text-2xl font-bold">Extract Text from PDF</h1>

	<div class="mb-6">
		<input
			type="file"
			accept="application/pdf"
			onchange={handleFileUpload}
			class="block w-full cursor-pointer rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
		/>
	</div>

	<h2 class="mb-2 text-xl font-semibold">Extracted Text</h2>
	<pre
		class="whitespace-pre-wrap rounded-lg border border-gray-300 bg-gray-100 p-4">
        {JSON.stringify(semesters)}
      </pre>
</main>
