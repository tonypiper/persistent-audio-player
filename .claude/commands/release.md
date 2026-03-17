Release a new version of the plugin.

## Steps

1. Run `npm run build` to ensure the project compiles cleanly. Stop if it fails.

2. Look at the git log since the last tag to determine what changed:
   ```
   git log $(git describe --tags --abbrev=0)..HEAD --oneline
   ```

3. Determine the version bump type. Default to `patch` unless the changes clearly warrant `minor` (new features) or `major` (breaking changes). Confirm with the user before proceeding.

4. Update `CHANGELOG.md`: add a new section at the top (after the `# Changelog` heading) with the new version number and a concise summary of changes. Do not include merge commits or version-bump commits.

5. Run `npm version <patch|minor|major>` — this bumps `package.json`, runs `version-bump.mjs` (which updates `manifest.json` and `versions.json`), stages all version files plus `CHANGELOG.md`, and creates the commit and tag.

6. Push the commit and tag:
   ```
   git push && git push --tags
   ```
   This triggers the GitHub Actions release workflow which builds the plugin and creates a GitHub release with notes from the changelog.

7. Report the new version number and confirm the tag was pushed.
