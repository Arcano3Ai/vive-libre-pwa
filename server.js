const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 8080;

// --- 1. BOOTSTRAP INMEDIATO ---
const server = http.createServer(app);
server.listen(port, '0.0.0.0', () => {
  console.log(`✅ Butler is listening on port ${port}`);
});

// --- 2. CONFIGURACIÓN ---
app.use(express.json());
const distPath = path.join(__dirname, 'dist');

// Health Check explícito
app.get('/api/health', (req, res) => res.status(200).send('Sergio is alive'));

// --- 3. IA ENGINE ---
let genAI = null;
let orchestrator = null;

const initAI = () => {
    if (!genAI) {
        try {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const cors = require('cors');
            app.use(cors());
            orchestrator = require('./agents/orchestrator');
            genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
            console.log('✅ IA Engine ready');
        } catch (e) {
            console.error('❌ IA Load Error:', e.message);
        }
    }
};

app.post('/api/chat', async (req, res) => {
    initAI();
    if (!genAI || !orchestrator) return res.status(500).send('IA no inicializada');
    
    const { message, history } = req.body;
    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash", 
            systemInstruction: orchestrator.unifiedSystemInstruction 
        });
        const chat = model.startChat({
            history: (history || []).map(h => ({
                role: h.role === 'bot' || h.role === 'model' ? 'model' : 'user',
                parts: [{ text: h.text || '' }]
            }))
        });
        const result = await chat.sendMessage(message);
        const resp = await result.response;
        res.send(resp.text());
    } catch (e) {
        console.error('Chat Error:', e);
        res.status(500).send('Error de Sergio: ' + e.message);
    }
});

// --- 4. SERVIR FRONTEND ---
app.use(express.static(distPath));

// SOLUCIÓN FINAL PARA EXPRESS 5: 
// No usamos app.get('*'). Usamos un middleware final que captura TODO lo que no sea API.
app.use((req, res) => {
    // Si la ruta empieza con /api y llegó aquí, es un 404 real de API
    if (req.url.startsWith('/api')) {
        return res.status(404).send('API Endpoint not found');
    }
    
    // Para todo lo demás, servimos el index.html (Soporte SPA)
    const indexFile = path.join(distPath, 'index.html');
    if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
    } else {
        res.status(404).send('Build not found. Please check Cloud Build logs.');
    }
});

// Manejador de errores global para evitar crasheos
app.use((err, req, res, next) => {
    console.error('CRITICAL SERVER ERROR:', err);
    res.status(500).send('Something went wrong on the server.');
});
