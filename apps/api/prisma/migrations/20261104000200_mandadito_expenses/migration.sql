ALTER TABLE cash_movements ADD COLUMN category TEXT;
ALTER TABLE cash_movements ADD COLUMN sale_id TEXT REFERENCES sales(id) ON DELETE RESTRICT;
ALTER TABLE cash_movements ADD COLUMN client_request_id TEXT;
CREATE UNIQUE INDEX cash_movements_client_request_id_key ON cash_movements(client_request_id);
CREATE INDEX cash_movements_category_created_at_idx ON cash_movements(category, created_at);
CREATE INDEX cash_movements_sale_id_idx ON cash_movements(sale_id);
ALTER TABLE cash_movements ADD CONSTRAINT mandadito_expense_valid CHECK
  (category IS DISTINCT FROM 'mandadito' OR (type = 'expense' AND amount > 0 AND payment_method_id IS NOT NULL));
