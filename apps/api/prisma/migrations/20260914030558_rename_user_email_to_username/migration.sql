-- El POS trabaja 100% offline: un correo electrónico no tiene ningún uso
-- (no hay verificación, ni recuperación de contraseña por correo, ni
-- ningún otro flujo que dependa de internet), así que el login pasa de
-- correo a nombre de usuario simple.
ALTER TABLE "users" RENAME COLUMN "email" TO "username";

-- Los usuarios existentes tenían correos falsos tipo "admin@aguachiles.local"
-- solo para cumplir el formato de correo que ya no se exige; se usa la parte
-- antes de la "@" como su nuevo nombre de usuario.
UPDATE "users" SET "username" = split_part("username", '@', 1);
