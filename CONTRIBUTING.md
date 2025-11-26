# Contributing to SIP Protocol

Thank you for your interest in contributing to SIP Protocol! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Issues

Before creating an issue, please:
1. Search existing issues to avoid duplicates
2. Use the issue templates provided
3. Include relevant details (OS, Node version, reproduction steps)

### Submitting Changes

1. **Fork the repository** and create your branch from `main`
2. **Install dependencies**: `pnpm install`
3. **Make your changes** with clear, descriptive commits
4. **Test your changes**: `pnpm test`
5. **Lint your code**: `pnpm lint`
6. **Submit a pull request** with a clear description

### Pull Request Guidelines

- Keep PRs focused on a single change
- Update documentation as needed
- Add tests for new functionality
- Follow existing code style
- Write meaningful commit messages

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/sip-protocol.git
cd sip-protocol

# Install dependencies
pnpm install

# Create a branch for your changes
git checkout -b feature/your-feature-name

# Start development
pnpm dev
```

## Project Structure

```
sip-protocol/
├── apps/
│   └── demo/           # Demo application
├── packages/
│   ├── sdk/            # Core SDK
│   └── types/          # TypeScript types
├── docs/               # Documentation
└── .github/            # GitHub templates & workflows
```

## Coding Standards

### TypeScript

- Use strict TypeScript configuration
- Prefer explicit types over inference for public APIs
- Document public functions with JSDoc comments

### Formatting

- 2-space indentation
- Single quotes for strings
- No semicolons (Prettier default)
- Max line length: 100 characters

### Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add stealth address generation
fix: resolve commitment verification bug
docs: update integration guide
chore: update dependencies
```

## Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## Documentation

- Update docs for any public API changes
- Use clear, concise language
- Include code examples where helpful

## Getting Help

- Open a [GitHub Discussion](https://github.com/RECTOR-LABS/sip-protocol/discussions) for questions
- Join our community channels (links in README)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
