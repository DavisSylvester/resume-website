import { describe, expect, test } from 'bun:test';
import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AuditTrail } from '../lib/audit-trail';
import { PlatformConfig, resourceName } from '../lib/naming';

const CONFIG: PlatformConfig = { resourcePrefix: 'gh-app', envName: 'prod', expectedAccount: '123456789012' };

/** Synthesizes an AuditTrail in an isolated stack so these tests never touch CdkStack's assets. */
const synthAuditTrail = (): Template => {
  const app: App = new App();
  const stack: Stack = new Stack(app, 'TestStack', { env: { account: '123456789012', region: 'us-east-1' } });
  new AuditTrail(stack, 'AuditTrail', { config: CONFIG });
  return Template.fromStack(stack);
};

describe('resourceName', () => {

  test('puts the environment last: <prefix>-<name>-<env>', () => {
    expect(resourceName(CONFIG, 'cloudtrail-logs')).toBe('gh-app-cloudtrail-logs-prod');
  });
});

describe('AuditTrail', () => {

  const template: Template = synthAuditTrail();

  test('creates one multi-region trail with log-file validation and the convention name', () => {
    template.resourceCountIs('AWS::CloudTrail::Trail', 1);
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      TrailName: 'gh-app-cloudtrail-prod',
      IsMultiRegionTrail: true,
      IncludeGlobalServiceEvents: true,
      EnableLogFileValidation: true,
      IsLogging: true,
    });
  });

  test('log bucket is private, encrypted, versioned and expires objects after 365 days', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'gh-app-cloudtrail-logs-prod',
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [{ ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }],
      },
      VersioningConfiguration: { Status: 'Enabled' },
      LifecycleConfiguration: { Rules: Match.arrayWith([Match.objectLike({ ExpirationInDays: 365 })]) },
    });
  });

  test('bucket policy denies any request made without TLS', () => {
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Deny',
            Action: 's3:*',
            Condition: { Bool: { 'aws:SecureTransport': 'false' } },
          }),
        ]),
      },
    });
  });

  test('bucket and trail are retained if the stack is deleted, so the audit record survives', () => {
    template.hasResource('AWS::S3::Bucket', { DeletionPolicy: 'Retain', UpdateReplacePolicy: 'Retain' });
    template.hasResource('AWS::CloudTrail::Trail', { DeletionPolicy: 'Retain', UpdateReplacePolicy: 'Retain' });
  });
});
