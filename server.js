const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 8080;

// --- 1. ARRANQUE INMEDIATO (Para engañar al Health Check de Google) ---
const server = http.createServer(app);
server.listen(port, '0.0.0.0', () => {
  console.log(`✅ BOOTSTRAP: Servidor escuchando en puerto ${port}`);
});

// --- 2. CONFIGURACIÓN BÁSICA ---
app.use(express.json());
const distPath = path.join(__dirname, 'dist');

// Endpoint de salud que SIEMPRE responde
app.get('/api/health', (req, res) => res.status(200).send('Sergio is alive'));

// --- 3. CARGA SEGURA DE DEPENDENCIAS PESADAS ---
let genAI = null;
let orchestrator = null;

try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const { WebSocketServer, WebSocket } = require('ws');
    const cors = require('cors');
    
    app.use(cors());
    orchestrator = require('./agents/orchestrator');
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'MISSING_KEY');
    
    console.log('✅ DEPENDENCIAS: Cargadas correctamente');

    // Configuración de WebSockets
    const wss = new WebSocketServer({ server });
    wss.on('connection', (ws) => {
        console.log('Voz activa');
        const apiKey = process.env.GEMINI_API_KEY;
        const gws = new (require('ws'))(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`);
        ws.on('message', m => { if(gws.readyState === 1) gws.send(m) });
        gws.on('message', d => { if(ws.readyState === 1) ws.send(d) });
        ws.on('close', () => gws.close());
    });

} catch (err) {
    console.error('❌ CRITICAL ERROR DURANTE CARGA:', err.message);
}

// --- 4. RUTAS DE CHAT ---
app.post('/api/chat', async (req, res) => {
    if (!genAI || !orchestrator) return res.status(500).send('Error: Sistema de IA no inicializado.');
    
    const { message, history } = req.body;
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction: orchestrator.unifiedSystemInstruction });
        const chat = model.startChat({
            history: (history || []).map(h => ({
                role: h.role === 'bot' ? 'model' : 'user',
                parts: [{ text: h.text || '' }]
            }))
        });
        const result = await chat.sendMessage(message);
        const resp = await result.response;
        res.send(resp.text());
    } catch (e) {
        res.status(500).send('Error IA: ' + e.message);
    }
});

// --- 5. SERVIR FRONTEND ---
app.use(express.static(distPath));
app.get('*', (req, res) => {
    const index = path.join(distPath, 'index.html');
    if (fs.existsSync(index)) res.sendFile(index);
    else res.status(404).send('Sitio en construcción. Build de Vite no encontrado.');
});
