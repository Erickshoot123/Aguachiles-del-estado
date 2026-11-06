# Porciones y entrega automática

Desde 0.2.5 se retiran los controles de preferencias individuales al capturar pedidos.
Cada producto se agrega con su cantidad y siguen disponibles las notas generales del
pedido. Los datos históricos y las solicitudes offline de versiones anteriores se
conservan para poder consultar y reimprimir sus comandas originales.

El nombre del cliente permanece visible y es opcional tanto en mostrador como en
delivery. Delivery sigue requiriendo teléfono y dirección; compartir por WhatsApp
también funciona si no se proporcionó nombre.

El tablero permite arrastrar pedidos entre Cocina, En espera de recolección y Enviado,
incluso para corregir y regresar a una estación anterior. Se valida la sucursal y el
estado esperado; los entregados o cancelados no vuelven al tablero por arrastre.
No se alteran cobros, pagos ni existencias al cambiar de columna.

ESC cierra primero el modal superior. Desde una pantalla secundaria vuelve al tablero;
desde el tablero sin modales permanece en la pantalla principal. También cancela el
formulario de configuración inicial y el ajuste abierto de disponibilidad.

El plazo de 25 minutos comienza al pasar de recolección a En delivery. Se guarda en
la base local y no se reinicia al recargar el navegador, cobrar o reiniciar el POS.
El servidor comprueba vencimientos cada 15 segundos. Si el POS estuvo apagado,
procesa los vencidos al arrancar. Solo cambia el estado de entrega: un pedido sin
cobrar sigue sin cobrar y puede buscarse por folio para cobrarlo. Los pagos, las
reservas de platos y los movimientos de caja no se modifican por el temporizador.

La migración conserva los pedidos existentes. Los que ya estaban En delivery reciben
un plazo de 25 minutos desde la actualización, porque antes no se guardaba la salida.
No se cambia automáticamente un pedido que siga en preparación o recolección.

Se elimina la franja superior de sucursal y sincronización del área de trabajo;
la configuración y la sincronización central existentes siguen funcionando.
