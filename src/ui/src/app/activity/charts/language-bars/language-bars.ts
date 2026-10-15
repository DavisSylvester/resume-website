import { Component, computed } from '@angular/core';
import type { Signal } from '@angular/core';
import * as d3 from 'd3';
import { roundedBar } from '../bar-path';
import { D3Chart, token, whole } from '../d3-chart';
import type { LanguageShare } from '../../interfaces';

const TOP: number = 6;

interface LanguageRow {
  name: string;
  commits: number;
  share: number;
}

export const toLanguageRows = (langs: LanguageShare[]): LanguageRow[] => {
  const total: number = d3.sum(langs, (l: LanguageShare): number => l.commits) || 1;
  const head: LanguageShare[] = langs.slice(0, TOP);
  const tail: number = d3.sum(langs.slice(TOP), (l: LanguageShare): number => l.commits);
  const rows: LanguageRow[] = head.map((l: LanguageShare): LanguageRow => ({ name: l.name, commits: l.commits, share: l.commits / total }));
  if (tail > 0) rows.push({ name: 'Other', commits: tail, share: tail / total });
  return rows;
};

/** One series, so one color: horizontal bars with the share at the tip. */
@Component({
  selector: 'app-language-bars',
  standalone: true,
  templateUrl: './language-bars.html',
  styleUrl: './language-bars.scss',
})
export class LanguageBars extends D3Chart<LanguageShare[]> {

  protected readonly rows: Signal<LanguageRow[]> = computed((): LanguageRow[] => toLanguageRows(this.data()));
  protected readonly fmt: Intl.NumberFormat = whole;
  protected readonly pct: Intl.NumberFormat = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 });

  protected render(el: HTMLDivElement, langs: LanguageShare[], width: number): void {
    d3.select(el).selectAll('svg').remove();
    const rows: LanguageRow[] = toLanguageRows(langs);
    if (rows.length === 0) return;

    const rowH: number = 34;
    const margin: { top: number; right: number; bottom: number; left: number } = { top: 4, right: 52, bottom: 4, left: 96 };
    const height: number = rows.length * rowH + margin.top + margin.bottom;
    const x: d3.ScaleLinear<number, number> = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (r: LanguageRow): number => r.share) ?? 1])
      .range([margin.left, width - margin.right]);
    const thickness: number = 18;

    const svg: d3.Selection<SVGSVGElement, unknown, null, undefined> = d3
      .select(el)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('role', 'img')
      .attr('aria-label', 'Share of commits by language');
    const g: d3.Selection<SVGGElement, LanguageRow, SVGGElement, unknown> = svg
      .append('g')
      .selectAll<SVGGElement, LanguageRow>('g')
      .data(rows)
      .join('g')
      .attr('transform', (_r: LanguageRow, i: number): string => `translate(0,${margin.top + i * rowH})`);

    g.append('text')
      .attr('class', 'viz-bar-label')
      .attr('x', margin.left - 10)
      .attr('y', rowH / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .text((r: LanguageRow): string => r.name);
    g.append('path')
      .attr('d', (r: LanguageRow): string => roundedBar((rowH - thickness) / 2, thickness, margin.left, x(r.share), true))
      .attr('fill', token(el, '--series-1'));
    g.append('text')
      .attr('class', 'viz-bar-value')
      .attr('x', (r: LanguageRow): number => x(r.share) + 8)
      .attr('y', rowH / 2)
      .attr('dominant-baseline', 'middle')
      .text((r: LanguageRow): string => this.pct.format(r.share));
    g.append('rect')
      .attr('x', 0)
      .attr('width', width)
      .attr('height', rowH)
      .attr('fill', 'transparent')
      .on('pointermove', (event: PointerEvent, r: LanguageRow): void => {
        const [px, py] = d3.pointer(event, el);
        this.showTip(el, px, py, r.name, [
          { value: whole.format(r.commits), label: 'commits (estimated by code share)' },
          { value: this.pct.format(r.share), label: 'of all commits' },
        ]);
      })
      .on('pointerleave', (): void => this.hideTip());
  }
}
