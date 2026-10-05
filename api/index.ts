import express from "express";
import legacyApp from "../server";

const app = express();

app.use(express.json({ limit: "10mb" }));

// Stokes/SSRS lives inside the corporate network. A Vercel Serverless Function
// cannot reach clanfdbsw06-li.ad.sqmlitio.com, so never forward corporate
// credentials to the legacy NTLM proxy when the application is deployed here.
app.post("/api/reporte-stokes", (_req, res) => {
  return res.status(409).json({
    error: "La conexión Stokes no puede ejecutarse desde Vercel.",
    code: "STOKES_REQUIRES_CORPORATE_BRIDGE",
    detail:
      "ReportServer está disponible únicamente dentro de la red corporativa. Use el diagnóstico Stokes para validar acceso desde este equipo; las credenciales corporativas no serán reenviadas desde Vercel.",
    diagnosticUrl: "/stokes-diagnostic.html"
  });
});

// Preserve all existing API routes while the Stokes integration is migrated to
// an internal-network bridge.
app.use(legacyApp);

export default app;
