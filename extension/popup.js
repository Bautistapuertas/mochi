const DEFAULT_MOCHI_URL = 'https://mochi-omega-ten.vercel.app';

let mochiUrl = DEFAULT_MOCHI_URL;
let accessToken = null;
let currentTab = null;
let activeMode = 'page'; // 'excalidraw' | 'pdf' | 'clip' | 'file' | 'page'
let customFile = null;
let treeMaterias = [];
let treeFolders = [];

// Elementos DOM
const btnSettings = document.getElementById('btnSettings');
const settingsPanel = document.getElementById('settingsPanel');
const txtMochiUrl = document.getElementById('txtMochiUrl');
const btnSaveSettings = document.getElementById('btnSaveSettings');

const loginWarning = document.getElementById('loginWarning');
const btnOpenMochi = document.getElementById('btnOpenMochi');
const mainForm = document.getElementById('mainForm');

const detectedBanner = document.getElementById('detectedBanner');
const detectedIcon = document.getElementById('detectedIcon');
const detectedBadge = document.getElementById('detectedBadge');
const detectedDesc = document.getElementById('detectedDesc');

const txtFileName = document.getElementById('txtFileName');
const formatGroup = document.getElementById('formatGroup');
const selMateria = document.getElementById('selMateria');
const folderGroup = document.getElementById('folderGroup');
const selFolder = document.getElementById('selFolder');

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');

const btnSave = document.getElementById('btnSave');
const btnSaveText = document.getElementById('btnSaveText');
const statusBox = document.getElementById('statusBox');

const userAccountText = document.getElementById('userAccountText');
const linkViewMochi = document.getElementById('linkViewMochi');

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
  // Cargar configuración guardada
  const cfg = await chrome.storage.local.get(['mochiUrl', 'lastMateria', 'lastFolder']);
  if (cfg.mochiUrl) mochiUrl = cfg.mochiUrl;
  txtMochiUrl.value = mochiUrl;
  linkViewMochi.href = mochiUrl;

  setupEvents();
  await checkAuthAndLoad();
  await detectActiveTab();
});

function setupEvents() {
  // Toggle ajustes
  btnSettings.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
  });

  btnSaveSettings.addEventListener('click', async () => {
    let url = txtMochiUrl.value.trim();
    if (!url) url = DEFAULT_MOCHI_URL;
    url = url.replace(/\/+$/, '');
    mochiUrl = url;
    await chrome.storage.local.set({ mochiUrl: url });
    linkViewMochi.href = mochiUrl;
    settingsPanel.classList.add('hidden');
    showStatus('Dirección guardada. Reconectando...', 'success');
    await checkAuthAndLoad();
  });

  btnOpenMochi.addEventListener('click', () => {
    chrome.tabs.create({ url: mochiUrl });
  });

  linkViewMochi.addEventListener('click', (e) => {
    e.preventDefault();
    const matId = selMateria.value;
    const destUrl = matId ? `${mochiUrl}/#/m/${matId}` : mochiUrl;
    chrome.tabs.create({ url: destUrl });
  });

  // Cambio de materia -> cargar subcarpetas
  selMateria.addEventListener('change', () => {
    const matId = selMateria.value;
    chrome.storage.local.set({ lastMateria: matId });
    updateSubfolders(matId);
  });

  selFolder.addEventListener('change', () => {
    chrome.storage.local.set({ lastFolder: selFolder.value });
  });

  // Dropzone de archivos
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleCustomFile(e.target.files[0]);
    }
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--accent)';
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.style.borderColor = 'var(--border)';
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--border)';
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleCustomFile(e.dataTransfer.files[0]);
    }
  });

  // Botón guardar
  btnSave.addEventListener('click', executeSave);
}

function handleCustomFile(file) {
  customFile = file;
  activeMode = 'file';
  txtFileName.value = file.name;
  formatGroup.classList.add('hidden');
  detectedBanner.classList.remove('hidden');
  detectedIcon.textContent = '📎';
  detectedBadge.textContent = 'Archivo local';
  detectedDesc.textContent = `Archivo listo (${Math.round(file.size / 1024)} KB)`;
}

// 1. Verificar autenticación con Mochi
async function checkAuthAndLoad() {
  userAccountText.textContent = 'Verificando sesión...';
  try {
    const resp = await fetch(`${mochiUrl}/api/token`, { credentials: 'include' });
    if (!resp.ok) {
      throw new Error('Sin sesión activa');
    }
    const data = await resp.json();
    accessToken = data.access_token;
    userAccountText.textContent = data.user?.name ? `${data.user.name} (${data.user.email})` : data.user?.email || 'Conectado';
    loginWarning.classList.add('hidden');
    mainForm.classList.remove('hidden');

    await loadMateriasFromDrive();
  } catch (err) {
    userAccountText.textContent = 'No conectado';
    loginWarning.classList.remove('hidden');
    mainForm.classList.add('hidden');
  }
}

// 2. Cargar materias y carpetas de Google Drive
async function loadMateriasFromDrive() {
  if (!accessToken) return;
  selMateria.innerHTML = '<option value="" disabled selected>Cargando materias...</option>';

  try {
    const query = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and trashed=false");
    const fields = encodeURIComponent('files(id,name,parents,appProperties)');
    const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=1000`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const j = await r.json();
    const all = j.files || [];

    // Materias son aquellas con facu=materia o cuyo padre es un año (e.g. 3er año)
    const yearFolders = all.filter(f => /([1-7])(?:er|do|er|to|mo)?\s*año/i.test(f.name) || f.appProperties?.facu === 'year');
    const yearIds = new Set(yearFolders.map(y => y.id));

    treeMaterias = all.filter(f => f.appProperties?.facu === 'materia' || (f.parents && yearIds.has(f.parents[0])));
    treeFolders = all.filter(f => !treeMaterias.some(m => m.id === f.id) && !yearIds.has(f.id));

    selMateria.innerHTML = '';
    if (treeMaterias.length === 0) {
      selMateria.innerHTML = '<option value="" disabled selected>No se encontraron materias</option>';
      return;
    }

    treeMaterias.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    for (const m of treeMaterias) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      selMateria.appendChild(opt);
    }

    const { lastMateria } = await chrome.storage.local.get('lastMateria');
    if (lastMateria && treeMaterias.some(m => m.id === lastMateria)) {
      selMateria.value = lastMateria;
    } else {
      selMateria.selectedIndex = 0;
    }

    updateSubfolders(selMateria.value);
  } catch (e) {
    showStatus('Error al leer materias de Drive: ' + e.message, 'error');
  }
}

function updateSubfolders(materiaId) {
  if (!materiaId) {
    folderGroup.classList.add('hidden');
    return;
  }
  // Encontrar todas las carpetas cuyo ancestro sea esta materia
  const materiaFolders = [];
  const queue = [materiaId];
  while (queue.length > 0) {
    const parentId = queue.shift();
    const children = treeFolders.filter(f => f.parents && f.parents.includes(parentId));
    for (const c of children) {
      materiaFolders.push(c);
      queue.push(c.id);
    }
  }

  selFolder.innerHTML = '<option value="">(Carpeta principal de la materia)</option>';
  if (materiaFolders.length > 0) {
    folderGroup.classList.remove('hidden');
    materiaFolders.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    for (const f of materiaFolders) {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = `📁 ${f.name}`;
      selFolder.appendChild(opt);
    }
  } else {
    folderGroup.classList.add('hidden');
  }
}

// 3. Detección de la pestaña activa (Excalidraw, PDF, etc.)
async function detectActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tabs[0];
  if (!currentTab) return;

  // Revisar si hay un clip pendiente de menú contextual
  const { pendingClip } = await chrome.storage.local.get('pendingClip');
  if (pendingClip) {
    await chrome.storage.local.remove('pendingClip');
    activeMode = 'clip';
    detectedBanner.classList.remove('hidden');
    detectedIcon.textContent = '📝';
    detectedBadge.textContent = 'Texto seleccionado';
    detectedDesc.textContent = pendingClip.title;
    txtFileName.value = pendingClip.filename;
    customFile = new Blob([pendingClip.content], { type: 'text/markdown' });
    return;
  }

  const url = currentTab.url || '';

  // CASO 1: Excalidraw
  if (url.includes('excalidraw.com') || currentTab.title.toLowerCase().includes('excalidraw')) {
    activeMode = 'excalidraw';
    detectedBanner.classList.remove('hidden');
    detectedIcon.textContent = '🎨';
    detectedBadge.textContent = 'Pizarra Excalidraw';
    detectedDesc.textContent = 'Diagrama detectado en esta pestaña';
    formatGroup.classList.remove('hidden');

    const cleanTitle = currentTab.title.replace(/[-|]\s*excalidraw/i, '').trim() || 'Pizarra';
    txtFileName.value = `${cleanTitle} - ${new Date().toISOString().slice(0, 10)}`;
    return;
  }

  // CASO 2: Documento PDF
  if (url.toLowerCase().endsWith('.pdf') || url.includes('.pdf?')) {
    activeMode = 'pdf';
    detectedBanner.classList.remove('hidden');
    detectedIcon.textContent = '📄';
    detectedBadge.textContent = 'Documento PDF';
    detectedDesc.textContent = 'PDF listo para descargar y guardar';

    const cleanName = decodeURIComponent(url.split('/').pop().split('?')[0]) || 'Documento.pdf';
    txtFileName.value = cleanName;
    return;
  }

  // CASO 3: Página web normal
  activeMode = 'page';
  detectedBanner.classList.remove('hidden');
  detectedIcon.textContent = '🌐';
  detectedBadge.textContent = 'Página web';
  detectedDesc.textContent = 'Guardar apunte con enlace y título';
  const pageTitle = (currentTab.title || 'Apunte').replace(/[<>:"/\\|?*]/g, '').slice(0, 40).trim();
  txtFileName.value = `${pageTitle} - ${new Date().toISOString().slice(0, 10)}.md`;
}

// 4. Ejecución del guardado en Google Drive
async function executeSave() {
  if (!accessToken) {
    showStatus('Primero iniciá sesión en Mochi.', 'error');
    return;
  }

  const targetFolderId = selFolder.value || selMateria.value;
  if (!targetFolderId) {
    showStatus('Seleccioná una materia de destino.', 'error');
    return;
  }

  let fileName = txtFileName.value.trim();
  if (!fileName) {
    showStatus('Escribí un nombre para el archivo.', 'error');
    return;
  }

  setSaving(true);

  try {
    let fileBlob = null;
    let mimeType = 'application/octet-stream';

    if (activeMode === 'excalidraw') {
      const selectedFormat = document.querySelector('input[name="format"]:checked').value;
      if (selectedFormat === 'excalidraw') {
        if (!fileName.endsWith('.excalidraw')) fileName += '.excalidraw';
        mimeType = 'application/vnd.excalidraw+json';

        // Extraer elementos de localStorage de la pestaña
        const results = await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          func: () => {
            const el = localStorage.getItem('excalidraw');
            const st = localStorage.getItem('excalidraw-state');
            const fl = localStorage.getItem('files');
            return {
              type: 'excalidraw',
              version: 2,
              source: 'https://excalidraw.com',
              elements: el ? JSON.parse(el) : [],
              appState: st ? JSON.parse(st) : {},
              files: fl ? JSON.parse(fl) : {}
            };
          }
        });

        const scene = results?.[0]?.result;
        if (!scene || !scene.elements || scene.elements.length === 0) {
          throw new Error('No se encontraron trazos en la pizarra de Excalidraw.');
        }
        fileBlob = new Blob([JSON.stringify(scene, null, 2)], { type: mimeType });
      } else {
        // Formato PNG
        if (!fileName.endsWith('.png')) fileName += '.png';
        mimeType = 'image/png';

        const results = await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          func: () => {
            const canvas = document.querySelector('.excalidraw__canvas') || document.querySelector('canvas');
            return canvas ? canvas.toDataURL('image/png') : null;
          }
        });

        const dataUrl = results?.[0]?.result;
        if (!dataUrl) throw new Error('No se pudo capturar la imagen de la pizarra.');
        const res = await fetch(dataUrl);
        fileBlob = await res.blob();
      }
    } else if (activeMode === 'pdf') {
      if (!fileName.endsWith('.pdf')) fileName += '.pdf';
      mimeType = 'application/pdf';
      const pdfResp = await fetch(currentTab.url);
      fileBlob = await pdfResp.blob();
    } else if (activeMode === 'file' && customFile) {
      fileBlob = customFile;
      mimeType = customFile.type || 'application/octet-stream';
    } else {
      // Nota de página web en Markdown
      if (!fileName.endsWith('.md')) fileName += '.md';
      mimeType = 'text/markdown';

      // Obtener texto seleccionado si existe
      let selText = '';
      try {
        const selRes = await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          func: () => window.getSelection().toString()
        });
        selText = selRes?.[0]?.result || '';
      } catch {}

      const mdContent = `# ${currentTab.title}\n\n- **Enlace:** [${currentTab.url}](${currentTab.url})\n- **Fecha:** ${new Date().toLocaleString('es-AR')}\n\n${selText ? `## Apunte seleccionado\n> ${selText}\n` : ''}`;
      fileBlob = new Blob([mdContent], { type: mimeType });
    }

    // Subir a Google Drive (Multipart upload)
    await uploadToDrive(fileName, targetFolderId, mimeType, fileBlob);

    showStatus(`¡"${fileName}" guardado en Mochi con éxito! 🎉`, 'success');
  } catch (err) {
    showStatus('Error al guardar: ' + err.message, 'error');
  } finally {
    setSaving(false);
  }
}

async function uploadToDrive(name, parentId, mimeType, blob) {
  const metadata = {
    name,
    parents: [parentId],
    mimeType
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: form
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Drive respondió ${res.status}: ${errText.slice(0, 150)}`);
  }

  return await res.json();
}

function setSaving(saving) {
  btnSave.disabled = saving;
  btnSaveText.textContent = saving ? 'Guardando en Drive...' : 'Guardar en Mochi';
}

function showStatus(msg, type) {
  statusBox.className = `status-box status-${type}`;
  statusBox.textContent = msg;
  statusBox.classList.remove('hidden');
}
