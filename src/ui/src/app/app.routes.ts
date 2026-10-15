import { Routes } from '@angular/router';
import { PrintResume } from './pages/print-resume/print-resume';
import { About } from './pages/about/about';

export const routes: Routes = [
  { path: 'print', component: PrintResume },
  { path: 'about', component: About },
  {
    path: 'activity',
    title: 'GitHub Activity | Davis Sylvester',
    loadComponent: () => import('./pages/activity/activity').then((m) => m.Activity),
  },
];
