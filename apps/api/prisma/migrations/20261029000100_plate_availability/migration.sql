CREATE TYPE "PlateSize" AS ENUM ('kilo', 'half_kilo');
ALTER TABLE products ADD COLUMN plate_size "PlateSize";
-- Clasifica las presentaciones existentes; otros productos y extras no consumen estos platos.
UPDATE products SET plate_size = CASE
  WHEN lower(unit || ' ' || name) ~ '(medio|1/2|½)' THEN 'half_kilo'::"PlateSize"
  WHEN lower(unit) IN ('kilo', 'kg') OR lower(name) ~ '(1 kilo|1 kg)' THEN 'kilo'::"PlateSize"
  ELSE NULL END WHERE NOT is_complement;

CREATE TABLE plate_days (
  id TEXT PRIMARY KEY, location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  business_date VARCHAR(10) NOT NULL,
  initial_kilo INTEGER NOT NULL CHECK (initial_kilo >= 0),
  initial_half INTEGER NOT NULL CHECK (initial_half >= 0),
  kilo_limit INTEGER NOT NULL, half_limit INTEGER NOT NULL,
  kilo_reserved INTEGER NOT NULL DEFAULT 0 CHECK (kilo_reserved >= 0),
  half_reserved INTEGER NOT NULL DEFAULT 0 CHECK (half_reserved >= 0),
  kilo_sold INTEGER NOT NULL DEFAULT 0 CHECK (kilo_sold >= 0),
  half_sold INTEGER NOT NULL DEFAULT 0 CHECK (half_sold >= 0),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL,
  CONSTRAINT plate_days_location_id_business_date_key UNIQUE(location_id, business_date),
  CHECK (kilo_limit >= kilo_reserved + kilo_sold),
  CHECK (half_limit >= half_reserved + half_sold)
);
CREATE TYPE "PlateAllocationState" AS ENUM ('reserved', 'sold', 'released');
CREATE TABLE plate_allocations (
  sale_id TEXT PRIMARY KEY REFERENCES sales(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  day_id TEXT NOT NULL REFERENCES plate_days(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  kilo INTEGER NOT NULL CHECK (kilo >= 0), half_kilo INTEGER NOT NULL CHECK (half_kilo >= 0),
  state "PlateAllocationState" NOT NULL DEFAULT 'reserved'
);
CREATE INDEX plate_allocations_day_id_idx ON plate_allocations(day_id);
