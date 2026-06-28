import { Meteor } from 'meteor/meteor';

// URL del demonio Python (dentro de Docker, se comunican por el nombre del servicio)
const DEMONIO_HOST = process.env.DEMONIO_HOST || 'demonio-python';
const DEMONIO_PORT = process.env.DEMONIO_PORT || 8001;

async function callDemonio(path) {
  const url = `http://${DEMONIO_HOST}:${DEMONIO_PORT}${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });

    const data = await response.text();

    if (!response.ok) {
      throw new Error(data);
    }

    return JSON.parse(data);
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error('Timeout al conectar con el demonio');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

Meteor.methods({
  async pausarImpresora() {
    try {
      const result = await callDemonio('/pausar');
      return result.message;
    } catch (e) {
      throw new Meteor.Error('printer-error', 'Error al pausar: ' + e.message);
    }
  },

  async reanudarImpresora() {
    try {
      const result = await callDemonio('/reanudar');
      return result.message;
    } catch (e) {
      throw new Meteor.Error('printer-error', 'Error al reanudar: ' + e.message);
    }
  }
});
