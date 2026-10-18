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
];

export const findProject = (slug: string): PortfolioProject | undefined =>
  PORTFOLIO_PROJECTS.find((p: PortfolioProject): boolean => p.slug === slug);
