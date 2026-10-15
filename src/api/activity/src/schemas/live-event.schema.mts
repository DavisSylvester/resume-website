import { Type } from '@sinclair/typebox';

/**
 * A push received in real time from the GitHub App webhook.
 * For private repositories the name, url and messages are redacted before storage.
 */
export const LiveEventSchema = Type.Object({
  id: Type.String(),
  receivedAt: Type.String(),
  repo: Type.String(),
  url: Type.Union([Type.String(), Type.Null()]),
  isPrivate: Type.Boolean(),
  language: Type.Union([Type.String(), Type.Null()]),
  branch: Type.String(),
  commitCount: Type.Integer({ minimum: 0 }),
  messages: Type.Array(Type.String()),
});

export const LiveEventListSchema = Type.Object({
  events: Type.Array(LiveEventSchema),
  /** Pass back as `since` on the next poll. */
  cursor: Type.String(),
});

export const LiveQuerySchema = Type.Object({
  since: Type.Optional(Type.String()),
});
