import JSZip from 'jszip';
import pannellumJs from 'pannellum/build/pannellum.js?raw';
import pannellumCss from 'pannellum/build/pannellum.css?raw';
import pannellumLicense from 'pannellum/COPYING?raw';
import type { Project } from './studio';

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function exportTourZip(project: Project): Promise<Blob> {
  if (!project.scenes.length) throw new Error('Add at least one panorama before exporting a tour.');
  const zip = new JSZip();
  const files: Record<string, string> = {};
  const used = new Set<string>();
  for (const [index, scene] of project.scenes.entries()) {
    let slug = scene.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `scene-${index + 1}`;
    if (used.has(slug)) slug += `-${index + 1}`;
    used.add(slug);
    const ext = scene.mimeType === 'image/png' ? 'png' : scene.mimeType === 'image/webp' ? 'webp' : 'jpg';
    files[scene.id] = `assets/${slug}.${ext}`;
    zip.file(files[scene.id], scene.blob);
  }
  const tour = {
    title: project.name,
    default: { firstScene: project.startSceneId && files[project.startSceneId] ? project.startSceneId : project.scenes[0].id, autoLoad: true, showControls: true, sceneFadeDuration: 350 },
    scenes: Object.fromEntries(project.scenes.map((scene) => [scene.id, {
      title: scene.name, type: 'equirectangular', panorama: files[scene.id],
      hotSpots: scene.hotspots.filter((h) => h.targetSceneId && files[h.targetSceneId]).map((h) => ({ id: h.id, pitch: h.pitch, yaw: h.yaw, type: 'scene', text: h.label, sceneId: h.targetSceneId }))
    }]))
  };
  const tourJson = JSON.stringify(tour).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#111416"><title>${escapeHtml(project.name)}</title><link rel="stylesheet" href="vendor/pannellum.css"><link rel="stylesheet" href="vendor/tour.css"></head><body><header><strong>${escapeHtml(project.name)}</strong><span>360° virtual tour</span></header><main id="panorama"></main><footer>Tour created with Luxe360 Studio · Select a directional arrow to move between scenes</footer><script src="vendor/pannellum.js"></script><script>const tour=${tourJson};pannellum.viewer('panorama',tour);</script></body></html>`;
  zip.file('index.html', html);
  zip.file('tour.json', JSON.stringify(tour, null, 2));
  zip.file('vendor/pannellum.js', pannellumJs);
  zip.file('vendor/pannellum.css', pannellumCss);
  zip.file('vendor/PANNELLUM-LICENSE.txt', pannellumLicense);
  zip.file('vendor/tour.css', 'html,body{margin:0;height:100%;font-family:system-ui,sans-serif;color:#e9e9e6;background:#111416}header{height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 22px;background:#181c1f;border-bottom:1px solid #2a3033}header strong{font-size:14px}header span,footer{font-size:11px;color:#a3abad}footer{height:32px;display:flex;align-items:center;justify-content:center}#panorama{height:calc(100% - 84px);width:100%}');
  zip.file('README.txt', 'Luxe360 Studio standalone tour\n\nKeep the relative folder structure intact. Host these files as a static website or use a local static HTTP server if the browser blocks file:// resources. This website export is separate from Google Maps publication.\n\nPannellum is included under its MIT license; see vendor/PANNELLUM-LICENSE.txt.');
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 5 } });
}
