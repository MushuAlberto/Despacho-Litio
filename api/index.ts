import express from "express";
import legacyApp from "../server";

const app = express();

app.use(express.json({ limit: "10mb" }));

// Stokes/SSRS vive dentro de la red corporativa. Vercel no puede alcanzar
// directamente clanfdbsw06-li.ad.sqmlitio.com y no debe recibir credenciales
// corporativas para intentar hacerlo.
app.post("/api/reporte-stokes", (_req, res) => {
  return res.status(409).json({
    error: "La conexión automática con Stokes aún no está disponible desde Vercel.",
    code: "STOKES_INTERNAL_API_REQUIRED",
    detail:
      "Utilice la carga manual del Excel Historico_guia_transportista. La conexión automática quedará habilitada cuando exista una API interna corporativa autorizada."
  });
});

app.use(legacyApp);

export default app;
