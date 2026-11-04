# Impresión directa de la Ofichido en Aguachiles POS

## Flujo que usa este programa

1. Crear pedido guarda la venta en la API y devuelve su ID. La impresión utiliza ese
   pedido existente: fallar la impresión nunca vuelve a crear una venta.
2. La terminal consulta GET /api/orders/:id/comanda. La API arma productos, cantidades,
   cliente si se proporcionó, teléfono, entrega, notas generales y total.
3. La terminal manda POST /print al agente de impresión de esta PC, con printerId y
   un ticket JSON validado. En la aplicación instalada es 127.0.0.1:48882; en desarrollo
   es 127.0.0.1:4000. La API instalada usa 48881 y la de desarrollo 3000.
4. El agente elige la impresora configurada. Para Windows su interfaz es
   printer:Ofichido POS5890Z-L 58mm, usando exactamente el nombre de la cola de Windows.
5. El módulo compartido usa node-thermal-printer, protocolo Epson ESC/POS, ancho de
   32 columnas para 58 mm y caracteres Windows-1252. renderTicketCommands convierte
   alineación, negritas, texto, total y alimentación en un Buffer de comandos.
6. windowsSpooler envía esos bytes mediante un proceso PowerShell oculto. El código C#
   llama OpenPrinterW, StartDocPrinterW con tipo RAW, StartPagePrinter y WritePrinter,
   y después finaliza documento/página y cierra el identificador. Los bytes viajan en
   base64 por stdin, sin interpretar el nombre de la impresora como código.
7. La cola de Windows entrega el trabajo por el USB configurado. No se usa window.print,
   el diálogo de impresión del navegador ni acceso WebUSB desde la interfaz.

## Configuración comprobada en esta PC

- Nombre exacto: Ofichido POS5890Z-L 58mm.
- Controlador: Generic / Text Only.
- Puerto: USB002. USB001 corresponde a la Canon G2010; no es la Ofichido.
- La configuración de desarrollo apunta a printer:Ofichido POS5890Z-L 58mm.
- En el instalador, elige esa cola en Configurar impresora. Si eliges archivo de prueba,
  la comanda se guarda en data/print-output y no sale en papel.

El número USB puede cambiar en otra computadora. Se debe comprobar en Propiedades de
la impresora > Puertos y seleccionar el nombre correcto en el POS.

## Ejemplo técnico dentro de Node

Usa el ticket devuelto por la API, no una cadena de texto ni un objeto incompleto:

```ts
import { printTicketToInterface } from '@aguachiles/shared/printing';

// ticket es el objeto validado de GET /api/orders/:id/comanda.
await printTicketToInterface({
  interfaceString: 'printer:Ofichido POS5890Z-L 58mm',
  width: 32,
  ticket,
});
```

Este módulo es solo para Node/Windows; la interfaz React llama al agente HTTP.
El controlador de Windows transporta los bytes RAW, no debe convertirlos mediante
GDI, Out-Printer o una impresión normal de HTML. Para impresoras de red existe además
la ruta TCP del mismo módulo; USB en este proyecto utiliza la cola de Windows.

## Cuando no imprime

1. Revisa alimentación, papel térmico y cable USB. Comprueba que no esté en pausa o
   trabajando sin conexión desde la cola de impresión de Windows.
2. Comprueba nombre, controlador y puerto con:

```powershell
Get-Printer -Name 'Ofichido POS5890Z-L 58mm' |
  Select-Object Name, DriverName, PortName, PrinterStatus
```

3. Comprueba que el agente esté iniciado y GET http://127.0.0.1:48882/printers responda
   en la instalación. Este endpoint enumera impresoras configuradas en el agente;
   la ventana Configurar impresora enumera las colas instaladas en Windows.
4. Si la API de impresión devuelve 400, revisa el esquema completo y printerId. Si
   devuelve 502, revisa data/logs y la cola Windows: nombre inexistente, puerto, permisos
   del usuario o error del controlador. No envíes los comandos como texto Unicode.
5. Si la respuesta es 200 pero no sale papel, abre la cola Windows. La respuesta confirma
   que el trabajo fue aceptado, no que el papel haya salido físicamente. Un trabajo
   detenido o un puerto equivocado puede quedar aceptado sin imprimir.
6. Revisa el papel antes de reintentar: un acuse perdido puede ocurrir después de la
   impresión. Por eso Windows RAW no se reintenta automáticamente. El banner conserva
   trabajos sin confirmar y el detalle permite Reimprimir comanda sin duplicar pedidos.

Las reimpresiones explícitas se identifican con la leyenda REIMPRESIÓN. No se hicieron
pruebas físicas en esta actualización: las pruebas usan archivo o respuestas simuladas.
