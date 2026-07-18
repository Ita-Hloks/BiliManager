const FILTER_TRENDING_ATTR = "data-bili-manager-filter-trending";

export function applySearchCleanup(filterTrending: boolean): void {
  const root = document.documentElement;
  if (filterTrending) root.setAttribute(FILTER_TRENDING_ATTR, "true");
  else root.removeAttribute(FILTER_TRENDING_ATTR);
}
