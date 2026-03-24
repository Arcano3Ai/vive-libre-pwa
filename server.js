const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send('<h1>Sergio está vivo (Modo Diagnóstico)</h1><p>Si ves esto, el despliegue funcionó. Ahora procederé a cargar la IA.</p>');
});

app.get('/api/health', (req, res) => res.status(200).send('OK'));

app.listen(port, '0.0.0.0', () => {
  console.log(`Diagnostic server listening on port ${port}`);
});
