// Entrada separada del paquete a propósito (ver package.json "exports"):
// depende de node-thermal-printer, que usa APIs de Node (fs, net) y no debe
// llegar al bundle del navegador. Solo apps/api y apps/print-agent la
// importan; apps/web solo debe usar el índice principal (tipos/schemas Zod).
export * from './renderTicketCommands.js';
export * from './printToInterface.js';
