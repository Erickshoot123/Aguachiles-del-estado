# Instalador de Aguachiles POS para Windows

Esta edición preliminar incluye Node.js 22, PostgreSQL 16, la interfaz, la API,
el agente de impresión y el requisito de Microsoft Visual C++. Funciona de forma
local; no necesita Docker, npm ni conexión a internet durante la instalación.

## Llevarlo a otra computadora

1. Copia `AguachilesPOS-Instalador-0.2.0-preview.exe` por USB a la otra PC.
2. Usa Windows 10/11 **de 64 bits con .NET Framework 4.8**, una unidad **NTFS** y al menos 2 GB libres.
   El instalador se puede transportar en USB; el programa y su base se instalan
   en Windows, de forma predeterminada dentro de tu perfil en C:.
3. Abre el instalador y pulsa **Instalar**. Puedes crear un acceso en el escritorio
   y activar el inicio automático al entrar a Windows. Si falta Visual C++, su
   instalador oficial de Microsoft puede solicitar permiso de administrador.
4. Pulsa **Abrir POS** y escribe nombre de sucursal, usuario administrador y una
   contraseña de al menos 12 caracteres. Elige la zona horaria correcta.
5. Selecciona la impresora instalada en Windows. Para la Ofichido POS5890Z-L usa
   la cola correspondiente y papel de 58 mm. Si eliges "archivo de prueba", las
   comandas se guardan en un archivo y no salen en papel.
6. Espera a que se prepare la base y se abra el navegador. Inicia sesión con las
   credenciales que acabas de elegir y registra los platos disponibles del día.

No se crean usuarios `cajero`/`gerente` de demostración ni ventas de ejemplo. El
administrador puede crear las cuentas del personal desde Usuarios. El menú inicial
se puede editar; no se precargan platos disponibles ni existencias de insumos.

## Uso diario, impresora y respaldo

- El acceso **Aguachiles POS** inicia los servicios y abre el navegador.
- El icono de la bandeja de Windows permite abrir el POS, cambiar de impresora,
  crear un respaldo y cerrar la aplicación con su base de datos.
- Cerrar la pestaña del navegador mantiene los servicios activos. Para detenerlos,
  usa **Cerrar POS** en la bandeja.
- **Configurar impresora** cierra los servicios, permite elegir otra cola de
  Windows y los reinicia. Instala primero el controlador en Windows si la
  impresora no aparece. El instalador no incorpora controladores de la Ofichido.
- **Crear respaldo** genera un archivo `.dump` consistente. Copia esos respaldos
  periódicamente a otra unidad; guardarlos solo en la misma PC no protege ante
  una falla del disco.

El navegador usa `http://127.0.0.1:48880`; la API usa 48881, el agente 48882 y
PostgreSQL 54329. Todos escuchan solo en esta PC. Esta edición corresponde a una
terminal local; conectar otras terminales por LAN requiere configuración adicional.

## Datos, actualizaciones y desinstalación

Los datos viven en `%LOCALAPPDATA%\AguachilesPOS\data`, fuera de las versiones
del programa. Incluyen la base, `backups`, `logs`, `print-output` y la configuración
protegida con DPAPI para ese usuario de Windows. Usa siempre la misma cuenta de
Windows para operar esa instalación.

Ejecutar un instalador nuevo conserva la carpeta de datos. Antes de migrar una
base existente, el lanzador crea un respaldo. Una migración fallida requiere
revisión y, si corresponde, restaurar ese respaldo: no hay reversión automática.

Desinstalar desde Aplicaciones de Windows quita el programa y sus accesos,
**conservando datos y respaldos**. Reinstalar con el mismo usuario recupera esa
configuración. No borres la carpeta `data` para actualizar.

Una sucursal nueva comienza con una base independiente. Para reemplazar una PC
con ventas existentes se necesita una restauración supervisada del `.dump`.
Copiar `config.dat` a otra PC no sirve: está protegido para el usuario/equipo de
origen. La restauración guiada y la vinculación a la nube todavía no están
integradas en el asistente de esta edición.

## Estado de esta entrega

Es un instalador **preliminar sin firma digital comercial**. Windows puede mostrar
"editor desconocido". Se entrega su SHA-256 junto al archivo. La validación en
carpeta aislada de esta PC no reemplaza probarlo en un Windows limpio y con la
impresora real del equipo de destino antes de usarlo para ventas reales.

## Construcción para desarrolladores

```powershell
npm ci
npm run build:windows -- --output C:/ruta/entregables
```

Requiere Windows x64, Node/npm y el compilador de .NET Framework incluido en
Windows. No usa un empaquetador comercial. El constructor descarga desde fuentes
oficiales, comprueba SHA-256 de `packaging/windows/vendor-lock.json`, usa
`package-lock.json` y genera un manifiesto de integridad para todos los archivos.
Los ZIP de proveedores quedan en `build/windows/cache`. Los archivos del servidor
PostgreSQL, la licencia de Node y las licencias de las dependencias se incluyen
en el paquete. Microsoft Visual C++ se conserva como instalador oficial.

Con poco espacio en C: se puede elegir otra carpeta temporal en una unidad NTFS:

```powershell
npm run build:windows -- --build-root D:/AguachilesPOS-InstallerBuild --output C:/ruta/entregables
node packaging/windows/smoke.mjs --installer C:/ruta/entregables/AguachilesPOS-Instalador-0.2.0-preview.exe --build-root D:/AguachilesPOS-InstallerBuild --test-root C:/ruta/pruebas
```

La prueba crea una instalación y datos sintéticos, usa solo los runtimes
empaquetados, prueba DPAPI, inicio, login, platos, pedido, comanda, respaldo,
reinstalación, migración y desinstalación conservando datos. Su destino debe ser
NTFS. No usa la impresora física ni la base de desarrollo. `--stage` permite
reanudar una construcción con dependencias ya preparadas; úsalo únicamente si
los archivos compilados y sus dependencias corresponden a la revisión actual.
Antes de ejecutar la prueba de navegador instala Chromium de Playwright con
`npx playwright install chromium`. Detén los procesos de desarrollo antes de
reinstalar dependencias o regenerar Prisma en Windows, para liberar sus DLL.

Fuentes: [Node.js](https://nodejs.org/dist/),
[PostgreSQL / EDB](https://www.postgresql.org/download/windows/),
[Microsoft Visual C++](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist/).
