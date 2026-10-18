import { ContactReason, ReplyChannel } from '../../types/index.mjs';
import type { ContactMessage } from '../../interfaces/index.mjs';

export const REASON_LABEL: Record<ContactReason, string> = {
  [ContactReason.Consulting]: 'Consulting services',
  [ContactReason.Resume]: 'Resume request',
  [ContactReason.Employment]: 'Employment opportunity',
};

export const REPLY_LABEL: Record<ReplyChannel, string> = {
  [ReplyChannel.WhatsApp]: 'WhatsApp',
  [ReplyChannel.Sms]: 'SMS',
  [ReplyChannel.Email]: 'Email',
};

export const subjectOf = (m: ContactMessage): string => `${REASON_LABEL[m.reason]} from ${m.name}`;

/** Label/value pairs, shared by the plain-text body and the Teams fact set. */
export const factsOf = (m: ContactMessage): [string, string][] => [
  ['From', m.name],
  ...(m.company ? ([['Company', m.company]] satisfies [string, string][]) : []),
  ['Reason', REASON_LABEL[m.reason]],
  ['Reply via', `${REPLY_LABEL[m.replyVia]}: ${m.replyTo}`],
  ['Received', m.receivedAt],
];

export const textOf = (m: ContactMessage): string =>
  [
    `New contact request: ${subjectOf(m)}`,
    '',
    ...factsOf(m).map(([label, value]: [string, string]): string => `${label}: ${value}`),
    '',
    m.message,
    '',
    `Ref: ${m.id}`,
  ].join('\n');

/** SMS/WhatsApp body: the header lines plus the message, cut to `max` characters. */
export const shortTextOf = (m: ContactMessage, max: number): string => {
  const full: string = [
    `${subjectOf(m)}`,
    `Reply via ${REPLY_LABEL[m.replyVia]}: ${m.replyTo}`,
    '',
    m.message,
  ].join('\n');
  return full.length <= max ? full : `${full.slice(0, max - 1)}…`;
};
