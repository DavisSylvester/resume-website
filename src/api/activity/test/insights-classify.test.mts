import { describe, expect, test } from 'bun:test';
import {
  FileClass,
  classifyFile,
  cloudOfProvider,
  commitType,
  findIacRoots,
  isDeployWorkflow,
  manifestFrameworks,
  npmFrameworks,
  terraformProviders,
} from '../src/services/insights/classify.mjs';
import { toLedgerCommit } from '../src/services/insights/ledger.mjs';
import type { IacRoots } from '../src/services/insights/classify.mjs';

const roots: IacRoots = findIacRoots(
  ['infrastructure/cdk/cdk.json', 'infrastructure/cdk/lib/stack.ts', 'svc/Pulumi.yaml', 'sam/samconfig.toml', 'fn/serverless.yml', 'node_modules/x/cdk.json'],
  ['libs/constructs'],
);

describe('findIacRoots', () => {
  test('finds each tool root and ignores node_modules', () => {
    expect(roots).toEqual({
      cdk: ['infrastructure/cdk', 'libs/constructs'],
      pulumi: ['svc'],
      cloudformation: ['sam'],
      serverless: ['fn'],
    });
  });
});

describe('classifyFile', () => {
  test.each([
    ['infra/main.tf', FileClass.Terraform],
    ['envs/prod.tfvars', FileClass.Terraform],
    ['infra/.terraform.lock.hcl', FileClass.Terraform],
    ['infra/.terraform/providers/x.tf', FileClass.Excluded],
    ['infrastructure/cdk/lib/stack.ts', FileClass.Cdk],
    ['infrastructure/cdk/test/stack.test.ts', FileClass.Cdk],
    ['libs/constructs/src/bucket.ts', FileClass.Cdk],
    ['azure/main.bicep', FileClass.Bicep],
    ['svc/index.ts', FileClass.Pulumi],
    ['sam/template.yaml', FileClass.CloudFormation],
    ['deploy/cfn-network.yml', FileClass.CloudFormation],
    ['fn/handler.ts', FileClass.Serverless],
    ['.github/workflows/ci.yml', FileClass.Ci],
    ['src/app.test.ts', FileClass.Test],
    ['tests/test_api.py', FileClass.Test],
    ['pkg/x_test.go', FileClass.Test],
    ['Api.Tests/UserTests.cs', FileClass.Test],
    ['docs/guide.md', FileClass.Docs],
    ['README.md', FileClass.Docs],
    ['src/app.ts', FileClass.Source],
    ['package-lock.json', FileClass.Excluded],
    ['bun.lock', FileClass.Excluded],
    ['dist/main.js', FileClass.Excluded],
    ['assets/logo.png', FileClass.Excluded],
  ])('%s -> %s', (path: string, expected: string) => {
    expect(classifyFile(path, roots)).toBe(expected as FileClass);
  });
});

describe('commitType', () => {
  test.each([
    ['feat: add page', 'feat'],
    ['fix(api): handle 404', 'fix'],
    ['refactor!: drop v1', 'refactor'],
    ['Feature: thing', 'feat'],
    ['hotfix: prod', 'fix'],
    ['docs: readme', 'docs'],
    ['Update README', 'other'],
    ['Merge pull request #1 from x/y', 'merge'],
  ])('%s -> %s', (msg: string, expected: string) => {
    expect(commitType(msg, false)).toBe(expected);
  });

  test('a commit with two parents is a merge whatever its message', () => {
    expect(commitType('feat: x', true)).toBe('merge');
  });
});

describe('terraform providers', () => {
  test('reads lock files, required_providers and provider blocks', () => {
    const lock: string = 'provider "registry.terraform.io/hashicorp/aws" {\n  version = "5.0"\n}\nprovider "registry.terraform.io/auth0/auth0" {}';
    const tf: string = 'terraform {\n required_providers {\n  azurerm = { source = "hashicorp/azurerm" }\n }\n}\nprovider "google" {\n}';
    expect(terraformProviders(lock)).toEqual(['auth0', 'aws']);
    expect(terraformProviders(tf)).toEqual(['azurerm', 'google']);
  });

  test('drops utility providers such as local, null and random', () => {
    const lock: string = ['aws', 'local', 'null', 'random']
      .map((p: string): string => `provider "registry.terraform.io/hashicorp/${p}" {}`)
      .join('\n');
    expect(terraformProviders(lock)).toEqual(['aws']);
  });

  test('maps providers to clouds', () => {
    expect(cloudOfProvider('aws')).toBe('AWS');
    expect(cloudOfProvider('azuread')).toBe('Azure');
    expect(cloudOfProvider('google-beta')).toBe('GCP');
    expect(cloudOfProvider('auth0')).toBeNull();
  });
});

describe('frameworks', () => {
  test('npm: maps dependencies, detects Bun and aws-cdk-lib', () => {
    const r = npmFrameworks(
      JSON.stringify({
        packageManager: 'bun@1.4.3',
        dependencies: { '@angular/core': '21', elysia: '1', 'aws-cdk-lib': '2', '@aws-sdk/client-s3': '3' },
        devDependencies: { typescript: '6', vitest: '4' },
      }),
    );
    expect(r.usesCdk).toBe(true);
    expect(r.usesBun).toBe(true);
    expect(r.frameworks.map((f) => f.name).sort()).toEqual(['AWS CDK', 'AWS SDK', 'Angular', 'Bun', 'Elysia', 'TypeScript', 'Vitest']);
  });

  test('npm: bad JSON yields nothing', () => {
    expect(npmFrameworks('{nope').frameworks).toEqual([]);
  });

  test('pubspec, csproj and python manifests', () => {
    expect(manifestFrameworks('pubspec.yaml', 'dependencies:\n  flutter:\n    sdk: flutter').map((f) => f.name)).toEqual(['Dart', 'Flutter']);
    expect(manifestFrameworks('Api.csproj', '<Project Sdk="Microsoft.NET.Sdk.Web"><PackageReference Include="xunit" /></Project>').map((f) => f.name)).toEqual([
      '.NET',
      'ASP.NET Core',
      'xUnit / NUnit',
    ]);
    expect(manifestFrameworks('requirements.txt', 'fastapi==0.1\nboto3').map((f) => f.name)).toEqual(['Python', 'FastAPI', 'AWS SDK']);
  });
});

describe('isDeployWorkflow', () => {
  test('matches deploy-like names and paths only', () => {
    expect(isDeployWorkflow('Deploy to prod', '.github/workflows/main.yml')).toBe(true);
    expect(isDeployWorkflow('build', '.github/workflows/cd.yml')).toBe(true);
    expect(isDeployWorkflow('CI', '.github/workflows/ci.yml')).toBe(false);
  });
});

describe('toLedgerCommit', () => {
  test('sums lines per class, drops excluded files and keeps no file names or message', () => {
    const rec = toLedgerCommit(
      {
        sha: 'abc',
        date: '2026-10-01T00:00:00Z',
        message: 'feat(infra): add vpc\n\nsecret details',
        isMerge: false,
        files: [
          { filename: 'infra/vpc.tf', additions: 40, deletions: 2 },
          { filename: 'infra/outputs.tf', additions: 5, deletions: 0 },
          { filename: 'src/app.ts', additions: 10, deletions: 3 },
          { filename: 'package-lock.json', additions: 900, deletions: 900 },
        ],
      },
      'private:7',
      true,
      roots,
    );
    expect(rec).toEqual({
      sha: 'abc',
      repo: 'private:7',
      isPrivate: true,
      date: '2026-10-01T00:00:00Z',
      type: 'feat',
      isMerge: false,
      lines: { terraform: { add: 45, del: 2, files: 2 }, source: { add: 10, del: 3, files: 1 } },
    });
    expect(JSON.stringify(rec)).not.toContain('vpc');
    expect(JSON.stringify(rec)).not.toContain('secret');
  });
});
