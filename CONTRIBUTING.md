# Contributing to chatLibre

Thank you for your interest in contributing to chatLibre! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone. We do not tolerate harassment or discrimination of any kind.

## Getting Started

### Development Environment

**Server (Rust):**
```bash
cd server
cargo build
cargo test
cargo run
```

**Client (Tauri + React):**
```bash
cd client
npm install
npm run tauri dev
```

### Prerequisites
- Rust 1.75+
- Node.js 20+
- SQLite development libraries
- OpenSSL development libraries

## Development Workflow

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a feature branch** (`git checkout -b feature/my-feature`)
4. **Make your changes** and commit with clear, descriptive messages
5. **Push to your fork** 
6. **Open a Pull Request** against the `main` branch

## Commit Messages

Follow the Conventional Commits specification:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance tasks

## Security Considerations

When contributing to chatLibre, **security is paramount**:

### Cryptographic Code
- All cryptographic implementations must be reviewed by at least one maintainer with security expertise
- Use only established, audited cryptographic libraries (libsodium, ring)
- Never implement your own cryptography
- All PRs affecting crypto must include test vectors

### Data Handling
- Never log sensitive data (keys, plaintext messages)
- Ensure no sensitive data persists beyond necessary scope
- Validate all inputs from untrusted sources

### Testing
- Unit tests for all new functionality
- Integration tests for protocol flows
- Security-focused test cases

## Pull Request Checklist

- [ ] Code follows the project's style guidelines
- [ ] Self-reviewed and tested
- [ ] Documentation updated (if applicable)
- [ ] Tests added/updated
- [ ] No new compiler warnings
- [ ] Security considerations documented
- [ ] Branch is up to date with main

## Reporting Security Issues

**DO NOT** file public issues for security vulnerabilities.

Instead, please report them to:
1. Email: security@chatlibre.dev
2. Or use GitHub's private vulnerability reporting

Expected response time: 48 hours

## License

By contributing, you agree that your contributions will be licensed under the AGPL-3.0 license.

## Questions?

- GitHub Discussions: /discussions
- IRC: #chatlibre on irc.libera.chat
- Matrix: #chatlibre:chatlibre.dev

Thank you for contributing to a more private internet!
