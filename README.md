# Luxe360 Studio

Luxe360 Studio is a local-first, browser-based 360° tour editor. Core editing works without an account, backend, subscription, or a paid API. Original panorama files are kept in the current browser and are not uploaded unless you explicitly use Google publishing.

## Features

- Import multiple JPG/JPEG, PNG and WebP panorama files.
- Inspect image dimensions and identify likely 2:1 equirectangular panoramas.
- Arrange scenes; set a start scene; rename and remove scenes.
- Place directional navigation hotspots at actual spherical yaw/pitch positions.
- Connect hotspots to other scenes, label them, reposition, duplicate and delete them.
- Preview navigation between the linked scenes.
- Undo/redo primary scene and hotspot operations.
- Autosave editable project data and image blobs in IndexedDB.
- Export/import a portable `.luxe360.json` backup with all image data embedded.
- Export a standalone static tour ZIP with panorama files and a bundled Pannellum viewer.
- Optional Google Street View Publish API flow using OAuth, XMP-tagged JPEG derivatives, GPS preflight and connection updates.
- Responsive layout with scene list, panorama editor and context-aware inspector.

## Requirements and local development

- Node.js 20+ and npm.
- A modern browser with IndexedDB, Canvas, Blob and WebGL support.

```bash
npm install
npm run dev
```

Build and preview the production bundle:

```bash
npm run build
npm run preview
```

`vite.config.ts` uses the relative base `./` so assets can work from GitHub Pages repository paths.

## GitHub Pages publishing

1. Create a GitHub repository and push this project's source to the `main` branch.
2. In **Settings → Pages**, choose **GitHub Actions** as the build/deployment source.
3. The workflow in `.github/workflows/deploy.yml` installs packages, builds the Vite app and deploys the `dist` folder.
4. Read the completed workflow run and **Settings → Pages** for the public URL.
5. If enabling Google publishing, register that exact website origin in Google Cloud Console.

## Saving and privacy

The editor stores project records and image blobs in IndexedDB in the current browser profile. Local work does not sync between devices. Clearing site data or using a different browser/profile can remove access to the local copy; export a project backup regularly and keep it somewhere safe. Project JSON exports embed image data and can be large. The original photos are not modified by local tour editing.

## Google Street View publishing setup

Google publishing is a separate workflow from standalone ZIP export. To use it:

1. Select or create a project in Google Cloud Console.
2. Enable the Street View Publish API.
3. Configure the OAuth consent screen.
4. Create an OAuth 2.0 Web application client.
5. Add the exact origin for your deployed website to **Authorized JavaScript origins**.
6. Paste the public client ID into the Google publishing panel. Never paste a client secret.
7. Enter valid latitude and longitude for each scene, check that each image is a true full 360° 2:1 equirectangular panorama, then authorize and submit.

The access token is held in memory for the current tab and is not stored in IndexedDB. The app prepares an upload JPEG with Photo Sphere XMP tags; this metadata cannot turn an ordinary photograph into a real spherical panorama. Google can reject, process later, or decline to surface submitted images publicly. Review API results and verify final photo status in Google Maps/Street View.

The current implementation uses the image heading for the XMP heading field; double-check orientation and location before uploading. Indoor scenes may share a business coordinate, but position/orientation should accurately represent the capture setup. Publishing to Google is not available without the user's own authorized OAuth configuration.

Official docs:

- https://developers.google.com/streetview/publish
- https://developers.google.com/streetview/publish/authorizing
- https://developers.google.com/streetview/publish/reference/rest/v1/photo/startUpload
- https://developers.google.com/streetview/spherical-metadata

## Standalone tour export

The ZIP contains `index.html`, `tour.json`, local Pannellum viewer assets, a small stylesheet, and the panorama files. Keep the internal relative paths intact. Host the folder on a static host or serve it from a local HTTP server when browser security restrictions block `file://` resources. This is a static tour website, not a Google Maps upload.

## Troubleshooting

- **Blank viewer:** check the image is readable and use a supported JPG/PNG/WebP file. Very large panoramas may exceed GPU/browser texture limits.
- **Unusual proportions:** a full equirectangular panorama is commonly 2:1. A 2:1 ratio is a useful check, not proof that an image contains a full 360° view.
- **Save error:** export a backup and check browser storage permissions/private-browsing restrictions.
- **OAuth error:** confirm the API is enabled, the correct web client is in use, consent is configured, and the authorized origin matches exactly.
- **Google rejects the image:** inspect the complete API error and confirm that the source actually covers a full sphere. Metadata alone cannot make it so.
- **Moving projects:** export `.luxe360.json` on one device and import it on the other. Browser data does not sync automatically.

## Third-party licenses

This project bundles Pannellum and JSZip. Review their respective license terms before redistribution or commercial bundling. The product does not use another tour editor's branding.
