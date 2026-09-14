import QRCode from 'qrcode';
import type { JSX } from 'react';
import { useEffect, useRef } from 'react';
import { ModalBackdrop } from '../../components/ModalBackdrop';
import { useWhatsAppShare } from './hooks';

const UI_TEXT = {
  title: 'Enviar por WhatsApp',
  loading: 'Generando…',
  error: 'No se pudo generar el mensaje de WhatsApp.',
  retry: 'Reintentar',
  truncatedWarning:
    'El mensaje era muy largo: se recortaron las notas del pedido para que el código QR siga siendo legible.',
  scanHint: 'Escanéalo con la cámara del celular de quien va a enviarlo.',
  openLink: 'Abrir WhatsApp',
  close: 'Cerrar',
} as const;

const QR_SIZE = 320;

interface WhatsAppModalProps {
  orderId: string;
  onClose: () => void;
}

export function WhatsAppModal({ orderId, onClose }: WhatsAppModalProps): JSX.Element {
  const shareQuery = useWhatsAppShare(orderId, true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!shareQuery.data || !canvasRef.current) return;
    // Generado 100% offline con la librería qrcode: no depende de ningún
    // servicio externo para renderizar el código.
    void QRCode.toCanvas(canvasRef.current, shareQuery.data.url, {
      errorCorrectionLevel: 'M',
      width: QR_SIZE,
      margin: 2,
    });
  }, [shareQuery.data]);

  return (
    <ModalBackdrop
      onClose={onClose}
      zIndexClassName="z-50"
      contentClassName="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-surface p-6"
    >
      <h2 className="m-0 text-[17px] font-semibold">{UI_TEXT.title}</h2>

      {shareQuery.isLoading ? <p className="text-sm text-muted">{UI_TEXT.loading}</p> : null}

      {shareQuery.isError ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-red-600">
            {shareQuery.error instanceof Error ? shareQuery.error.message : UI_TEXT.error}
          </p>
          <button
            type="button"
            onClick={() => void shareQuery.refetch()}
            className="h-9 self-start rounded-lg border border-border px-3 text-[13px] hover:border-border-hover"
          >
            {UI_TEXT.retry}
          </button>
        </div>
      ) : null}

      {shareQuery.data ? (
        <>
          {shareQuery.data.truncated ? (
            <p className="rounded-lg bg-accent-soft px-3 py-2 text-[12px] text-accent-hover">
              {UI_TEXT.truncatedWarning}
            </p>
          ) : null}

          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              width={QR_SIZE}
              height={QR_SIZE}
              className="h-[320px] w-[320px] min-w-[320px]"
            />
          </div>
          <p className="text-center text-xs text-muted">{UI_TEXT.scanHint}</p>

          <a
            href={shareQuery.data.url}
            target="_blank"
            rel="noreferrer"
            className="flex h-11 items-center justify-center rounded-lg border border-border text-[14px] hover:border-border-hover"
          >
            {UI_TEXT.openLink}
          </a>
        </>
      ) : null}

      <button
        type="button"
        onClick={onClose}
        className="h-11 rounded-lg border border-border text-[14px]"
      >
        {UI_TEXT.close}
      </button>
    </ModalBackdrop>
  );
}
