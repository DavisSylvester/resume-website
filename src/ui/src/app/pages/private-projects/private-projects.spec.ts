import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PrivateProjects } from './private-projects';
import { ContactDialogService } from '../../contact/contact-dialog.service';
import { PRIVATE_PROJECTS } from '../../portfolio/portfolio-projects';

/** Renders the page with a real router (for routerLink hrefs) and returns its root element. */
const render = async (): Promise<HTMLElement> => {
  await TestBed.configureTestingModule({ imports: [PrivateProjects], providers: [provideRouter([])] }).compileComponents();
  const fixture = TestBed.createComponent(PrivateProjects);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
};

describe('PrivateProjects', () => {
  it('explains why the projects are private', async () => {
    const el: HTMLElement = await render();

    expect(el.querySelector('h1')?.textContent).toContain('Private projects');
    expect(el.querySelectorAll('.private__reasons li').length).toBe(3);
  });

  it('lists every private project with the Secure badge and no public links', async () => {
    const el: HTMLElement = await render();

    const cards: NodeListOf<HTMLElement> = el.querySelectorAll<HTMLElement>('.project');
    expect(cards.length).toBe(PRIVATE_PROJECTS.length);
    for (const card of Array.from(cards)) {
      expect(card.querySelector('.secure-badge')?.textContent).toContain('Secure');
      expect(card.querySelector('a.store-link')).toBeNull();
    }
    expect(el.querySelector('.project__summary-link')?.getAttribute('href')).toBe('/portfolio/claude-dashboard');
  });

  it('opens the contact dialog from the walkthrough button', async () => {
    const el: HTMLElement = await render();
    const contact: ContactDialogService = TestBed.inject(ContactDialogService);

    (el.querySelector('.private__cta-button') as HTMLButtonElement).click();
    expect(contact.isOpen()).toBe(true);
  });
});
