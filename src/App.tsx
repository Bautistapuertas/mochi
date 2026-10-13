import { useCallback, useEffect, useState } from 'react';
import { Button, Spinner, ToastProvider, errorText } from './components/ui';
import { FacuContext } from './lib/context';
import { Offline } from './components/icons';
import { AuthError, currentUser, offlineMode } from './lib/drive';
import { loadTree, type Tree } from './lib/facu';
import { useRoute } from './lib/router';
import Home from './screens/Home';
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

  if (status === 'loading')
    return (
      <div className="min-h-dvh grid place-items-center">
        <Spinner />
      </div>
    );

  if (status === 'login') return <Login />;

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
        {route.name === 'materia' && route.id ? (
          <MateriaScreen key={route.id} id={route.id} folderId={route.folder} />
        ) : route.name === 'search' ? (
          <SearchScreen initial={route.q ?? ''} />
        ) : (
          <Home />
        )}
        {route.file && <Viewer key={route.file} id={route.file} />}
        <OfflineBanner onBack={reload} />
      </ToastProvider>
    </FacuContext.Provider>
  );
}
