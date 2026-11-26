import type { PortfolioProject } from './interfaces';

/** Public projects, in display order. Add a new entry here to list it and give it a summary page. */
export const PORTFOLIO_PROJECTS: PortfolioProject[] = [
  {
    slug: 'bjj-open-mat',
    name: 'BJJ Open Mat',
    tagline: 'Find a Brazilian Jiu-Jitsu open mat anywhere, see who is going, and RSVP.',
    icon: '/images/projects/bjj-open-mat-icon.png',
    status: 'Live on iOS and Android',
    summary: [
      'BJJ Open Mat is a free mobile app for finding a place to train, near home or in any city you are traveling to. ' +
        'It maps open mats around you and filters them by gi or no-gi, distance, skill level and time. You can see who is ' +
        'coming, tap "I\'m going", and check in when you arrive.',
      'It is community-driven: anyone can add a mat, and gym owners claim their gym to verify their own sessions and see ' +
        'expected against actual attendance. I designed and built the whole product myself, from the Flutter app and the ' +
        'API to the admin portal, the marketing website, the AWS infrastructure and the release pipelines to both app stores.',
    ],
    highlights: [
      { title: 'Location search', text: 'Find open mats by GPS, city or ZIP code, up to 100 miles away, in a list or on a map.' },
      { title: 'Filters', text: 'Gi or no-gi, free sessions, skill level, and day or time window.' },
      { title: 'RSVP and check-in', text: '"I\'m going" RSVPs and arrival check-ins, with attendees, belt ranks and a training log.' },
      { title: 'Gym profiles', text: 'Owners claim their gym, post and verify sessions, and see expected against actual attendance.' },
      { title: 'Sign-in', text: 'Google, Apple, Facebook, Amazon, Microsoft, email or passkey, with Face ID / Touch ID unlock.' },
      { title: 'Gym referrals', text: 'Per-gym QR flyers that deep-link into the right store with a referral code.' },
    ],
    architecture: [
      { title: 'Mobile', text: 'One Flutter (Dart) codebase for iOS and Android.' },
      { title: 'API', text: 'Bun + Elysia on AWS Lambda behind API Gateway, with TypeBox schemas shared as the contract.' },
      { title: 'Data', text: 'MongoDB with geospatial queries for distance search.' },
      { title: 'Identity', text: 'Auth0 with social connections, passkeys and PKCE on every public client.' },
      { title: 'Web', text: 'Angular marketing site and an Angular admin portal for gyms, schedules, members and email campaigns.' },
      { title: 'Delivery', text: 'AWS CDK infrastructure; GitHub Actions for CI, store releases and a nightly crawl that finds new sessions.' },
    ],
    stack: ['Flutter', 'Dart', 'TypeScript', 'Bun', 'Elysia', 'MongoDB', 'Auth0', 'AWS Lambda', 'AWS CDK', 'Angular', 'GitHub Actions'],
    appStoreUrl: 'https://apps.apple.com/us/app/bjj-open-mat/id6787704999',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.davissylvester.bjjopenmat',
    websiteUrl: 'https://bjjopenmat.app',
  },
  {
    slug: 'claude-dashboard',
    name: 'Claude Dashboard',
    tagline: 'A private control panel for my whole Claude Code setup: agents, skills, knowledge base, usage and spend.',
    icon: '/images/projects/claude-dashboard-icon.svg',
    status: 'Private · behind sign-in',
    secure: true,
    summary: [
      'Claude Dashboard is a web app that shows my entire Claude Code setup in one place: global settings, custom agents, ' +
        'skills, the knowledge base of known failures and fixes, memory notes, prompt history, token usage and estimated ' +
        'spend. It also has a safe editor for every instruction and agent file, so I can change how my agents behave ' +
        'without opening a terminal.',
      'It runs two ways. Locally, a Bun API reads the real configuration folders on my PC. In the cloud, a sync agent ' +
        'mirrors a redacted copy to S3 and the same app serves it from AWS Lambda, with live updates over WebSockets. ' +
        'It is not open to the public: every request needs an Auth0 sign-in with the owner role, and prompt text never ' +
        'leaves the machine, only counts.',
    ],
    highlights: [
      { title: 'Everything in one view', text: 'Config, agents, skills, knowledge base, memory, history, usage and storage across 13 views.' },
      { title: 'Safe editing', text: 'Allow-listed markdown only, version checks with conflict detection, a backup before every write, and an extra confirmation for CLAUDE.md.' },
      { title: 'Usage and spend', text: 'Token usage by model and day, an API-equivalent cost estimate, and the plan I actually pay, kept as separate numbers.' },
      { title: 'Knowledge base tools', text: 'Browse failure lessons, spot instructions that contradict each other, and hand a lesson to an agent as a ready-to-run zip.' },
      { title: 'Skill curation', text: 'Groups similar skills so duplicates can be merged, with one-click checks run by Claude.' },
      { title: 'Live updates', text: 'File changes on the PC reach the open dashboard within seconds over an authenticated WebSocket.' },
    ],
    architecture: [
      { title: 'Web', text: 'Angular 22 with signals and standalone components; d3 charts; light and dark themes; fully responsive.' },
      { title: 'API', text: 'Bun + Elysia with TypeBox validation, one Docker image serving three AWS Lambda functions.' },
      { title: 'Data', text: 'S3 for the synced files, SQS for change events, MongoDB for WebSocket tickets and live connections.' },
      { title: 'Identity', text: 'Auth0 SPA with PKCE and Google sign-in; the API checks the JWT and a namespaced owner role on every call.' },
      { title: 'Delivery', text: 'AWS CDK stack with least-privilege IAM per function; API Gateway HTTP and WebSocket APIs on a custom domain.' },
      { title: 'Quality', text: 'Bun and Vitest unit tests, plus Playwright responsive and visual-fidelity audits against the production build.' },
    ],
    stack: ['Angular', 'TypeScript', 'Bun', 'Elysia', 'TypeBox', 'd3', 'Auth0', 'AWS Lambda', 'API Gateway', 'S3', 'SQS', 'MongoDB', 'AWS CDK', 'Playwright'],
  },
];

/** Projects anyone can use: they have store or website links. Listed on /portfolio. */
export const PUBLIC_PROJECTS: PortfolioProject[] = PORTFOLIO_PROJECTS.filter((p: PortfolioProject): boolean => p.secure !== true);

/** Projects behind sign-in, with no public links. Listed on /private-projects. */
export const PRIVATE_PROJECTS: PortfolioProject[] = PORTFOLIO_PROJECTS.filter((p: PortfolioProject): boolean => p.secure === true);

export const findProject = (slug: string): PortfolioProject | undefined =>
  PORTFOLIO_PROJECTS.find((p: PortfolioProject): boolean => p.slug === slug);
