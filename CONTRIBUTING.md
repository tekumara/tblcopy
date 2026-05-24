# Contributing

## Tests

Run the test suite:

```bash
npm test
```

## Release flow

- Push conventional commits to `main` such as `feat: ...` and `fix: ...`.
- `.github/workflows/release-please.yml` opens or updates the release PR.
- Merging that PR creates the tag and GitHub Release.
- The publish workflow then publishes the package to npm from the `release.published` event.
