<!--
Keep the title in Conventional Commit form, e.g.

  feat(editor): add find and replace
  fix(desktop): restore tabs after an update
  chore(ci): cache pnpm store

The title is what appears in the generated release notes.
-->

## Summary

<!-- What changes, and why. One or two paragraphs. -->

## Related issues

<!-- Closes #123 -->

## Platforms affected

- [ ] Web
- [ ] Desktop (Windows / macOS / Linux)
- [ ] Mobile (Android / iOS)
- [ ] Shared packages
- [ ] Tooling / CI

## How this was tested

<!-- Commands run, platforms exercised, manual steps. -->

## Release impact

- [ ] No user-visible change
- [ ] Patch — bug fix, backwards compatible
- [ ] Minor — new functionality, backwards compatible
- [ ] Major — breaking change

<!-- If this is a breaking change, describe the migration below. -->

## Checklist

- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` passes
- [ ] Documentation updated where behaviour changed
