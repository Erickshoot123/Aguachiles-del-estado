# Actualizaciones manuales de Aguachiles POS

## Flujo implementado

En **Administración → Actualizaciones**, un usuario con `users.manage` puede:

1. Pulsar **Buscar actualizaciones**. Solo esta acción consulta la última release estable de GitHub.
2. Leer la versión, tamaño y novedades. Las releases en borrador o preliminares no se distribuyen.
3. Pulsar **Descargar versión**. El POS sigue funcionando y guarda un paquete completo separado del programa activo.
4. Cerrar caja y terminar movimientos, pedidos offline e impresiones pendientes.
5. Pulsar **Instalar y reiniciar POS** y confirmar. Se bloquean nuevos movimientos, se pausa el agente de impresión y se crea un respaldo antes de iniciar el instalador externo.

El paquete descargado se conserva al cerrar el POS. Recuperar esa descarga al abrir el programa no consulta Internet ni la instala. Antes de ejecutarla, tanto Node como el actualizador nativo comprueban firma, plataforma, versión, tamaño y SHA-256.

El programa conserva versiones separadas y cambia `current-version` al final mediante reemplazo atómico. Los archivos del lanzador se respaldan antes de activarlos y se restauran si su copia falla. La carpeta `data` no participa en el reemplazo de archivos. No se necesita Node, npm, Git ni herramientas de compilación en el equipo del negocio.

## Canal elegido

- Código: `Erickshoot123/Aguachiles-del-estado`.
- Descargas propuestas: `Erickshoot123/aguachiles-pos-releases`, **público y separado**.
- Ese segundo repositorio solo necesita un README inicial y los archivos de cada release.
- El POS no lleva ningún token de GitHub. Solo descarga recursos públicos y contiene la clave pública para verificar firmas.

El repositorio del código era público al revisarlo; esta implementación no cambia su visibilidad. El repositorio de descargas todavía debe crearse. Tampoco se han creado claves de distribución ni publicado versiones durante la implementación.

## Activación inicial en GitHub

### 1. Crear el repositorio de descargas

En GitHub, crea `aguachiles-pos-releases` bajo la cuenta `Erickshoot123`, público e inicializado con README. El nombre puede cambiarse mediante la variable `UPDATE_RELEASE_REPOSITORY` descrita abajo.

### 2. Crear y resguardar la clave de firma

Desde la raíz del proyecto, en una PC de confianza:

```powershell
node packaging/windows/generate-update-key.mjs --output "$env:LOCALAPPDATA\AguachilesPOS-firma"
```

El comando genera RSA de 3072 bits y rechaza sobrescribir una clave existente. No se ha ejecutado para crear claves reales de distribución. Guarda una copia privada segura de `update-private.pem`; utiliza la misma clave para las siguientes versiones. No la agregues al repositorio, al instalador ni a un release.

### 3. Configurar Actions en el repositorio del código

En **Settings → Secrets and variables → Actions**, agrega:

| Tipo     | Nombre                       | Contenido                                                                                          |
| -------- | ---------------------------- | -------------------------------------------------------------------------------------------------- |
| Variable | `UPDATE_RELEASE_REPOSITORY`  | `Erickshoot123/aguachiles-pos-releases`                                                            |
| Variable | `UPDATE_PUBLIC_KEY_PEM`      | Contenido de `update-public.pem`                                                                   |
| Secreto  | `UPDATE_SIGNING_PRIVATE_KEY` | Contenido de `update-private.pem`                                                                  |
| Secreto  | `RELEASE_UPLOAD_TOKEN`       | Token de acceso restringido al repositorio de descargas, con permiso Contents de lectura/escritura |

El token de publicación solo se usa en Actions. La clave privada solo se inyecta en el paso de firma. El constructor recibe únicamente la clave pública.

### 4. Preparar y revisar una versión

El workflow `.github/workflows/windows-release.yml` debe estar en la rama predeterminada del repositorio del código. En **Actions → Preparar versión Windows (manual) → Run workflow**, introduce:

- Versión estable sin `v`, por ejemplo `0.2.7`.
- Novedades que verá el usuario del POS.

El workflow ejecuta verificaciones y pruebas, compila en Windows, firma el manifiesto y crea **un borrador** en el repositorio de descargas. Un push normal no ejecuta este workflow. No sobrescribe versiones existentes.

Los archivos del borrador son:

```text
AguachilesPOS-Instalador-0.2.7.exe
AguachilesPOS-Instalador-0.2.7.exe.sha256.txt
update-manifest.json
update-manifest.sig
```

Revisa y prueba el instalador en un equipo o carpeta de prueba antes de publicar. El builder verifica los SHA-256 de los runtimes oficiales contra `vendor-lock.json`; si un proveedor cambió un enlace de descarga, la construcción se detiene. Revisa la versión y el archivo oficial antes de actualizar ese lock; no omitas su validación.

El workflow se preparó y validó localmente, pero todavía no se ha ejecutado en GitHub. Una publicación real requiere completar la configuración anterior y ejecutar esa construcción remota.

### 5. Publicar cuando esté aprobado

En el repositorio de descargas abre **Releases**, revisa el borrador `v0.2.7` y pulsa **Publish release** como versión estable. El paquete y los dos archivos del manifiesto deben quedar juntos en ese tag. Esta es una acción aparte de subir código.

El POS podrá encontrar esa versión cuando el usuario pulse **Buscar actualizaciones**. No instala ni avisa en segundo plano.

### 6. Primera instalación que incluye el actualizador

Una instalación antigua necesita recibir una vez, por USB o descarga manual, un instalador que incluya el nuevo actualizador y la clave pública. Una app que todavía no tiene este código no puede actualizarse sola para obtenerlo.

Los builds locales sin canal/clave pública quedan con **actualizaciones sin configurar**, manteniendo el POS operativo. Los builds de release con `--version` exigen un canal con clave pública válida.

## Archivos, fallos y recuperación

- Descargas: `updates/<versión>/` bajo la carpeta de instalación.
- Respaldo previo: `data/backups/*antes-de-actualizacion-manual.dump`.
- Diagnóstico del actualizador: `updates/last-result.json`.
- Configuración del canal: `update-channel.json` dentro de la versión del programa; contiene únicamente datos públicos.
- El actualizador rechaza HTTP, dominios de descarga ajenos a GitHub, downgrade, firmas no válidas y paquetes incompletos o alterados.
- Si el canal está dañado, se deshabilitan las actualizaciones; no se impide abrir el POS.
- No se modifica el directorio de otra instalación ni se detienen sus servicios.

El instalador conserva la base y sus respaldos. Las migraciones se ejecutan al arrancar la versión nueva. Si falla una migración o no se confirma el arranque, el actualizador muestra el error y conserva el diagnóstico. **No restaura automáticamente la base ni promete una reversión compatible del esquema.** La recuperación de una base requiere revisar el fallo y, cuando proceda, restaurar el respaldo de forma supervisada. El respaldo automático previo es un `.dump` local protegido por los permisos de la carpeta; los respaldos manuales cifrados siguen siendo una función independiente.

La firma RSA de los paquetes es independiente de la firma comercial Authenticode del `.exe`. Esta implementación no compra ni configura un certificado comercial y Windows puede mostrar editor desconocido.

## Pruebas locales del mecanismo

```powershell
node --test packaging/windows/updates.test.mjs
node packaging/windows/test-native-updates.mjs
npm run test --workspace=@aguachiles/api -- --run tests/updates.test.ts
npm run test --workspace=@aguachiles/print-agent
```

La prueba nativa compila un componente de verificación y usa archivos ficticios: no construye ni ejecuta un instalador real. Las pruebas de interfaz `updates.spec.ts` simulan las respuestas de actualización; no descargan paquetes de GitHub ni reinician el equipo.
