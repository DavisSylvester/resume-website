import { Directive, ElementRef, afterNextRender, effect, input, signal, viewChild } from '@angular/core';
import type { InputSignal, OnDestroy, Signal, WritableSignal } from '@angular/core';
import type { TooltipRow } from '../interfaces';

/** Reads a CSS custom property from the chart host, so colors stay in SCSS tokens. */
export const token = (el: Element, name: string): string =>
  getComputedStyle(el).getPropertyValue(name).trim();

export const compact: Intl.NumberFormat = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
export const whole: Intl.NumberFormat = new Intl.NumberFormat('en-US');

/**
 * Base for every d3 chart: owns the canvas element, tracks its width with a
 * ResizeObserver, re-renders when data or width change, and provides one tooltip
 * whose content is always set with textContent (labels are untrusted data).
 */
@Directive()
export abstract class D3Chart<T> implements OnDestroy {

  public readonly data: InputSignal<T> = input.required<T>();
  public readonly tableView: InputSignal<boolean> = input<boolean>(false);

  protected readonly canvas: Signal<ElementRef<HTMLDivElement>> = viewChild.required<ElementRef<HTMLDivElement>>('canvas');
  protected readonly width: WritableSignal<number> = signal<number>(0);
  private observer: ResizeObserver | null = null;
  private tip: HTMLDivElement | null = null;

  public constructor() {
    afterNextRender((): void => {
      const el: HTMLDivElement = this.canvas().nativeElement;
      this.observer = new ResizeObserver((entries: ResizeObserverEntry[]): void => {
        const w: number = Math.floor(entries[0]?.contentRect.width ?? 0);
        if (w !== this.width()) this.width.set(w);
      });
      this.observer.observe(el);
    });
    effect((): void => {
      const data: T = this.data();
      const w: number = this.width();
      if (w > 0) this.render(this.canvas().nativeElement, data, w);
    });
  }

  public ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  protected abstract render(el: HTMLDivElement, data: T, width: number): void;

  protected showTip(el: HTMLDivElement, x: number, y: number, title: string, rows: TooltipRow[]): void {
    const tip: HTMLDivElement = this.ensureTip(el);
    tip.replaceChildren();
    const head: HTMLDivElement = document.createElement('div');
    head.className = 'viz-tooltip__title';
    head.textContent = title;
    tip.appendChild(head);
    for (const row of rows) {
      const line: HTMLDivElement = document.createElement('div');
      line.className = 'viz-tooltip__row';
      if (row.color) {
        const key: HTMLSpanElement = document.createElement('span');
        key.className = 'viz-tooltip__key';
        key.style.background = row.color;
        line.appendChild(key);
      }
      const value: HTMLElement = document.createElement('strong');
      value.textContent = row.value;
      const label: HTMLSpanElement = document.createElement('span');
      label.textContent = row.label;
      line.append(value, label);
      tip.appendChild(line);
    }
    tip.hidden = false;
    // Keep the tooltip inside the chart: flip left of the pointer near the right edge.
    const flip: boolean = x > el.clientWidth - tip.offsetWidth - 16;
    tip.style.left = `${flip ? x - tip.offsetWidth - 12 : x + 12}px`;
    tip.style.top = `${Math.max(0, y - tip.offsetHeight - 8)}px`;
  }

  protected hideTip(): void {
    if (this.tip) this.tip.hidden = true;
  }

  private ensureTip(el: HTMLDivElement): HTMLDivElement {
    if (!this.tip || !el.contains(this.tip)) {
      this.tip = document.createElement('div');
      this.tip.className = 'viz-tooltip';
      this.tip.setAttribute('role', 'status');
      this.tip.hidden = true;
      el.appendChild(this.tip);
    }
    return this.tip;
  }
}
