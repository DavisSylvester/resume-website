import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { CfnOutput, Duration } from 'aws-cdk-lib';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
// Import local build of aws-constructs to use the updated certificate logic
import { SpaCFRoute53 } from '../../../../aws-constructs/dist';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const fn = new lambda.DockerImageFunction(this, "BunImageFn", {
      code: lambda.DockerImageCode.fromImageAsset(
        path.resolve(__dirname, "..", "..", "..", "api", "chat"),
        {
          // IMPORTANT for Apple Silicon users building amd64 images:
          // platform: Platform.LINUX_AMD64,
          platform: Platform.LINUX_AMD64,
        }
      ),
      memorySize: 128,
      timeout: Duration.seconds(10),
      // architecture: lambda.Architecture.X86_64, // default
    });

    const api = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: "cdk-bun-lambda-image-api",
    });

    api.addRoutes({
      path: "/{proxy+}",                 // forward all routes
      methods: [apigwv2.HttpMethod.ANY],
      integration: new HttpLambdaIntegration("BunIntegration", fn),
    });

    // Cast to any to avoid duplicate constructs type mismatch during local linking
    new SpaCFRoute53(this as any, `davis-resume-spa`, {
    siteName: "davis-resume-app",
    bucketName: "davis-resume-spa",
    cloudfrontName: "davis-resume-spa",
    domainName: "dsylvester.io",
    fqdn: "www.dsylvester.io",
    hostedZoneId: "Z00521283KLJPV4530BY5",
  });

  // Cast to any to avoid duplicate constructs type mismatch during local linking
    new SpaCFRoute53(this as any, `davis-resume-spa2`, {
    siteName: "davis-resume-app2",
    bucketName: "davis-resume-spa2",
    cloudfrontName: "davis-resume-spa2",
    domainName: "dsylvester.ai",
    fqdn: "www.dsylvester.ai",
    hostedZoneId: "Z084603532M2PA5E3QFC8",
  });
    new CfnOutput(this, "ApiUrl", { value: api.url! });
  }
  
}
