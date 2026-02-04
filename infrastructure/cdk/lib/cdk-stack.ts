import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { CfnOutput, Duration } from 'aws-cdk-lib';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const fn = new lambda.DockerImageFunction(this, "BunImageFn", {
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, "../../", "api/chat"),
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

    new CfnOutput(this, "ApiUrl", { value: api.url! });
  }
  
}
