import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { dismissTopEscapeAction } from '../lib/escapeActions';

export function EscapeNavigation(): null {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const handle = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.repeat || event.isComposing || event.defaultPrevented) return;
      if (dismissTopEscapeAction()) { event.preventDefault(); return; }
      if (pathname !== '/' && pathname !== '/login') { event.preventDefault(); navigate('/'); }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [navigate, pathname]);
  return null;
}
