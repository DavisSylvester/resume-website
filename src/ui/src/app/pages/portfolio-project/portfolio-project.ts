import { Component, computed, effect, inject, input } from '@angular/core';
import type { InputSignal, Signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { findProject } from '../../portfolio/portfolio-projects';
import { StoreLinks } from '../../portfolio/store-links/store-links';
import type { PortfolioProject } from '../../portfolio/interfaces';

/** Summary page for one public project: what it does, how it is built, and where to get it. */
@Component({
  selector: 'app-portfolio-project',
  standalone: true,
  imports: [RouterLink, StoreLinks],
  templateUrl: './portfolio-project.html',
  styleUrl: './portfolio-project.scss',
})
export class PortfolioProjectPage {

  /** The :slug route parameter, bound by withComponentInputBinding(). */
  public readonly slug: InputSignal<string> = input<string>('');

  private readonly title: Title = inject(Title);

  protected readonly project: Signal<PortfolioProject | undefined> = computed((): PortfolioProject | undefined =>
    findProject(this.slug()),
  );

  public constructor() {
    effect((): void => {
      const p: PortfolioProject | undefined = this.project();
      this.title.setTitle(`${p ? p.name : 'Project not found'} | Davis Sylvester`);
    });
  }
}
