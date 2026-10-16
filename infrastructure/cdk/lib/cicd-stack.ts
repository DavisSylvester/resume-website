import * as cdk from "aws-cdk-lib/core";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { PlatformConfig, resourceName } from "./naming";

export interface CicdStackProps extends cdk.StackProps {
  config: PlatformConfig;
}

const GITHUB_REPO = "DavisSylvester/resume-website";
const OIDC_HOST = "token.actions.githubusercontent.com";
const SITE_BUCKETS: string[] = ["davis-resume-spa", "davis-resume-spa2"];
const DISTRIBUTION_IDS: string[] = ["EJ2FDYIEIWV34", "E3LZODQSO3JZTE"];
const CDK_QUALIFIER = "hnb659fds";

/** IAM role assumed by GitHub Actions (main branch only) via the pre-existing OIDC provider. */
export class CicdStack extends cdk.Stack {
  public readonly deployRole: iam.Role;

  public constructor(scope: Construct, id: string, props: CicdStackProps) {
    super(scope, id, props);

    const account: string = props.config.expectedAccount;

    // Imported, never created: one GitHub OIDC provider per account.
    const provider: iam.IOpenIdConnectProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      "GitHubOidcProvider",
      `arn:aws:iam::${account}:oidc-provider/${OIDC_HOST}`,
    );

    this.deployRole = new iam.Role(this, "GitHubDeployRole", {
      roleName: resourceName(props.config, "github-deploy"),
      description: `Assumed by GitHub Actions in ${GITHUB_REPO} to deploy`,
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.OpenIdConnectPrincipal(provider, {
        StringEquals: {
          [`${OIDC_HOST}:aud`]: "sts.amazonaws.com",
          [`${OIDC_HOST}:sub`]: `repo:${GITHUB_REPO}:ref:refs/heads/main`,
        },
      }),
    });

    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AssumeCdkBootstrapRoles",
        actions: ["sts:AssumeRole"],
        resources: [`arn:aws:iam::${account}:role/cdk-${CDK_QUALIFIER}-*-${account}-us-east-1`],
      }),
    );

    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "SiteListBuckets",
        actions: ["s3:ListBucket"],
        resources: SITE_BUCKETS.map((b: string): string => `arn:aws:s3:::${b}`),
      }),
    );
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "SiteUploadObjects",
        actions: ["s3:PutObject", "s3:GetObject"],
        resources: SITE_BUCKETS.map((b: string): string => `arn:aws:s3:::${b}/*`),
      }),
    );
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "InvalidateSiteCache",
        actions: ["cloudfront:CreateInvalidation"],
        resources: DISTRIBUTION_IDS.map((d: string): string => `arn:aws:cloudfront::${account}:distribution/${d}`),
      }),
    );

    new cdk.CfnOutput(this, "GitHubDeployRoleArn", { value: this.deployRole.roleArn });
  }
}
