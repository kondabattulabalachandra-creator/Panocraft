# Luxee360 Studio QA checklist

## Repeatable manual checks

Run `npm ci`, `npm run typecheck`, and `npm run build`. Serve the production output with `npm run preview` and open the app at the repository base path `/Panocraft/`.

1. **Import and persistence:** load at least two local panorama files; select scenes, reload, and confirm scene records and image pixels are present.
2. **Hotspots:** place a marker, set its label/destination and pitch/yaw, reposition it, duplicate/delete it, then follow it in preview. Confirm markers are unique after viewer load and that destination links resolve to stable scene IDs. Change icon/tint/size/opacity/rotation; try advanced axis rotation, 2D/floor/wall placement, zoom scaling, label size/colors/formatting/alignment, shadow, hover-only, and force-2D. Exercise no-action, scene navigation, HTTP(S) link, and information actions.
3. **Project backup:** export a `.luxe360.json`, import it back with confirmation, and verify scene names, image data, links, locations, and start scene.
4. **Standalone website:** export the tour ZIP; verify one uniquely named panorama asset per scene, all scene definitions and hotspots in `tour.json`, and the required `index.html`, `vendor/pannellum.js`, `vendor/pannellum.css`, `vendor/tour.css`, and `vendor/PANNELLUM-LICENSE.txt`. Include colliding titles such as `A`, `A-2`, `A-2-5`, `A`, `A-2` and confirm none of the generated asset paths overlap. Compare source and extracted panorama SHA-256 hashes to confirm original bytes are unchanged. Test the ZIP from a static HTTP server and follow every navigation hotspot. Confirm disconnected scenes trigger a preflight warning, invalid navigation destinations block export instead of disappearing, and non-2:1 images prompt a stitched-panorama check.
5. **Responsive layout:** inspect narrow phone, tablet, and desktop widths. Confirm bottom navigation opens scene/property panels without horizontal page overflow.
6. **Google publishing:** without a configured public OAuth client ID and valid coordinates, verify that authorization/publish controls remain unavailable. With a separately configured test Google project, test consent and API errors. Do not send a real photo unless the user explicitly configures and initiates that action.

## Recorded run: 2026-10-22

**Build.** `npm run typecheck`, `npm run build`, and `git diff --check` passed. Vite emitted a 356,249-byte initial JavaScript bundle (108.01 kB gzip), a 53,347-byte stylesheet (12.31 kB gzip), and a 167,370-byte tour-export chunk (52.63 kB gzip). The tour-export chunk was absent from initial resource requests and loaded only after the ZIP export action. The build completed without the previous oversized-chunk warning. No external Google Fonts URLs remain in the emitted build.

**Hotspot editor.** The saved sample tour loaded with three scenes and four original links. After the Pannellum load guard, each scene displayed exactly its configured markers; selecting a marker did not create an extra one. A new marker was placed on the panorama canvas, edited to label `QA connection`, linked to `Service counter`, and assigned yaw/pitch values. Duplicate, reposition, and delete actions updated the marker count and coordinates. Preview navigation opened the correct destination scene, with one marker rendered for that scene and no viewer error. Keyboard `H` and `V`, Escape, undo, and redo were also exercised.

**Persistence and exports.** A project backup containing three scenes and embedded image data was exported, restored through the app import handler, and autosaved. Reloading the page retained three scenes, five hotspots, and all three thumbnails. The standalone ZIP contained three panorama files, three scene definitions, five valid navigation links, Pannellum JavaScript/CSS, and the Pannellum MIT notice. ZIP asset paths and destination scene IDs validated successfully.

**Responsive and console checks.** Same-origin production-preview frames at 360, 390, 768, and 1024 CSS pixels had no horizontal overflow. Scene/property bottom navigation opened the expected panel at phone/tablet widths; desktop sidebars remained present. Browser console showed no errors during the final production flow.

**Google preflight.** The local project had no OAuth client ID and no scene coordinates. The panel reported 0/3 scenes ready and kept authorization and publication disabled. No Google authorization, upload, or publication was attempted.

**Deployment verification.** Commit `f961079` was deployed by GitHub Actions run [`39745275677`](https://github.com/kondabattulabalachandra-creator/Panocraft/actions/runs/39745275677), which completed successfully. The cache-busted public URL <https://kondabattulabalachandra-creator.github.io/Panocraft/?cb=f961079> loaded the dark editor, Luxe Growth logo, and saved three-scene tour. The root, `/Panocraft/assets/index-sJeF0gZZ.js`, `/Panocraft/assets/index-CTqB650a.css`, and `/Panocraft/assets/luxeegrowth-logo-CVnH6Xp3.jpeg` each returned HTTP 200 with HTML, JavaScript, CSS, and JPEG MIME types respectively. Browser console was clean. On the hosted build, the sample hotspot count remained one after selection, preview navigation reached Main showroom, and the lazy export chunk loaded only after the ZIP action. The downloaded ZIP contained three scenes, four valid sample links, local images, viewer assets, and the Pannellum license notice.


## Priority walkthrough-direction check

1. In room A, place a default floor-arrow connection to room B and verify its arrow is visibly floor-tilted and stays at its selected panorama position.
2. Add a reciprocal hotspot from room B back to room A. Follow A→B in preview and verify the initial view in B faces toward that return hotspot; follow B→A and verify the reverse direction.
3. Remove the reciprocal connection in B and verify automatic arrival falls back to the opposite of the exit yaw. Disable automatic facing on one A→B hotspot, set arrival yaw/pitch, and verify only that connection uses the custom direction.
4. Create two different links into room B with different manual directions; verify each link preserves its own direction across reload, project backup restore, and standalone ZIP export.

## Thumbnail-to-panorama connections

1. Drag a non-active scene card from the left rail onto several distinct points in the panorama. Confirm the selected source scene receives a navigation hotspot for exactly the dragged destination and that yaw/pitch match the drop location.
2. Drag the active scene card from the left rail onto its own panorama. Confirm a clear rejection and no self-link is created.
3. Drag a thumbnail onto another scene card and confirm existing scene-reorder behavior still works.
4. Choose **Add connection**, click a point in the panorama, and verify the new connection has no automatic destination. Select a destination in the inspector and confirm it becomes a valid navigation connection. Check this flow at narrow/mobile widths where drag-and-drop may not be available.

## Recorded run: 2026-10-22 — drag/drop and regression review

**Hosted deployment.** Commit `d48c5df` deployed through GitHub Actions run [39751302027](https://github.com/kondabattulabalachandra-creator/Panocraft/actions/runs/39751302027), which completed successfully. The cache-busted hosted page at <https://kondabattulabalachandra-creator.github.io/Panocraft/?cb=d48c5df> rendered the editor and sample scenes. HTML, `/Panocraft/assets/index-CZ-euxvc.js` (381,505 bytes, `application/javascript`), `/Panocraft/assets/index-DM4A-U1A.css` (65,477 bytes, `text/css`), and the Luxe Growth logo (64,719 bytes, `image/jpeg`) returned HTTP 200. Browser console was empty before the interaction checks.

**Hosted drag/drop.** Dropping the `Main showroom` scene card onto the `Store entrance` panorama activated the drop overlay and created a second hotspot with the `Main showroom` label, a valid destination ID, and navigation action. A drop of the active scene onto its own panorama was rejected with “A scene cannot connect to itself” and did not increase the marker count. The click-placement fallback created a `New connection` with no destination and action `none`; selecting `Main showroom` changed it to a navigation hotspot. The temporary links were deleted afterward. Dragging `Service counter` onto `Store entrance` reordered the list, and the original order was restored using the move controls. No panorama viewer error appeared.

**Local production regression checks.** On the merged `d48c5df` working tree, `npm run typecheck`, `npm run build`, and `git diff --check` passed. A saved Force 2D test marker with a 60° X-axis setting rendered with `rotate(0deg) scale(var(--addon-zoom, 1))`, with no perspective or X/Y/Z 3D rotation. Backup imports with duplicate scene IDs and duplicate hotspot IDs were both rejected with specific errors; the existing three-scene project remained intact. A fresh standalone ZIP contained 12 entries, six test hotspots, the Force 2D flag and runtime branch, Pannellum JS/CSS, and the Pannellum license notice. Temporary local test hotspots were then removed, restoring the sample counts to 1/2/1.


## Professional workspace redesign

1. On desktop, confirm the top-left Luxe Growth logo and Luxee360 Studio name appear alongside project name, undo/redo, local save status, Save, Export, and Preview; verify the Export button downloads the standalone ZIP.
2. Collapse and reopen the scene sidebar. Confirm the viewer expands into the freed space, no separate bottom strip appears, and the left rail has only one **Import photos** control before and after scenes are added.
3. Confirm there is no bottom horizontal photo strip. Select scenes from the left rail, then drag a non-active scene card onto the panorama. Confirm exact-position placement and correct destination; on narrow widths open **Scenes** from bottom navigation to switch scenes.
4. Select a hotspot and use **Duplicate hotspot**. Confirm the copy is selected, preserves destination/action/appearance, and receives a visible offset. Confirm an empty source label produces a readable “Hotspot copy” label.
5. Switch between dark and light themes and verify the brand palette, Manrope interface text, Playfair Display headings, logo, toolbar, and sidebar controls remain legible.
6. Select a hotspot and trigger repeated appearance/selection redraws; verify every marker retains exactly one icon and at most one label, including with an uploaded custom image.

## Recorded run: 2026-10-22 — mobile workspace grid regression

**Build and base path.** `npm run typecheck`, `npm run build`, and `git diff --check` passed. The production preview served `/Panocraft/` with HTTP 200 and rendered the sample tour.

**Responsive check.** At 360px and 768px, `.workspace` and `.scene-strip` measured the full viewport width and document/body widths equaled the viewport, with no horizontal page overflow. The bottom navigation opened Scenes, switched to Details, and returned to Editor with both side panels closed. At 1024px the desktop three-column workspace and sidebars remained present. The production build was tested in same-origin browser frames.


## Recorded run: 2026-10-22 — complete tour export integrity

**Build and collision regression.** On the local production build, `npm run typecheck`, `npm run build`, and `git diff --check` passed. The deterministic scene-title sequence `A`, `A-2`, `A-2-5`, `A`, `A-2` previously produced only four unique panorama paths for five scenes. After the slug-allocation fix, all five paths were unique and every extracted SHA-256 matched its source bytes. An uppercase `IMAGE/PNG` MIME value also produced a `.png` asset path. The audit harness confirmed four valid navigation links, reported disconnected and non-2:1 scenes as warnings, and rejected an invalid navigation destination.

**Editor preflight and ZIP integrity.** In the local production preview, a temporary 512×512 PNG produced both the non-2:1 and unreachable-scene warnings. Canceling the confirmation created no ZIP; continuing produced a four-scene ZIP with four hotspots and four valid navigation links. Each of the four extracted panorama hashes exactly matched its IndexedDB source, and every panorama was stored without ZIP compression. The original three-scene sample project was restored afterward.

**Standalone runtime.** The three-scene export included all 12 expected files, returned HTTP 200 for Pannellum JavaScript/CSS, tour CSS, and `tour.json`, and rendered on a local static HTTP server. Following the `Enter showroom` hotspot navigated to the next scene and displayed its two hotspots. The browser console reported no errors.
