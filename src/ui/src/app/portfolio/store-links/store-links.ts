import { Component, input } from '@angular/core';
import type { InputSignal } from '@angular/core';
import type { PortfolioProject } from '../interfaces';

/** App Store, Google Play and website buttons for one project. Renders only the links it has. */
@Component({
  selector: 'app-store-links',
  standalone: true,
  templateUrl: './store-links.html',
  styleUrl: './store-links.scss',
})
export class StoreLinks {

  public readonly project: InputSignal<PortfolioProject> = input.required<PortfolioProject>();
  /** Light-on-accent styling, for use on an accent-colored background. */
  public readonly onAccent: InputSignal<boolean> = input<boolean>(false);
}
