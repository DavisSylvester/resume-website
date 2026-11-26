import { Component, input } from '@angular/core';
import type { InputSignal } from '@angular/core';

/** Lock badge for a project that runs behind sign-in and is not open to the public. */
@Component({
  selector: 'app-secure-badge',
  standalone: true,
  templateUrl: './secure-badge.html',
  styleUrl: './secure-badge.scss',
})
export class SecureBadge {

  /** Light-on-accent styling, for use on an accent-colored background. */
  public readonly onAccent: InputSignal<boolean> = input<boolean>(false);
}
