import type { JSX, MouseEvent, ReactNode } from 'react';

interface ModalBackdropProps {
  onClose: () => void;
  children: ReactNode;
  contentClassName?: string;
  zIndexClassName?: string;
}

export function ModalBackdrop({
  onClose,
  children,
  contentClassName = '',
  zIndexClassName = 'z-40',
}: ModalBackdropProps): JSX.Element {
  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>): void => {
    event.stopPropagation();
    onClose();
  };

  return (
    <div
      onClick={handleBackdropClick}
      className={`fixed inset-0 flex items-center justify-center bg-text/40 p-6 ${zIndexClassName}`}
    >
      <div onClick={(event) => event.stopPropagation()} className={contentClassName}>
        {children}
      </div>
    </div>
  );
}
