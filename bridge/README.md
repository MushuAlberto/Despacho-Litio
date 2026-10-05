# Stokes Bridge

Servicio local para conectar **Despacho Litio** con el ReportServer corporativo desde un computador conectado a la red de la empresa.

## Objetivo

La aplicación web sigue alojada en Vercel, pero el acceso a `clanfdbsw06-li.ad.sqmlitio.com` debe ocurrir dentro de la red corporativa. El Bridge escucha solamente en `127.0.0.1:3847`, por lo que no queda expuesto a otros equipos de la red.

## Puesta en marcha en el PC corporativo

1. Instalar Node.js LTS si el equipo no lo tiene.
2. Descargar o clonar este repositorio.
3. Ejecutar una vez:

```bash
npm install
```

4. Iniciar el Bridge:

```bash
npm run stokes:bridge
```

Debe aparecer:

```text
[Stokes Bridge] activo en http://127.0.0.1:3847
[Stokes Bridge] ReportServer interno: clanfdbsw06-li.ad.sqmlitio.com
```

5. Abrir `https://despacho-litio.vercel.app` y entrar al módulo **Reporte Stokes**.
6. El indicador debe cambiar a **Bridge conectado**.

## Seguridad

- El Bridge se enlaza únicamente a `127.0.0.1`.
- Solo acepta solicitudes desde los orígenes definidos en `STOKES_ALLOWED_ORIGINS`.
- El cliente no puede indicar un `serverUrl` alternativo; el Bridge elimina ese campo antes de pasar la solicitud al proxy legado.
- El ReportServer por defecto es `http://clanfdbsw06-li.ad.sqmlitio.com/ReportServer`.
- El módulo limpia la contraseña del estado del formulario cuando termina cada solicitud.
- Los datos operacionales de ejemplo fueron retirados del repositorio.

## Variables opcionales

```text
STOKES_BRIDGE_PORT=3847
REPORT_SERVER_URL=http://clanfdbsw06-li.ad.sqmlitio.com/ReportServer
STOKES_ALLOWED_ORIGINS=https://despacho-litio.vercel.app
```

Para permitir también una URL Preview específica de Vercel, agrégala separada por coma en `STOKES_ALLOWED_ORIGINS`.
