// Service worker en background para menús contextuales y manejo de eventos

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'mochi-save-selection',
    title: 'Guardar texto en Mochi',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'mochi-save-link',
    title: 'Guardar enlace en Mochi',
    contexts: ['link']
  });

  chrome.contextMenus.create({
    id: 'mochi-save-page',
    title: 'Guardar página en Mochi',
    contexts: ['page']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let clipData = null;

  if (info.menuItemId === 'mochi-save-selection' && info.selectionText) {
    clipData = {
      type: 'note',
      title: tab?.title ? `Apunte - ${tab.title}` : 'Nuevo apunte',
      content: `# ${tab?.title || 'Apunte'}\n\nFuente: ${tab?.url || ''}\n\n> ${info.selectionText}\n`,
      filename: `Apunte - ${Date.now()}.md`
    };
  } else if (info.menuItemId === 'mochi-save-link' && info.linkUrl) {
    clipData = {
      type: 'note',
      title: 'Enlace guardado',
      content: `# Enlace guardado\n\n- **Link:** ${info.linkUrl}\n- **Página de origen:** ${tab?.title || ''} (${tab?.url || ''})\n`,
      filename: `Link - ${Date.now()}.md`
    };
  } else if (info.menuItemId === 'mochi-save-page') {
    clipData = {
      type: 'note',
      title: tab?.title ? `Página - ${tab.title}` : 'Página guardada',
      content: `# ${tab?.title || 'Página web'}\n\n- **URL:** ${tab?.url || ''}\n- **Fecha:** ${new Date().toLocaleString('es-AR')}\n`,
      filename: `Pagina - ${Date.now()}.md`
    };
  }

  if (clipData) {
    await chrome.storage.local.set({ pendingClip: clipData });
    try {
      await chrome.action.openPopup();
    } catch {
      // Si el navegador no permite abrir el popup directamente, el clip queda guardado para la próxima apertura
    }
  }
});
