ALTER TABLE sales ADD COLUMN delivery_fee DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0);
ALTER TABLE sale_items ADD COLUMN menu_flavor TEXT;
ALTER TABLE sale_items ADD COLUMN portion_size "PlateSize";
UPDATE sale_items i SET portion_size=p.plate_size, menu_flavor=CASE
 WHEN lower(p.name) LIKE '%tradicional%' OR lower(p.name) LIKE '%verde%' THEN 'green'
 WHEN lower(p.name) LIKE '%colorado%' OR lower(p.name) LIKE '%rojo%' THEN 'red'
 WHEN lower(p.name) LIKE '%prieto%' OR lower(p.name) LIKE '%negro%' THEN 'black' END
FROM products p WHERE p.id=i.product_id AND p.is_complement=false AND p.plate_size IS NOT NULL;
