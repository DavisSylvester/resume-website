import { Component, computed } from '@angular/core';
import type { Signal } from '@angular/core';
import * as d3 from 'd3';
import { D3Chart, token, whole } from '../d3-chart';

const DAYS: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const hourLabel = (h: number): string => {
  if (h === 0) return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
};

interface Cell {
  day: number;
  hour: number;
  count: number;
}

/** 7 x 24 grid of public commits by weekday and local hour. */
@Component({
  selector: 'app-rhythm-heatmap',
  standalone: true,
  templateUrl: './rhythm-heatmap.html',
  styleUrl: './rhythm-heatmap.scss',
})
export class RhythmHeatmap extends D3Chart<number[][]> {

  protected readonly days: string[] = DAY_NAMES;
  protected readonly hours: number[] = d3.range(24);
  protected readonly hourLabel: (h: number) => string = hourLabel;
  protected readonly rows: Signal<{ day: string; total: number; cells: number[] }[]> = computed(
    (): { day: string; total: number; cells: number[] }[] =>
      this.data().map((cells: number[], i: number): { day: string; total: number; cells: number[] } => ({
        day: DAY_NAMES[i] ?? '',
        total: d3.sum(cells),
        cells,
      })),
  );

  protected render(el: HTMLDivElement, grid: number[][], width: number): void {
    d3.select(el).selectAll('svg').remove();
    const cells: Cell[] = grid.flatMap((row: number[], day: number): Cell[] =>
      row.map((count: number, hour: number): Cell => ({ day, hour, count })),
    );
    const max: number = d3.max(cells, (c: Cell): number => c.count) ?? 0;

    const margin: { top: number; right: number; bottom: number; left: number } = { top: 4, right: 4, bottom: 24, left: 36 };
    const cell: number = Math.max(10, Math.min(30, Math.floor((width - margin.left - margin.right) / 24)));
    const w: number = cell * 24;
    const h: number = cell * 7;

    const color: d3.ScaleSequential<string> = d3
      .scaleSequential(d3.interpolateRgb(token(el, '--seq-lo'), token(el, '--seq-hi')))
      .domain([1, Math.max(2, max)]);

    const svg: d3.Selection<SVGSVGElement, unknown, null, undefined> = d3
      .select(el)
      .append('svg')
      .attr('width', w + margin.left + margin.right)
      .attr('height', h + margin.top + margin.bottom)
      .attr('role', 'img')
      .attr('aria-label', 'Public commits by weekday and hour of day');
    const g: d3.Selection<SVGGElement, unknown, null, undefined> = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    g.append('g')
      .selectAll('text')
      .data(DAYS)
      .join('text')
      .attr('class', 'viz-axis-label')
      .attr('x', -8)
      .attr('y', (_d: string, i: number): number => i * cell + cell / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .text((d: string): string => d);
    g.append('g')
      .selectAll('text')
      .data([0, 6, 12, 18, 23])
      .join('text')
      .attr('class', 'viz-axis-label')
      .attr('x', (hr: number): number => hr * cell + cell / 2)
      .attr('y', h + 16)
      .attr('text-anchor', 'middle')
      .text((hr: number): string => hourLabel(hr));

    // A 2px surface gap separates the cells; zero cells sit at the gridline tone.
    const rects: d3.Selection<SVGRectElement, Cell, SVGGElement, unknown> = g
      .append('g')
      .selectAll<SVGRectElement, Cell>('rect')
      .data(cells)
      .join('rect')
      .attr('x', (c: Cell): number => c.hour * cell + 1)
      .attr('y', (c: Cell): number => c.day * cell + 1)
      .attr('width', cell - 2)
      .attr('height', cell - 2)
      .attr('rx', 3)
      .attr('fill', (c: Cell): string => (c.count > 0 ? color(c.count) : token(el, '--viz-grid')))
      .on('pointermove', (event: PointerEvent, c: Cell): void => {
        const [x, y] = d3.pointer(event, el);
        rects.attr('opacity', (r: Cell): number => (r === c ? 1 : 0.6));
        this.showTip(el, x, y, `${DAY_NAMES[c.day]} · ${hourLabel(c.hour)}`, [
          { value: whole.format(c.count), label: c.count === 1 ? 'commit' : 'commits' },
        ]);
      })
      .on('pointerleave', (): void => {
        rects.attr('opacity', 1);
        this.hideTip();
      });
  }
}
