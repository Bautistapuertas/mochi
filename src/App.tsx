import { useCallback, useEffect, useState } from 'react';
import { Button, Spinner, ToastProvider, errorText } from './components/ui';
import { FacuContext } from './lib/context';
import { Offline } from './components/icons';
import { AuthError, currentUser, offlineMode } from './lib/drive';
import { loadTree, type Tree } from './lib/facu';
import { useRoute } from './lib/router';
import Shell from './components/Shell';
import MochiBubble from './components/MochiBubble';
import FechasScreen from './screens/FechasScreen';
import EntregasScreen from './screens/EntregasScreen';
import CarreraScreen from './screens/CarreraScreen';
import Home from './screens/Home';
import YoScreen from './screens/YoScreen';
import ImportScreen from './screens/ImportScreen';
import AsistenteScreen from './screens/AsistenteScreen';
import Login from './screens/Login';
import MateriaScreen from './screens/MateriaScreen';
import SearchScreen from './screens/SearchScreen';
import Viewer from './screens/Viewer';

// Aviso cuando se está mostrando lo guardado porque no hay internet.
function OfflineBanner({ onBack }: { onBack: () => void }) {
  const [off, setOff] = useState(offlineMode);
  useEffect(() => {
    const sync = () => setOff(offlineMode);
    const online = () => onBack();
    addEventListener('mochi:offline', sync);
    addEventListener('online', online);
    return () => {
      removeEventListener('mochi:offline', sync);
      removeEventListener('online', online);
    };
  }, [onBack]);
  if (!off) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[70] flex justify-center pointer-events-none safe-top">
      <div className="mt-2 px-4 h-8 rounded-full bg-ink text-bg text-sm font-semibold flex items-center gap-2 shadow-lg">
        <Offline width={16} height={16} /> Sin conexión · mostrando lo guardado
      </div>
    </div>
  );
}

const PENDING = 'mochi:importar';

export default function App() {
  const [tree, setTree] = useState<Tree | null>(null);
  const [status, setStatus] = useState<'loading' | 'login' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const route = useRoute();

  const reload = useCallback(async () => {
    try {
      setTree(await loadTree());
      setStatus('ready');
    } catch (e) {
      if (e instanceof AuthError) return setStatus('login');
      setError(errorText(e));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Después de entrar, se abre el link compartido que se estaba por recibir.
  useEffect(() => {
    if (status !== 'ready') return;
    try {
      const pending = localStorage.getItem(PENDING);
      if (pending) {
        localStorage.removeItem(PENDING);
        if (location.hash !== pending) location.hash = pending;
      }
    } catch {}
  }, [status, tree]);

  if (status === 'loading')
    return (
      <div className="min-h-dvh grid place-items-center">
        <Spinner />
      </div>
    );

  if (status === 'login') {
    if (route.name === 'importar') {
      try {
        localStorage.setItem(PENDING, location.hash);
      } catch {}
    }
    return <Login sharing={route.name === 'importar'} />;
  }

  if (status === 'error' || !tree)
    return (
      <div className="min-h-dvh grid place-items-center p-6 text-center">
        <div className="max-w-sm">
          <p className="text-lg font-bold mb-2">No pudimos cargar tus apuntes</p>
          <p className="text-muted mb-6 break-words">{error}</p>
          <Button variant="primary" onClick={() => (setStatus('loading'), reload())}>
            Reintentar
          </Button>
        </div>
      </div>
    );

  return (
    <FacuContext.Provider value={{ tree, reload, user: currentUser }}>
      <ToastProvider>
        <Shell route={route}>
          {route.name === 'materia' && route.id ? (
            <MateriaScreen key={route.id} id={route.id} folderId={route.folder} />
          ) : route.name === 'search' ? (
            <SearchScreen initial={route.q ?? ''} />
          ) : route.name === 'fechas' ? (
            <FechasScreen />
          ) : route.name === 'entregas' ? (
            <EntregasScreen />
          ) : route.name === 'carrera' ? (
            <CarreraScreen />
          ) : route.name === 'yo' ? (
            <YoScreen />
          ) : route.name === 'ia' ? (
            <AsistenteScreen />
          ) : route.name === 'importar' && route.id ? (
            <ImportScreen id={route.id} />
          ) : (
            <Home />
          )}
        </Shell>
        {route.file && <Viewer key={route.file} id={route.file} />}
        <MochiBubble route={route} />
        <OfflineBanner onBack={reload} />
      </ToastProvider>
    </FacuContext.Provider>
  );
}
