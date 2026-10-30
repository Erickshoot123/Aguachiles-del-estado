# Porciones y entrega automática

Cada aguachile seleccionado se envía como una porción independiente. Dos porciones
iguales pueden tener ingredientes y condimentos distintos. Se puede quitar cebolla,
pepino y aguacate; elegir normal, sin, poco o extra para ajo, sal y pimienta; y activar
extra picante. Las instrucciones se guardan en la línea del pedido, se muestran en
su tarjeta y detalle, y salen junto al platillo en la comanda y WhatsApp. Las notas
generales siguen disponibles para indicaciones que correspondan a todo el pedido.

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
