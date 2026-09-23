# Security

## Never store operational secrets in documentation

Documentation, examples, issues, logs, and screenshots must not contain real:

- passwords or password hashes;
- API, cloud, tunnel, or Git access tokens;
- SSH private keys or license keys;
- database connection strings containing credentials;
- private `.env` contents;
- authenticated URLs or embedded credentials;
- recovery codes, cookies, or session values.

Use variable names and neutral placeholders such as `<secret-manager-reference>` or
`<deploy-key-path>`. A placeholder must not resemble a usable credential.

If a credential has ever been committed, deleting the current file is not enough because
the value remains in Git history and existing clones. Revoke or rotate it first, then
decide whether repository-history cleanup is necessary.

## Repository protections

The repositories ignore `.env`, `.env.*` except `.env.example`, and `*.pem`. Keep example
files limited to safe local-development values. Before committing documentation or config,
review the diff and scan it for credential formats and private infrastructure data.

Deploy keys referenced by `BENCHMARKS_DEPLOY_KEY` or `RESULTS_DEPLOY_KEY` remain on the
backend host. Do not copy them into workers, images, or persistent result archives.

## Trust boundaries

Submitted tools and benchmark generators are untrusted code and are intended to run on
workers. The `local` backend is not isolated, and the local Docker backend is controlled by
a backend that has access to the host Docker socket. Worker images and node scripts must
not receive backend database credentials or host-side Git keys.

In the current VNN Docker paths, several wrappers classify private worker addresses as
backend-local, including typical local and remote Docker container addresses. Generator
setup, generation, and toolkit run wrappers can therefore execute against backend-container
paths; on `local_docker`, toolkit installation and post-installation are also skipped. The
backend has database configuration and the Docker socket, so these VNN paths are not
isolated from the backend.

The remote Docker worker service has state-changing endpoints and no built-in
authentication. Restrict it at the network layer or add an authenticated proxy. Treat its
port as an infrastructure control plane, not a public API.

Worker callback endpoints are intentionally simple so node scripts can report completion.
Expose only the required routes, use unpredictable external network boundaries where
possible, and monitor unexpected callback traffic. Callback identities are not
authenticated, so these routes are not hostile-network safe.

## Least privilege

- Run installation and toolkit scripts as an unprivileged user unless root is required.
- Limit cloud and Git credentials to the exact resources and operations needed.
- Use separate deployment identities for independent installations.
- Keep Django admin access limited to operators.
- Do not expose the Docker socket, SSH keys, or database ports to participant networks.
- Keep production secrets in a secret manager or protected deployment configuration, not
  in source control.
