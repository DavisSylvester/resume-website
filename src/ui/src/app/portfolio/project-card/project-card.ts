import { Component, input } from '@angular/core';
import type { InputSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SecureBadge } from '../secure-badge/secure-badge';
import { StoreLinks } from '../store-links/store-links';
import type { PortfolioProject } from '../interfaces';

/** One project in a list: icon, name, status (with the Secure badge), tagline, stack, and its links. */
@Component({
  selector: 'app-project-card',
  standalone: true,
  imports: [RouterLink, SecureBadge, StoreLinks],
  templateUrl: './project-card.html',
  styleUrl: './project-card.scss',
})
export class ProjectCard {

  public readonly project: InputSignal<PortfolioProject> = input.required<PortfolioProject>();
}
