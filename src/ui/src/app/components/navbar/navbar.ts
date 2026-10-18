import {
  Component,
  DestroyRef,
  HostListener,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';
import { NavigationEnd, Router, type Event as RouterEvent } from '@angular/router';
import type { Subscription } from 'rxjs';

interface NavLink {
  label: string;
  href: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {

  /** Section anchors are rooted at `/` so they also work from /about, /portfolio, etc. */
  protected readonly links: NavLink[] = [
    { label: 'About', href: '/about' },
    { label: 'Activity', href: '/activity' },
    { label: 'Portfolio', href: '/portfolio' },
    { label: 'Expertise', href: '/#expertise' },
    { label: 'Experience', href: '/#experience' },
    { label: 'Projects', href: '/#projects' },
    { label: 'Badges', href: '/#badges' },
    { label: 'Certifications', href: '/#certifications' },
  ];

  /** Whether the small-screen drawer is open. Unused above the `md` breakpoint. */
  protected readonly open: WritableSignal<boolean> = signal<boolean>(false);

  public constructor() {
    // Close on any completed navigation (back/forward, future routerLinks). Subscribed
    // manually rather than via rxjs-interop, which trips NG0203 on the Vite dev server.
    const sub: Subscription = inject(Router).events.subscribe((e: RouterEvent): void => {
      if (e instanceof NavigationEnd) this.close();
    });
    inject(DestroyRef).onDestroy((): void => sub.unsubscribe());
  }

  protected toggle(): void {
    this.open.update((v: boolean): boolean => !v);
  }

  protected close(): void {
    this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }
}
