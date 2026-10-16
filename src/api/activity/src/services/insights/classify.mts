/**
 * Pure classification rules for the insights ledger. No I/O; everything here is unit-tested.
 */

export const IacTool = {
  Terraform: 'terraform',
  Cdk: 'cdk',
  Bicep: 'bicep',
  Pulumi: 'pulumi',
  CloudFormation: 'cloudformation',
  Serverless: 'serverless',
} as const;
export type IacTool = (typeof IacTool)[keyof typeof IacTool];
export const IAC_TOOLS: IacTool[] = Object.values(IacTool);

export const FileClass = {
  ...IacTool,
  Test: 'test',
  Ci: 'ci',
  Docs: 'docs',
  Source: 'source',
  Excluded: 'excluded',
} as const;
export type FileClass = (typeof FileClass)[keyof typeof FileClass];

export const Cloud = { Aws: 'AWS', Azure: 'Azure', Gcp: 'GCP' } as const;
export type Cloud = (typeof Cloud)[keyof typeof Cloud];

/** Directories (repo-relative, '' = root) that mark an IaC project of a given tool. */
export interface IacRoots {
  cdk: string[];
  pulumi: string[];
  cloudformation: string[];
  serverless: string[];
}

const EXCLUDED: RegExp[] = [
  /(^|\/)node_modules\//,
  /(^|\/)(dist|build|out|coverage|cdk\.out|\.terraform|\.angular|\.dart_tool|bin\/Debug|bin\/Release|obj)\//,
  /(^|\/)(package-lock\.json|bun\.lockb?|yarn\.lock|pnpm-lock\.yaml|pubspec\.lock|Cargo\.lock|poetry\.lock|composer\.lock|go\.sum)$/,
  /\.min\.(js|css)$/,
  /\.(png|jpe?g|gif|webp|ico|svg|pdf|zip|woff2?|ttf|mp4|mkv)$/i,
];

const TEST: RegExp[] = [
  /(^|\/)(__tests__|tests?|spec|specs|e2e)\//i,
  /\.(test|spec|e2e-spec|e2e)\.[a-z0-9]+$/i,
  /_test\.(go|py|dart)$/,
  /(^|\/)test_[^/]+\.py$/,
  /Tests?\.cs$/,
  /(^|\/)[^/]+\.Tests?\//,
];

const CI: RegExp[] = [/^\.github\/workflows\//, /(^|\/)azure-pipelines[^/]*\.ya?ml$/, /(^|\/)buildspec[^/]*\.ya?ml$/, /(^|\/)Jenkinsfile$/, /(^|\/)\.gitlab-ci\.yml$/];

const DOCS: RegExp[] = [/\.(md|mdx|rst|adoc)$/i, /(^|\/)docs?\//i];

const dirOf = (path: string): string => {
  const i: number = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
};

const under = (path: string, root: string): boolean => root === '' || path === root || path.startsWith(`${root}/`);

/** Finds the IaC project roots from a repository's file list (tree paths). */
export const findIacRoots = (paths: string[], cdkPackageDirs: string[] = []): IacRoots => {
  const roots: IacRoots = { cdk: [...cdkPackageDirs], pulumi: [], cloudformation: [], serverless: [] };
  for (const p of paths) {
    if (EXCLUDED.some((re: RegExp): boolean => re.test(p))) continue;
    const name: string = p.slice(p.lastIndexOf('/') + 1);
    if (name === 'cdk.json') roots.cdk.push(dirOf(p));
    else if (name === 'Pulumi.yaml' || name === 'Pulumi.yml') roots.pulumi.push(dirOf(p));
    else if (name === 'samconfig.toml') roots.cloudformation.push(dirOf(p));
    else if (/^serverless\.(ya?ml|ts|js)$/.test(name)) roots.serverless.push(dirOf(p));
  }
  const uniq = (xs: string[]): string[] => [...new Set(xs)].sort();
  return { cdk: uniq(roots.cdk), pulumi: uniq(roots.pulumi), cloudformation: uniq(roots.cloudformation), serverless: uniq(roots.serverless) };
};

/** Classifies one changed file. IaC wins over test/docs so CDK tests count toward CDK. */
export const classifyFile = (path: string, roots: IacRoots): FileClass => {
  if (EXCLUDED.some((re: RegExp): boolean => re.test(path))) return FileClass.Excluded;
  if (/\.(tf|tfvars|tf\.json)$/.test(path) || /(^|\/)\.terraform\.lock\.hcl$/.test(path)) return FileClass.Terraform;
  if (/\.(bicep|bicepparam)$/.test(path)) return FileClass.Bicep;
  if (roots.cdk.some((r: string): boolean => under(path, r))) return FileClass.Cdk;
  if (roots.pulumi.some((r: string): boolean => under(path, r))) return FileClass.Pulumi;
  if (roots.serverless.some((r: string): boolean => under(path, r))) return FileClass.Serverless;
  if (roots.cloudformation.some((r: string): boolean => under(path, r)) || /(cloudformation|(^|[/._-])cfn[._-])/i.test(path)) {
    return FileClass.CloudFormation;
  }
  if (CI.some((re: RegExp): boolean => re.test(path))) return FileClass.Ci;
  if (TEST.some((re: RegExp): boolean => re.test(path))) return FileClass.Test;
  if (DOCS.some((re: RegExp): boolean => re.test(path))) return FileClass.Docs;
  return FileClass.Source;
};

export const isTestPath = (path: string): boolean =>
  !EXCLUDED.some((re: RegExp): boolean => re.test(path)) && TEST.some((re: RegExp): boolean => re.test(path));

export const isExcludedPath = (path: string): boolean => EXCLUDED.some((re: RegExp): boolean => re.test(path));

export const COMMIT_TYPES: string[] = ['feat', 'fix', 'refactor', 'test', 'docs', 'chore', 'ci', 'build', 'perf', 'style', 'revert'];

/** Conventional Commit type of a message's first line; `merge` for merges, else `other`. */
export const commitType = (message: string, isMerge: boolean): string => {
  if (isMerge || /^Merge (pull request|branch|remote-tracking)/.test(message)) return 'merge';
  const m: RegExpExecArray | null = /^([a-z]+)(\([^)]*\))?!?:\s/i.exec(message.trim());
  const type: string = (m?.[1] ?? '').toLowerCase();
  if (type === 'feature') return 'feat';
  if (type === 'bugfix' || type === 'hotfix') return 'fix';
  if (type === 'tests') return 'test';
  if (type === 'doc') return 'docs';
  return COMMIT_TYPES.includes(type) ? type : 'other';
};

const PROVIDER_CLOUD: Record<string, Cloud> = {
  aws: Cloud.Aws,
  awscc: Cloud.Aws,
  azurerm: Cloud.Azure,
  azuread: Cloud.Azure,
  azapi: Cloud.Azure,
  azuredevops: Cloud.Azure,
  google: Cloud.Gcp,
  'google-beta': Cloud.Gcp,
};

/** Terraform provider names from `.terraform.lock.hcl` or `.tf` source. */
export const terraformProviders = (text: string): string[] => {
  const found: Set<string> = new Set();
  for (const m of text.matchAll(/provider\s+"registry\.terraform\.io\/[^/"]+\/([a-z0-9-]+)"/g)) found.add(m[1] ?? '');
  for (const m of text.matchAll(/source\s*=\s*"(?:registry\.terraform\.io\/)?[^/"]+\/([a-z0-9-]+)"/g)) found.add(m[1] ?? '');
  for (const m of text.matchAll(/^\s*provider\s+"([a-z0-9-]+)"\s*\{/gm)) found.add(m[1] ?? '');
  found.delete('');
  return [...found].sort();
};

export const cloudOfProvider = (provider: string): Cloud | null => PROVIDER_CLOUD[provider] ?? null;

export interface Framework {
  name: string;
  category: string;
}

export const Category = {
  Frontend: 'Frontend',
  Backend: 'Backend',
  Mobile: 'Mobile',
  Cloud: 'Cloud & IaC',
  Data: 'Data & AI',
  Testing: 'Testing',
  Runtime: 'Runtime',
} as const;

const NPM: [RegExp, string, string][] = [
  [/^@angular\/core$/, 'Angular', Category.Frontend],
  [/^react$/, 'React', Category.Frontend],
  [/^vue$/, 'Vue', Category.Frontend],
  [/^next$/, 'Next.js', Category.Frontend],
  [/^svelte$/, 'Svelte', Category.Frontend],
  [/^d3$/, 'D3', Category.Frontend],
  [/^tailwindcss$/, 'Tailwind CSS', Category.Frontend],
  [/^@angular\/material$/, 'Angular Material', Category.Frontend],
  [/^@ionic\/(angular|react|core)$/, 'Ionic', Category.Mobile],
  [/^@capacitor\/core$/, 'Capacitor', Category.Mobile],
  [/^react-native$/, 'React Native', Category.Mobile],
  [/^electron$/, 'Electron', Category.Frontend],
  [/^elysia$/, 'Elysia', Category.Backend],
  [/^express$/, 'Express', Category.Backend],
  [/^fastify$/, 'Fastify', Category.Backend],
  [/^@nestjs\/core$/, 'NestJS', Category.Backend],
  [/^hono$/, 'Hono', Category.Backend],
  [/^@azure\/functions$/, 'Azure Functions', Category.Cloud],
  [/^aws-cdk-lib$/, 'AWS CDK', Category.Cloud],
  [/^@aws-sdk\//, 'AWS SDK', Category.Cloud],
  [/^@azure\//, 'Azure SDK', Category.Cloud],
  [/^@pulumi\//, 'Pulumi', Category.Cloud],
  [/^(mongodb|mongoose)$/, 'MongoDB', Category.Data],
  [/^(pg|postgres|@prisma\/client|prisma)$/, 'PostgreSQL / Prisma', Category.Data],
  [/^(redis|ioredis)$/, 'Redis', Category.Data],
  [/^(@langchain\/|langchain$|@langchain\/langgraph)/, 'LangChain / LangGraph', Category.Data],
  [/^@anthropic-ai\/sdk$/, 'Anthropic SDK', Category.Data],
  [/^openai$/, 'OpenAI SDK', Category.Data],
  [/^ollama$/, 'Ollama', Category.Data],
  [/^@modelcontextprotocol\//, 'Model Context Protocol', Category.Data],
  [/^@playwright\/test$|^playwright$/, 'Playwright', Category.Testing],
  [/^vitest$/, 'Vitest', Category.Testing],
  [/^jest$/, 'Jest', Category.Testing],
  [/^@sinclair\/typebox$/, 'TypeBox', Category.Backend],
  [/^(@auth0\/|auth0$)/, 'Auth0', Category.Backend],
];

/** Frameworks from a package.json body. Also reports whether it depends on aws-cdk-lib. */
export const npmFrameworks = (json: string): { frameworks: Framework[]; usesCdk: boolean; usesBun: boolean } => {
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; packageManager?: string };
  try {
    pkg = JSON.parse(json) as typeof pkg;
  } catch {
    return { frameworks: [], usesCdk: false, usesBun: false };
  }
  const deps: string[] = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
  const out: Map<string, Framework> = new Map();
  for (const dep of deps) {
    for (const [re, name, category] of NPM) if (re.test(dep)) out.set(name, { name, category });
  }
  const usesBun: boolean = (pkg.packageManager ?? '').startsWith('bun') || deps.includes('@types/bun') || deps.includes('bun-types');
  if (usesBun) out.set('Bun', { name: 'Bun', category: Category.Runtime });
  else if (deps.length > 0) out.set('Node.js', { name: 'Node.js', category: Category.Runtime });
  out.set('TypeScript', { name: 'TypeScript', category: Category.Runtime });
  if (!deps.includes('typescript') && !deps.some((d: string): boolean => d.startsWith('@types/'))) out.delete('TypeScript');
  return { frameworks: [...out.values()], usesCdk: deps.includes('aws-cdk-lib'), usesBun };
};

/** Frameworks from a non-npm manifest, keyed by its file name. */
export const manifestFrameworks = (fileName: string, text: string): Framework[] => {
  const out: Framework[] = [];
  const add = (name: string, category: string): void => {
    if (!out.some((f: Framework): boolean => f.name === name)) out.push({ name, category });
  };
  if (fileName === 'pubspec.yaml') {
    add('Dart', Category.Runtime);
    if (/^\s*flutter:\s*$/m.test(text) || /sdk:\s*flutter/.test(text)) add('Flutter', Category.Mobile);
  } else if (fileName.endsWith('.csproj')) {
    add('.NET', Category.Runtime);
    if (/Microsoft\.AspNetCore|Sdk="Microsoft\.NET\.Sdk\.Web"/.test(text)) add('ASP.NET Core', Category.Backend);
    if (/Microsoft\.EntityFrameworkCore/.test(text)) add('Entity Framework', Category.Data);
    if (/Microsoft\.NET\.Sdk\.Functions|Microsoft\.Azure\.Functions/.test(text)) add('Azure Functions', Category.Cloud);
    if (/xunit|NUnit|MSTest/i.test(text)) add('xUnit / NUnit', Category.Testing);
  } else if (fileName === 'requirements.txt' || fileName === 'pyproject.toml') {
    add('Python', Category.Runtime);
    const py: [RegExp, string, string][] = [
      [/\bdjango\b/i, 'Django', Category.Backend],
      [/\bflask\b/i, 'Flask', Category.Backend],
      [/\bfastapi\b/i, 'FastAPI', Category.Backend],
      [/\bpandas\b/i, 'pandas', Category.Data],
      [/\blangchain/i, 'LangChain / LangGraph', Category.Data],
      [/\bboto3\b/i, 'AWS SDK', Category.Cloud],
      [/\bpytest\b/i, 'pytest', Category.Testing],
    ];
    for (const [re, name, category] of py) if (re.test(text)) add(name, category);
  } else if (fileName === 'go.mod') {
    add('Go', Category.Runtime);
  } else if (fileName === 'Cargo.toml') {
    add('Rust', Category.Runtime);
  }
  return out;
};

export const MANIFEST_NAMES: RegExp = /(^|\/)(package\.json|pubspec\.yaml|requirements\.txt|pyproject\.toml|go\.mod|Cargo\.toml|[^/]+\.csproj)$/;

/** Workflow runs named or pathed like a deployment count as deploys. */
export const isDeployWorkflow = (name: string, path: string): boolean =>
  /(deploy|release|publish|\bcd\b|cd\.ya?ml|delivery)/i.test(`${name} ${path}`);
