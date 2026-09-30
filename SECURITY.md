# Security Policy

## Supported versions

Security fixes are provided for the latest tagged release.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub Security Advisories for
this repository. Do not include secrets, API keys, or private Session content
in an issue.

## Security boundary

The Host operation that creates directories is exposed as exact Fetch routes
under DSH's shared `/api` Connection channel, behind its Host/Origin fence and
browser authentication. It accepts no path from
the browser: the root is Host configuration and all generated child names are
fixed-format date/time values plus cryptographic randomness.
