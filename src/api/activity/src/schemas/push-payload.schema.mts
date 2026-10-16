import { Type } from '@sinclair/typebox';

/** The subset of a GitHub `push` webhook payload that this service reads. */
export const PushPayloadSchema = Type.Object(
  {
    ref: Type.String(),
    deleted: Type.Optional(Type.Boolean()),
    repository: Type.Object(
      {
        id: Type.Optional(Type.Integer()),
        full_name: Type.String(),
        private: Type.Boolean(),
        html_url: Type.String(),
        language: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      },
      { additionalProperties: true },
    ),
    commits: Type.Array(
      Type.Object(
        {
          id: Type.String(),
          message: Type.String(),
          distinct: Type.Optional(Type.Boolean()),
        },
        { additionalProperties: true },
      ),
    ),
    sender: Type.Object({ login: Type.String() }, { additionalProperties: true }),
  },
  { additionalProperties: true },
);
