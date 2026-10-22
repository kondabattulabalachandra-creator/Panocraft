# Luxe360 Studio QA checklist

## Repeatable manual checks

Run `npm ci`, `npm run typecheck`, and `npm run build`. Serve the production output with `npm run preview` and open the app at the repository base path `/Panocraft/`.

1. **Import and persistence:** load at least two local panorama files; select scenes, reload, and confirm scene records and image pixels are present.
2. **Hotspots:** place a marker, set its label/destination and pitch/yaw, reposition it, duplicate/delete it, then follow it in preview. Confirm markers are unique after viewer load and that destination links resolve to stable scene IDs.
3. **Project backup:** export a `.luxe360.json`, import it back with confirmation, and verify scene names, image data, links, locations, and start scene.
4. **Standalone website:** export the tour ZIP, confirm `index.html`, `tour.json`, local panorama files, `vendor/pannellum.js`, `vendor/pannellum.css`, `vendor/tour.css`, and `vendor/PANNELLUM-LICENSE.txt`, then test it from a static HTTP server.
5. **Responsive layout:** inspect narrow phone, tablet, and desktop widths. Confirm bottom navigation opens scene/property panels without horizontal page overflow.
6. **Google publishing:** without a configured public OAuth client ID and valid coordinates, verify that authorization/publish controls remain unavailable. With a separately configured test Google project, test consent and API errors. Do not send a real photo unless the user explicitly configures and initiates that action.

## Recorded run: 2026-10-22

**Build.** `npm run typecheck`, `npm run build`, and `git diff --check` passed. Vite emitted a 356,249-byte initial JavaScript bundle (108.01 kB gzip), a 53,347-byte stylesheet (12.31 kB gzip), and a 167,370-byte tour-export chunk (52.63 kB gzip). The tour-export chunk was absent from initial resource requests and loaded only after the ZIP export action. The build completed without the previous oversized-chunk warning. No external Google Fonts URLs remain in the emitted build.

**Hotspot editor.** The saved sample tour loaded with three scenes and four original links. After the Pannellum load guard, each scene displayed exactly its configured markers; selecting a marker did not create an extra one. A new marker was placed on the panorama canvas, edited to label `QA connection`, linked to `Service counter`, and assigned yaw/pitch values. Duplicate, reposition, and delete actions updated the marker count and coordinates. Preview navigation opened the correct destination scene, with one marker rendered for that scene and no viewer error. Keyboard `H` and `V`, Escape, undo, and redo were also exercised.

**Persistence and exports.** A project backup containing three scenes and embedded image data was exported, restored through the app import handler, and autosaved. Reloading the page retained three scenes, five hotspots, and all three thumbnails. The standalone ZIP contained three panorama files, three scene definitions, five valid navigation links, Pannellum JavaScript/CSS, and the Pannellum MIT notice. ZIP asset paths and destination scene IDs validated successfully.

**Responsive and console checks.** Same-origin production-preview frames at 360, 390, 768, and 1024 CSS pixels had no horizontal overflow. Scene/property bottom navigation opened the expected panel at phone/tablet widths; desktop sidebars remained present. Browser console showed no errors during the final production flow.

**Google preflight.** The local project had no OAuth client ID and no scene coordinates. The panel reported 0/3 scenes ready and kept authorization and publication disabled. No Google authorization, upload, or publication was attempted.

**Deployment status for this run.** The Pages deployment at commit `c6fb2c5` had previously completed successfully and loaded at the repository URL with compiled `/Panocraft/assets/...` requests. The fixes recorded above are newer local changes and still require a successful main-branch Actions deployment and a fresh hosted-page verification before release. See [`docs/RELEASE_CHECKLIST.md`](../docs/RELEASE_CHECKLIST.md).