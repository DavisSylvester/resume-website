import { Type } from '@sinclair/typebox';

/** Shape of the Secrets Manager secret that holds the GitHub App credentials. */
export const AppCredentialsSchema = Type.Object({
  appId: Type.String({ minLength: 1 }),
  installationId: Type.String({ minLength: 1 }),
  privateKey: Type.String({ minLength: 1 }),
  webhookSecret: Type.String({ minLength: 16 }),
});
