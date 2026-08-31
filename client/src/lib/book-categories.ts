export type BookCategory = {
  parentCategory: string;
  category: string;
  description?: string;
};

export function categoryLabel(categories: readonly BookCategory[], value: string): string {
  return categories.find((category) => category.category === value)?.category || value;
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