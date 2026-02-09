import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import { CfnOutput, Duration } from "aws-cdk-lib";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
// Import local build of aws-constructs to use the updated certificate logic
import { SpaCFRoute53 } from "@sylvesterllc/aws-constructs";

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const fn = new lambda.DockerImageFunction(this, "BunImageFn", {
      functionName: "bun-chat",
      code: lambda.DockerImageCode.fromImageAsset(
        path.resolve(__dirname, "..", "..", "..", "src", "api", "chat"),
        {
          // IMPORTANT for Apple Silicon users building amd64 images:
          // platform: Platform.LINUX_AMD64,
          platform: Platform.LINUX_AMD64,
        },
      ),
      memorySize: 128,
      timeout: Duration.seconds(10),
      // architecture: lambda.Architecture.X86_64, // default
    });

    const fn2 = new lambda.DockerImageFunction(this, "BunImageFn2", {
      functionName: "bun-chat-2",
      code: lambda.DockerImageCode.fromImageAsset(
        path.resolve(__dirname, "..", "..", "..", "src", "api", "chat2"),
        {
          // IMPORTANT for Apple Silicon users building amd64 images:
          // platform: Platform.LINUX_AMD64,
          platform: Platform.LINUX_AMD64,
        },
      ),
      memorySize: 128,
      timeout: Duration.seconds(10),
      // architecture: lambda.Architecture.X86_64, // default
    });

    const api = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: "cdk-bun-lambda-image-api",
    });

    // Route /chat to fn2 (chat2 function)
    api.addRoutes({
      path: "/chat",
      methods: [apigwv2.HttpMethod.ANY],
      integration: new HttpLambdaIntegration("ChatIntegration", fn2),
    });

    // Route /chat2/* to fn2
    api.addRoutes({
      path: "/chat2/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration: new HttpLambdaIntegration("Chat2Integration", fn2),
    });

    // Route everything else to fn (chat function)
    api.addRoutes({
      path: "/{proxy+}",
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
