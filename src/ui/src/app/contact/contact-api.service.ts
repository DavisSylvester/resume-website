import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ACTIVITY_API_CONFIG } from '../activity/activity.config';
import type { ActivityApiConfig } from '../activity/activity.config';
import type { ContactReceipt, ContactRequest } from './interfaces';

export type ContactResult = { ok: true; receipt: ContactReceipt } | { ok: false; message: string };

const FALLBACK_MESSAGE: string = 'Something went wrong sending your message. Please try again, or email me directly.';

/** Sends the contact form to the API, which fans it out to email, SMS, WhatsApp, Telegram, Slack and Teams. */
@Injectable({ providedIn: 'root' })
export class ContactApiService {

  private readonly http: HttpClient = inject(HttpClient);
  private readonly config: ActivityApiConfig = inject(ACTIVITY_API_CONFIG);

  public async submit(request: ContactRequest): Promise<ContactResult> {
    try {
      const receipt: ContactReceipt = await firstValueFrom(
        this.http.post<ContactReceipt>(`${this.config.baseUrl}/contact`, request),
      );
      return { ok: true, receipt };
    } catch (error: unknown) {
      return { ok: false, message: this.messageFor(error) };
    }
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return FALLBACK_MESSAGE;
    const body: unknown = error.error;
    // Our own errors carry { code, message } written for people; framework 4xx/5xx bodies do not.
    if (typeof body === 'object' && body !== null && 'code' in body && 'message' in body) {
      const message: unknown = (body as { message: unknown }).message;
      if (typeof message === 'string' && message.length > 0) return message;
    }
    return FALLBACK_MESSAGE;
  }
}
