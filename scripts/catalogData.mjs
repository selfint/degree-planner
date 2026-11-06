import { getSemesterName } from './SAPClient.mjs';

function identifier(value, context) {
	if (
		typeof value !== 'string' ||
		!/^[A-Za-z0-9_-]+$/.test(value) ||
		['__proto__', 'constructor', 'prototype', 'en', 'he'].includes(value)
	) {
		throw new Error(`Invalid ${context}: ${String(value)}`);
	}
	return value;
}

function labels(value, context) {
	if (typeof value?.en !== 'string' || typeof value?.he !== 'string') {
		throw new Error(`Missing bilingual labels for ${context}`);
	}
	return { en: value.en, he: value.he };
}

function sortNodes(nodes) {
	return nodes.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

// Match the former additive directory writer: a refresh keeps historical nodes
// and custom requirement fields, while replacing labels/course lists supplied by SAP.
export function mergeRequirement(previous, incoming) {
	const children = new Map(
		(previous?.nested ?? []).map((node) => [node.name, node])
	);
	for (const node of incoming.nested ?? []) {
		children.set(node.name, mergeRequirement(children.get(node.name), node));
	}
	return {
		...previous,
		...incoming,
		nested: sortNodes([...children.values()])
	};
}

function mapTreeNode(node) {
	const name = identifier(node.Otjid, 'requirement ID');
	const i18n = labels(node.Name, name);
	const children = (node.children ?? []).flatMap(mapTreeNode);
	// Keep the legacy English-prefix rule. Hebrew is a display label, not an ID.
	if (i18n.en.toLowerCase().startsWith('structure element')) {
		return children;
	}
	const mapped = { name, nested: [], ...i18n };
	if (node.courses !== undefined) {
		if (
			!Array.isArray(node.courses) ||
			node.courses.some(
				(code) => typeof code !== 'string' || !/^SM\d{8}$/.test(code)
			)
		) {
			throw new Error(`Invalid SAP course codes in ${name}`);
		}
		mapped.courses = node.courses.map((code) => code.slice(2));
	}
	return [mergeRequirement(undefined, { ...mapped, nested: children })];
}

/** Convert the same raw SAP catalogs used by the old directory pipeline. */
export function buildCatalogData(rawCatalogs) {
	if (!Array.isArray(rawCatalogs) || rawCatalogs.length === 0) {
		throw new Error('Expected a non-empty raw SAP catalog array');
	}
	const catalogs = {};
	const requirements = new Map();
	for (const { track, tree } of rawCatalogs) {
		const root = tree?.children?.at(0);
		if (root === undefined) continue; // SAP also returns tracks with no tree.
		const catalogId = identifier(`${track.Peryr}_${track.Perid}`, 'catalog ID');
		const facultyId = identifier(track.OrgId, 'faculty ID');
		const programId = identifier(`${track.Otjid}_${root.Otjid}`, 'program ID');
		const season = getSemesterName(track.Perid);
		if (season === undefined)
			throw new Error(`Unknown semester ${track.Perid}`);
		const year = (catalogs[catalogId] ??= {});
		Object.assign(year, {
			en: `${track.Peryr} ${season.en}`,
			he: `${track.Peryr} ${season.he}`
		});
		const faculty = (year[facultyId] ??= {});
		Object.assign(faculty, labels(track.OrgText, facultyId));
		faculty[programId] = labels(track.ZzQualifications, programId);
		const key = `${catalogId}/${facultyId}/${programId}`;
		const requirement = {
			name: 'requirement',
			nested: (root.children ?? []).flatMap(mapTreeNode),
			...labels(track.ZzQualifications, programId)
		};
		requirements.set(key, mergeRequirement(requirements.get(key), requirement));
	}
	if (requirements.size === 0)
		throw new Error('SAP catalogs contain no usable programs');
	return { catalogs: sortCatalogs(catalogs), requirements };
}

export function sortCatalogs(catalogs, depth = 3) {
	if (depth === 0) return catalogs;
	const result = {};
	for (const key of ['en', 'he']) {
		if (key in catalogs) result[key] = catalogs[key];
	}
	for (const key of Object.keys(catalogs)
		.filter((key) => key !== 'en' && key !== 'he')
		.sort()) {
		identifier(key, 'manifest key');
		result[key] = sortCatalogs(catalogs[key], depth - 1);
	}
	return result;
}

export function mergeCatalogs(previous, incoming) {
	const result = structuredClone(previous);
	for (const [catalogId, catalog] of Object.entries(incoming)) {
		const year = (result[catalogId] ??= {});
		Object.assign(year, labels(catalog, catalogId));
		for (const [facultyId, faculty] of Object.entries(catalog)) {
			if (facultyId === 'en' || facultyId === 'he') continue;
			year[facultyId] = { ...year[facultyId], ...faculty };
		}
	}
	return sortCatalogs(result);
}

export function programKeys(catalogs) {
	const keys = [];
	for (const [catalogId, catalog] of Object.entries(catalogs)) {
		identifier(catalogId, 'catalog ID');
		labels(catalog, catalogId);
		for (const [facultyId, faculty] of Object.entries(catalog)) {
			if (facultyId === 'en' || facultyId === 'he') continue;
			identifier(facultyId, 'faculty ID');
			labels(faculty, facultyId);
			for (const [programId, program] of Object.entries(faculty)) {
				if (programId === 'en' || programId === 'he') continue;
				identifier(programId, 'program ID');
				labels(program, programId);
				keys.push(`${catalogId}/${facultyId}/${programId}`);
			}
		}
	}
	if (keys.length === 0)
		throw new Error('Catalog manifest contains no programs');
	return keys;
}

export function validateRequirement(node, context) {
	identifier(node?.name, `requirement name in ${context}`);
	labels(node, context);
	if (
		node.courses !== undefined &&
		(!Array.isArray(node.courses) ||
			node.courses.some(
				(code) => typeof code !== 'string' || !/^\d{8}$/.test(code)
			))
	) {
		throw new Error(`Invalid course codes in ${context}/${node.name}`);
	}
	if (node.nested !== undefined) {
		if (!Array.isArray(node.nested))
			throw new Error(`Invalid nested requirements in ${context}`);
		for (const child of node.nested)
			validateRequirement(child, `${context}/${node.name}`);
	}
}
