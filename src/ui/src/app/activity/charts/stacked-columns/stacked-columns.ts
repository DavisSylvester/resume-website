import { Component } from '@angular/core';
import * as d3 from 'd3';
import { roundedBar } from '../bar-path';
import { D3Chart, compact, token, whole } from '../d3-chart';
import type { ColumnData, ColumnRow, ColumnSeries, TooltipRow } from '../../interfaces';

/**
 * Reusable stacked column chart on one y axis: columns <= 24px, 2px surface gap between
 * segments, rounded data end on the top segment only. Used for IaC by month, PRs, CI runs
 * and the career arc.
 */
@Component({
  selector: 'app-stacked-columns',
  standalone: true,
  templateUrl: './stacked-columns.html',
  styleUrl: './stacked-columns.scss',
})
export class StackedColumns extends D3Chart<ColumnData> {

  protected readonly fmt: Intl.NumberFormat = whole;

  /** A row may omit a series key; treat that as zero. */
  protected cell(row: ColumnRow, key: string): number {
    const v: number | undefined = row.values[key];
    return v ?? 0;
  }

  protected total(row: ColumnRow, series: ColumnSeries[]): number {
    return series.reduce((s: number, x: ColumnSeries): number => s + (row.values[x.key] ?? 0), 0);
  }

  protected render(el: HTMLDivElement, data: ColumnData, width: number): void {
    d3.select(el).selectAll('svg').remove();
    if (data.rows.length === 0) return;

    const height: number = 240;
    const margin: { top: number; right: number; bottom: number; left: number } = { top: 10, right: 8, bottom: 26, left: 40 };
    const x: d3.ScaleBand<string> = d3
      .scaleBand<string>()
      .domain(data.rows.map((r: ColumnRow): string => r.key))
      .range([margin.left, width - margin.right])
      .paddingInner(0.25);
    const max: number = d3.max(data.rows, (r: ColumnRow): number => this.total(r, data.series)) ?? 0;
    const y: d3.ScaleLinear<number, number> = d3
      .scaleLinear()
      .domain([0, Math.max(1, max)])
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
      .attr('aria-label', data.caption);

    svg
      .append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(
        d3
          .axisLeft(y)
          .ticks(4)
          .tickSize(-(width - margin.left - margin.right))
          .tickFormat((v: d3.NumberValue): string => compact.format(Number(v))),
      )
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

    // Thin the x labels so they never collide.
    const every: number = Math.max(1, Math.ceil(data.rows.length / Math.max(2, Math.floor(width / 64))));
    svg
      .append('g')
      .selectAll('text')
      .data(data.rows.filter((_r: ColumnRow, i: number): boolean => i % every === 0))
      .join('text')
      .attr('class', 'viz-axis-label')
      .attr('x', (r: ColumnRow): number => (x(r.key) ?? 0) + x.bandwidth() / 2)
      .attr('y', height - 8)
      .attr('text-anchor', 'middle')
      .text((r: ColumnRow): string => r.label);

    const colors: Map<string, string> = new Map(data.series.map((s: ColumnSeries): [string, string] => [s.key, token(el, s.color)]));
    const cols: d3.Selection<SVGGElement, ColumnRow, SVGGElement, unknown> = svg
      .append('g')
      .selectAll<SVGGElement, ColumnRow>('g')
      .data(data.rows)
      .join('g');

    cols.each((row: ColumnRow, i: number, nodes: SVGGElement[] | ArrayLike<SVGGElement>): void => {
      const g: d3.Selection<SVGGElement, unknown, null, undefined> = d3.select(nodes[i] as SVGGElement);
      const left: number = (x(row.key) ?? 0) + offset;
      const present: ColumnSeries[] = data.series.filter((s: ColumnSeries): boolean => (row.values[s.key] ?? 0) > 0);
      let acc: number = 0;
      present.forEach((s: ColumnSeries, idx: number): void => {
        const v: number = row.values[s.key] ?? 0;
        const base: number = y(acc) - (idx === 0 ? 0 : 1);
        const top: number = y(acc + v) + (idx === present.length - 1 ? 0 : 1);
        acc += v;
        if (base - top < 0.5) return;
        // Only the topmost segment gets the rounded data end; the 2px gap separates the rest.
        const path: string =
          idx === present.length - 1
            ? roundedBar(left, thickness, base, top)
            : `M${left},${base}V${top}H${left + thickness}V${base}Z`;
        g.append('path').attr('d', path).attr('fill', colors.get(s.key) ?? '');
      });
    });

    // The whole band column is the hover target.
    cols
      .append('rect')
      .attr('x', (r: ColumnRow): number => x(r.key) ?? 0)
      .attr('width', Math.max(x.bandwidth(), 6))
      .attr('y', margin.top)
      .attr('height', height - margin.top - margin.bottom)
      .attr('fill', 'transparent')
      .on('pointermove', (event: PointerEvent, r: ColumnRow): void => {
        const [px, py] = d3.pointer(event, el);
        cols.attr('opacity', (c: ColumnRow): number => (c === r ? 1 : 0.55));
        const rows: TooltipRow[] = data.series.map((s: ColumnSeries): TooltipRow => ({
          value: whole.format(r.values[s.key] ?? 0),
          label: s.label,
          color: colors.get(s.key),
        }));
        if (data.series.length > 1) rows.push({ value: whole.format(this.total(r, data.series)), label: `total ${data.unit}` });
        this.showTip(el, px, py, r.label, rows);
      })
      .on('pointerleave', (): void => {
        cols.attr('opacity', 1);
        this.hideTip();
      });
  }
}
