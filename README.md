# AURA IG Conversations Dashboard

Dashboard para análisis de conversaciones de Instagram con métricas de entregas y conversión.

## Características

- 📅 Filtro por rango de fechas
- 📊 Gráfico de barras apiladas + línea para entregas y leads
- ⏱️ Tarjeta con tiempo medio de respuesta
- 📈 Gráfico de tasa de conversión por tipo de mensaje
- 🔄 Agrupación por día/semana/mes

## Setup Local

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env.local

# Editar .env.local con tus credenciales de Supabase
# NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key

# Iniciar en desarrollo
npm run dev
```

## Deploy en Vercel

1. Sube el código a GitHub
2. Conecta el repo en [vercel.com](https://vercel.com)
3. Añade las variables de entorno en Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy automático

## Estructura de la tabla Supabase

El dashboard espera una tabla `ig_conversations` con:

```sql
- id (uuid)
- ig_user_id (text)
- ig_username (text)
- message_content (text)
- message_tag (text)
- direction (text) -- 'inbound' o 'outbound'
- created_at (timestamptz)
```

## Tags soportados

### Start Messages
- startMessage_A, B, C, D, E

### Second Messages
- secondMessage_A, B, C, D
- secondMessageFollowUp

### Final Messages
- finalMessage_A, B, C, D
- finalMessageFollowUp

### Otros
- goodByeMessage_afterLeadCreated
- goodByeMessage_afterJustContent
- goodByeMessage_afterNotInterested
- phoneFollowUp
