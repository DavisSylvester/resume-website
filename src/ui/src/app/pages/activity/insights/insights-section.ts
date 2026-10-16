import { Component, computed, input } from '@angular/core';
import type { InputSignal, Signal } from '@angular/core';
import * as d3 from 'd3';
import { compact, whole } from '../../../activity/charts/d3-chart';
import { HBars } from '../../../activity/charts/hbars/hbars';
import { StackedColumns } from '../../../activity/charts/stacked-columns/stacked-columns';
import type { ColumnData, ColumnSeries, HBarRow, IacToolStat, Insights, MonthValues } from '../../../activity/interfaces';

interface Tile {
  label: string;
  value: string;
  note: string;
}

interface ToolMeta {
  label: string;
  color: string;
}

/** Each IaC tool keeps one fixed color, whatever its rank (color follows the entity). */
export const TOOL_META: Record<string, ToolMeta> = {
  terraform: { label: 'Terraform', color: '--series-1' },
  cdk: { label: 'AWS CDK', color: '--series-2' },
  bicep: { label: 'Bicep', color: '--series-3' },
  pulumi: { label: 'Pulumi', color: '--series-4' },
  cloudformation: { label: 'CloudFormation / SAM', color: '--series-5' },
  serverless: { label: 'Serverless', color: '--series-6' },
};

const CATEGORY_ORDER: string[] = ['Frontend', 'Backend', 'Mobile', 'Cloud & IaC', 'Data & AI', 'Testing', 'Runtime'];

const TYPE_LABEL: Record<string, string> = {
  feat: 'Features',
  fix: 'Fixes',
  refactor: 'Refactors',
  test: 'Tests',
  docs: 'Docs',
  chore: 'Chores',
  ci: 'CI',
  build: 'Build',
  perf: 'Performance',
  style: 'Style',
  revert: 'Reverts',
  merge: 'Merges',
  other: 'Other / unprefixed',
};

const pct: Intl.NumberFormat = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 });

export const monthLabel = (month: string): string => {
  const d: Date = new Date(`${month}-01T00:00:00Z`);
  return d.getUTCMonth() === 0 ? d3.utcFormat("%b '%y")(d) : d3.utcFormat('%b')(d);
};

export const durationLabel = (hours: number | null): string => {
  if (hours === null) return '–';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.round(hours * 10) / 10} h`;
  return `${Math.round(hours / 24)} days`;
};

const ratio = (part: number, whole_: number): number => (whole_ > 0 ? part / whole_ : 0);

/** The "Engineering insights" cards: IaC, stack, commit mix, testing, PRs, CI/CD and career arc. */
@Component({
  selector: 'app-insights-section',
  standalone: true,
  imports: [StackedColumns, HBars],
  templateUrl: './insights-section.html',
  styleUrl: './insights-section.scss',
})
export class InsightsSection {

  public readonly insights: InputSignal<Insights> = input.required<Insights>();
  public readonly tableView: InputSignal<boolean> = input<boolean>(false);

  protected readonly fmt: Intl.NumberFormat = whole;
  protected readonly toolMeta: Record<string, ToolMeta> = TOOL_META;

  protected readonly tools: Signal<IacToolStat[]> = computed((): IacToolStat[] =>
    this.insights().iac.tools.filter((t: IacToolStat): boolean => TOOL_META[t.tool] !== undefined),
  );

  protected readonly iacHeadline: Signal<string> = computed((): string => {
    const tools: IacToolStat[] = this.tools().filter((t: IacToolStat): boolean => t.commits > 0);
    const total: number = d3.sum(tools, (t: IacToolStat): number => t.commits);
    if (total === 0) return 'No infrastructure-as-code commits classified yet.';
    return tools
      .slice(0, 3)
      .map((t: IacToolStat): string => `${TOOL_META[t.tool]?.label} ${pct.format(t.commits / total)}`)
      .join(' · ');
  });

  protected readonly iacColumns: Signal<ColumnData> = computed((): ColumnData => {
    const series: ColumnSeries[] = this.tools()
      .filter((t: IacToolStat): boolean => t.commits > 0)
      .map((t: IacToolStat): ColumnSeries => ({ key: t.tool, label: TOOL_META[t.tool]?.label ?? t.tool, color: TOOL_META[t.tool]?.color ?? '--series-1' }));
    return {
      series,
      unit: 'IaC commits',
      caption: 'Commits touching infrastructure-as-code files per month, by tool',
      rows: this.insights().iac.monthly.map((m: MonthValues) => ({ key: m.month, label: monthLabel(m.month), values: m.values })),
    };
  });

  protected readonly clouds: Signal<HBarRow[]> = computed((): HBarRow[] =>
    this.insights().iac.clouds.map((c: { cloud: string; repos: number }): HBarRow => ({
      label: c.cloud,
      value: c.repos,
      valueLabel: `${c.repos} ${c.repos === 1 ? 'repo' : 'repos'}`,
    })),
  );

  protected readonly providers: Signal<string> = computed((): string =>
    this.insights()
      .iac.providers.slice(0, 10)
      .map((p: { name: string; repos: number }): string => p.name)
      .join(', '),
  );

  protected readonly stackGroups: Signal<{ category: string; items: { name: string; repos: number }[] }[]> = computed(() => {
    const byCat: Map<string, { name: string; repos: number }[]> = new Map();
    for (const s of this.insights().stack) {
      const list: { name: string; repos: number }[] = byCat.get(s.category) ?? [];
      list.push({ name: s.name, repos: s.repos });
      byCat.set(s.category, list);
    }
    return [...byCat.entries()]
      .sort(([a]: [string, unknown], [b]: [string, unknown]): number => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b))
      .map(([category, items]: [string, { name: string; repos: number }[]]) => ({ category, items }));
  });

  protected readonly commitTypes: Signal<HBarRow[]> = computed((): HBarRow[] => {
    const types: { type: string; count: number }[] = this.insights().commitTypes;
    const total: number = d3.sum(types, (t: { count: number }): number => t.count);
    return types.slice(0, 9).map((t: { type: string; count: number }): HBarRow => ({
      label: TYPE_LABEL[t.type] ?? t.type,
      value: t.count,
      valueLabel: pct.format(ratio(t.count, total)),
      note: `${whole.format(t.count)} commits`,
    }));
  });

  protected readonly testingTiles: Signal<Tile[]> = computed((): Tile[] => {
    const t: Insights['testing'] = this.insights().testing;
    const testShare: number = ratio(t.testLinesAdded, t.testLinesAdded + t.codeLinesAdded);
    const sizeRatio: number = ratio(t.codeBytes, t.testBytes);
    return [
      { label: 'Commits that touch tests', value: pct.format(ratio(t.commitsTouchingTests, t.commitsTotal)), note: `${whole.format(t.commitsTouchingTests)} of ${whole.format(t.commitsTotal)}` },
      { label: 'Test share of lines written', value: pct.format(testShare), note: `${compact.format(t.testLinesAdded)} test lines` },
      { label: 'Repos with test suites', value: `${t.reposWithTests} of ${t.reposScanned}`, note: 'active in the last 12 months' },
      { label: 'Test to code size', value: t.testBytes > 0 ? `1 : ${Math.round(sizeRatio * 10) / 10}` : '–', note: 'bytes of test code per byte of code' },
    ];
  });

  protected readonly testMeter: Signal<number> = computed((): number => {
    const t: Insights['testing'] = this.insights().testing;
    return ratio(t.commitsTouchingTests, t.commitsTotal);
  });

  protected readonly prTiles: Signal<Tile[]> = computed((): Tile[] => {
    const p: Insights['pullRequests'] = this.insights().pullRequests;
    return [
      { label: 'Pull requests opened', value: whole.format(p.opened), note: 'last 12 months' },
      { label: 'Merged', value: whole.format(p.merged), note: `${pct.format(ratio(p.merged, p.opened))} merge rate` },
      { label: 'Median time to merge', value: durationLabel(p.medianHoursToMerge), note: 'opened to merged' },
      { label: 'Reviews given', value: whole.format(p.reviews), note: 'pull request reviews' },
    ];
  });

  protected readonly prColumns: Signal<ColumnData> = computed((): ColumnData => ({
    series: [{ key: 'merged', label: 'Merged', color: '--series-1' }],
    unit: 'pull requests',
    caption: 'Pull requests merged per month',
    rows: this.insights().pullRequests.monthly.map((m: MonthValues) => ({ key: m.month, label: monthLabel(m.month), values: { merged: m.values['merged'] ?? 0 } })),
  }));

  protected readonly ciTiles: Signal<Tile[]> = computed((): Tile[] => {
    const c: Insights['cicd'] = this.insights().cicd;
    const weeks: number = Math.max(1, c.weekly.length);
    return [
      { label: 'Pipeline runs', value: whole.format(c.runs), note: `across ${c.reposWithRuns} repos` },
      { label: 'Success rate', value: pct.format(ratio(c.succeeded, c.succeeded + c.failed)), note: `${whole.format(c.failed)} failed runs` },
      { label: 'Deployments', value: whole.format(c.deploys), note: `${Math.round((c.deploys / weeks) * 10) / 10} per active week` },
    ];
  });

  protected readonly ciColumns: Signal<ColumnData> = computed((): ColumnData => ({
    series: [
      { key: 'succeeded', label: 'Succeeded', color: '--status-good' },
      { key: 'failed', label: 'Failed', color: '--status-critical' },
    ],
    unit: 'runs',
    caption: 'GitHub Actions runs per week by outcome',
    rows: this.insights().cicd.weekly.map((w: { week: string; values: Record<string, number> }) => ({
      key: w.week,
      label: d3.utcFormat('%b %-d')(new Date(`${w.week}T00:00:00Z`)),
      values: w.values,
    })),
  }));

  protected readonly careerColumns: Signal<ColumnData> = computed((): ColumnData => ({
    series: [
      { key: 'public', label: 'Public', color: '--series-1' },
      { key: 'private', label: 'Private', color: '--series-3' },
    ],
    unit: 'contributions',
    caption: 'Contributions per calendar year, public and private',
    rows: this.insights().career.years.map((y: Insights['career']['years'][number]) => ({
      key: String(y.year),
      label: String(y.year),
      values: { public: Math.max(0, y.contributions - y.privateContributions), private: y.privateContributions },
    })),
  }));

  protected readonly careerSummary: Signal<string> = computed((): string => {
    const years: Insights['career']['years'] = this.insights().career.years;
    if (years.length === 0) return '';
    const best: Insights['career']['years'][number] = years.reduce((a, b) => (b.contributions > a.contributions ? b : a));
    const total: number = d3.sum(years, (y: { contributions: number }): number => y.contributions);
    return `${whole.format(total)} contributions since joining GitHub in ${this.insights().career.joinedYear ?? years[0]?.year}. Busiest year: ${best.year}, with ${whole.format(best.contributions)}.`;
  });

  protected readonly coverage: Signal<string> = computed((): string => {
    const c: Insights['coverage'] = this.insights().coverage;
    const pending: string = c.commitsPending > 0 ? ` ${whole.format(c.commitsPending)} more are still being analyzed.` : '';
    return `Classified from ${whole.format(c.commitsAnalyzed)} commits across ${c.reposScanned} repositories.${pending}`;
  });
}
