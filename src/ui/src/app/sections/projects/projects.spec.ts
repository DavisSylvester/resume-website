import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Projects } from './projects';
import { PORTFOLIO_PROJECTS } from '../../portfolio/portfolio-projects';

describe('Projects', () => {
  let fixture: ComponentFixture<Projects>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Projects],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Projects);
    await fixture.whenStable();
    el = fixture.nativeElement;
  });

  it('renders the Professional Projects heading', () => {
    expect(el.querySelector('h2')?.textContent).toContain('Professional Projects');
  });

  it('renders a card per public project with a case-study link and store buttons', () => {
    expect(el.querySelectorAll('.pro-card').length).toBe(PORTFOLIO_PROJECTS.length);
    expect(el.querySelector('.pro-card__summary')?.getAttribute('href')).toBe('/portfolio/bjj-open-mat');
    expect(el.querySelector('.store-links--on-accent a.store-link--primary')?.getAttribute('href')).toContain('apps.apple.com');
  });

  it('no longer shows the old employer cards', () => {
    expect(el.querySelector('.project-card')).toBeNull();
    expect(el.textContent).not.toContain('Selected Projects');
  });
});
