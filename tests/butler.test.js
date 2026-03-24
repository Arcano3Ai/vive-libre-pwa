const request = require('supertest');
const { app, server } = require('../server');
const { unifiedSystemInstruction } = require('../agents/orchestrator');
const WebSocket = require('ws');

// Increase timeout for real API calls
jest.setTimeout(30000);

describe('Vive Libre Butler System Tests', () => {
  let testServer;
  let testPort;

  beforeAll((done) => {
    // Start server once for all tests
    testServer = server.listen(0, () => {
      testPort = testServer.address().port;
      done();
    });
  });

  afterAll((done) => {
    // Close the server and ensure it is finished
    testServer.close(() => {
        // Add a small delay for any pending async operations (like WS closing logs)
        setTimeout(done, 500);
    });
  });

  describe('Orchestrator Logic', () => {
    it('should correctly aggregate instructions from all agents', () => {
      expect(unifiedSystemInstruction).toContain('CONOCIMIENTO DE NUESTRAS VILLAS:');
      expect(unifiedSystemInstruction).toContain('SUGERENCIAS DE ACTIVIDADES LOCALES (SANTIAGO, N.L.):');
      expect(unifiedSystemInstruction).toContain('EXPERIENCIAS GASTRONÓMICAS (RECOMENDACIONES):');
      expect(unifiedSystemInstruction).toContain('SOPORTE Y MANTENIMIENTO AL HUÉSPED:');
      expect(unifiedSystemInstruction).toContain('PROCESO DE RESERVA:');
      
      expect(typeof unifiedSystemInstruction).toBe('string');
      expect(unifiedSystemInstruction.length).toBeGreaterThan(1000);
    });
  });

  describe('REST API - /api/chat', () => {
    it('should return a valid text response from Gemini', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({
          message: 'Hola, ¿quién eres? Responde brevemente.',
          history: []
        });

      expect(res.statusCode).toEqual(200);
      expect(typeof res.text).toBe('string');
      expect(res.text.length).toBeGreaterThan(0);
      // It should identify as the Butler/Concierge
      expect(res.text.toLowerCase()).toMatch(/vive libre|concierge|mayordomo|butler|asistente/);
    });

    it('should return 400 if message is missing', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({});

      expect(res.statusCode).toEqual(400);
      expect(res.text).toBe('Incompleto.');
    });
  });

  describe('WebSocket Proxy', () => {
    it('should handle WebSocket connections', (done) => {
      // Temporarily suppress console.log to avoid Jest noise during WS close
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      const ws = new WebSocket(`ws://localhost:${testPort}`);
      
      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
      });

      ws.on('close', () => {
        consoleSpy.mockRestore();
        done();
      });

      ws.on('error', (err) => {
        consoleSpy.mockRestore();
        done(err);
      });
    });
  });
});
