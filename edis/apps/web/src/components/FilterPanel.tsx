import clsx from 'clsx';
import { DEFAULT_FILTERS, FILTER_GROUPS, FILTER_LABELS, NewsFilterLabel, normalizeFilters } from '../lib/newsFilters';

export type FilterPanelProps = {
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
};

const toCheckboxId = (label: string) =>
  `news-filter-${label.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`;

const FilterPanel = ({ selected, onChange, className }: FilterPanelProps) => {
  const normalizedSelected = normalizeFilters(selected);
  const selectedSet = new Set<NewsFilterLabel>(normalizedSelected);
  const hasSelection = normalizedSelected.length > 0;
  const hasAllSelected = normalizedSelected.length === FILTER_LABELS.length;

  const handleToggle = (label: NewsFilterLabel) => {
    if (selectedSet.has(label)) {
      onChange(normalizedSelected.filter((item) => item !== label));
      return;
    }

    onChange(normalizeFilters([...normalizedSelected, label]));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const handleReset = () => {
    onChange([...DEFAULT_FILTERS]);
  };

  const handleSelectAll = () => {
    onChange(normalizeFilters(FILTER_LABELS));
  };

  return (
    <aside
      className={clsx(
        'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900',
        className
      )}
      aria-label="Filter news topics"
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Filter news topics</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Choose the safety signals you want highlighted in the news feed.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-xs font-medium text-sky-600 underline-offset-4 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
            disabled={hasAllSelected}
          >
            Select all
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs font-medium text-sky-600 underline-offset-4 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
            disabled={!hasSelection}
          >
            Clear all
          </button>
        </div>
      </header>
      <div className="space-y-6" role="group" aria-label="News filter groups">
        {Object.entries(FILTER_GROUPS).map(([groupLabel, labels]) => (
          <fieldset key={groupLabel} className="space-y-3">
            <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">{groupLabel}</legend>
            <div className="space-y-2">
              {labels.map((label) => {
                const checkboxId = toCheckboxId(label);
                const isChecked = selectedSet.has(label);

                return (
                  <div key={label} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggle(label)}
                      className="h-5 w-5 rounded border-slate-300 text-sky-600 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-900"
                    />
                    <label htmlFor={checkboxId} className="flex-1 text-sm text-slate-700 dark:text-slate-200">
                      {label}
                    </label>
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {hasSelection
            ? `${normalizedSelected.length} of ${FILTER_LABELS.length} active`
            : 'No filters applied'}
        </span>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Reset filters
        </button>
      </div>
    </aside>
  );
};

export default FilterPanel;
