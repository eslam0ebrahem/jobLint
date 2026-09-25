# LinkedIn and Indeed browser fixtures

These fixtures are sanitized DOM snapshots used by `tests/browser-fixtures.test.ts` and the local fixture inspector. They exercise detector boundaries without contacting LinkedIn or Indeed.

## Capture workflow

1. Open the supported page in a browser and capture only the smallest HTML region needed to reproduce the layout.
2. Preserve the structural hooks the detector uses: platform-specific classes, `data-testid` values, `data-jk`/job identifiers, canonical URL shape, and realistic surrounding noise.
3. Remove scripts, stylesheets, network references, inline event handlers, and third-party resources. Keep JSON-LD only when it is part of the behavior being tested.
4. Replace names, companies, locations, IDs, copy, and URLs with fictional values. Never reuse a real person's profile, email, token, cookie, session value, or tracking identifier.
5. Add the required `<meta name="fixture-url" content="https://…">` value and a `<base href="…">` when relative links are needed.
6. Name the file `linkedin-…` or `indeed-…` and describe the variant (`detail`, `search`, `consent`, `sign-in`, `expired`, or `missing-company`).
7. Add a focused assertion to `tests/browser-fixtures.test.ts` and a classification to `tests/fixtures/expected.json`.

## Review checklist

- The fixture is fictional, minimized, and contains no secrets or personal data.
- The expected result is explicit: detail extraction, discovery cards, or no result.
- The card boundary is tested for search pages; unrelated headings and neighboring cards must not leak into results.
- Blocked states must not produce an incomplete job.
- The test passes without network access.
- `npm run verify:fixtures` passes and, in GitHub Actions, writes a fixture-contract table to the step summary and a marked pull-request comment.
- `npm run inspect:fixtures` shows the intended source and extracted fields.

## Local commands

From `extension/`:

```bash
npm test -- tests/browser-fixtures.test.ts
npm run verify:fixtures
npm run inspect:fixtures
```

The inspector runs the actual detector and discovery modules in jsdom and serves a local-only comparison page. Its generated report is written under `.output/` and is intentionally not committed. `npm run test:visual` locks the inspector's detail, discovery, and blocked states with cross-platform ARIA snapshots.
