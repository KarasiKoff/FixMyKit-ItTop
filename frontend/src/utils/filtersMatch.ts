export function filtersEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
    const keys = Object.keys(a) as (keyof T)[];
    return keys.every((key) => a[key] === b[key]);
}
