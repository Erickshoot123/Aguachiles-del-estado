import { useEffect, useRef, type RefObject } from 'react';

interface EscapeAction { close: () => void; element: () => HTMLElement | null }
const actions: EscapeAction[] = [];

export function dismissTopEscapeAction(): boolean {
  const dialogs = actions.filter((action) => action.element()?.isConnected);
  dialogs.sort((a, b) => {
    const left = a.element()!; const right = b.element()!;
    const z = (Number.parseInt(getComputedStyle(left).zIndex, 10) || 0) - (Number.parseInt(getComputedStyle(right).zIndex, 10) || 0);
    return z || (left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  });
  const action = dialogs.at(-1) ?? actions.at(-1);
  if (!action) return false;
  action.close(); return true;
}

export function useEscapeDismiss(close: () => void, enabled = true, element?: RefObject<HTMLElement | null>): void {
  const callback = useRef(close);
  useEffect(() => { callback.current = close; }, [close]);
  useEffect(() => {
    if (!enabled) return;
    const action = { close: () => callback.current(), element: () => element?.current ?? null };
    actions.push(action);
    return () => { const index = actions.indexOf(action); if (index >= 0) actions.splice(index, 1); };
  }, [enabled, element]);
}
