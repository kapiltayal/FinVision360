export type TransactionCategoryState = {
  isEdit: boolean;
  type: string;
  initialType?: string;
  subcategory: string;
  initialSubcategory?: string;
  parentCategory: string;
  initialParentCategory?: string | null;
};

/** Let edits to other fields save without resubmitting an unchanged legacy category. */
export function isUnchangedTransactionCategory(state: TransactionCategoryState): boolean {
  return state.isEdit &&
    state.type === state.initialType &&
    state.subcategory === state.initialSubcategory &&
    state.parentCategory === (state.initialParentCategory ?? "");
}
