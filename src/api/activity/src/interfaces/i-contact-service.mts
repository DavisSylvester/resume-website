import type { ContactReceipt } from './i-contact-receipt.mjs';
import type { ContactError } from '../errors/index.mjs';
import type { ContactRequest, Result } from '../types/index.mjs';

export interface ContactService {
  submit(request: ContactRequest, sourceIp: string): Promise<Result<ContactReceipt, ContactError>>;
}
