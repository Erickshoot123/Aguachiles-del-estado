import { describe, expect, it } from 'vitest';
import { buildWhatsAppMessage, type WhatsAppOrderInput } from './whatsapp.js';

function baseOrder(overrides: Partial<WhatsAppOrderInput> = {}): WhatsAppOrderInput {
  return {
    ticketNumber: '#1042',
    createdAt: '2026-01-15T20:30:00.000Z',
    customerName: 'Juan Pérez',
    customerPhone: '5512345678',
    deliveryAddress: 'Calle Falsa 123, Colonia Centro',
    deliveryReferences: null,
    items: [{ productName: 'Aguachile Tradicional (1 kilo)', quantity: 2 }],
    notes: null,
    ...overrides,
  };
}

describe('buildWhatsAppMessage', () => {
  it('arma el mensaje con folio, hora, cliente, teléfono, dirección y productos', () => {
    const { message } = buildWhatsAppMessage(baseOrder());

    expect(message).toContain('Pedido *#1042*');
    expect(message).toContain('Cliente: Juan Pérez');
    expect(message).toContain('Tel: 5512345678');
    expect(message).toContain('Dirección: Calle Falsa 123, Colonia Centro');
    expect(message).toContain('2x Aguachile Tradicional (1 kilo)');
  });

  it('no incluye montos: ni total, ni envío, ni método de pago, ni "paga con"/cambio', () => {
    const { message } = buildWhatsAppMessage(baseOrder());

    expect(message).not.toContain('Total');
    expect(message).not.toContain('Envío');
    expect(message).not.toContain('Método de pago');
    expect(message).not.toContain('Paga con');
    expect(message).not.toContain('Cambio');
    expect(message).not.toMatch(/\$\d/);
  });

  it('incluye las referencias solo cuando vienen', () => {
    const withReferences = buildWhatsAppMessage(baseOrder({ deliveryReferences: 'Portón negro' }));
    expect(withReferences.message).toContain('Referencias: Portón negro');

    const withoutReferences = buildWhatsAppMessage(baseOrder({ deliveryReferences: null }));
    expect(withoutReferences.message).not.toContain('Referencias');
  });

  it('usa *negrita* de WhatsApp únicamente en el folio, y no agrega emojis', () => {
    const { message } = buildWhatsAppMessage(baseOrder({ deliveryReferences: 'Portón negro' }));

    const asteriskMatches = message.match(/\*/g) ?? [];
    expect(asteriskMatches).toHaveLength(2); // *#1042*
    expect(message).toMatch(/\*#1042\*/);
    // Ningún carácter fuera del rango básico esperado (letras con acento, ñ,
    // dígitos, puntuación común) — descarta emojis u otros símbolos raros.
    expect(message).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  it('preserva acentos y ñ tal cual (sin escapar) en el texto del mensaje', () => {
    const { message } = buildWhatsAppMessage(
      baseOrder({
        customerName: 'María José Muñoz',
        deliveryAddress: 'Av. Insurgentes Sur, depto. 4°, Coyoacán',
        deliveryReferences: 'Junto a la peluquería "El Cañón"',
        notes: 'Sin cebolla, poco picante — pidió que tocáramos el timbre',
      }),
    );

    expect(message).toContain('Cliente: María José Muñoz');
    expect(message).toContain('Coyoacán');
    expect(message).toContain('peluquería "El Cañón"');
    expect(message).toContain('Notas: Sin cebolla, poco picante — pidió que tocáramos el timbre');
  });

  it('la URL codifica el mensaje completo y apunta a wa.me sin número (compartir abierto)', () => {
    const { message, url } = buildWhatsAppMessage(baseOrder());

    expect(url).toBe(`https://wa.me/?text=${encodeURIComponent(message)}`);
    expect(decodeURIComponent(url.split('?text=')[1] as string)).toBe(message);
  });

  it('recorta las notas largas cuando la URL supera el límite y lo marca como truncated', () => {
    // Un pedido con varios productos (normal) pero unas notas kilométricas
    // dictadas por el cliente: las notas son lo único que empuja la URL
    // sobre el límite, así que recortarlas alcanza para que quepa.
    const items = Array.from({ length: 6 }, (_, index) => ({
      productName: `Aguachile Tradicional (${index % 2 === 0 ? '1 kilo' : 'medio kilo'})`,
      quantity: index + 1,
    }));
    const veryLongNotes =
      'El cliente pidió que el pedido se entregue en la puerta trasera del edificio porque la principal está en remodelación, '.repeat(
        6,
      );

    const { message, url, truncated } = buildWhatsAppMessage(
      baseOrder({ items, notes: veryLongNotes, deliveryReferences: 'Edificio azul, timbre 4B' }),
    );

    expect(truncated).toBe(true);
    expect(url.length).toBeLessThanOrEqual(900);
    // El pedido (folio, cliente, productos) se conserva completo; solo las
    // notas se recortan.
    expect(message).toContain('Pedido *#1042*');
    expect(message).toContain('6x Aguachile Tradicional (medio kilo)');
    expect(message).toContain('Notas:');
    expect(message).not.toContain(veryLongNotes);
  });

  it('quita las notas del todo si ni siquiera recortadas alcanzan a caber', () => {
    const manyItems = Array.from({ length: 25 }, (_, index) => ({
      productName: `Aguachile especial de temporada número ${index + 1} con extras`,
      quantity: index + 1,
    }));

    const { message, truncated } = buildWhatsAppMessage(
      baseOrder({ items: manyItems, notes: 'Sin cebolla' }),
    );

    // La lista de productos por sí sola ya excede el límite (la especificación
    // solo pide recortar notas, no la lista de productos), así que el pedido
    // completo se conserva y únicamente las notas se sacrifican del todo.
    expect(truncated).toBe(true);
    expect(message).not.toContain('Notas');
    expect(message).toContain('Aguachile especial de temporada número 25 con extras');
  });

  it('no marca truncated cuando el mensaje cabe sin problema', () => {
    const { truncated, url } = buildWhatsAppMessage(baseOrder());

    expect(truncated).toBe(false);
    expect(url.length).toBeLessThanOrEqual(900);
  });
});
