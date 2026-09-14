-- El mensaje de WhatsApp del pedido dejó de mostrar montos (total, envío,
-- método de pago, "paga con", cambio) a pedido del negocio: solo importa la
-- logística de entrega (quién, dónde, qué). Estos dos campos ya no tienen
-- ningún consumidor.
ALTER TABLE "sales" DROP COLUMN "delivery_fee_amount";
ALTER TABLE "sales" DROP COLUMN "cash_tendered_amount";
