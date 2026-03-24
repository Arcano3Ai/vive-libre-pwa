# Script de despliegue SEGURO para Vive Libre
Write-Host "🚀 Preparando despliegue seguro..." -ForegroundColor Cyan

# 1. Extraer la API Key del archivo .env localmente
$envFile = Get-Content .env
$geminiKey = ($envFile | Select-String "GEMINI_API_KEY=").ToString().Split("=")[1].Trim()

if (-not $geminiKey) {
    Write-Host "❌ Error: No se encontró GEMINI_API_KEY en el archivo .env" -ForegroundColor Red
    exit
}

Write-Host "📦 Subiendo proyecto a Cloud Run (usando la llave de tu .env)..." -ForegroundColor Yellow

# 2. Ejecutar el despliegue pasando la variable capturada y forzando puerto 8080
gcloud run deploy vive-libre `
  --source . `
  --region us-central1 `
  --allow-unauthenticated `
  --port 8080 `
  --set-env-vars="GEMINI_API_KEY=$geminiKey"

Write-Host "✅ ¡Despliegue finalizado con éxito!" -ForegroundColor Green
