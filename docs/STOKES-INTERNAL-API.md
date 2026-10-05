# Integración Stokes

La aplicación desplegada en Vercel no puede acceder directamente al ReportServer corporativo. Los computadores corporativos tampoco permiten ejecutar un Bridge local.

## Modo actual

Reporte Stokes opera mediante carga manual del Excel exportado desde `Historico_guia_transportista`. El archivo se procesa en el navegador y no se sube a Vercel.

## Integración futura

Cuando TI disponga de una API o gateway dentro de la red corporativa, configure en Vercel:

`VITE_STOKES_INTERNAL_API_URL=https://<host-interno-autorizado>`

El módulo espera:

- `GET /health` opcional, para mostrar disponibilidad.
- `POST /api/reporte-stokes` con `username`, `password`, `domain`, `fechaInicio` y `fechaFin`.
- Respuesta JSON `{ data: [...] }` con los registros normalizados.

La API interna debe ser accesible únicamente desde la red corporativa, usar HTTPS, restringir CORS al dominio de Despacho-Litio y no almacenar credenciales.
