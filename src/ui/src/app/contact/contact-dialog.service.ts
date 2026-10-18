import { Injectable, signal } from '@angular/core';
import type { Signal, WritableSignal } from '@angular/core';

/** Open/close state for the contact modal, shared by every "Contact" button on the site. */
@Injectable({ providedIn: 'root' })
export class ContactDialogService {

  private readonly openState: WritableSignal<boolean> = signal<boolean>(false);

  public readonly isOpen: Signal<boolean> = this.openState.asReadonly();

  public open(): void {
    this.openState.set(true);
  }

  public close(): void {
    this.openState.set(false);
  }
}
