import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { ContactDialogService } from '../../contact/contact-dialog.service';
import { Navbar } from './navbar';

@Component({ template: '' })
class Blank {}

describe('Navbar', () => {
  let component: Navbar;
  let fixture: ComponentFixture<Navbar>;
  let host: HTMLElement;

  const toggle = (): HTMLButtonElement =>
    host.querySelector('.menu-toggle') as HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [provideRouter([{ path: 'about', component: Blank }])],
    }).compileComponents();

    fixture = TestBed.createComponent(Navbar);
    component = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('roots section anchors at / so they work from other pages', () => {
    const hrefs: string[] = Array.from(host.querySelectorAll('.nav-links a')).map(
      (a: Element): string => a.getAttribute('href') ?? '',
    );
    expect(hrefs).toContain('/#expertise');
    expect(hrefs.every((h: string): boolean => h.startsWith('/'))).toBe(true);
  });

  it('starts with the drawer closed', () => {
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('#nav-drawer')).toBeNull();
  });

  it('opens and closes the drawer from the toggle', async () => {
    toggle().click();
    await fixture.whenStable();
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(toggle().getAttribute('aria-label')).toBe('Close menu');
    expect(host.querySelector('#nav-drawer')).not.toBeNull();

    toggle().click();
    await fixture.whenStable();
    expect(host.querySelector('#nav-drawer')).toBeNull();
  });

  it('closes the drawer on Escape', async () => {
    toggle().click();
    await fixture.whenStable();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('closes the drawer when a link is followed', async () => {
    toggle().click();
    await fixture.whenStable();

    const link = host.querySelector('#nav-drawer a') as HTMLAnchorElement;
    link.addEventListener('click', (e: Event): void => e.preventDefault());
    link.click();
    await fixture.whenStable();
    expect(host.querySelector('#nav-drawer')).toBeNull();
  });

  it('closes the drawer when the route changes', async () => {
    toggle().click();
    await fixture.whenStable();

    await TestBed.inject(Router).navigateByUrl('/about');
    await fixture.whenStable();
    expect(host.querySelector('#nav-drawer')).toBeNull();
  });

  it('opens the contact modal from the Contact button', async () => {
    const contact: ContactDialogService = TestBed.inject(ContactDialogService);
    (host.querySelector('.nav-button') as HTMLButtonElement).click();
    expect(contact.isOpen()).toBe(true);
  });

  it('closes the drawer when Contact is chosen from it', async () => {
    toggle().click();
    await fixture.whenStable();
    (host.querySelector('.drawer__cta') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(host.querySelector('#nav-drawer')).toBeNull();
    expect(TestBed.inject(ContactDialogService).isOpen()).toBe(true);
  });
});
