export interface HBarRow {
  label: string;
  value: number;
  /** Text at the bar tip, e.g. "42%" or "12 repos". */
  valueLabel: string;
  /** Extra tooltip line. */
  note?: string;
}
