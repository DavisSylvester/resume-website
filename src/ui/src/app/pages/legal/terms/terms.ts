import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Terms of use for the site and its contact form, including the SMS program terms carriers require. */
@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './terms.html',
  styleUrl: '../legal.scss',
})
export class Terms {}
