# Working on Biblio

Follow the rules in [CONTRIBUTING.md](CONTRIBUTING.md), especially the requirement to keep shared
app features, the demo, and the setup/builder flow in sync. For now the owner's app is the basis for
the template: everything in `apps/web` and `packages/core` is shared, and the website, its captures,
and the setup flow follow it. Owner-only features, when the owner asks for one, go in
`apps/web/src/custom/` (see [docs/EXTENDING.md](docs/EXTENDING.md)). Check for source/deployment
divergence before recording or deploying.
