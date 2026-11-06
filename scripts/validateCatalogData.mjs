import { resolve } from 'node:path';
import { readCatalogData } from './generateCatalogData.mjs';

const { requirements } = readCatalogData(resolve('static'));
console.log(
	`Validated ${requirements.size} programs in the canonical JSON snapshot`
);
