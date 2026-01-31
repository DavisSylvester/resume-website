import { Component } from '@angular/core';
import { Hero } from '../../sections/hero/hero';
import { Expertise } from '../../sections/expertise/expertise';
import { Experience } from '../../sections/experience/experience';
import { Certifications } from '../../sections/certifications/certifications';
import { Contact } from '../../sections/contact/contact';

@Component({
  selector: 'app-print-resume',
  standalone: true,
  imports: [Hero, Expertise, Experience, Certifications, Contact],
  templateUrl: './print-resume.html',
  styleUrl: './print-resume.scss',
})
export class PrintResume {}
