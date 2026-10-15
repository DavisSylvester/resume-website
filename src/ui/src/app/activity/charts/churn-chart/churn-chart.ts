import { Component } from '@angular/core';
import * as d3 from 'd3';
import { roundedBar } from '../bar-path';
import { D3Chart, compact, token, whole } from '../d3-chart';
import type { ChurnWeek } from '../../interfaces';

const WEEK_MS: number = 7 * 86_400_000;

/** The API omits quiet weeks; restore them as zeros so the x axis is true to time. */
export const fillWeeks = (weeks: ChurnWeek[]): ChurnWeek[] => {
  const byWeek: Map<string, ChurnWeek> = new Map(weeks.map((w: ChurnWeek): [string, ChurnWeek] => [w.week, w]));
  const sorted: string[] = [...byWeek.keys()].sort();
  const first: number = Date.parse(`${sorted[0]}T00:00:00Z`);
  const last: number = Date.parse(`${sorted[sorted.length - 1]}T00:00:00Z`);
  const out: ChurnWeek[] = [];
  for (let t: number = first; t <= last; t += WEEK_MS) {
    const key: string = new Date(t).toISOString().slice(0, 10);
    out.push(byWeek.get(key) ?? { week: key, additions: 0, deletions: 0 });
  }
  return out;
};

/** Lines added (up) and deleted (down) per week across public repositories, on one axis. */
@Component({
  selector: 'app-churn-chart',
  standalone: true,
  templateUrl: './churn-chart.html',
  styleUrl: './churn-chart.scss',
})
export class ChurnChart extends D3Chart<ChurnWeek[]> {

  protected readonly fmt: Intl.NumberFormat = whole;
  protected readonly weekLabel: (week: string) => string = (week: string): string =>
    d3.utcFormat('%b %-d, %Y')(new Date(`${week}T00:00:00Z`));

  protected render(el: HTMLDivElement, sparse: ChurnWeek[], width: number): void {
    d3.select(el).selectAll('svg').remove();
    if (sparse.length === 0) return;
    const weeks: ChurnWeek[] = fillWeeks(sparse);

    const height: number = 260;
    const margin: { top: number; right: number; bottom: number; left: number } = { top: 10, right: 8, bottom: 26, left: 44 };
    const x: d3.ScaleBand<string> = d3
      .scaleBand<string>()
      .domain(weeks.map((w: ChurnWeek): string => w.week))
      .range([margin.left, width - margin.right])
      .paddingInner(0.2);
    const maxAdd: number = d3.max(weeks, (w: ChurnWeek): number => w.additions) ?? 1;
    const maxDel: number = d3.max(weeks, (w: ChurnWeek): number => w.deletions) ?? 1;
    const y: d3.ScaleLinear<number, number> = d3
      .scaleLinear()
      .domain([-maxDel, maxAdd])
      .nice()
      .range([height - margin.bottom, margin.top]);
    const thickness: number = Math.min(24, x.bandwidth());
    const offset: number = (x.bandwidth() - thickness) / 2;

    const svg: d3.Selection<SVGSVGElement, unknown, null, undefined> = d3
      .select(el)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('role', 'img')
      .attr('aria-label', 'Lines added and deleted per week in public repositories');

    // Recessive hairline grid with compact ticks (0 / 10K / 20K), on a single y axis.
    svg
      .append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickSize(-(width - margin.left - margin.right)).tickFormat((v: d3.NumberValue): string => compact.format(Math.abs(Number(v)))))
      .call((axis: d3.Selection<SVGGElement, unknown, null, undefined>): void => {
        axis.select('.domain').remove();
        axis.selectAll('line').attr('stroke', token(el, '--viz-grid'));
        axis.selectAll('text').attr('class', 'viz-axis-label');
      });
    svg
      .append('line')
      .attr('x1', margin.left)
      .attr('x2', width - margin.right)
      .attr('y1', y(0))
      .attr('y2', y(0))
      .attr('stroke', token(el, '--viz-axis'));

    const ticks: string[] = weeks
      .map((w: ChurnWeek): string => w.week)
      .filter((_w: string, i: number, all: string[]): boolean => i % Math.max(1, Math.ceil(all.length / Math.max(2, Math.floor(width / 80)))) === 0);
    svg
      .append('g')
      .selectAll('text')
      .data(ticks)
      .join('text')
      .attr('class', 'viz-axis-label')
      .attr('x', (w: string): number => (x(w) ?? 0) + x.bandwidth() / 2)
      .attr('y', height - 8)
      .attr('text-anchor', 'middle')
      .text((w: string): string => d3.utcFormat('%b %-d')(new Date(`${w}T00:00:00Z`)));

    const add: string = token(el, '--div-pos');
    const del: string = token(el, '--div-neg');
    const groups: d3.Selection<SVGGElement, ChurnWeek, SVGGElement, unknown> = svg
      .append('g')
      .selectAll<SVGGElement, ChurnWeek>('g')
      .data(weeks)
      .join('g');
    groups
      .append('path')
      .attr('d', (w: ChurnWeek): string => roundedBar((x(w.week) ?? 0) + offset, thickness, y(0) - 1, y(w.additions)))
      .attr('fill', add);
    groups
      .append('path')
      .attr('d', (w: ChurnWeek): string => roundedBar((x(w.week) ?? 0) + offset, thickness, y(0) + 1, y(-w.deletions)))
      .attr('fill', del);
    // The whole band column is the hit target, not just the painted bar.
    groups
      .append('rect')
      .attr('x', (w: ChurnWeek): number => x(w.week) ?? 0)
      .attr('width', Math.max(x.bandwidth(), 6))
      .attr('y', margin.top)
      .attr('height', height - margin.top - margin.bottom)
      .attr('fill', 'transparent')
      .on('pointermove', (event: PointerEvent, w: ChurnWeek): void => {
        const [px, py] = d3.pointer(event, el);
        groups.attr('opacity', (g: ChurnWeek): number => (g === w ? 1 : 0.55));
        this.showTip(el, px, py, `Week of ${this.weekLabel(w.week)}`, [
          { value: `+${whole.format(w.additions)}`, label: 'lines added', color: add },
          { value: `−${whole.format(w.deletions)}`, label: 'lines deleted', color: del },
        ]);
      })
      .on('pointerleave', (): void => {
        groups.attr('opacity', 1);
        this.hideTip();
      });
  }
}
