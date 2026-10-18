import { Construct } from "constructs";
import * as path from "path";
import { CfnOutput, Duration, RemovalPolicy, SecretValue, Stack } from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as iam from "aws-cdk-lib/aws-iam";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import { PlatformConfig, resourceName } from "./naming";

/** SES-verified sending domain for contact-form email. */
const CONTACT_EMAIL_DOMAIN: string = "dsylvester.ai";

export interface ActivityApiProps {
  config: PlatformConfig;
  api: apigwv2.HttpApi;
}

const ALLOWED_ORIGINS: string = [
  "https://www.dsylvester.io",
  "https://www.dsylvester.ai",
  "https://dsylvester.io",
  "https://dsylvester.ai",
  "http://localhost:4200",
].join(",");

export class ActivityApi extends Construct {
  public readonly table: dynamodb.Table;
  public readonly secret: secretsmanager.Secret;
  public readonly contactSecret: secretsmanager.Secret;
  public readonly fn: lambda.DockerImageFunction;

  constructor(scope: Construct, id: string, props: ActivityApiProps) {
    super(scope, id);

    const { config, api } = props;

    // RETAIN: survives `cdk destroy`.
    this.table = new dynamodb.Table(this, "ActivityTable", {
      tableName: resourceName(config, "activity"),
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "expiresAt",
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // RETAIN: survives `cdk destroy`. The real value is set out-of-band with
    // `aws secretsmanager put-secret-value`.
    this.secret = new secretsmanager.Secret(this, "GitHubAppSecret", {
      secretName: resourceName(config, "github-app"),
      description: "GitHub App credentials: {appId, installationId, privateKey, webhookSecret}",
      secretStringValue: SecretValue.unsafePlainText(
        JSON.stringify({
          appId: "REPLACE_ME",
          installationId: "REPLACE_ME",
          privateKey: "REPLACE_ME",
          webhookSecret: "REPLACE_ME",
        }),
      ),
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // RETAIN: survives `cdk destroy`. Channels left as REPLACE_ME are skipped by the API, so
    // each one can be switched on independently with `aws secretsmanager put-secret-value`.
    // Do not edit the initial JSON below: a template change rewrites the live secret value.
    // Email (SES), SMS and WhatsApp (End User Messaging) need no keys; the resendApiKey and emailFrom
    // keys are unused. SMS and WhatsApp only need these settings added to it:
    // smsOriginationIdentity, whatsAppPhoneNumberId, whatsAppTemplateName, whatsAppTemplateLanguage.
    this.contactSecret = new secretsmanager.Secret(this, "ContactSecret", {
      secretName: resourceName(config, "contact"),
      description:
        "Contact form channels: AWS End User Messaging settings (SMS + WhatsApp), Telegram bot, Slack and Teams webhooks",
      secretStringValue: SecretValue.unsafePlainText(
        JSON.stringify({
          resendApiKey: "REPLACE_ME",
          emailFrom: "REPLACE_ME",
          twilioAccountSid: "REPLACE_ME",
          twilioAuthToken: "REPLACE_ME",
          twilioSmsFrom: "REPLACE_ME",
          twilioWhatsAppFrom: "REPLACE_ME",
          telegramBotToken: "REPLACE_ME",
          telegramChatId: "REPLACE_ME",
          slackWebhookUrl: "REPLACE_ME",
          teamsWebhookUrl: "REPLACE_ME",
        }),
      ),
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const functionName: string = resourceName(config, "activity-api");

    const logGroup = new logs.LogGroup(this, "ActivityApiLogs", {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.fn = new lambda.DockerImageFunction(this, "ActivityApiFn", {
      functionName,
      code: lambda.DockerImageCode.fromImageAsset(
        path.resolve(__dirname, "..", "..", "..", "src", "api", "activity"),
        { platform: Platform.LINUX_AMD64 },
      ),
      // The hourly run backfills the insights ledger (hundreds of GitHub calls); API requests
      // only read the snapshot, and API Gateway still caps them at 30 s.
      memorySize: 1024,
      timeout: Duration.seconds(300),
      logGroup,
      environment: {
        GITHUB_LOGIN: "DavisSylvester",
        TABLE_NAME: this.table.tableName,
        GITHUB_APP_SECRET_ARN: this.secret.secretArn,
        ACTIVITY_TIMEZONE: "America/Chicago",
        ALLOWED_ORIGINS,
        LOG_LEVEL: "info",
        CONTACT_SECRET_ARN: this.contactSecret.secretArn,
        CONTACT_EMAIL_TO: "dsylvesteriii@gmail.com",
        // dsylvester.ai is already a verified SES domain identity (DKIM on) in this account.
        CONTACT_EMAIL_FROM: `Davis Sylvester website <contact@${CONTACT_EMAIL_DOMAIN}>`,
        CONTACT_PHONE_TO: "+12142231413",
        CONTACT_RATE_LIMIT_PER_HOUR: "5",
      },
    });

    this.table.grantReadWriteData(this.fn);
    this.secret.grantRead(this.fn);
    this.contactSecret.grantRead(this.fn);

    // The webhook hands heavy work to an async invoke of this same function. The ARN is built
    // from the name (not this.fn.functionArn) to avoid a self-referencing dependency cycle.
    const { region, account } = Stack.of(this);
    this.fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [`arn:aws:lambda:${region}:${account}:function:${functionName}`],
      }),
    );

    // Contact email (SES), SMS and WhatsApp (End User Messaging) all use the function's own role.
    this.fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail"],
        resources: [`arn:aws:ses:${region}:${account}:identity/${CONTACT_EMAIL_DOMAIN}`],
      }),
    );
    this.fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["sms-voice:SendTextMessage"],
        // SendTextMessage is authorized against the number/pool and also any opt-out list,
        // configuration set or protect configuration it touches, so allow the account's SMS resources.
        resources: [`arn:aws:sms-voice:${region}:${account}:*`],
      }),
    );
    this.fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["social-messaging:SendWhatsAppMessage"],
        resources: [`arn:aws:social-messaging:${region}:${account}:phone-number-id/*`],
      }),
    );

    // More specific than the existing /{proxy+} route, so these win.
    const integration = new HttpLambdaIntegration("ActivityIntegration", this.fn);

    api.addRoutes({
      path: "/activity/{proxy+}",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.OPTIONS],
      integration,
    });

    api.addRoutes({
      path: "/contact",
      methods: [apigwv2.HttpMethod.POST, apigwv2.HttpMethod.OPTIONS],
      integration,
    });

    api.addRoutes({
      path: "/webhooks/github",
      methods: [apigwv2.HttpMethod.POST],
      integration,
    });

    new events.Rule(this, "ActivityRefreshRule", {
      ruleName: resourceName(config, "activity-refresh"),
      description: "Hourly deep refresh of GitHub activity",
      schedule: events.Schedule.rate(Duration.hours(1)),
      targets: [new targets.LambdaFunction(this.fn)],
    });

    new CfnOutput(this, "ActivityApiUrl", { value: api.apiEndpoint });
    new CfnOutput(this, "GitHubWebhookUrl", { value: `${api.apiEndpoint}/webhooks/github` });
    new CfnOutput(this, "GitHubAppSecretArn", { value: this.secret.secretArn });
    new CfnOutput(this, "ActivityTableName", { value: this.table.tableName });
    new CfnOutput(this, "ContactUrl", { value: `${api.apiEndpoint}/contact` });
    new CfnOutput(this, "ContactSecretArn", { value: this.contactSecret.secretArn });
  }
}
