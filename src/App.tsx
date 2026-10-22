import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BadgeCheck, Check, ChevronDown,
  CircleAlert, Copy, ExternalLink, FileArchive, FileImage, FileJson, FolderOpen,
  Globe, GripVertical, ImagePlus, Info, Layers3, Link2, LoaderCircle, MapPin,
  Maximize2, Moon, MousePointer2, PackageCheck, Plus, Redo2, Save, Settings2,
  ShieldCheck, Sun, Trash2, Undo2, Upload, WandSparkles, X, ZoomIn
} from 'lucide-react';
import PanoramaCanvas from './components/PanoramaCanvas';
import HotspotAddonPanel from './components/HotspotAddonPanel';
import luxeGrowthLogo from './assets/luxeegrowth-logo.jpeg';
import {
  cloneProject, createProject, createSampleProject, exportProjectJson,
  importProjectJson, loadGoogleClientId, loadProject, newId, prepareGoogleJpeg,
  saveGoogleClientId, saveProject, type Hotspot, type Project, type Scene
} from './lib/studio';

type EditMode = 'select' | 'add' | 'reposition';
type MessageType = 'success' | 'error' | 'info';
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/streetviewpublish';

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: { initTokenClient: (config: {
      client_id: string; scope: string;
      callback: (response: { access_token?: string; error?: string; error_description?: string }) => void;
      error_callback?: (error: { message?: string }) => void;
    }) => { requestAccessToken: (options?: { prompt?: string }) => void } } } };
  }
}

const fileName = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Untitled panorama';
const bytesLabel = (bytes: number) => bytes < 1024 * 1024 ? Math.max(1, Math.round(bytes / 1024)) + ' KB' : (bytes / (1024 * 1024)).toFixed(1) + ' MB';
const numeric = (value: string) => value.trim() === '' || !Number.isFinite(Number(value)) ? undefined : Number(value);

function Toast({ message, kind, dismiss }: { message: string; kind: MessageType; dismiss: () => void }) {
  if (!message) return null;
  const Icon = kind === 'success' ? Check : kind === 'error' ? CircleAlert : Info;
  return <div className={'toast toast-' + kind} role="status"><Icon size={17}/><span>{message}</span><button className="icon-button" onClick={dismiss} aria-label="Dismiss"><X size={15}/></button></div>;
}

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const old = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
    if (old) { old.addEventListener('load', () => resolve(), { once: true }); old.addEventListener('error', () => reject(new Error('Google OAuth script failed to load.')), { once: true }); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.defer = true; script.dataset.googleIdentity = 'true';
    script.onload = () => resolve(); script.onerror = () => reject(new Error('Google OAuth script failed to load. Check the connection.'));
    document.head.appendChild(script);
  });
}

function googleToken(clientId: string): Promise<string> {
  return loadGoogleScript().then(() => new Promise((resolve, reject) => {
    const oauth = window.google?.accounts?.oauth2;
    if (!oauth) { reject(new Error('Google OAuth is unavailable in this browser.')); return; }
    const tokenClient = oauth.initTokenClient({
      client_id: clientId, scope: GOOGLE_SCOPE,
      callback: (response) => response.access_token && !response.error ? resolve(response.access_token) : reject(new Error(response.error_description || response.error || 'Google authorization was not completed.')),
      error_callback: (error) => reject(new Error(error.message || 'Google authorization was cancelled.'))
    });
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }));
}

async function apiRequest(url: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {}); headers.set('Authorization', 'Bearer ' + token);
  if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const body = await response.text(); let detail = body;
    try { const parsed = JSON.parse(body); detail = parsed.error?.message || parsed.error_description || body; } catch { /* Keep raw response text. */ }
    throw new Error('Google Street View API (' + response.status + '): ' + (detail || response.statusText));
  }
  if (response.status === 204) return {};
  return response.json();
}

export default function App() {
  const [project, setProject] = useState<Project>(createProject);
  const [history, setHistory] = useState<Project[]>([]);
  const [redoHistory, setRedoHistory] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cameraTarget, setCameraTarget] = useState<{ sceneId: string; yaw: number; pitch: number } | null>(null);
  const draggingSceneRef = useRef(false);
  const [hotspotId, setHotspotId] = useState<string | null>(null);
  const [tab, setTab] = useState<'editor' | 'google'>('editor');
  const [mode, setMode] = useState<EditMode>('select');
  const [preview, setPreview] = useState(false);
  const [tinyPlanet, setTinyPlanet] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return localStorage.getItem('luxe360-theme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
  });
  const [saveState, setSaveState] = useState<'loading' | 'saving' | 'saved' | 'error'>('loading');
  const [loaded, setLoaded] = useState(false);
  const [projectLoadOk, setProjectLoadOk] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'scenes' | 'properties' | null>(null);
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState<MessageType>('info');
  const [clientId, setClientId] = useState('');
  const [token, setToken] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleProgress, setGoogleProgress] = useState('');
  const [googleResults, setGoogleResults] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  const toastRef = useRef<number | null>(null);
  const knownObjectUrlsRef = useRef<Set<string>>(new Set());

  const activeScene = project.scenes.find((s) => s.id === activeId) || project.scenes[0] || null;
  const selectedHotspot = activeScene?.hotspots.find((h) => h.id === hotspotId) || null;
  const linkedCount = project.scenes.reduce((sum, scene) => sum + scene.hotspots.filter((h) => project.scenes.some((s) => s.id === h.targetSceneId)).length, 0);

  const notify = useCallback((message: string, kind: MessageType = 'info') => {
    setNotice(message); setNoticeType(kind);
    if (toastRef.current) window.clearTimeout(toastRef.current);
    toastRef.current = window.setTimeout(() => setNotice(''), 5500);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadProject().then((saved) => {
      if (cancelled) return;
      if (saved) { setProject(saved); setActiveId(saved.startSceneId || saved.scenes[0]?.id || null); }
      setProjectLoadOk(true); setLoaded(true); setSaveState('saved');
    }).catch((error: unknown) => {
      if (cancelled) return;
      setLoaded(true); setSaveState('error'); notify(error instanceof Error ? error.message : 'Could not restore local project. Existing data was left untouched.', 'error');
    });
    loadGoogleClientId().then((savedClient) => {
      if (!cancelled && savedClient) setClientId(savedClient);
    }).catch((error: unknown) => {
      if (!cancelled) notify(error instanceof Error ? 'Google settings could not be restored: ' + error.message : 'Google settings could not be restored.', 'error');
    });
    return () => { cancelled = true; };
  }, [notify]);

  useEffect(() => {
    if (!loaded || !projectLoadOk) return;
    setSaveState('saving');
    const timer = window.setTimeout(() => saveProject(project).then(() => setSaveState('saved')).catch((error: unknown) => {
      setSaveState('error'); notify(error instanceof Error ? 'Local save failed: ' + error.message : 'Local save failed. Export a backup.', 'error');
    }), 400);
    return () => window.clearTimeout(timer);
  }, [project, loaded, projectLoadOk, notify]);

  useEffect(() => {
    const urls = new Set([...project.scenes, ...history.flatMap((item) => item.scenes), ...redoHistory.flatMap((item) => item.scenes)].map((scene) => scene.imageUrl));
    for (const url of knownObjectUrlsRef.current) if (!urls.has(url)) URL.revokeObjectURL(url);
    knownObjectUrlsRef.current = urls;
  }, [project, history, redoHistory]);

  useEffect(() => () => { for (const url of knownObjectUrlsRef.current) URL.revokeObjectURL(url); }, []);

  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
    try { localStorage.setItem('luxe360-theme', theme); } catch { /* Theme persistence is optional. */ }
  }, [theme]);

  useEffect(() => () => { if (toastRef.current) window.clearTimeout(toastRef.current); }, []);

  const pushProject = (next: Project) => {
    setHistory((items) => [...items.slice(-39), cloneProject(project)]);
    setRedoHistory([]); setProject({ ...next, updatedAt: Date.now() });
  };
  const undo = () => {
    if (!history.length) return;
    setRedoHistory((items) => [...items, cloneProject(project)]);
    const previous = history[history.length - 1]; setHistory((items) => items.slice(0, -1)); setProject(previous);
    setActiveId(previous.scenes.some((s) => s.id === activeId) ? activeId : previous.scenes[0]?.id || null); setHotspotId(null); setMode('select');
  };
  const redo = () => {
    if (!redoHistory.length) return;
    setHistory((items) => [...items, cloneProject(project)]);
    const next = redoHistory[redoHistory.length - 1]; setRedoHistory((items) => items.slice(0, -1)); setProject(next);
    setActiveId(next.scenes.some((s) => s.id === activeId) ? activeId : next.scenes[0]?.id || null); setHotspotId(null); setMode('select');
  };
  const actionsRef = useRef({ undo, redo });
  actionsRef.current = { undo, redo };
  const keyboardStateRef = useRef({ preview, sceneCount: project.scenes.length });
  keyboardStateRef.current = { preview, sceneCount: project.scenes.length };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && key === 'z') {
        event.preventDefault();
        if (!keyboardStateRef.current.preview) (event.shiftKey ? actionsRef.current.redo : actionsRef.current.undo)();
        return;
      }
      if (modifier && key === 'y') { event.preventDefault(); if (!keyboardStateRef.current.preview) actionsRef.current.redo(); return; }
      if (modifier || event.altKey) return;
      if (event.key === 'Escape') { setPreview(false); setMode('select'); setMenuOpen(false); setMobilePanel(null); return; }
      if (key === 'v') { setMode('select'); return; }
      if (key === 'h' && !keyboardStateRef.current.preview && keyboardStateRef.current.sceneCount > 1) { setMode('add'); setHotspotId(null); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const importPhotos = async (files: FileList | File[]) => {
    const selected = Array.from(files).filter((f) => /^image\/(jpeg|png|webp)$/i.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name));
    if (!selected.length) { notify('Choose JPG, PNG or WebP images.', 'error'); return; }
    setIsBusy(true); const scenes: Scene[] = []; const failures: string[] = [];
    for (const file of selected) {
      try {
        const mimeType = /^image\/(jpeg|png|webp)$/i.test(file.type) ? file.type.toLowerCase() : /\.png$/i.test(file.name) ? 'image/png' : /\.webp$/i.test(file.name) ? 'image/webp' : 'image/jpeg';
        const blob = file.slice(0, file.size, mimeType);
        const bitmap = await createImageBitmap(blob); const width = bitmap.width; const height = bitmap.height; bitmap.close();
        if (!width || !height) throw new Error('Invalid dimensions');
        scenes.push({ id: newId(), name: fileName(file.name), mimeType, size: file.size, width, height, blob, imageUrl: URL.createObjectURL(blob), heading: 0, hotspots: [] });
      } catch { failures.push(file.name); }
    }
    if (scenes.length) {
      pushProject({ ...project, scenes: [...project.scenes, ...scenes], startSceneId: project.startSceneId || scenes[0].id });
      setActiveId(scenes[0].id); setHotspotId(null); setPreview(false); setTab('editor'); setMode('select');
      notify(`${scenes.length} panorama${scenes.length === 1 ? '' : 's'} imported locally.${failures.length ? ' Skipped ' + failures.length + ' unreadable file(s).' : ''}`, failures.length ? 'info' : 'success');
    } else notify('None of the selected images could be read.', 'error');
    if (inputRef.current) inputRef.current.value = '';
    setIsBusy(false);
  };

  const loadSample = async () => {
    if (project.scenes.length && !window.confirm('Add the sample tour to this project?')) return;
    setIsBusy(true);
    try {
      const sample = await createSampleProject();
      pushProject({ ...project, name: project.scenes.length ? project.name : sample.name, scenes: [...project.scenes, ...sample.scenes], startSceneId: project.startSceneId || sample.startSceneId });
      setActiveId(sample.startSceneId); setHotspotId(null); setPreview(false); setTab('editor'); notify('A sample walkthrough has been created locally in your browser.', 'success');
    } catch (error) { notify(error instanceof Error ? error.message : 'Sample tour failed.', 'error'); }
    setIsBusy(false);
  };

  const patchScene = (id: string, patch: Partial<Scene>, undoable = false) => {
    const update = (p: Project): Project => ({ ...p, scenes: p.scenes.map((s) => s.id === id ? { ...s, ...patch } : s) });
    if (undoable) pushProject(update(project)); else setProject((p) => ({ ...update(p), updatedAt: Date.now() }));
  };
  const addHotspotAt = (pitch: number, yaw: number, targetSceneId = '') => {
    if (!activeScene) return;
    const target = targetSceneId ? project.scenes.find((s) => s.id === targetSceneId) : undefined;
    if (targetSceneId && !target) { notify('Choose a destination from this tour.', 'error'); return; }
    if (target?.id === activeScene.id) { notify('A scene cannot connect to itself. Choose another destination.', 'error'); return; }
    const created: Hotspot = { id: newId(), label: target?.name || 'New connection', targetSceneId: target?.id || '', pitch: Math.round(pitch * 10) / 10, yaw: Math.round(yaw * 10) / 10, action: target ? 'navigate' : 'none', icon: 'arrow', tint: '#e0c45d', width: 44, height: 44, opacity: 100, rotation: 0, placementMode: 'floor', scaleOnZoom: true, labelFontSize: 11, labelColor: '#29362e', labelBackground: '#ffffff', labelAlignment: 'center', shadow: true, autoFaceBack: true };
    pushProject({ ...project, scenes: project.scenes.map((s) => s.id === activeScene.id ? { ...s, hotspots: [...s.hotspots, created] } : s) });
    setHotspotId(created.id); setMode('select'); setMobilePanel('properties');
    notify(target ? `Connection to ${target.name} added.` : 'Connection added. Choose its destination in the inspector.', 'success');
  };
  const placeHotspot = (pitch: number, yaw: number) => {
    if (!activeScene) return;
    if (mode === 'reposition' && selectedHotspot) {
      pushProject({ ...project, scenes: project.scenes.map((s) => s.id === activeScene.id ? { ...s, hotspots: s.hotspots.map((h) => h.id === selectedHotspot.id ? { ...h, pitch: Math.round(pitch * 10) / 10, yaw: Math.round(yaw * 10) / 10 } : h) } : s) });
      setMode('select'); notify('Hotspot repositioned.', 'success'); return;
    }
    if (mode === 'add') addHotspotAt(pitch, yaw);
  };
  const patchHotspot = (patch: Partial<Hotspot>) => {
    if (!activeScene || !selectedHotspot) return;
    pushProject({ ...project, scenes: project.scenes.map((s) => s.id === activeScene.id ? { ...s, hotspots: s.hotspots.map((h) => h.id === selectedHotspot.id ? { ...h, ...patch } : h) } : s) });
  };
  const deleteHotspot = (id: string) => {
    if (!activeScene) return;
    pushProject({ ...project, scenes: project.scenes.map((s) => s.id === activeScene.id ? { ...s, hotspots: s.hotspots.filter((h) => h.id !== id) } : s) });
    setHotspotId(null); setMode('select'); notify('Hotspot deleted.');
  };
  const duplicateHotspot = () => {
    if (!activeScene || !selectedHotspot) return;
    const copy = { ...selectedHotspot, id: newId(), label: selectedHotspot.label + ' copy', yaw: Math.max(-179, Math.min(179, selectedHotspot.yaw + 15)) };
    pushProject({ ...project, scenes: project.scenes.map((s) => s.id === activeScene.id ? { ...s, hotspots: [...s.hotspots, copy] } : s) }); setHotspotId(copy.id); notify('Hotspot duplicated.');
  };
  const removeScene = (scene: Scene) => {
    if (!window.confirm(`Remove “${scene.name}” from the project? The original device file will not be deleted.`)) return;
    const scenes = project.scenes.filter((s) => s.id !== scene.id).map((s) => ({ ...s, hotspots: s.hotspots.filter((h) => h.targetSceneId !== scene.id) }));
    pushProject({ ...project, scenes, startSceneId: project.startSceneId === scene.id ? scenes[0]?.id || null : project.startSceneId });
    setActiveId(scenes[0]?.id || null); setHotspotId(null); notify('Scene removed; inbound hotspots were removed safely.');
  };
  const reorder = (dragId: string, targetId: string) => {
    const from = project.scenes.findIndex((s) => s.id === dragId); const to = project.scenes.findIndex((s) => s.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const scenes = [...project.scenes]; const [moved] = scenes.splice(from, 1); scenes.splice(to, 0, moved); pushProject({ ...project, scenes });
  };
  const moveScene = (id: string, offset: -1 | 1) => {
    const from = project.scenes.findIndex((s) => s.id === id); const to = from + offset;
    if (from < 0 || to < 0 || to >= project.scenes.length) return;
    const scenes = [...project.scenes]; const [moved] = scenes.splice(from, 1); scenes.splice(to, 0, moved); pushProject({ ...project, scenes });
  };

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  const saveNow = async () => {
    try { await saveProject(project); setSaveState('saved'); notify('Project saved locally.', 'success'); }
    catch (error) { setSaveState('error'); notify(error instanceof Error ? error.message : 'Save failed.', 'error'); }
  };
  const exportProject = async () => {
    setIsBusy(true); try { downloadBlob(await exportProjectJson(project), (project.name || 'luxe360-project').replace(/[^\w-]+/g, '-').toLowerCase() + '.luxe360.json'); notify('Project backup exported, including the original panorama files.', 'success'); }
    catch (error) { notify(error instanceof Error ? error.message : 'Project export failed.', 'error'); }
    setIsBusy(false); setMenuOpen(false);
  };
  const exportTour = async () => {
    setIsBusy(true); try { const { exportTourZip } = await import('./lib/tour-export'); downloadBlob(await exportTourZip(project), (project.name || 'luxe360-tour').replace(/[^\w-]+/g, '-').toLowerCase() + '-tour.zip'); notify('Standalone tour ZIP exported.', 'success'); }
    catch (error) { notify(error instanceof Error ? error.message : 'Tour export failed.', 'error'); }
    setIsBusy(false); setMenuOpen(false);
  };
  const restoreProject = async (file?: File) => {
    if (!file) return;
    try {
      const restored = await importProjectJson(file);
      if (!window.confirm(`Replace the current project with “${restored.name}”?`)) { restored.scenes.forEach((s) => URL.revokeObjectURL(s.imageUrl)); return; }
      historyReset(); setProject(restored); setProjectLoadOk(true); setActiveId(restored.startSceneId || restored.scenes[0]?.id || null); setHotspotId(null); setTab('editor'); setPreview(false); notify('Project backup restored.', 'success');
    } catch (error) { notify(error instanceof Error ? error.message : 'Backup import failed.', 'error'); }
    if (backupRef.current) backupRef.current.value = ''; setMenuOpen(false);
  };
  const historyReset = () => { setHistory([]); setRedoHistory([]); };

  const saveClient = async () => {
    if (clientId && !clientId.endsWith('.apps.googleusercontent.com')) { notify('Enter a Google OAuth web client ID ending in .apps.googleusercontent.com.', 'error'); return; }
    try { await saveGoogleClientId(clientId.trim()); setToken(''); notify(clientId.trim() ? 'OAuth client ID saved in this browser.' : 'OAuth client ID removed.', 'success'); }
    catch (error) { notify(error instanceof Error ? error.message : 'Could not save OAuth settings.', 'error'); }
  };
  const authorize = async () => {
    if (!clientId.trim()) { notify('Add your Google OAuth web client ID first.', 'error'); return; }
    setGoogleBusy(true); setGoogleProgress('Waiting for Google authorization…');
    try { const accessToken = await googleToken(clientId.trim()); setToken(accessToken); setGoogleProgress(''); notify('Google authorization granted for this tab session.', 'success'); }
    catch (error) { setGoogleProgress(''); notify(error instanceof Error ? error.message : 'Google authorization failed.', 'error'); }
    finally { setGoogleBusy(false); }
  };
  const publish = async () => {
    if (!project.scenes.length) { notify('Import photos before publishing.', 'error'); return; }
    const invalid = project.scenes.filter((s) => s.width / s.height < 1.97 || s.width / s.height > 2.03 || s.latitude === undefined || s.longitude === undefined || s.latitude < -90 || s.latitude > 90 || s.longitude < -180 || s.longitude > 180);
    if (invalid.length) { notify(`${invalid.length} scene(s) need a 2:1 image and valid latitude/longitude before publishing.`, 'error'); return; }
    if (!clientId.trim()) { notify('Configure a Google OAuth web client ID first.', 'error'); return; }
    setGoogleBusy(true); setGoogleResults([]); const published: Record<string, string> = {}; const results: string[] = [];
    try {
      let access = token;
      if (!access) { access = await googleToken(clientId.trim()); setToken(access); }
      for (const [index, scene] of project.scenes.entries()) {
        setGoogleProgress(`Preparing scene ${index + 1} of ${project.scenes.length}: ${scene.name}`);
        const jpeg = await prepareGoogleJpeg(scene);
        const upload: { uploadUrl?: string } = await apiRequest('https://streetviewpublish.googleapis.com/v1/photo:startUpload', access, { method: 'POST', body: '' });
        if (!upload.uploadUrl) throw new Error('Google did not return an upload URL for ' + scene.name + '.');
        const rawResponse = await fetch(upload.uploadUrl, { method: 'POST', headers: { Authorization: 'Bearer ' + access, 'Content-Type': 'image/jpeg', 'X-Goog-Upload-Protocol': 'raw', 'X-Goog-Upload-Content-Length': String(jpeg.size) }, body: jpeg });
        if (!rawResponse.ok) throw new Error(`Upload of ${scene.name} failed (${rawResponse.status}).`);
        setGoogleProgress(`Creating Google photo ${index + 1} of ${project.scenes.length}: ${scene.name}`);
        const created: { photoId?: { id?: string }; shareLink?: string; mapsPublishStatus?: string } = await apiRequest('https://streetviewpublish.googleapis.com/v1/photo', access, {
          method: 'POST', body: JSON.stringify({ uploadReference: { uploadUrl: upload.uploadUrl }, pose: { latLngPair: { latitude: scene.latitude, longitude: scene.longitude } } })
        });
        if (!created.photoId?.id) throw new Error('Google did not return a photo ID for ' + scene.name + '.');
        published[scene.id] = created.photoId.id;
        setProject((current) => ({ ...current, updatedAt: Date.now(), scenes: current.scenes.map((s) => s.id === scene.id ? { ...s, googlePhotoId: created.photoId?.id, googleShareLink: created.shareLink || '' } : s) }));
        results.push(`${scene.name}: created Google photo ${created.photoId.id}.`); setGoogleResults([...results]);
      }
      setGoogleProgress('Connecting published panoramas…');
      for (const scene of project.scenes) {
        const source = published[scene.id]; if (!source) continue;
        const connections = scene.hotspots.filter((h) => published[h.targetSceneId] && h.targetSceneId !== scene.id).map((h) => ({ target: { id: published[h.targetSceneId] } }));
        if (!connections.length) continue;
        try { await apiRequest(`https://streetviewpublish.googleapis.com/v1/photo/${encodeURIComponent(source)}?updateMask=connections`, access, { method: 'PUT', body: JSON.stringify({ photoId: { id: source }, connections }) }); }
        catch (error) { results.push(`${scene.name}: photo created, but connection update failed: ${error instanceof Error ? error.message : 'unknown API error'}`); }
      }
      setGoogleResults([...results]); setGoogleProgress(''); notify(`Google accepted ${Object.keys(published).length} photo creation request(s). Check final processing status in Google Maps.`, 'success');
    } catch (error) { setGoogleProgress(''); setGoogleResults([...results, 'Stopped: ' + (error instanceof Error ? error.message : 'Google publishing failed.')]); notify(error instanceof Error ? error.message : 'Google publishing failed.', 'error'); }
    finally { setGoogleBusy(false); }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, id: string) => { event.preventDefault(); const dragged = event.dataTransfer.getData('text/luxe360-scene'); if (dragged) reorder(dragged, id); };
  const selectedTargetExists = !!selectedHotspot && project.scenes.some((s) => s.id === selectedHotspot.targetSceneId);
  const activeIndex = activeScene ? project.scenes.findIndex((s) => s.id === activeScene.id) : -1;
  const initialView = activeScene && cameraTarget?.sceneId === activeScene.id
    ? cameraTarget
    : { yaw: activeScene ? ((activeScene.heading + 180) % 360 + 360) % 360 - 180 : 0, pitch: 0 };

  return <div className={'app-shell' + (theme === 'dark' ? ' theme-dark' : '') + (!loaded ? ' app-loading' : '')}>
    <header className="topbar">
      <div className="brand-lockup"><img className="brand-logo" src={luxeGrowthLogo} alt="Luxe Growth"/><div className="brand-copy"><span className="brand-name">Luxe360 <b>Studio</b></span><span className="brand-subtitle">360° TOUR EDITOR</span></div></div>
      <div className="topbar-divider"/>
      <div className="project-title-wrap"><input className="project-name-input" aria-label="Project name" value={project.name} onChange={(e) => setProject({ ...project, name: e.target.value, updatedAt: Date.now() })}/><div className="save-indicator">{saveState === 'saving' ? <LoaderCircle size={13} className="spin"/> : saveState === 'error' ? <CircleAlert size={13}/> : <Check size={13}/>}<span>{saveState === 'loading' ? 'Loading' : saveState === 'saving' ? 'Saving' : saveState === 'error' ? 'Save issue' : 'Saved locally'}</span></div></div>
      <div className="topbar-spacer"/>
      <div className="topbar-actions">
        <button className="icon-button history-button" title="Undo (Ctrl/⌘+Z)" aria-label="Undo" aria-keyshortcuts="Control+Z Meta+Z" disabled={!history.length || preview} onClick={undo}><Undo2 size={17}/></button><button className="icon-button history-button" title="Redo (Ctrl/⌘+Shift+Z)" aria-label="Redo" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z" disabled={!redoHistory.length || preview} onClick={redo}><Redo2 size={17}/></button><div className="action-divider"/>
        <button className="icon-button theme-toggle" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}</button>
        <button className={'tab-button ' + (tab === 'editor' ? 'tab-button-active' : '')} onClick={() => { setTab('editor'); setPreview(false); }}><MousePointer2 size={15}/> Editor</button><button className={'tab-button ' + (tab === 'google' ? 'tab-button-active' : '')} onClick={() => { setTab('google'); setPreview(false); setMode('select'); }}><Globe size={15}/> Google publishing</button>
        <div className="project-menu-wrap"><button className="button button-quiet" onClick={() => setMenuOpen((v) => !v)}><FolderOpen size={16}/> Project <ChevronDown size={14}/></button>{menuOpen && <div className="dropdown-menu"><button onClick={() => { void saveNow(); setMenuOpen(false); }}><Save size={15}/> Save now</button><button onClick={exportProject} disabled={isBusy}><FileJson size={15}/> Export project backup</button><button onClick={() => backupRef.current?.click()}><Upload size={15}/> Import project backup</button><button onClick={exportTour} disabled={isBusy}><FileArchive size={15}/> Export standalone tour ZIP</button></div>}</div>
        <button className="button button-primary quick-save-button" onClick={() => void saveNow()}><Save size={15}/> Save</button>
        {tab === 'editor' && <button className={'button ' + (preview ? 'button-dark' : 'button-primary')} onClick={() => { setPreview((v) => !v); setMode('select'); setHotspotId(null); setTinyPlanet(false); }}>{preview ? <X size={15}/> : <Maximize2 size={15}/>} {preview ? 'Exit preview' : 'Preview tour'}</button>}
        <input ref={backupRef} className="visually-hidden" type="file" accept="application/json,.json,.luxe360.json" onChange={(e) => void restoreProject(e.target.files?.[0])}/>
      </div>
    </header>

    <main className="workspace">
      <aside className={'scene-sidebar ' + (mobilePanel === 'scenes' ? 'mobile-panel-open' : '')}>
        <div className="panel-heading"><div><p className="eyebrow">YOUR TOUR</p><h2>Scenes <span className="count-pill">{project.scenes.length}</span></h2></div><button className="icon-button mobile-only" onClick={() => setMobilePanel(null)} aria-label="Close scenes"><X size={16}/></button><button className="icon-button desktop-only" title="Import panoramas" onClick={() => inputRef.current?.click()}><Plus size={17}/></button></div>
        <div className="scene-toolbar"><span>{linkedCount} linked hotspots</span><button className="text-button" onClick={() => inputRef.current?.click()}><ImagePlus size={14}/> Add photos</button></div>
        <input ref={inputRef} className="visually-hidden" type="file" multiple accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={(e) => e.target.files && void importPhotos(e.target.files)}/>
        <div className="scene-list">
          {!project.scenes.length ? <div className="empty-scenes"><div className="empty-icon"><FileImage size={21}/></div><strong>No scenes yet</strong><span>Import panorama photos to start building your tour.</span><button className="button button-primary button-full" onClick={() => inputRef.current?.click()}><Upload size={15}/> Import panoramas</button><button className="text-button centered" disabled={isBusy} onClick={() => void loadSample()}><WandSparkles size={14}/> Try sample tour</button></div> : project.scenes.map((scene, index) => <div key={scene.id} className={'scene-card ' + (scene.id === activeScene?.id ? 'scene-card-active' : '')} onClick={(e) => { if (draggingSceneRef.current) { e.preventDefault(); return; } setActiveId(scene.id); setCameraTarget(null); setHotspotId(null); setMode('select'); if (mobilePanel === 'scenes') setMobilePanel(null); }} draggable={!preview} onDragStart={(e) => { draggingSceneRef.current = true; e.dataTransfer.setData('text/luxe360-scene', scene.id); e.dataTransfer.setData('text/luxe360-connection', scene.id); e.dataTransfer.effectAllowed = 'copyMove'; }} onDragEnd={() => { window.setTimeout(() => { draggingSceneRef.current = false; }, 150); }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, scene.id)}>
            <div className="scene-thumb"><img src={scene.imageUrl} alt=""/><span className="scene-number">{String(index + 1).padStart(2, '0')}</span>{scene.id === project.startSceneId && <span className="start-badge">START</span>}</div>
            <div className="scene-card-body"><div className="scene-name-row"><span className="scene-name">{scene.name}</span><span className="scene-drag-handle"><GripVertical size={14}/></span></div><span className="scene-meta">{scene.width} × {scene.height} · {bytesLabel(scene.size)}</span><div className="scene-mini-status"><span className={'status-dot ' + (scene.width / scene.height > 1.97 && scene.width / scene.height < 2.03 ? 'status-ok' : 'status-warn')}/><span>{scene.width / scene.height > 1.97 && scene.width / scene.height < 2.03 ? '2:1 panorama' : 'Check proportions'}</span>{scene.hotspots.length > 0 && <span className="hotspot-count"><Link2 size={11}/> {scene.hotspots.length}</span>}</div></div>
            {!preview && <div className="scene-quick-actions" onClick={(e) => e.stopPropagation()}><button className="tiny-icon-button" title="Move scene up" disabled={index === 0} onClick={() => moveScene(scene.id, -1)}><ArrowUp size={12}/></button><button className="tiny-icon-button" title="Move scene down" disabled={index === project.scenes.length - 1} onClick={() => moveScene(scene.id, 1)}><ArrowDown size={12}/></button></div>}
          </div>)}
        </div>
        <div className="sidebar-footer"><div className="privacy-note"><ShieldCheck size={16}/><div><strong>Private by default</strong><span>Photos stay in this browser.</span></div></div><button className="button button-subtle button-full" disabled={isBusy} onClick={() => inputRef.current?.click()}>{isBusy ? <LoaderCircle size={15} className="spin"/> : <Plus size={15}/>} Import more photos</button></div>
      </aside>

      <section className="editor-main">
        {tab === 'editor' ? <>
          <div className="canvas-toolbar"><div className="canvas-location"><span className="canvas-breadcrumb">TOUR EDITOR</span>{activeScene && <><ChevronDown size={13} className="breadcrumb-chevron"/><span className="canvas-current">{activeScene.name}</span></>}</div><div className="canvas-tools">{activeScene && <span className="aspect-chip">{(activeScene.width / activeScene.height).toFixed(2)}:1</span>}<button className="canvas-tool" title="Select mode (V)" aria-keyshortcuts="V" aria-pressed={mode === 'select'} disabled={preview || !activeScene} onClick={() => setMode('select')}><MousePointer2 size={15}/><span>Select</span></button><button className={'canvas-tool ' + (mode === 'add' ? 'canvas-tool-active' : '')} title="Add connection (H)" aria-label="Add connection" aria-keyshortcuts="H" aria-pressed={mode === 'add'} disabled={preview || !activeScene || project.scenes.length < 2} onClick={() => { setTinyPlanet(false); setMode(mode === 'add' ? 'select' : 'add'); setHotspotId(null); }}><Plus size={15}/><span>Add connection</span></button><button className={'canvas-tool ' + (tinyPlanet ? 'canvas-tool-active' : '')} title="Toggle tiny-planet view" aria-pressed={tinyPlanet} disabled={!activeScene} onClick={() => setTinyPlanet((enabled) => { const next = !enabled; if (next) setMode('select'); return next; })}><Globe size={15}/><span>{tinyPlanet ? 'Exit tiny planet' : 'Tiny planet'}</span></button>{mode !== 'select' && <span className="mode-hint">{mode === 'add' ? 'Click point, then choose destination' : 'Click to reposition'}</span>}</div></div>
          {activeScene ? <div className="canvas-wrap"><PanoramaCanvas scene={activeScene} allScenes={project.scenes} initialYaw={initialView.yaw} initialPitch={initialView.pitch} mode={preview ? 'select' : mode} selectedHotspotId={hotspotId} preview={preview} tinyPlanet={tinyPlanet} onPlace={placeHotspot} onSceneDrop={(id, pitch, yaw) => addHotspotAt(pitch, yaw, id)} onSelect={(id) => { setHotspotId(id); setMode('select'); if (window.innerWidth < 900) setMobilePanel('properties'); }} onNavigate={(id, yaw, pitch) => { setCameraTarget({ sceneId: id, yaw, pitch }); setActiveId(id); setHotspotId(null); }}/>{preview && <div className="preview-badge"><span className="preview-live-dot"/> Tour preview <span>·</span> {activeIndex + 1} of {project.scenes.length}</div>}{project.scenes.length === 1 && !preview && <div className="canvas-bottom-note"><Info size={13}/> Import another scene to connect navigation hotspots.</div>}</div> : <div className="canvas-empty"><div className="empty-canvas-art"><div className="empty-globe"><Globe size={36}/></div><span className="orbit orbit-one"/><span className="orbit orbit-two"/></div><p className="eyebrow">START BUILDING</p><h1>Your next space starts here.</h1><p>Import your 360° photos to connect scenes and build an interactive walkthrough.</p><div className="empty-actions"><button className="button button-primary" onClick={() => inputRef.current?.click()}><Upload size={16}/> Import panorama photos</button><button className="button button-quiet" disabled={isBusy} onClick={() => void loadSample()}><WandSparkles size={15}/> Try a sample tour</button></div><span className="micro-copy"><ShieldCheck size={13}/> No account. No upload. Your files stay on this device.</span></div>}
          {activeScene && !preview && <div className="bottom-statusbar"><div className="statusbar-left"><span><MousePointer2 size={12}/> Drag to look around</span><span><ZoomIn size={13}/> Scroll to zoom</span></div><div className="statusbar-right">{activeScene.hotspots.length} hotspot{activeScene.hotspots.length === 1 ? '' : 's'} <span className="status-separator">·</span> {activeScene.width} × {activeScene.height}</div></div>}
        </> : <GooglePanel project={project} clientId={clientId} setClientId={setClientId} saveClient={saveClient} authorize={authorize} tokenReady={!!token} busy={googleBusy} progress={googleProgress} results={googleResults} publish={publish} patchScene={patchScene} back={() => setTab('editor')}/>}
      </section>

      {tab === 'editor' && <aside className={'properties-sidebar ' + (mobilePanel === 'properties' ? 'mobile-panel-open' : '')}>
        <div className="panel-heading properties-heading"><div><p className="eyebrow">INSPECTOR</p><h2>{selectedHotspot ? 'Hotspot' : activeScene ? 'Scene settings' : 'Properties'}</h2></div><button className="icon-button mobile-only" onClick={() => setMobilePanel(null)} aria-label="Close properties"><X size={16}/></button>{selectedHotspot && <span className="selection-indicator"><span/> SELECTED</span>}</div>
        {!activeScene ? <div className="property-empty"><Settings2 size={23}/><strong>Nothing selected</strong><span>Import a scene to start editing properties.</span></div> : selectedHotspot ? <div className="property-content">
          <div className="property-section"><div className="property-section-title"><Link2 size={15}/><h3>Hotspot connection</h3></div><p className="field-help">Choose where this marker takes visitors. Other appearance and action settings are below.</p><label className="field-label" htmlFor="hotspot-target">Destination scene</label><select id="hotspot-target" className="select-input" value={selectedHotspot.targetSceneId} onChange={(e) => patchHotspot({ targetSceneId: e.target.value, action: e.target.value ? 'navigate' : 'none' })}><option value="">Choose a scene…</option>{project.scenes.filter((s) => s.id !== activeScene.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>{selectedHotspot.action === 'navigate' && !selectedTargetExists && <div className="inline-warning"><CircleAlert size={14}/> Choose a valid destination.</div>}</div>
          <div className="property-section"><div className="property-section-title"><MapPin size={15}/><h3>Spherical position</h3></div><p className="field-help">Exact panorama coordinates. You can also drag the marker with the reposition tool.</p><div className="field-row"><div className="field-group"><label className="field-label" htmlFor="hotspot-yaw">Yaw (°)</label><input id="hotspot-yaw" className="text-input" type="number" step="0.1" value={selectedHotspot.yaw} onChange={(e) => patchHotspot({ yaw: numeric(e.target.value) ?? 0 })}/></div><div className="field-group"><label className="field-label" htmlFor="hotspot-pitch">Pitch (°)</label><input id="hotspot-pitch" className="text-input" type="number" min="-90" max="90" step="0.1" value={selectedHotspot.pitch} onChange={(e) => patchHotspot({ pitch: Math.max(-90, Math.min(90, numeric(e.target.value) ?? 0)) })}/></div></div><button className="button button-subtle button-full reposition-button" onClick={() => { setTinyPlanet(false); setMode('reposition'); }}><MapPin size={15}/> Reposition in panorama</button></div>
          <HotspotAddonPanel hotspot={selectedHotspot} onChange={patchHotspot}/>
          <div className="property-section"><div className="property-section-title"><Settings2 size={15}/><h3>Manage hotspot</h3></div><div className="property-action-row"><button className="button button-subtle" onClick={duplicateHotspot}><Copy size={14}/> Duplicate</button><button className="button button-danger-soft" onClick={() => deleteHotspot(selectedHotspot.id)}><Trash2 size={14}/> Delete</button></div></div><div className="tip-card"><Info size={15}/><span>Your add-on styles are saved with this project and included in project backups.</span></div>
        </div> : <div className="property-content">
          <div className="scene-property-preview"><img src={activeScene.imageUrl} alt={activeScene.name}/><div className="scene-preview-overlay"><span>{activeIndex + 1} / {project.scenes.length}</span><span>{bytesLabel(activeScene.size)}</span></div></div>
          <div className="property-section"><div className="property-section-title"><FileImage size={15}/><h3>Scene details</h3></div><label className="field-label" htmlFor="scene-name">Scene name</label><input id="scene-name" className="text-input" maxLength={80} value={activeScene.name} onChange={(e) => patchScene(activeScene.id, { name: e.target.value }, true)}/><div className="detail-grid"><div><span>Dimensions</span><strong>{activeScene.width} × {activeScene.height}</strong></div><div><span>File size</span><strong>{bytesLabel(activeScene.size)}</strong></div><div><span>Aspect ratio</span><strong>{(activeScene.width / activeScene.height).toFixed(2)}:1</strong></div><div><span>Format</span><strong>{activeScene.mimeType.split('/')[1]?.toUpperCase() || 'IMAGE'}</strong></div></div>{activeScene.width / activeScene.height > 1.97 && activeScene.width / activeScene.height < 2.03 ? <div className="check-row check-good"><Check size={15}/><span>Dimensions look like a 2:1 panorama.</span></div> : <div className="check-row check-warn"><CircleAlert size={15}/><span>Not close to 2:1. Verify that this is a full 360° image before publishing.</span></div>}</div>
          <div className="property-section"><div className="property-section-title"><MapPin size={15}/><h3>Google position</h3><span className="optional-tag">OPTIONAL</span></div><p className="field-help">Only needed for Google Street View publishing. Indoor scenes may use the same shop coordinates.</p><div className="field-row"><div className="field-group"><label className="field-label" htmlFor="scene-lat">Latitude</label><input id="scene-lat" className="text-input" type="number" min="-90" max="90" step="any" placeholder="17.385" value={activeScene.latitude ?? ''} onChange={(e) => patchScene(activeScene.id, { latitude: numeric(e.target.value) })}/></div><div className="field-group"><label className="field-label" htmlFor="scene-lng">Longitude</label><input id="scene-lng" className="text-input" type="number" min="-180" max="180" step="any" placeholder="78.486" value={activeScene.longitude ?? ''} onChange={(e) => patchScene(activeScene.id, { longitude: numeric(e.target.value) })}/></div></div><div className="field-group field-space-top"><label className="field-label" htmlFor="scene-heading">Initial heading (degrees)</label><input id="scene-heading" className="text-input" type="number" min="0" max="359.9" step="0.1" value={activeScene.heading} onChange={(e) => patchScene(activeScene.id, { heading: Math.max(0, Math.min(359.9, numeric(e.target.value) ?? 0)) })}/></div></div>
          <div className="property-section"><div className="property-section-title"><Link2 size={15}/><h3>Scene connections</h3></div>{activeScene.hotspots.length ? activeScene.hotspots.map((h) => { const dest = project.scenes.find((s) => s.id === h.targetSceneId); return <button key={h.id} className="connection-row" onClick={() => setHotspotId(h.id)}><span className="connection-arrow"><ArrowRight size={14}/></span><span><strong>{h.label || 'Untitled hotspot'}</strong><small>{dest?.name || 'Destination not set'}</small></span><ChevronDown size={14} className="connection-chevron"/></button>; }) : <p className="empty-connections">No connections yet. Choose Add connection, click a point in the panorama, then select a destination.</p>}</div>
          <div className="property-footer-actions"><button className="button button-subtle button-full" onClick={() => { setProject({ ...project, startSceneId: activeScene.id, updatedAt: Date.now() }); notify('Start scene updated.', 'success'); }}><BadgeCheck size={15}/>{project.startSceneId === activeScene.id ? 'Start scene' : 'Set as start scene'}</button><button className="button button-danger-soft button-full" onClick={() => removeScene(activeScene)}><Trash2 size={15}/> Remove scene from project</button></div>
        </div>}
      </aside>}
    </main>
    <footer className="app-footer"><span><span className="footer-dot"/> All core editing features are free</span><span className="footer-right"><ShieldCheck size={13}/> Local-first editing <span className="footer-divider">·</span> <button onClick={() => notify('Export a .luxe360.json backup to move projects between browsers or devices.', 'info')}>Backup & privacy</button><span className="footer-divider">·</span> v1.0</span></footer>
    <div className="mobile-bottom-nav"><button onClick={() => { setTab('editor'); setMobilePanel(mobilePanel === 'scenes' ? null : 'scenes'); }}><Layers3 size={18}/><span>Scenes</span></button><button onClick={() => { setTab('editor'); setMobilePanel(null); }}><MousePointer2 size={18}/><span>Editor</span></button><button onClick={() => { setTab('editor'); setMobilePanel(mobilePanel === 'properties' ? null : 'properties'); }}><Settings2 size={18}/><span>Properties</span></button><button onClick={() => { setTab('google'); setMobilePanel(null); }}><Globe size={18}/><span>Google</span></button></div>
    <Toast message={notice} kind={noticeType} dismiss={() => setNotice('')}/>
    {!loaded && <div className="loading-overlay" role="status"><LoaderCircle size={19} className="spin"/> Restoring your local project…</div>}
  </div>;
}

function GooglePanel({ project, clientId, setClientId, saveClient, authorize, tokenReady, busy, progress, results, publish, patchScene, back }: {
  project: Project; clientId: string; setClientId: (value: string) => void; saveClient: () => void; authorize: () => void;
  tokenReady: boolean; busy: boolean; progress: string; results: string[]; publish: () => void;
  patchScene: (id: string, patch: Partial<Scene>) => void; back: () => void;
}) {
  const [setupOpen, setSetupOpen] = useState(true);
  const ratioOk = (scene: Scene) => scene.width / scene.height > 1.97 && scene.width / scene.height < 2.03;
  const coordsOk = (scene: Scene) => scene.latitude !== undefined && scene.longitude !== undefined && scene.latitude >= -90 && scene.latitude <= 90 && scene.longitude >= -180 && scene.longitude <= 180;
  const readyCount = project.scenes.filter((s) => ratioOk(s) && coordsOk(s)).length;
  return <div className="google-page">
    <div className="google-page-header"><div><div className="google-eyebrow"><Globe size={14}/> GOOGLE STREET VIEW</div><h1>Publishing workspace</h1><p>Prepare panorama scenes for Google's Street View Publish API.</p></div><button className="button button-quiet" onClick={back}><ArrowLeft size={15}/> Back to editor</button></div>
    <div className="google-notice"><Info size={17}/><div><strong>Separate from website export</strong><span>A downloadable tour ZIP is not a Google Maps upload. Google authorization, full 360° imagery, Photo Sphere metadata and valid coordinates are required.</span></div><a href="https://developers.google.com/streetview/publish" target="_blank" rel="noreferrer" aria-label="Google publishing documentation"><ExternalLink size={15}/></a></div>
    <div className="google-overview-grid"><div className="google-stat"><span className="stat-icon"><Layers3 size={16}/></span><span className="stat-label">Scenes in project</span><strong>{project.scenes.length}</strong></div><div className="google-stat"><span className="stat-icon stat-icon-green"><Check size={16}/></span><span className="stat-label">Basic preflight passed</span><strong>{readyCount}<small> / {project.scenes.length}</small></strong></div><div className="google-stat"><span className="stat-icon stat-icon-blue"><Link2 size={16}/></span><span className="stat-label">Configured connections</span><strong>{project.scenes.reduce((sum, s) => sum + s.hotspots.filter((h) => project.scenes.some((d) => d.id === h.targetSceneId)).length, 0)}</strong></div></div>
    <section className="google-card"><button className="google-card-heading" onClick={() => setSetupOpen((v) => !v)}><span className="google-card-icon"><Settings2 size={17}/></span><span><strong>Google API setup</strong><small>Use your own OAuth client ID · no client secret is stored here</small></span><ChevronDown className={setupOpen ? 'rotate-180' : ''} size={16}/></button>
      {setupOpen && <div className="google-card-body"><div className="setup-steps"><div><span>1</span><p>In Google Cloud Console, enable the Street View Publish API and configure consent.</p></div><div><span>2</span><p>Create a Web application OAuth client and add this exact origin.</p></div><div><span>3</span><p>Paste the public client ID below. Never paste a client secret or access token.</p></div></div><label className="field-label" htmlFor="google-client-id">OAuth 2.0 web client ID</label><div className="client-id-row"><input id="google-client-id" className="text-input" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="000000000000-....apps.googleusercontent.com"/><button className="button button-subtle" onClick={saveClient}><Save size={14}/> Save ID</button></div><div className="google-setup-links"><a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">Google Cloud credentials <ExternalLink size={12}/></a><a href="https://developers.google.com/streetview/publish/authorizing" target="_blank" rel="noreferrer">Authorization guide <ExternalLink size={12}/></a></div><div className="auth-row"><div className="auth-status"><span className={'status-dot ' + (tokenReady ? 'status-ok' : 'status-neutral')}/><span>{tokenReady ? 'Authorized for this tab session' : 'Not authorized'}</span><small>The access token stays in memory.</small></div><button className="button button-primary" disabled={!clientId.trim() || busy} onClick={authorize}>{busy ? <LoaderCircle className="spin" size={15}/> : <ShieldCheck size={15}/>} Authorize Google</button></div></div>}
    </section>
    <section className="google-card"><div className="google-card-heading static-heading"><span className="google-card-icon"><MapPin size={17}/></span><span><strong>Scene preflight</strong><small>Set positions and verify images before upload</small></span><span className="preflight-count">{readyCount} / {project.scenes.length} ready</span></div>
      {!project.scenes.length ? <div className="google-empty"><FileImage size={22}/><strong>No scenes to publish</strong><span>Import panorama photos in the editor first.</span><button className="button button-subtle" onClick={back}>Go to editor</button></div> : <div className="google-scene-list">{project.scenes.map((scene, index) => <div className="google-scene-row" key={scene.id}><img src={scene.imageUrl} alt=""/><div className="google-scene-details"><div className="google-scene-title"><strong>{scene.name}</strong><span className={ratioOk(scene) ? 'pill-success' : 'pill-warning'}>{ratioOk(scene) ? '2:1 ratio' : 'Check ratio'}</span></div><span className="google-scene-sub">{scene.width} × {scene.height} · {bytesLabel(scene.size)}{scene.googlePhotoId ? ' · Photo ID: ' + scene.googlePhotoId : ''}</span><div className="google-position-fields"><label><span>Latitude</span><input type="number" min="-90" max="90" step="any" placeholder="17.385" value={scene.latitude ?? ''} onChange={(e) => patchScene(scene.id, { latitude: numeric(e.target.value) })}/></label><label><span>Longitude</span><input type="number" min="-180" max="180" step="any" placeholder="78.486" value={scene.longitude ?? ''} onChange={(e) => patchScene(scene.id, { longitude: numeric(e.target.value) })}/></label><label><span>Heading °</span><input type="number" min="0" max="359.9" step="0.1" value={scene.heading} onChange={(e) => patchScene(scene.id, { heading: Math.max(0, Math.min(359.9, numeric(e.target.value) ?? 0)) })}/></label></div><div className="scene-preflight-line">{ratioOk(scene) ? <Check size={13}/> : <CircleAlert size={13}/>}<span>{ratioOk(scene) ? 'Dimensions look suitable; confirm it is a full 360° panorama.' : 'A full equirectangular 2:1 image is required.'}</span>{coordsOk(scene) ? <BadgeCheck size={13} className="preflight-check"/> : <span className="missing-coordinate">Location needed</span>}{scene.googleShareLink && <a href={scene.googleShareLink} target="_blank" rel="noreferrer">Open result <ExternalLink size={11}/></a>}</div></div><span className="google-row-index">{String(index + 1).padStart(2, '0')}</span></div>)}</div>}
      <div className="google-card-footer"><div className="upload-note"><ShieldCheck size={15}/><span>Originals are not changed. Derived JPEG copies with Photo Sphere XMP are created for submission.</span></div><button className="button button-primary" disabled={!project.scenes.length || busy || readyCount !== project.scenes.length || !clientId.trim()} onClick={publish}>{busy ? <LoaderCircle size={15} className="spin"/> : <Upload size={15}/>} {busy ? 'Working…' : 'Prepare & publish scenes'}</button></div>
      {progress && <div className="publish-progress"><LoaderCircle size={15} className="spin"/><span>{progress}</span></div>}{results.length > 0 && <div className="google-results"><strong><PackageCheck size={15}/> API results</strong>{results.map((result, i) => <p key={i}><Check size={13}/>{result}</p>)}</div>}
    </section>
    <div className="google-disclaimer"><ShieldCheck size={15}/><p>Google may reject, process slowly, or decline to surface an uploaded image publicly. Verify final status in Google Maps / Street View. Website export does not publish to Google.</p></div>
  </div>;
}
