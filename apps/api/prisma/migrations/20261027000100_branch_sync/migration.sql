ALTER TABLE sales ADD COLUMN client_request_id TEXT, ADD COLUMN paid_at TIMESTAMP(3);
CREATE UNIQUE INDEX sales_client_request_id_key ON sales(client_request_id);
UPDATE sales s SET paid_at = p.first_payment FROM
  (SELECT sale_id, min(created_at) first_payment FROM sale_payments GROUP BY sale_id) p
  WHERE s.id = p.sale_id;

CREATE TABLE local_nodes (
  id TEXT PRIMARY KEY DEFAULT 'local' CHECK (id = 'local'),
  location_id TEXT NOT NULL UNIQUE REFERENCES locations(id) ON DELETE RESTRICT,
  installation_id TEXT NOT NULL UNIQUE,
  last_success_at TIMESTAMP(3), last_error TEXT
);
CREATE TABLE sync_outbox (
  sequence BIGSERIAL PRIMARY KEY, kind TEXT NOT NULL, entity_id TEXT NOT NULL,
  location_id TEXT NOT NULL, payload JSONB NOT NULL, deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, sent_at TIMESTAMP(3)
);
CREATE INDEX sync_outbox_sent_at_sequence_idx ON sync_outbox(sent_at, sequence);
CREATE TABLE sync_installations (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, source_location_id TEXT NOT NULL UNIQUE,
  time_zone TEXT NOT NULL, token_hash TEXT NOT NULL, is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMP(3), pending_count INTEGER
);
CREATE TABLE sync_records (
  installation_id TEXT NOT NULL REFERENCES sync_installations(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL, entity_id TEXT NOT NULL, sequence BIGINT NOT NULL,
  payload JSONB NOT NULL, deleted BOOLEAN NOT NULL DEFAULT false,
  occurred_at TIMESTAMP(3) NOT NULL, amount DECIMAL(12,2) NOT NULL,
  status TEXT, payment_type TEXT,
  PRIMARY KEY (installation_id, kind, entity_id)
);
CREATE INDEX sync_records_installation_id_occurred_at_kind_idx
  ON sync_records(installation_id, occurred_at, kind);

-- Captura una proyección mínima, sin datos de entrega ni credenciales.
-- Los triggers y la operación original confirman o revierten juntos.
CREATE FUNCTION capture_pos_sync_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  row_data JSONB;
  branch_id TEXT;
  event_kind TEXT;
  event_payload JSONB;
  method_type TEXT;
BEGIN
  row_data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  CASE TG_TABLE_NAME
    WHEN 'sales' THEN
      event_kind := 'sale';
      branch_id := row_data->>'location_id';
      event_payload := jsonb_build_object(
        'ticketNumber', row_data->>'ticket_number', 'status', row_data->>'status',
        'amount', row_data->>'total', 'occurredAt',
        COALESCE(row_data->>'paid_at', row_data->>'created_at') || 'Z');
    WHEN 'sale_payments' THEN
      event_kind := 'payment';
      SELECT location_id INTO branch_id FROM sales WHERE id = row_data->>'sale_id';
      SELECT type::text INTO method_type FROM payment_methods WHERE id = row_data->>'payment_method_id';
      event_payload := jsonb_build_object(
        'saleId', row_data->>'sale_id', 'paymentType', method_type,
        'amount', row_data->>'amount', 'occurredAt', row_data->>'created_at' || 'Z');
    WHEN 'refunds' THEN
      event_kind := 'refund';
      SELECT location_id INTO branch_id FROM sales WHERE id = row_data->>'sale_id';
      event_payload := jsonb_build_object(
        'saleId', row_data->>'sale_id', 'status', row_data->>'status',
        'amount', row_data->>'total_refunded', 'occurredAt', row_data->>'created_at' || 'Z');
    WHEN 'cash_register_sessions' THEN
      event_kind := 'cashSession';
      SELECT location_id INTO branch_id FROM cash_registers WHERE id = row_data->>'cash_register_id';
      event_payload := jsonb_build_object(
        'registerId', row_data->>'cash_register_id', 'status', row_data->>'status',
        'amount', row_data->>'opening_amount', 'occurredAt', row_data->>'opened_at' || 'Z',
        'expectedAmount', row_data->>'expected_closing_amount',
        'actualAmount', row_data->>'actual_closing_amount', 'difference', row_data->>'difference',
        'closedAt', CASE WHEN row_data->>'closed_at' IS NULL THEN NULL ELSE row_data->>'closed_at' || 'Z' END);
    WHEN 'cash_movements' THEN
      event_kind := 'cashMovement';
      SELECT r.location_id INTO branch_id FROM cash_register_sessions s
        JOIN cash_registers r ON r.id = s.cash_register_id WHERE s.id = row_data->>'session_id';
      SELECT type::text INTO method_type FROM payment_methods WHERE id = row_data->>'payment_method_id';
      event_payload := jsonb_build_object(
        'sessionId', row_data->>'session_id', 'type', row_data->>'type',
        'paymentType', method_type, 'amount', row_data->>'amount',
        'occurredAt', row_data->>'created_at' || 'Z');
  END CASE;
  INSERT INTO sync_outbox(kind, entity_id, location_id, payload, deleted)
    VALUES (event_kind, row_data->>'id', branch_id, event_payload, TG_OP = 'DELETE');
  RETURN NULL;
END;
$$;

CREATE TRIGGER sales_sync AFTER INSERT OR UPDATE OR DELETE ON sales
  FOR EACH ROW EXECUTE FUNCTION capture_pos_sync_event();
CREATE TRIGGER payments_sync AFTER INSERT OR UPDATE OR DELETE ON sale_payments
  FOR EACH ROW EXECUTE FUNCTION capture_pos_sync_event();
CREATE TRIGGER refunds_sync AFTER INSERT OR UPDATE OR DELETE ON refunds
  FOR EACH ROW EXECUTE FUNCTION capture_pos_sync_event();
CREATE TRIGGER sessions_sync AFTER INSERT OR UPDATE OR DELETE ON cash_register_sessions
  FOR EACH ROW EXECUTE FUNCTION capture_pos_sync_event();
CREATE TRIGGER movements_sync AFTER INSERT OR UPDATE OR DELETE ON cash_movements
  FOR EACH ROW EXECUTE FUNCTION capture_pos_sync_event();

-- Carga inicial bajo los locks de la migración: el historial no queda fuera.
UPDATE sales SET id = id;
UPDATE sale_payments SET id = id;
UPDATE refunds SET id = id;
UPDATE cash_register_sessions SET id = id;
UPDATE cash_movements SET id = id;
