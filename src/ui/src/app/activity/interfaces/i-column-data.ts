import type { ColumnRow } from './i-column-row';
import type { ColumnSeries } from './i-column-series';

export interface ColumnData {
  rows: ColumnRow[];
  series: ColumnSeries[];
  /** Noun for tooltip totals, e.g. "commits". */
  unit: string;
  caption: string;
}
