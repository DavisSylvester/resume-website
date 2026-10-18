import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Privacy policy: what the contact form collects, where it goes, and the SMS commitments carriers require. */
@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './privacy.html',
  styleUrl: '../legal.scss',
})
export class Privacy {}
