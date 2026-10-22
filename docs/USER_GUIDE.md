# Luxe360 Studio user guide

## Start a project

Open the editor in a modern browser. Use **Try sample tour** to explore a three-scene walkthrough without supplying photos. To begin with your own images, choose **Import panoramas** or **Add photos** and select JPG/JPEG, PNG, or WebP files. The app reads image dimensions locally. A ratio near 2:1 is a helpful check for an equirectangular panorama, but it does not prove that the source covers a complete sphere.

Scenes appear in the left panel. Select one to edit it, use its quick controls to move it in the list, and use the inspector to rename it or set it as the start scene. Removing a scene removes links pointing to that scene; it does not delete the original device file.

## Create and tune navigation hotspots

Drag a scene thumbnail from the sidebar onto the desired point in the panorama to create a connection directly. Panocraft highlights the viewer as a drop target and places the marker at that exact panorama position. A scene cannot connect to itself. If drag-and-drop is unavailable, choose **Add connection** (or press `H`), click the desired point, then choose the destination in the inspector. New connections do not choose a destination automatically. This thumbnail-to-panorama workflow follows the connection interaction demonstrated in [Kuula’s guide](https://kuula.co/help/connections).

New navigation markers use a tilted floor-arrow style by default; choose 2D or wall placement when that fits better. A hotspot stores spherical pitch and yaw values, so its position remains attached to the panorama as you look around. In the inspector:

- Give the marker a short label and choose a destination scene.
- In **Arrival view**, each connection can set its own starting camera direction. **Face back toward previous room automatically** uses a matching return hotspot in the destination when present, otherwise it turns back from the exit direction. Turn this off to enter an exact arrival yaw and pitch for that connection.
- Enter yaw and pitch for numeric placement. Pitch is clamped to the range −90° to 90°.
- Use **Reposition in panorama** to place it visually instead.
- In **Icon**, choose an arrow, information, pin, star, or camera marker, or upload a PNG, JPG, WebP, or GIF under 4 MB. Set its tint, width, height, opacity, and rotation; **Advanced** exposes per-axis rotation.
- Choose a 2D, floor, or wall display style and turn **Scale on zoom** on or off.
- Edit the label text and set its font size, text/background colors, bold/italic styling, and alignment. **Shadow**, **Only hover**, and **Force 2D** adjust marker presentation.
- Set **Action** to no action, navigate to a scene, open an HTTP(S) link, or show an information message. Link actions accept only web addresses.
- Duplicate or delete the selected marker as needed.

A navigation marker with no valid destination is flagged in the inspector and does not navigate in preview. Choose **Preview tour** to try the configured action and confirm that each linked room opens in its configured arrival direction. Use **Tiny planet** in the canvas toolbar to switch to a stereographic tiny-planet view; toggle it again to return to the normal panorama view. Exit preview to edit again.

## Keyboard and responsive controls

The editor supports `Ctrl+Z` / `⌘+Z` for undo, `Ctrl+Shift+Z` / `⌘+Shift+Z` or `Ctrl+Y` for redo, `V` for select mode, `H` for hotspot placement, and `Esc` to exit preview, reset selection mode, close the project menu, or dismiss an open mobile panel. Shortcuts are ignored while typing in text fields and selects.

At narrow widths, the scene and inspector panels are hidden until opened from the bottom navigation. The panorama workspace remains central. Use the **Scenes**, **Editor**, **Properties**, and **Google** bottom actions to move between mobile panels and work areas.

Use the sun/moon icon to switch between dark and light mode. Dark mode is the default; the selected theme is saved in the current browser profile.

## Saving, backups, and website export

Edits autosave to IndexedDB in the current browser profile. The status in the top bar reports whether local saving has completed. Use the top-bar **Save** button or **Project → Save now** to request an immediate save.

Use **Project → Export project backup** to download a `.luxe360.json` containing scene metadata, links, and embedded panorama bytes. This file can be moved to another device. **Project → Import project backup** replaces the current project only after confirmation.

Use **Project → Export standalone tour ZIP** to create a static website package. Extract the ZIP and serve it from a static HTTP server with the directory structure intact. The ZIP includes its panorama images, hotspot appearance/labels/actions, `index.html`, tour configuration, local Pannellum files, stylesheet, and Pannellum license notice. This is not a Google Maps upload.

## Optional Google Street View publishing

The **Google publishing** panel is a separate, user-initiated workflow. Before it can submit anything, configure a Google Cloud project, enable the Street View Publish API, set up OAuth consent, create a web OAuth client, and allow the exact deployed origin. Enter only the public client ID ending in `.apps.googleusercontent.com`; never enter a client secret. Authorization uses Google's consent screen and holds the returned access token in memory for the current tab.

Each scene must pass the app's 2:1 dimension check and have valid latitude and longitude. Confirm that the image really is a full 360° panorama and that the coordinates and heading reflect the capture. The app prepares a JPEG derivative with Photo Sphere metadata, uploads it, and can request links between successfully created photos. API acceptance does not guarantee that Google will publish or display a photo immediately. Check final processing status in Google Maps/Street View.

Do not use this publishing feature until you have configured your own Google API/OAuth project and reviewed Google's current terms and API requirements.

## Privacy and recovery

The editor's local import, editing, preview, autosave, and project export flows do not upload panorama files. Local project data is isolated to this browser profile and does not synchronize. Keep backups outside the browser, especially before clearing site data or moving devices. Google publishing is the explicit exception and sends data to Google's service after user authorization.

## Troubleshooting

- **Project shows no scenes after reopening:** confirm you are using the same browser profile and origin and that site storage is enabled. Restore a `.luxe360.json` backup if needed.
- **Hotspot appears twice or not at all:** use the current build, wait for the panorama viewer to finish loading, and reload once. Report any persistent duplicate to the project maintainers with browser details.
- **Image does not render:** confirm the file is readable and within browser/GPU limits. A panorama viewer cannot synthesize missing parts of a sphere.
- **Standalone ZIP is blank:** preserve all folders and relative paths, then serve the extracted files over HTTP rather than opening `index.html` directly with `file://`.
- **GitHub Pages shows a blank page:** check the latest Actions run, the `/Panocraft/` Vite base, and that the workflow deployed `dist`, not the repository root.
- **Google publishing is unavailable:** the feature needs your own API enablement, OAuth client and consent configuration, authorized website origin, supported imagery, and valid scene coordinates.
