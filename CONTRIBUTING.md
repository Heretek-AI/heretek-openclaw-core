# Contributing to Heretek OpenClaw

Thank you for your interest in contributing to Heretek OpenClaw! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Requests](#pull-requests)
- [Testing](#testing)
- [Code Style](#code-style)
- [Commit Messages](#commit-messages)

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Welcome newcomers and help them learn
- Keep discussions on topic

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
   ```bash
   git clone https://github.com/your-username/heretek-openclaw-core.git
   cd heretek-openclaw-core
   ```
3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/heretek/heretek-openclaw-core.git
   ```
4. **Install dependencies**
   ```bash
   npm install
   ```

## Development Setup

### Prerequisites

- Node.js 20+
- npm 9+
- Git
- Docker (for integration tests)

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit with your settings
nano .env
```

### Running Locally

```bash
# Development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

## Making Changes

### Branch Naming

Use descriptive branch names:

```
feature/add-new-skill
fix/gateway-memory-leak
docs/update-api-reference
refactor/improve-error-handling
```

### Making Commits

1. **Create a branch** from `main`
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make focused commits**
   - Each commit should do one thing
   - Write clear commit messages
   - Test before committing

3. **Keep your branch updated**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

## Pull Requests

### Before Submitting

- [ ] Tests pass locally
- [ ] Code is linted
- [ ] Documentation is updated
- [ ] Changes are tested

### PR Description

Use the PR template and include:

- **What** changes are being made
- **Why** the changes are needed
- **How** the changes were tested
- **Related issues** (if any)

### Review Process

1. **Automated checks** must pass
2. **Code review** by maintainers
3. **Address feedback** promptly
4. **Squash commits** if requested

## Testing

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# With coverage
npm run test:coverage
```

### Writing Tests

- Write tests for new features
- Update tests when fixing bugs
- Aim for meaningful coverage
- Test edge cases

### Test Types

| Type | Location | Purpose |
|------|----------|---------|
| Unit | `tests/unit/` | Test individual functions |
| Integration | `tests/integration/` | Test component interactions |
| E2E | `tests/e2e/` | Test full user flows |
| Skills | `tests/skills/` | Test skill execution |

## Code Style

### JavaScript/TypeScript

- Use ESLint configuration provided
- Prefer `const` over `let`
- Use meaningful variable names
- Add JSDoc comments for public APIs

```javascript
/**
 * Calculate agent health status
 * @param {Object} agent - Agent instance
 * @returns {Object} Health status
 */
function calculateHealth(agent) {
  const metrics = collectMetrics(agent);
  return {
    status: metrics.status,
    score: metrics.score
  };
}
```

### Formatting

- Use Prettier for consistent formatting
- 2 spaces for indentation
- Single quotes for strings
- Semicolons required

```bash
# Format code
npm run format

# Check formatting
npm run format:check
```

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Test additions/changes
- `chore:` Build/config changes

### Examples

```
feat(agents): add historian agent for memory management

Implements the historian agent responsible for long-term
memory consolidation and decision tracking.

Closes #123
```

```
fix(gateway): resolve WebSocket connection timeout

Increased timeout from 5s to 30s for slow connections.

Fixes #456
```

```
docs(api): update A2A protocol documentation

Added examples for new message types and clarified
error handling procedures.
```

## Documentation

### Writing Documentation

- Use clear, concise language
- Include examples where helpful
- Link to related documentation
- Keep headings hierarchical

### Documentation Structure

```
docs/
├── getting-started/
├── architecture/
├── configuration/
├── operations/
└── api/
```

## Release Process

### Version Numbering

We use [Semantic Versioning](https://semver.org/):

- `MAJOR.MINOR.PATCH`
- Breaking changes → increment MAJOR
- New features → increment MINOR
- Bug fixes → increment PATCH

### Release Checklist

- [ ] Update version in package.json
- [ ] Update CHANGELOG.md
- [ ] Create git tag
- [ ] Publish to npm (if applicable)
- [ ] Create GitHub release

## Questions?

- **General questions:** GitHub Discussions
- **Bug reports:** GitHub Issues
- **Security issues:** Email security@heretek.ai

---

Thank you for contributing to Heretek OpenClaw! 🦞
