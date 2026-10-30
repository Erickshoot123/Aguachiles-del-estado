# Impresora térmica USB en Windows

Al confirmar Crear pedido, la terminal solicita la comanda del pedido guardado y la
envía automáticamente al destino configurado. Incluye folio, hora de creación,
canal, cantidades, productos, nombre y teléfono del cliente, dirección, referencias,
preferencias, notas y total del pedido. Los datos opcionales vacíos se omiten. No exige cobrar antes.
Los pedidos en cola por caída del servidor imprimen al confirmarse su creación.

Si no se confirma la impresión, un aviso conserva el folio en esta terminal y
permite Reimprimir comanda o Ya salió. Recargar no reenvía automáticamente el
trabajo. Comprueba el papel antes de reimprimir para evitar duplicados. La comanda
no modifica el registro de impresión del comprobante de cobro.

Instala la impresora en Windows y comprueba su nombre en Impresoras y escáneres.
El agente envía comandos ESC/POS en modo RAW a la cola local usando la API de
Windows; no requiere módulos nativos de Node ni compartir la impresora en la red.
La impresora debe admitir ESC/POS.

Ejemplo de `apps/print-agent/.env` para la Ofichido POS5890Z-L:

```dotenv
HOST=127.0.0.1
PORT=4000
PRINTER_WIDTH_58=32
PRINTERS=[{"id":"default","name":"Ofichido POS5890Z-L 58mm","interface":"printer:Ofichido POS5890Z-L 58mm","qrMode":"raster"}]
```

El nombre después de `printer:` debe coincidir exactamente con la cola de Windows.
En esta PC se registró con el controlador incluido `Generic / Text Only` en USB002.
Los puertos USB pueden variar en otras computadoras.

Reinicia el agente después de editar su configuración. En el modal de ticket elige
58 mm y agente local. El ancho inicial para nuevos ajustes es 58 mm; las terminales
que ya guardaron 80 mm conservan su selección hasta cambiarla en ese modal.

La respuesta de impresión confirma que Windows aceptó el trabajo, no que salió
papel. Comprueba alimentación, papel y cola si no sale. No hay reintentos automáticos
para la cola de Windows, para evitar duplicados cuando se pierde una confirmación.
