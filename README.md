# Luxe360 Studio

Luxe360 Studio is a local-first, browser-based 360° tour editor. It imports equirectangular panorama images, connects scenes with spherical navigation hotspots, and produces portable project backups or standalone tour websites. Core editing requires no account or paid API. The app uses the Luxe Growth brand asset supplied for this project and opens in dark mode.

## What it does

- Import multiple JPG/JPEG, PNG, and WebP images and inspect dimensions/aspect ratios.
- Arrange, rename, remove, and select the start scene.
- Place, label, connect, reposition, duplicate, and delete navigation hotspots with pitch/yaw coordinates.
- Preview scene-to-scene navigation in an interactive Pannellum viewer.
- Undo/redo edits; use `Ctrl/⌘+Z`, `Ctrl/⌘+Shift+Z` or `Ctrl/⌘+Y`, `V` for select, `H` for hotspot placement, and `Esc` to leave preview or close panels.
- Autosave scenes and original image blobs to this browser's IndexedDB.
- Export/import `.luxe360.json` project backups and export standalone tour ZIPs.
- Switch between the default dark workspace and light mode. The selected appearance is stored locally.
- Optionally prepare and submit panoramas through the Google Street View Publish API using the user's own OAuth client, valid coordinates, and full-sphere source images.

This is a tour assembly/editor, not a photo stitcher or retouching tool. It does not create a full sphere from an ordinary photograph. A 2:1 ratio is only a preflight hint; it is not proof of complete 360° coverage.

## Requirements and local development

Use Node.js 20 or newer and npm. The browser needs IndexedDB, Canvas, Blob, and WebGL support.

```bash
npm ci
npm run dev
```

Run the type check and production build before publishing:

```bash
npm run typecheck
npm run build
npm run preview
```

The GitHub Pages project deployment uses `/Panocraft/` as the Vite base path. The workflow in `.github/workflows/static.yml` builds the `dist` directory with Node.js 20 and deploys that artifact. Pages must use **GitHub Actions** as its source. The live project URL is <https://kondabattulabalachandra-creator.github.io/Panocraft/>.

## Saving and privacy

Project records and image blobs are saved in IndexedDB in the current browser profile. They do not sync to another device. Clearing site data, using private browsing, or changing browser profiles may make local work unavailable. Export a `.luxe360.json` backup regularly. A backup embeds the original images and can be large. Editing does not overwrite the source photos.

The editor does not upload images during local editing, preview, or project backup. Google publishing is an explicit, separate user action that sends a prepared JPEG to Google's API after OAuth authorization.

## Build a tour

1. Import two or more panorama photos, or select **Try sample tour** to explore the editor.
2. Select a scene. Choose **Add hotspot** (or press `H`) and click the panorama where the navigation marker should sit.
3. In the inspector, set the label and destination. Adjust yaw and pitch numerically or use **Reposition in panorama**.
4. Use **Preview tour** and follow a marker to check navigation.
5. Export a `.luxe360.json` backup for editing later, or export a standalone tour ZIP to host as a static website.

Detailed instructions and known limitations are in the [user guide](docs/USER_GUIDE.md). The responsive and hotspot feature comparison is in the [Kuula feature-gap matrix](docs/FEATURE_GAP_MATRIX.md). QA steps and current results are tracked in [tests/manual-qa.md](tests/manual-qa.md) and [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md).

## Google Street View publishing

Google publishing is distinct from static website export and is optional. It requires the user's Google Cloud project, Street View Publish API enablement, OAuth consent setup, a public OAuth web client ID, and the exact deployed website origin added as an authorized JavaScript origin. Never paste a client secret or access token into the app. Each scene also needs valid latitude and longitude and a true 2:1 full-sphere equirectangular source.

The app adds Photo Sphere XMP metadata to a JPEG derivative; metadata cannot make a partial or ordinary photo into a real 360° panorama. Google may reject, process later, or not surface submitted images. Confirm final status in Google Maps/Street View. No live publishing has been performed as part of this repository QA.

Official documentation:

- [Street View Publish API](https://developers.google.com/streetview/publish)
- [Authorization](https://developers.google.com/streetview/publish/authorizing)
- [Starting photo upload](https://developers.google.com/streetview/publish/reference/rest/v1/photo/startUpload)
- [Spherical metadata](https://developers.google.com/streetview/spherical-metadata)

## Standalone tour export

The ZIP includes `index.html`, `tour.json`, panorama files, a local Pannellum viewer, a small tour stylesheet, and the Pannellum MIT notice. Keep the relative paths intact. Extract and host the files on a static web server; some browsers restrict viewer assets opened directly through `file://`. A tour ZIP is not a Google Maps upload.

## Troubleshooting

- **GitHub Pages is blank:** confirm the Pages workflow succeeds, uploads the `dist` artifact, and that `vite.config.ts` still sets `base: '/Panocraft/'`. Inspect the deployed `/Panocraft/assets/...` requests; a source `index.html` pointing to `./src/main.tsx` is not a production build.
- **Viewer is blank or errors:** use a readable JPG/PNG/WebP image; unusually large images may exceed browser/GPU texture limits. Check the browser console and verify the image itself contains panorama pixels.
- **Save error:** export a backup and check browser storage permissions and private-browsing restrictions.
- **Google OAuth/API error:** check API enablement, consent configuration, authorized origin, OAuth client type, image dimensions, and coordinates. Use the complete Google error message.
- **Moving projects:** export and import a `.luxe360.json` backup. Local browser data does not sync automatically.

## License and notices

No license has been selected for Luxe360 Studio's original source or the supplied brand asset; do not assume that either is released under an open-source license. Bundled third-party components and their exact license texts are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).