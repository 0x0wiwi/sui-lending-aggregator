export async function runSequentialRefresh<T>(
  items: readonly T[],
  refresh: (item: T) => Promise<boolean | void>
) {
  for (const item of items) {
    if ((await refresh(item)) === false) return
  }
}
