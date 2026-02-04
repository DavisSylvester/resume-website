# Davis Resume Website

A modern, responsive resume website built with Angular, deployed on AWS with Infrastructure as Code (CDK). This project showcases professional experience, skills, certifications, and projects in an interactive web application.

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Development](#development)
- [Building & Deployment](#building--deployment)
- [Project Structure Details](#project-structure-details)

## 🎯 Project Overview

This is a full-stack project that combines:
- **Frontend**: An interactive Angular application displaying a professional resume
- **Infrastructure**: AWS CDK deployment configuration for hosting on AWS
- **Content**: Resume data stored as markdown documents

The application features sections for professional summary, experience, expertise, certifications, projects, and contact information.

## 📁 Project Structure

```
davis-resume/
├── docs/                    # Documentation and resume content
│   └── Davis-Sylvester-Node-11-2025.md
├── infrastructure/          # AWS CDK infrastructure as code
│   └── cdk/
├── ui/                      # Angular front-end application
└── README.md               # This file
```

## 🛠️ Technology Stack

### Frontend
- **Framework**: Angular 21
- **Language**: TypeScript 5.9
- **Styling**: SCSS
- **Package Manager**: pnpm (v10.0.0)
- **Testing**: Vitest
- **Build Tool**: Angular CLI 21.1.2

### Infrastructure
- **IaC**: AWS CDK 2.1104.0
- **Language**: TypeScript
- **Cloud Provider**: AWS
- **Testing**: Jest

### Core Libraries
- RxJS 7.8.0
- Angular Router for navigation
- Angular Forms for form handling

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18+ (recommended v20+)
- **pnpm**: v10.0.0+ (package manager)
- **AWS CLI**: v2+ (for infrastructure deployment)
- **AWS Account**: With appropriate credentials configured
- **Git**: For version control

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd davis-resume
```

### 2. Install Dependencies

Install dependencies for both the UI and infrastructure:

```bash
# Install UI dependencies
cd ui
pnpm install

# Install infrastructure dependencies
cd ../infrastructure/cdk
pnpm install
```

## 💻 Development

### Development Server (UI)

To start the Angular development server:

```bash
cd ui
pnpm start
# or
npm run start
```

Navigate to `http://localhost:4200/` in your browser. The application will automatically reload when you make changes to the source files.

### Code Scaffolding

To generate new Angular components:

```bash
cd ui
ng generate component component-name
# or
ng g c component-name
```

For more scaffolding options (directives, pipes, services, etc.):

```bash
ng generate --help
```

### Running Tests

#### Unit Tests (UI)

```bash
cd ui
pnpm test
# or
npm run test
```

Tests run with Vitest and automatically watch for file changes.

#### Infrastructure Tests

```bash
cd infrastructure/cdk
pnpm test
# or
npm run test
```

## 🏗️ Building & Deployment

### Build the UI

To create a production build of the Angular application:

```bash
cd ui
pnpm build
# or
npm run build
```

Build artifacts are stored in the `dist/` directory with optimizations for performance and speed.

### Watch Mode (Development)

For continuous development builds:

```bash
cd ui
pnpm watch
# or
npm run watch
```

### Deploy Infrastructure

Deploy to AWS using CDK:

```bash
cd infrastructure/cdk

# Synthesize the CloudFormation template
pnpm run cdk synth

# Deploy to AWS (interactive mode)
pnpm run cdk deploy

# Or with specific stack names if multiple stacks exist
pnpm run cdk deploy --all
```

### Bootstrap AWS (First Time Only)

If this is your first CDK deployment to this AWS account/region:

```bash
cd infrastructure/cdk
npx aws-cdk bootstrap aws://<ACCOUNT-ID>/<REGION>
```

## 📂 Project Structure Details

### `/ui` - Angular Application

The Angular application contains:

```
ui/
├── src/
│   ├── app/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── footer/
│   │   │   └── navbar/
│   │   ├── pages/               # Page-level components
│   │   │   ├── about/
│   │   │   └── print-resume/
│   │   ├── sections/            # Content sections
│   │   │   ├── badges/
│   │   │   ├── certifications/
│   │   │   ├── contact/
│   │   │   ├── experience/
│   │   │   ├── expertise/
│   │   │   ├── hero/
│   │   │   └── projects/
│   │   ├── app.ts              # Root component
│   │   ├── app.routes.ts       # Route configuration
│   │   └── app.config.ts       # App configuration
│   ├── main.ts                 # Bootstrap entry point
│   ├── index.html              # HTML entry point
│   └── styles.scss             # Global styles
├── public/                      # Static assets
│   ├── favicons/               # Favicon files
│   └── images/                 # Image assets
├── angular.json                # Angular CLI configuration
├── tsconfig.json               # TypeScript configuration
└── package.json                # Dependencies and scripts
```

### `/infrastructure/cdk` - AWS CDK Stack

Infrastructure as Code for deploying the application:

```
infrastructure/cdk/
├── bin/
│   └── cdk.ts                 # CDK app entry point
├── lib/
│   └── cdk-stack.ts           # Main CDK stack definition
├── test/
│   └── cdk.test.ts            # Infrastructure tests
├── tsconfig.json              # TypeScript configuration
└── package.json               # Dependencies and scripts
```

### `/docs` - Documentation

- `Davis-Sylvester-Node-11-2025.md` - Professional resume content including:
  - Contact information
  - Professional objective
  - Areas of expertise (languages, frameworks, databases, cloud, tools)
  - And more sections

## 📝 Component Overview

### Key Components

- **Navbar**: Navigation header with routing
- **Footer**: Footer information and links
- **Hero**: Landing section with introduction
- **Experience**: Professional work history
- **Expertise**: Technical skills and competencies
- **Certifications**: Professional certifications
- **Projects**: Portfolio of projects
- **Contact**: Contact information and form
- **Badges**: Technology badges and badges display
- **Print Resume**: Print-friendly resume view
- **About**: About page content

## 🔒 Environment Configuration

Create a `.env` file in the `ui` directory if needed for environment-specific configuration:

```
# Example .env
API_URL=https://your-api-endpoint
```

Ensure sensitive credentials are not committed to version control.

## 📚 Additional Resources

- [Angular Documentation](https://angular.dev)
- [Angular CLI Reference](https://angular.dev/tools/cli)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/v2/guide/)
- [Vitest Documentation](https://vitest.dev/)
- [SCSS Documentation](https://sass-lang.com/documentation)

## 🤝 Contributing

When contributing to this project:

1. Follow the existing code style and conventions
2. Write unit tests for new features
3. Update documentation as needed
4. Keep commits atomic and descriptive

## 📄 License

Include your license information here.

## 📧 Contact

For questions or inquiries, contact Davis Sylvester at dsylvesteriii@gmail.com.

---

**Last Updated**: February 3, 2026
