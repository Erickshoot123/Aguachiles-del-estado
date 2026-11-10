DELETE FROM "role_permissions" AS assignment
USING "roles" AS r, "permissions" AS p
WHERE assignment."role_id" = r."id"
  AND assignment."permission_id" = p."id"
  AND r."name" <> 'admin'
  AND p."code" = 'users.manage';
