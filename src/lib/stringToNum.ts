export function stringToNum(value: string | undefined): string | undefined {
	return value?.replace(/[^0-9.]/g, '').replace(/(.*?\..*?)\./g, '$1') ?? undefined;
}
