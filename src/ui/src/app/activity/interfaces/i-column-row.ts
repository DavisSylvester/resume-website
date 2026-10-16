/** One column of a stacked column chart. */
export interface ColumnRow {
  key: string;
  label: string;
  values: Record<string, number>;
}
