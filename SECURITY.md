# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :warning: Alpha    |
| < 0.1   | :x: Not supported |

**Note:** chatLibre is currently in alpha. Production use is not recommended.

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **Email**: Send details to `security@chatlibre.dev`
2. **GitHub Private Reporting**: Use the "Report a vulnerability" button in the Security tab
3. **Encrypted Email** (preferred): Use our PGP key below

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)
- Version(s) affected

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution**: As quickly as possible based on severity

## Security Model

### Threat Model

chatLibre is designed to protect against:

| Threat | Protection |
|--------|------------|
| Server operator reads messages | E2EE - server never sees plaintext |
| Network eavesdropping | TLS transport + E2EE |
| Mass surveillance | No centralized metadata collection |
| Server compromise | Messages stored client-side only |
| Identity theft | Keypair is sole credential |

### What chatLibre Does NOT Protect Against

- Compromised client device
- Keylogger/malware on client
- Physical access to device
- Social engineering attacks

## Cryptographic Standards

### Identity
- **Algorithm**: Ed25519
- **Key Derivation**: BIP39 mnemonic (24 words)
- **Storage**: Client-side only

### Messaging
- **Algorithm**: X25519 key exchange + ChaCha20-Poly1305
- **Key Exchange**: Double Ratchet (Signal Protocol)
- **Signatures**: Ed25519

### File Encryption
- **Algorithm**: AES-256-GCM
- **Key**: Per-file random key, encrypted to recipient

### Network Transport
- **WebSocket**: WSS (TLS required)
- **WebRTC**: DTLS-SRTP

## Security Audits

chatLibre has not yet undergone a professional security audit. This is planned before v1.0.0 release.

Community audit contributions are welcome and will be credited.

## PGP Key

```
-----BEGIN PGP PUBLIC KEY BLOCK-----

[To be added]

-----END PGP PUBLIC KEY BLOCK-----
```

## Known Limitations

1. **No Multi-Device Support**: Currently, keys cannot be shared across devices securely
2. **No Key Recovery**: Lost keys cannot be recovered (by design)
3. **Single Server Trust**: Federation requires trusting server operators

These limitations are documented and planned for future improvements.

## Security Updates

Security updates are released as patch versions and announced via:
- GitHub Security Advisories
- Project mailing list
- Matrix/IRC channel

## Bounty Program

A bug bounty program will be established at v1.0.0 release. Details to follow.

---

Thank you for helping keep chatLibre secure!
