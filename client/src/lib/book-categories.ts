export type BookCategory = {
  parentCategory: string;
  category: string;
  description?: string;
};

export function categoryLabel(categories: readonly BookCategory[], value: string): string {
  return categories.find((category) => category.category === value)?.category || value;
}

export function categoryParent(categories: readonly BookCategory[], value: string): string {
  return categories.find((category) => category.category === value)?.parentCategory || "Uncategorized";
}

export function groupedBookCategories(categories: readonly BookCategory[]): [string, BookCategory[]][] {
  const groups = new Map<string, BookCategory[]>();
  [...categories]
    .sort((a, b) => a.parentCategory.localeCompare(b.parentCategory) || a.category.localeCompare(b.category))
    .forEach((category) => {
      const entries = groups.get(category.parentCategory) ?? [];
      entries.push(category);
      groups.set(category.parentCategory, entries);
    });
  return Array.from(groups.entries());
}

export function groupedBookEntries<T extends { category: string }>(
  entries: readonly T[],
  categories: readonly BookCategory[],
): Array<{ parentCategory: string; category: string; entries: T[] }> {
  const parentByCategory = new Map(categories.map((category) => [category.category, category.parentCategory]));
  const groups = new Map<string, { parentCategory: string; category: string; entries: T[] }>();

  entries.forEach((entry) => {
    const parentCategory = parentByCategory.get(entry.category) || "Uncategorized";
    const key = `${parentCategory}\u0000${entry.category}`;
    const group = groups.get(key) ?? { parentCategory, category: entry.category, entries: [] };
    group.entries.push(entry);
    groups.set(key, group);
  });

  return Array.from(groups.values()).sort((a, b) =>
    a.parentCategory.localeCompare(b.parentCategory) || a.category.localeCompare(b.category));
}