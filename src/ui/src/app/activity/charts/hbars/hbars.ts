import { Component, input } from '@angular/core';
import type { InputSignal } from '@angular/core';
import * as d3 from 'd3';
import { roundedBar } from '../bar-path';
import { D3Chart, token } from '../d3-chart';
import type { HBarRow, TooltipRow } from '../../interfaces';

/** Reusable one-series horizontal bars with the value at the tip. */
@Component({
  selector: 'app-hbars',
  standalone: true,
  templateUrl: './hbars.html',
  styleUrl: './hbars.scss',
})
export class HBars extends D3Chart<HBarRow[]> {

  /** CSS custom property for the bar color. One series, so one color. */
  public readonly color: InputSignal<string> = input<string>('--series-1');
  public readonly caption: InputSignal<string> = input<string>('');
  public readonly labelWidth: InputSignal<number> = input<number>(110);

  protected render(el: HTMLDivElement, rows: HBarRow[], width: number): void {
    d3.select(el).selectAll('svg').remove();
    if (rows.length === 0) return;

    const rowH: number = 30;
    const margin: { top: number; right: number; bottom: number; left: number } = { top: 2, right: 64, bottom: 2, left: this.labelWidth() };
    const height: number = rows.length * rowH + margin.top + margin.bottom;
    const x: d3.ScaleLinear<number, number> = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (r: HBarRow): number => r.value) ?? 1])
      .range([margin.left, width - margin.right]);
    const thickness: number = 16;

    const svg: d3.Selection<SVGSVGElement, unknown, null, undefined> = d3
      .select(el)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('role', 'img')
      .attr('aria-label', this.caption());
    const g: d3.Selection<SVGGElement, HBarRow, SVGGElement, unknown> = svg
      .append('g')
      .selectAll<SVGGElement, HBarRow>('g')
      .data(rows)
      .join('g')
      .attr('transform', (_r: HBarRow, i: number): string => `translate(0,${margin.top + i * rowH})`);

    g.append('text')
      .attr('class', 'viz-bar-label')
      .attr('x', margin.left - 10)
      .attr('y', rowH / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .text((r: HBarRow): string => r.label);
    g.append('path')
      .attr('d', (r: HBarRow): string => roundedBar((rowH - thickness) / 2, thickness, margin.left, Math.max(margin.left + 1, x(r.value)), true))
      .attr('fill', token(el, this.color()));
    g.append('text')
      .attr('class', 'viz-bar-value')
      .attr('x', (r: HBarRow): number => Math.max(margin.left + 1, x(r.value)) + 8)
      .attr('y', rowH / 2)
      .attr('dominant-baseline', 'middle')
      .text((r: HBarRow): string => r.valueLabel);
    g.append('rect')
      .attr('width', width)
      .attr('height', rowH)
      .attr('fill', 'transparent')
      .on('pointermove', (event: PointerEvent, r: HBarRow): void => {
        const [px, py] = d3.pointer(event, el);
        const tip: TooltipRow[] = [{ value: r.valueLabel, label: '' }];
        if (r.note) tip.push({ value: '', label: r.note });
        this.showTip(el, px, py, r.label, tip);
      })
      .on('pointerleave', (): void => this.hideTip());
  }
}
