#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { CdkStack } from '../lib/cdk-stack';
import { CicdStack } from '../lib/cicd-stack';
import { APPLICATION_TAG, loadPlatformConfig } from '../lib/naming';

const app = new cdk.App();
// Fails synth if prefix/account context is missing or the resolved account differs.
const config = loadPlatformConfig(app);
const stack = new CdkStack(app, 'CdkStack', {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '123456789012', region: 'us-east-1' },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
 

});

// Stack-level tags: every taggable resource (existing ones update in place).
cdk.Tags.of(stack).add("application", APPLICATION_TAG);
cdk.Tags.of(stack).add("environment", config.envName);

const cicdStack = new CicdStack(app, 'GhAppCicdStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  config,
});
cdk.Tags.of(cicdStack).add("application", APPLICATION_TAG);
cdk.Tags.of(cicdStack).add("environment", config.envName);
