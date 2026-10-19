export function applySavedOrder<T extends { id: number }>(items: T[], savedOrder: number[] = []): T[] {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const ordered: T[] = [];
  const seen = new Set<number>();
  for (const id of savedOrder) {
    const item = itemsById.get(id);
    if (item && !seen.has(id)) {
      ordered.push(item);
      seen.add(id);
    }
  }
  for (const item of items) {
    if (!seen.has(item.id)) ordered.push(item);
  }
  return ordered;
}

export function moveItem<T extends { id: number }>(
  items: T[],
  movingId: number,
  targetId: number,
  afterTarget = false,
): T[] {
  if (movingId === targetId) return items;
  const movingIndex = items.findIndex((item) => item.id === movingId);
  const targetIndex = items.findIndex((item) => item.id === targetId);
  if (movingIndex < 0 || targetIndex < 0) return items;

  const next = [...items];
  const [moving] = next.splice(movingIndex, 1);
  const adjustedTargetIndex = next.findIndex((item) => item.id === targetId);
  next.splice(adjustedTargetIndex + (afterTarget ? 1 : 0), 0, moving);
  return next;
}
