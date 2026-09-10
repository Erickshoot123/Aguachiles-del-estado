-- Evita que dos sesiones queden abiertas a la vez en la misma caja
-- registradora. Sin este índice, dos aperturas concurrentes en la misma
-- caja pueden tener éxito ambas (el service solo hacía un SELECT + INSERT
-- sin protección a nivel de base de datos) -- comprobado con una prueba de
-- concurrencia. Es un índice único parcial (Prisma no puede expresarlo en
-- el schema.prisma), así que sigue permitiendo múltiples sesiones CERRADAS
-- por caja (el historial), solo bloquea que haya más de una "open" a la vez.
CREATE UNIQUE INDEX "cash_register_sessions_open_unique"
  ON "cash_register_sessions" ("cash_register_id")
  WHERE "status" = 'open';
