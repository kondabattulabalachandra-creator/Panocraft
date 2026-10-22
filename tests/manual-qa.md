# Luxe360 Studio QA checklist

Run locally with `npm install && npm run dev`. The application uses browser APIs, so exercise file operations in a real browser.

## 1. Import and save (critical)
1. Import at least two local JPG or PNG panorama files.
2. Select the second scene and check the scene name, dimensions and thumbnail.
3. Reload the page.
4. Confirm scenes and local panorama pixels remain present.

Expected: both scenes survive refresh and can be opened again.

## 2. Hotspot workflow
1. Import at least two panoramas.
2. Choose **Add hotspot** and click the panorama.
3. Set the destination scene and label in the inspector.
4. Select **Reposition in panorama** and click a new location.
5. Use undo and redo, then remove the hotspot.
6. Preview and follow another saved hotspot in a sample tour.

Expected: hotspots use spherical pitch/yaw and stable scene IDs. Removing a target scene also removes inbound links.

## 3. Backup/restore
1. Create a connected tour.
2. Export a `.luxe360.json` backup.
3. Import it back and confirm replacement.

Expected: scene image data, scene names, start scene, location fields and hotspot targets are restored.

## 4. Standalone tour package
1. Load the sample tour.
2. Export standalone tour ZIP.
3. Inspect the ZIP for `index.html`, `tour.json`, `vendor/pannellum.js`, `vendor/pannellum.css`, `vendor/tour.css`, and image files.
4. Host/extract the folder using a local HTTP server and navigate between scenes.

Expected: exported tour runs independently of the editor and uses only relative local assets.

## 5. Google preflight and mobile
1. On a mobile viewport, open Google publishing.
2. Load a project without valid location values and try to publish.
3. Confirm the app refuses to start submission with a visible warning.
4. Configure a Google OAuth web client in a test environment; grant or reject consent and verify the visible response.

Expected: invalid scenes are blocked; denied consent or API failures do not create false success messaging.
