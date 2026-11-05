import type { MandaditoExpense, Order } from '@aguachiles/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type JSX } from 'react';
import { ModalBackdrop } from '../../components/ModalBackdrop';
import { authFetch } from '../../lib/authFetch';
import { usePaymentMethods } from '../payments/hooks';
import { useTerminalCashRegisterId } from './terminalStore';
import { useCurrentCashSession } from './hooks';
import { AmountKeypad } from './AmountKeypad';

export function MandaditoModal({
  saleId,
  ticketNumber,
  onClose,
}: {
  saleId?: string;
  ticketNumber?: string;
  onClose: () => void;
}): JSX.Element {
  const registerId = useTerminalCashRegisterId();
  const session = useCurrentCashSession(registerId ?? '');
  const methods = usePaymentMethods();
  const cashMethod = methods.data?.find((method) => method.type === 'cash');
  const [amount, setAmount] = useState('');
  const [folio, setFolio] = useState(ticketNumber ?? '');
  const [requestId] = useState(() => crypto.randomUUID());
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      let orderId = folio.trim() === ticketNumber ? saleId : undefined;
      if (folio.trim() && !orderId) {
        const order = await authFetch<Order>(
          `/api/orders/lookup?ticketNumber=${encodeURIComponent(folio.trim())}`,
        );
        orderId = order.id;
      }
      return authFetch<MandaditoExpense>(`/api/cash-sessions/${session.data!.id}/mandaditos`, {
        method: 'POST',
        body: {
          clientRequestId: requestId,
          saleId: orderId,
          paymentMethodId: cashMethod!.id,
          amount: Number(amount),
        },
      });
    },
    onSuccess: () => {
      for (const key of ['cash-session', 'cash-movements', 'mandaditos', 'operations', 'reports'])
        void queryClient.invalidateQueries({ queryKey: [key] });
      onClose();
    },
  });
  const value = Number(amount);
  const valid =
    session.data &&
    cashMethod &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 100000 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.00001;
  return (
    <ModalBackdrop
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      zIndexClassName="z-50"
      contentClassName="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-5"
    >
      <h2 className="text-lg font-semibold">Agregar Envío / Mandadito</h2>
      <p className="mb-4 text-sm text-muted">
        El monto se registra como salida de efectivo de caja.
      </p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && !mutation.isPending) mutation.mutate();
        }}
      >
        {!registerId || (registerId && !session.isLoading && !session.data && !session.isError) ? (
          <p role="alert" className="text-sm text-red-700">
            Selecciona y abre la caja de esta terminal en Caja y cierre para registrar el gasto.
          </p>
        ) : null}
        {session.isLoading || methods.isLoading ? (
          <p className="text-sm text-muted">Cargando caja…</p>
        ) : null}
        {session.isError || methods.isError ? (
          <p role="alert">No se pudieron cargar los datos. Cierra y vuelve a intentarlo.</p>
        ) : null}
        {methods.isSuccess && !cashMethod ? (
          <p role="alert" className="text-sm text-red-700">
            No hay un método de efectivo activo. Revisa la configuración de pagos.
          </p>
        ) : null}
        <label className="text-sm">
          Folio del pedido (opcional)
          <input
            disabled={mutation.isPending}
            value={folio}
            onChange={(event) => setFolio(event.target.value)}
            placeholder="#123; vacío para gasto independiente"
            className="mt-1 w-full rounded-lg border border-border px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Monto pagado al mandadito ($)
          <input
            required
            disabled={mutation.isPending}
            type="text"
            inputMode="none"
            value={amount}
            onChange={(event) => {
              const next = event.target.value.replace(',', '.');
              if (/^\d{0,6}(\.\d{0,2})?$/.test(next)) setAmount(next);
            }}
            placeholder="0.00"
            className="mt-1 w-full rounded-xl border border-border px-4 py-3 text-right text-3xl font-semibold tabular-nums"
          />
        </label>
        <AmountKeypad value={amount} onChange={setAmount} disabled={mutation.isPending} />
        {mutation.isError ? (
          <p role="alert" className="text-sm text-red-700">
            {mutation.error.message}
          </p>
        ) : null}
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!valid || mutation.isPending}
            className="rounded-lg bg-accent px-3 py-2 font-semibold text-white disabled:opacity-50"
          >
            {mutation.isPending ? 'Registrando…' : 'Registrar gasto'}
          </button>
        </div>
      </form>
    </ModalBackdrop>
  );
}
