import { createContext, useContext } from 'react';
import type { User } from './drive';
import type { Tree } from './facu';

type Facu = { tree: Tree; user: User | null; reload: () => Promise<void> };

export const FacuContext = createContext<Facu>(null!);
export const useFacu = () => useContext(FacuContext);

// Avisa a las pantallas que algo cambió (archivo renombrado, movido, borrado...).
export const CHANGED = 'facu:changed';
export const notifyChanged = () => dispatchEvent(new Event(CHANGED));
