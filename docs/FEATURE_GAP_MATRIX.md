# Feature-gap matrix: Luxe360 Studio and Kuula

The supplied brief says “Kulaa”; this comparison assumes it means **Kuula**, based on Kuula's official product and help pages. Those pages were reviewed on 2026-10-22. This is a public capability comparison, not a promise of feature parity. Kuula's own pages describe its plans; Luxe360's column describes this repository's current implementation.

| Capability | Kuula Free/Pro descriptions | Luxe360 Studio today | Gap or distinction |
|---|---|---|---|
| Import and arrange panoramas | Kuula Pro describes uploading multiple panoramas, arranging them, and connecting them into a tour. [1] Kuula's help documents dragging a panorama thumbnail onto the desired panorama point to create a connection. [3] | Imports multiple JPG/JPEG, PNG, and WebP images locally; thumbnails can be dragged onto the viewer to create a link at that panorama position. **Add connection** remains as a click-to-place fallback, followed by explicit destination selection. | Core assembly workflow exists, but editing is local and export is self-hosted rather than a managed cloud tour. |
| Navigation hotspots | Kuula's Free help says a complete tour can be built, but visitors to a free public/embedded tour do not see active hotspots; the help page says Pro/Business enables fully functional shared hotspots. [2] | Navigation hotspots are editable and active in local preview and in the standalone ZIP without a subscription gate. | Different distribution model: Luxe360 has no tour hosting/account layer. |
| Hotspot content and appearance | Kuula Pro lists custom hotspot icons, images, labels, and hotspots. [1] | Editable icon or uploaded image, tint, size, opacity, rotation, plane, label formatting, shadow/hover display, and actions for scene navigation, web links, or information. | Different editor and distribution model; Luxe360's local preview and standalone exports preserve these options. |
| Audio | Kuula Pro lists audio/sounds; Kuula's Free help says audio integration is not included in Free. [1] [2] | No audio or voice-over hotspot support. | Not implemented; no parity claim. |
| Image editing | Kuula Pro lists photo retouching. [1] | Source photos are not modified. Luxe360 assembles tours and creates a JPEG derivative only for optional Google publishing. | No retouching, stitching, horizon leveling, or tiny-planet mode. |
| Floor plans, maps, and location | Kuula Pro describes interactive floor plans and Google Maps/location data. [1] | Per-scene latitude/longitude and a separate, optional Google Street View Publish API workflow. | No floor-plan editor; Street View publishing is not a floor-plan/maps feature and requires user-owned Google API/OAuth configuration. |
| Branding and hosted sharing | Kuula Pro lists custom branding and unlisted tours; Kuula Free help says free links/embeds carry Kuula branding and free content can be Public or Private. [1] [2] | The editor displays the supplied Luxe Growth logo. The standalone tour uses Luxe360 Studio branding; no customer-specific branding or managed tour hosting. | Branding is app-level, not a user-configurable white-label feature. There is no public link-sharing service. |
| Plan limits and privacy | Kuula's Free help lists up to 25 images per batch and 100 images per month, and says free public viewers do not see active hotspots. [2] The Pro page describes up to 100,000 posts and no upload limits. [1] | No account, monthly quota, subscription tier, or remote media storage. Data uses the current browser's IndexedDB and is limited by that device/browser's storage. | Local-first privacy removes server quotas but does not provide cloud backup, collaboration, or cross-device sync. |
| Project portability | Kuula Pro describes hosted collections and sharing. [1] | Portable `.luxe360.json` project backups embed original image data; static ZIPs bundle the viewer and tour assets. | User must store backups and host ZIP contents. |
| Editing workflow polish | Kuula describes a web tour editor and thumbnail-to-panorama connection workflow. [1] [3] | Dark/light theme toggle, keyboard undo/redo/select/connection shortcuts, scene inspector, responsive panels, and direct thumbnail-to-viewer connection drops with a click-to-place fallback. | Luxe360 implements its own interaction and code; it does not copy Kuula code, assets, or branding. |

## Scope decision

Luxe360 is a local-first panorama-tour assembly tool. The current release focuses on responsive scene editing, spherical navigation links, private-by-default storage, and portable exports. It does not copy Kuula code, assets, or branding and does not claim full feature parity. The dark theme, supplied Luxe Growth brand integration, keyboard shortcuts, and delayed export loading are Luxe360-specific improvements.

Google publishing remains optional and user-initiated. The app requires the user's own Google Cloud/API/OAuth setup and does not claim that API acceptance guarantees public display.

## References

[1]: https://kuula.co/page/pro "Kuula Pro feature page"
[2]: https://kuula.co/help/free "Kuula free-account features and limitations"
[3]: https://kuula.co/help/connections "Kuula hotspot connections help"
