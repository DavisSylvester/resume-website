import { Component, computed, input } from '@angular/core';
import type { InputSignal, Signal } from '@angular/core';
import * as d3 from 'd3';
import { D3Chart, compact, token, whole } from '../d3-chart';
import type { RepoActivity, TooltipRow, WeekCount } from '../../interfaces';

const MAX_SERIES: number = 5;
const DAY_MS: number = 86_400_000;

export interface StreamSeries {
  key: string;
  label: string;
  url: string | null;
  total: number;
  /** Fixed categorical slot (1-based). Follows the entity, never the current rank. */
  slot: number;
  byWeek: Map<string, number>;
}

/** Top repos keep their own stream; the long tail folds into "Other" rather than a 7th hue. */
export const toSeries = (repos: RepoActivity[], login: string): StreamSeries[] => {
  const strip = (name: string): string => (name.toLowerCase().startsWith(`${login.toLowerCase()}/`) ? name.slice(login.length + 1) : name);
  const toMap = (weekly: WeekCount[]): Map<string, number> => new Map(weekly.map((w: WeekCount): [string, number] => [w.week, w.count]));
  const head: StreamSeries[] = repos.slice(0, MAX_SERIES).map((r: RepoActivity, i: number): StreamSeries => ({
    key: r.name,
    label: strip(r.name),
    url: r.url,
    total: r.commits,
    slot: i + 1,
    byWeek: toMap(r.weekly),
  }));
  const tail: RepoActivity[] = repos.slice(MAX_SERIES);
  if (tail.length === 0) return head;
  const other: Map<string, number> = new Map();
  for (const r of tail) for (const w of r.weekly) other.set(w.week, (other.get(w.week) ?? 0) + w.count);
  return [
    ...head,
    {
      key: '__other__',
      label: `${tail.length} other repos`,
      url: null,
      total: d3.sum(tail, (r: RepoActivity): number => r.commits),
      slot: MAX_SERIES + 1,
      byWeek: other,
    },
  ];
};

/** Every Monday between the first and last active week, so quiet weeks render as zero. */
export const weekSpan = (series: StreamSeries[]): string[] => {
  const all: string[] = series.flatMap((s: StreamSeries): string[] => [...s.byWeek.keys()]).sort();
  const first: string | undefined = all[0];
  const last: string | undefined = all[all.length - 1];
  if (!first || !last) return [];
  const out: string[] = [];
  for (let t: number = Date.parse(`${first}T00:00:00Z`); t <= Date.parse(`${last}T00:00:00Z`); t += 7 * DAY_MS) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
};

type Row = { week: string } & Record<string, number | string>;

/** Streamgraph of public commits per week, one stream per repository. */
@Component({
  selector: 'app-repo-stream',
  standalone: true,
  templateUrl: './repo-stream.html',
  styleUrl: './repo-stream.scss',
})
export class RepoStream extends D3Chart<RepoActivity[]> {

  public readonly login: InputSignal<string> = input<string>('');
  protected readonly series: Signal<StreamSeries[]> = computed((): StreamSeries[] => toSeries(this.data(), this.login()));
  protected readonly fmt: Intl.NumberFormat = whole;

  protected render(el: HTMLDivElement, repos: RepoActivity[], width: number): void {
    d3.select(el).selectAll('svg').remove();
    const series: StreamSeries[] = toSeries(repos, this.login());
    const weeks: string[] = weekSpan(series);
    if (weeks.length < 2) return;

    const rows: Row[] = weeks.map((week: string): Row => {
      const row: Row = { week };
      for (const s of series) row[s.key] = s.byWeek.get(week) ?? 0;
      return row;
    });
    const stacked: d3.Series<Row, string>[] = d3
      .stack<Row>()
      .keys(series.map((s: StreamSeries): string => s.key))
      .value((r: Row, key: string): number => Number(r[key] ?? 0))
      .offset(d3.stackOffsetWiggle)
      .order(d3.stackOrderInsideOut)(rows);

    const height: number = 280;
    const margin: { top: number; right: number; bottom: number; left: number } = { top: 8, right: 8, bottom: 26, left: 8 };
    const x: d3.ScaleTime<number, number> = d3
      .scaleUtc()
      .domain([new Date(`${weeks[0]}T00:00:00Z`), new Date(`${weeks[weeks.length - 1]}T00:00:00Z`)])
      .range([margin.left, width - margin.right]);
    const lo: number = d3.min(stacked, (s: d3.Series<Row, string>): number => d3.min(s, (p: d3.SeriesPoint<Row>): number => p[0]) ?? 0) ?? 0;
    const hi: number = d3.max(stacked, (s: d3.Series<Row, string>): number => d3.max(s, (p: d3.SeriesPoint<Row>): number => p[1]) ?? 0) ?? 1;
    const y: d3.ScaleLinear<number, number> = d3.scaleLinear().domain([lo, hi]).range([height - margin.bottom, margin.top]);
    const at = (p: d3.SeriesPoint<Row>): Date => new Date(`${p.data.week}T00:00:00Z`);

    const area: d3.Area<d3.SeriesPoint<Row>> = d3
      .area<d3.SeriesPoint<Row>>()
      .x((p: d3.SeriesPoint<Row>): number => x(at(p)))
      .y0((p: d3.SeriesPoint<Row>): number => y(p[0]))
      .y1((p: d3.SeriesPoint<Row>): number => y(p[1]))
      .curve(d3.curveBasis);

    const slotOf: Map<string, number> = new Map(series.map((s: StreamSeries): [string, number] => [s.key, s.slot]));
    const colorOf = (key: string): string => token(el, `--series-${slotOf.get(key) ?? 1}`);
    const surface: string = token(el, '--viz-surface');

    const svg: d3.Selection<SVGSVGElement, unknown, null, undefined> = d3
      .select(el)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('role', 'img')
      .attr('aria-label', 'Public commits per week, stacked by repository');

    svg
      .append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(Math.max(2, Math.floor(width / 90))).tickFormat((d: Date | d3.NumberValue): string => d3.utcFormat('%b')(d as Date)).tickSizeOuter(0))
      .call((axis: d3.Selection<SVGGElement, unknown, null, undefined>): void => {
        axis.select('.domain').attr('stroke', token(el, '--viz-axis'));
        axis.selectAll('line').attr('stroke', token(el, '--viz-axis'));
        axis.selectAll('text').attr('class', 'viz-axis-label');
      });

    // The surface-colored stroke is the 2px gap between touching streams.
    svg
      .append('g')
      .selectAll('path')
      .data(stacked)
      .join('path')
      .attr('d', area)
      .attr('fill', (s: d3.Series<Row, string>): string => colorOf(s.key))
      .attr('fill-opacity', 0.88)
      .attr('stroke', surface)
      .attr('stroke-width', 1.5);

    const rule: d3.Selection<SVGLineElement, unknown, null, undefined> = svg
      .append('line')
      .attr('y1', margin.top)
      .attr('y2', height - margin.bottom)
      .attr('stroke', token(el, '--viz-text-2'))
      .attr('stroke-width', 1)
      .attr('visibility', 'hidden');

    // Crosshair: snap to the nearest week and list every repo at that week.
    svg
      .append('rect')
      .attr('x', margin.left)
      .attr('y', margin.top)
      .attr('width', width - margin.left - margin.right)
      .attr('height', height - margin.top - margin.bottom)
      .attr('fill', 'transparent')
      .on('pointermove', (event: PointerEvent): void => {
        const [px] = d3.pointer(event, svg.node());
        const t: number = x.invert(px).getTime();
        const i: number = Math.max(0, Math.min(rows.length - 1, Math.round((t - x.domain()[0]!.getTime()) / (7 * DAY_MS))));
        const row: Row | undefined = rows[i];
        if (!row) return;
        const rx: number = x(new Date(`${row.week}T00:00:00Z`));
        rule.attr('x1', rx).attr('x2', rx).attr('visibility', 'visible');
        const tipRows: TooltipRow[] = series
          .map((s: StreamSeries): TooltipRow => ({
            value: compact.format(Number(row[s.key] ?? 0)),
            label: s.label,
            color: colorOf(s.key),
          }))
          .filter((r: TooltipRow): boolean => r.value !== '0');
        const [ex, ey] = d3.pointer(event, el);
        this.showTip(el, ex, ey, `Week of ${d3.utcFormat('%b %-d, %Y')(new Date(`${row.week}T00:00:00Z`))}`, tipRows.length ? tipRows : [{ value: '0', label: 'commits' }]);
      })
      .on('pointerleave', (): void => {
        rule.attr('visibility', 'hidden');
        this.hideTip();
      });
  }
}
