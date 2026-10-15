import { Construct } from "constructs";

export const APPLICATION_TAG = "resume-website"; // repo name (DavisSylvester/resume-website)

export interface PlatformConfig {
  resourcePrefix: string;
  envName: string;
  expectedAccount: string;
}

/**
 * The resource prefix is chosen by the user and supplied as CDK context
 * (`-c resourcePrefix=<prefix>` or cdk.json). It is deliberately NOT defaulted:
 * every new physical name derives from it, and changing it later REPLACES
 * every resource named from it.
 * Confirmed by user on 2026-10-15: prefix `gh-app`, account 318205107378 (profile dsylvesteriii).
 * Both are pinned in cdk.json context.
 */
export const loadPlatformConfig = (scope: Construct): PlatformConfig => {
  const resourcePrefix: unknown = scope.node.tryGetContext("resourcePrefix");
  if (typeof resourcePrefix !== "string" || !/^[a-z0-9][a-z0-9-]{1,19}$/.test(resourcePrefix)) {
    throw new Error(
      "CDK context 'resourcePrefix' is missing or invalid (lowercase letters, digits, hyphens; 2-20 chars). " +
        "The prefix must be chosen by the user before any resource is created. " +
        "Pass -c resourcePrefix=<prefix> or set it in cdk.json context.",
    );
  }

  const expectedAccount: unknown = scope.node.tryGetContext("expectedAccount");
  if (typeof expectedAccount !== "string" || !/^\d{12}$/.test(expectedAccount)) {
    throw new Error(
      "CDK context 'expectedAccount' (12-digit AWS account id) is missing or invalid. " +
        "Pass -c expectedAccount=<id> or set it in cdk.json context.",
    );
  }

  const resolved: string | undefined = process.env.CDK_DEFAULT_ACCOUNT;
  if (resolved && resolved !== expectedAccount) {
    throw new Error(
      `Account guard: CDK resolved account ${resolved} but expectedAccount is ${expectedAccount}. Refusing to synth.`,
    );
  }

  const envName: unknown = scope.node.tryGetContext("env");

  return {
    resourcePrefix,
    envName: typeof envName === "string" && envName.length > 0 ? envName : "prod",
    expectedAccount,
  };
};

export const resourceName = (config: PlatformConfig, friendlyName: string): string =>
  `${config.resourcePrefix}-${friendlyName}-${config.envName}`;
