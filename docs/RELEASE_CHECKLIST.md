# Luxe360 Studio release checklist

## Diagnosis and deployment repair

- [x] Inspect the existing Vite/React repository, package scripts/lockfile, Vite base, entry point, deployment workflow, and GitHub Pages project URL before changing files.
- [x] Confirm the GitHub Pages site is a project site at `/Panocraft/`; Vite production asset URLs must use that base.
- [x] Replace the source-root publishing workflow with a Node 20 Vite build that deploys only `dist` through GitHub Pages Actions; remove the duplicate workflow file.
- [x] Fix the TypeScript build blockers and Pannellum browser integration: load the UMD viewer as a side effect, use its browser global and supported `.on()` event API, and wait for viewer load before synchronizing hotspot DOM.
- [x] Run `npm ci`, `npm run typecheck`, `npm run build`, and `git diff --check` successfully.
- [x] Diagnose the empty live screen from code and browser evidence: Pages had to serve compiled Vite output under the repository subpath, not unbuilt TSX from the repository root. The initial successful deployment of the deployment repair is commit `c6fb2c5`.

## Product and documentation

- [x] Add the user-supplied Luxe Growth logo to the header and make dark mode the default, with a persistent light/dark toggle.
- [x] Add accessible labels and keyboard shortcuts for select, hotspot placement, undo/redo, and Escape.
- [x] Fix a Pannellum loading race that could render a hotspot both before and after panorama load.
- [x] Lazy-load the standalone ZIP exporter; initial JavaScript decreased from 523.97 kB to 356.25 kB, with the exporter in a separate 167.37 kB chunk. Remove the optional Google Fonts network request.
- [x] Add complete setup/privacy/export instructions, a user guide, QA results, license index and upstream license texts, and an attributed Kuula feature-gap matrix.
- [x] Preserve truthful boundaries: no copied competitor code/assets/brand; no full photo stitching/retouching claim; optional Street View publishing requires the user's own Google API/OAuth setup.

## QA results recorded

- [x] Production browser loaded a three-scene sample from `/Panocraft/` with no final console errors.
- [x] Add/edit/destination/pitch-yaw/reposition/duplicate/delete hotspot flow passed; preview navigation reached the selected destination.
- [x] Undo/redo and keyboard shortcuts passed.
- [x] Project JSON export, import, autosave, and reload persistence passed with three scenes, five hotspots, and image thumbnails.
- [x] Standalone tour ZIP validated: three local panoramas, five linked hotspots, viewer assets, and Pannellum license notice.
- [x] Responsive checks at 360, 390, 768, and 1024 CSS pixels showed no horizontal overflow; mobile scene/property panels opened.
- [x] Google preflight without OAuth/locations kept authorization and publish disabled; no external upload was initiated.
- [ ] Run the same checks on the newly pushed main-branch build and verify the public Pages site, HTTP asset responses, and browser console after Actions completes.
- [ ] Test a real Google consent/API flow only with a separately configured user-owned test project and explicit user action.

## Current known release notes

The source repository does not declare a license for original Luxe360 code or the supplied brand asset. Do not imply either is open source until the owner chooses a root `LICENSE`.

The local QA build passed, but only a GitHub Actions run and live browser check for the exact release commit can establish that the new changes are deployed. Google publication was not performed because this test has no OAuth client or scene locations.