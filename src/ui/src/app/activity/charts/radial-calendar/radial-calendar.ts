import { Component, computed } from '@angular/core';
import type { Signal } from '@angular/core';
import * as d3 from 'd3';
import { D3Chart, compact, token, whole } from '../d3-chart';
import type { CalendarDay } from '../../interfaces';

interface MonthRow {
  month: string;
  total: number;
  busiest: number;
}

/**
 * Twelve months wrapped into a clock face. Each day is one radial bar whose length
 * (sqrt scale, so area tracks value) and shade both encode that day's contributions.
 */
@Component({
  selector: 'app-radial-calendar',
  standalone: true,
  templateUrl: './radial-calendar.html',
  styleUrl: './radial-calendar.scss',
})
export class RadialCalendar extends D3Chart<CalendarDay[]> {

  protected readonly months: Signal<MonthRow[]> = computed((): MonthRow[] => {
    const rolled: d3.InternMap<string, CalendarDay[]> = d3.group(this.data(), (d: CalendarDay): string => d.date.slice(0, 7));
    return [...rolled.entries()].map(([key, days]: [string, CalendarDay[]]): MonthRow => ({
      month: d3.utcFormat('%B %Y')(new Date(`${key}-01T00:00:00Z`)),
      total: d3.sum(days, (d: CalendarDay): number => d.count),
      busiest: d3.max(days, (d: CalendarDay): number => d.count) ?? 0,
    }));
  });

  protected readonly fmt: Intl.NumberFormat = whole;

  protected render(el: HTMLDivElement, days: CalendarDay[], width: number): void {
    d3.select(el).selectAll('svg').remove();
    if (days.length === 0) return;

    const size: number = Math.min(width, 620);
    const outer: number = size / 2 - 34;
    const inner: number = outer * 0.38;
    const max: number = d3.max(days, (d: CalendarDay): number => d.count) ?? 1;
    const total: number = d3.sum(days, (d: CalendarDay): number => d.count);
    const step: number = (2 * Math.PI) / days.length;

    const radius: d3.ScalePower<number, number> = d3.scaleSqrt().domain([0, max]).range([inner, outer]);
    const color: d3.ScaleSequential<string> = d3
      .scaleSequential(d3.interpolateRgb(token(el, '--seq-lo'), token(el, '--seq-hi')))
      .domain([0, Math.sqrt(max)]);
    const angle = (i: number): number => i * step;

    const svg: d3.Selection<SVGSVGElement, unknown, null, undefined> = d3
      .select(el)
      .append('svg')
      .attr('viewBox', `${-size / 2} ${-size / 2} ${size} ${size}`)
      .attr('width', size)
      .attr('height', size)
      .attr('role', 'img')
      .attr('aria-label', `${whole.format(total)} contributions over the last ${days.length} days, one bar per day`);

    // Recessive reference rings at a quarter, half and the max of the scale.
    const rings: number[] = [max / 4, max / 2, max].map((v: number): number => Math.round(v));
    svg
      .append('g')
      .selectAll('circle')
      .data(rings)
      .join('circle')
      .attr('r', (v: number): number => radius(v))
      .attr('fill', 'none')
      .attr('stroke', token(el, '--viz-grid'))
      .attr('stroke-width', 1);
    svg
      .append('g')
      .selectAll('text')
      .data(rings)
      .join('text')
      .attr('class', 'viz-axis-label')
      .attr('x', 4)
      .attr('y', (v: number): number => -radius(v) - 3)
      .text((v: number): string => compact.format(v));

    // Month spokes and labels on the first day of each month.
    const firsts: { i: number; label: string }[] = days
      .map((d: CalendarDay, i: number): { i: number; label: string; day: string } => ({
        i,
        day: d.date.slice(8, 10),
        label: d3.utcFormat('%b')(new Date(`${d.date}T00:00:00Z`)),
      }))
      .filter((d: { day: string }): boolean => d.day === '01');
    const months: d3.Selection<SVGGElement, { i: number; label: string }, SVGGElement, unknown> = svg
      .append('g')
      .selectAll<SVGGElement, { i: number; label: string }>('g')
      .data(firsts)
      .join('g');
    months
      .append('line')
      .attr('x1', (d: { i: number }): number => Math.sin(angle(d.i)) * (inner - 6))
      .attr('y1', (d: { i: number }): number => -Math.cos(angle(d.i)) * (inner - 6))
      .attr('x2', (d: { i: number }): number => Math.sin(angle(d.i)) * (outer + 6))
      .attr('y2', (d: { i: number }): number => -Math.cos(angle(d.i)) * (outer + 6))
      .attr('stroke', token(el, '--viz-axis'))
      .attr('stroke-width', 1);
    months
      .append('text')
      .attr('class', 'viz-axis-label')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('x', (d: { i: number }): number => Math.sin(angle(d.i) + step * 15) * (outer + 20))
      .attr('y', (d: { i: number }): number => -Math.cos(angle(d.i) + step * 15) * (outer + 20))
      .text((d: { label: string }): string => d.label);

    // One bar per day. Zero days get a faint stub so the year's shape stays legible.
    const bar: d3.Arc<unknown, { i: number; r: number }> = d3
      .arc<{ i: number; r: number }>()
      .innerRadius(inner)
      .outerRadius((d: { i: number; r: number }): number => d.r)
      .startAngle((d: { i: number }): number => angle(d.i) + step * 0.12)
      .endAngle((d: { i: number }): number => angle(d.i) + step * 0.88)
      .cornerRadius(1.5);
    const bars: d3.Selection<SVGPathElement, CalendarDay, SVGGElement, unknown> = svg
      .append('g')
      .selectAll<SVGPathElement, CalendarDay>('path')
      .data(days)
      .join('path')
      .attr('d', (d: CalendarDay, i: number): string =>
        bar({ i, r: d.count > 0 ? Math.max(radius(d.count), inner + 3) : inner + 2 }) ?? '',
      )
      .attr('fill', (d: CalendarDay): string => (d.count > 0 ? color(Math.sqrt(d.count)) : token(el, '--viz-grid')));

    // Center readout.
    svg
      .append('text')
      .attr('class', 'viz-center-value')
      .attr('text-anchor', 'middle')
      .attr('y', -2)
      .text(whole.format(total));
    svg
      .append('text')
      .attr('class', 'viz-center-label')
      .attr('text-anchor', 'middle')
      .attr('y', 20)
      .text('contributions');

    // Hit targets: full-radius wedges, far bigger than the 1-2px bars they cover.
    const hit: d3.Arc<unknown, { i: number }> = d3
      .arc<{ i: number }>()
      .innerRadius(inner * 0.9)
      .outerRadius(outer + 8)
      .startAngle((d: { i: number }): number => angle(d.i))
      .endAngle((d: { i: number }): number => angle(d.i) + step);
    svg
      .append('g')
      .selectAll('path')
      .data(days)
      .join('path')
      .attr('d', (_d: CalendarDay, i: number): string => hit({ i }) ?? '')
      .attr('fill', 'transparent')
      .on('pointermove', (event: PointerEvent, d: CalendarDay): void => {
        const [x, y] = d3.pointer(event, el);
        bars.attr('opacity', (b: CalendarDay): number => (b === d ? 1 : 0.55));
        this.showTip(el, x, y, d3.utcFormat('%a, %b %-d, %Y')(new Date(`${d.date}T00:00:00Z`)), [
          { value: whole.format(d.count), label: d.count === 1 ? 'contribution' : 'contributions' },
        ]);
      })
      .on('pointerleave', (): void => {
        bars.attr('opacity', 1);
        this.hideTip();
      });
  }
}
