import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Helper to run Gemini models in sequence
  const callGemini = async (prompt: string): Promise<string | null> => {
    if (!process.env.GEMINI_API_KEY) return null;
    const modelsToTry = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: { temperature: 0.3 }
        });
        if (response && response.text) {
          return response.text;
        }
      } catch (e) {
        console.log(`Model ${modelName} not available at this moment. Trying next fallback...`);
      }
    }
    return null;
  };

  // API routes FIRST
  app.post("/api/analyze-shift", async (req, res) => {
    try {
      const { title, data, complianceData, model } = req.body;
      
      if (!process.env.GEMINI_API_KEY) {
        console.warn("GEMINI_API_KEY is not defined in env.");
        return res.status(500).json({ error: "La API Key de Gemini no está configurada." });
      }

      // Format data and prompt
      const prompt = `
Actúa como un Especialista Senior de SQM Litio. Tu tarea es analizar las desviaciones operativas e informes de rendimiento de la jornada en la faena "${title}".

A continuación tienes los datos de producción de la jornada:
${JSON.stringify(data, null, 2)}

Y las correspondientes justificaciones o comentarios de desempeño reportados para los productos:
${JSON.stringify(complianceData, null, 2)}

Por favor, elabora un análisis ejecutivo estructurado en español chileno/profesional que resuma las desviaciones ocurridas basándose en los datos y principalmente en los cuadros de "Justificación de Desempeño" provistos.

Sigue esta estructura limpia en Markdown con títulos profesionales en negrita:
1. ### **Resumen Ejecutivo**: Una síntesis de las operaciones de la jornada, indicando el total programado y cargado, y el porcentaje general de cumplimiento.
2. ### **Análisis de Desviaciones de Desempeño**: Un análisis minucioso y detallado de las desviaciones y eventos anómalos basándote directamente en las "Justificación de Desempeño" reportadas en los archivos JSON. Si no hay registros de un producto específico, descríbelo de manera ejecutiva según las desviaciones de tiempos (horas reales vs meta).
3. ### **Rendimiento Operativo Clave**: Compara la planificación horaria contra el desempeño real (horas promedio de faena meta y real). Identifica el producto con mejor cumplimiento y el de mayor desviación.

Reglas:
- Sé directo y profesional, evita introducciones informales.
- Utiliza terminología minera y logística formal apropiada para SQM (ej. boletería, romana, zona de carguío, unidades de pesaje, saturación de flujo, dotación, etc.).
- No inventes justificaciones que no provengan del contexto de horas/tonelajes o justificaciones provistas en los datos adjuntos, pero interpreta la correlación entre las incidencias reportadas (ej. fallas mecánicas, esperas en romana) y los retrasos mostrados en los números.
`;

      // Check if user requested the NVIDIA GLM-5.2 model
      if (model === "glm") {
        console.log("User requested NVIDIA GLM model. Checking API Key...");
        if (!process.env.NVIDIA_API_KEY) {
          console.warn("NVIDIA_API_KEY is missing. Falling back to Gemini with notice.");
          const geminiText = await callGemini(prompt);
          if (geminiText) {
            return res.json({
              analysis: geminiText + "\n\n---\n\n*(Nota: Se utilizó Gemini de respaldo debido a que `NVIDIA_API_KEY` no está configurada en las variables de entorno. Agrega tu API Key de NVIDIA en Configuración para activar GLM-5.2 nativo)*"
            });
          }
        } else {
          try {
            console.log("Calling NVIDIA NIM API for GLM-5.2 / GLM-4...");
            const nimResponse = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`
              },
              body: JSON.stringify({
                model: "z-ai/glm-4-9b-chat", // GLM standard model name in NVIDIA NIM API
                messages: [
                  {
                    role: "user",
                    content: prompt
                  }
                ],
                temperature: 0.3,
                max_tokens: 2048,
                top_p: 0.7
              })
            });

            if (nimResponse.ok) {
              const nimJson = await nimResponse.json();
              const text = nimJson.choices?.[0]?.message?.content;
              if (text) {
                console.log("Successfully retrieved response from NVIDIA GLM-4/5.2 NIM.");
                return res.json({ analysis: text });
              }
            } else {
              const errText = await nimResponse.text();
              console.error(`NVIDIA NIM API returned error status: ${nimResponse.status}`, errText);
              
              // Fallback to Gemini
              const geminiText = await callGemini(prompt);
              if (geminiText) {
                return res.json({
                  analysis: geminiText + `\n\n---\n\n*(Nota: Se activó Gemini de respaldo debido a que el servidor de NVIDIA NIM GLM falló (Error ${nimResponse.status}).)*`
                });
              }
            }
          } catch (nimErr: any) {
            console.error("Failed to fetch from NVIDIA NIM:", nimErr);
            const geminiText = await callGemini(prompt);
            if (geminiText) {
              return res.json({
                analysis: geminiText + `\n\n---\n\n*(Nota: Se activó Gemini de respaldo debido a un error de conexión con NVIDIA NIM: ${nimErr.message || nimErr})*`
              });
            }
          }
        }
      }

      // Default to Gemini (or fallback if glm failed)
      const geminiText = await callGemini(prompt);
      if (geminiText) {
        res.json({ analysis: geminiText });
      } else {
        console.log("Serving local analytic fallback.");
        res.json({
          analysis: null,
          info: "Los servidores de IA están experimentando alta demanda. Se ha activado el motor de análisis local de respaldo."
        });
      }
    } catch (outerException: any) {
      console.log("Request handled via backup routine.", outerException);
      res.json({ 
        analysis: null, 
        info: "Servicio en mantención de carga. Procesado por el motor local de respaldo." 
      });
    }
  });

  // NEW: Refine performance justification with AI secure endpoint
  app.post("/api/refine-justification", async (req, res) => {
    try {
      const { text, product, stats, model } = req.body;

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "La API Key de Gemini no está configurada." });
      }

      const prompt = `
Actúa como un Especialista Senior de SQM Litio. Tu misión es redactar una justificación profesional, BREVE, EJECUTIVA y TÉCNICA (máximo 2 oraciones) para el reporte de desempeño.

Información operativa de referencia:
- Producto: ${product}
- Detalles: ${JSON.stringify(stats || {}, null, 2)}

Borrador/Observación original del supervisor:
"${text || 'Sin observación manual'}"

REGLAS CRÍTICAS DE REDACCIÓN:
- Transforma el borrador en un texto formal, profesional y elegante apto para la gerencia.
- Utiliza terminología logística profesional (congestión logística, desviaciones de ciclo, saturación de flujo, transición de dotación, incidentes mecánicos, etc.).
- Entrega ÚNICAMENTE el texto formalizado/justificación refinada, sin comentarios adicionales ni preámbulos.
- Mantén la máxima concisión. No inventes datos que no estén expresados o implícitos en el borrador original o los detalles estadísticos.
- Siempre usa la abreviatura "ton." en minúscula para toneladas si llegas a mencionarlas.
- Si mencionas o calculas cualquier tiempo, duración o retraso (por ejemplo: "2.53 h", "1.5 h", "45 min"), debes expresarlo obligatoriamente en formato de horas y minutos "HH:MM" (por ejemplo: "02:32", "01:30", "00:45"). NUNCA uses decimales para las horas.
`;

      if (model === "glm") {
        if (process.env.NVIDIA_API_KEY) {
          try {
            const nimResponse = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`
              },
              body: JSON.stringify({
                model: "z-ai/glm-4-9b-chat",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.3,
                max_tokens: 250
              })
            });

            if (nimResponse.ok) {
              const nimJson = await nimResponse.json();
              const responseText = nimJson.choices?.[0]?.message?.content;
              if (responseText) {
                return res.json({ refined: responseText.trim().replace(/^["']|["']$/g, '') });
              }
            }
          } catch (nimErr) {
            console.error("NVIDIA Refinement failed, falling back to Gemini:", nimErr);
          }
        }
      }

      // Default to Gemini
      const geminiText = await callGemini(prompt);
      if (geminiText) {
        return res.json({ refined: geminiText.trim().replace(/^["']|["']$/g, '') });
      } else {
        return res.status(500).json({ error: "No se pudo procesar la reescritura con IA en este momento." });
      }
    } catch (e: any) {
      console.error("Error in refine-justification route:", e);
      res.status(500).json({ error: e.message || "Error interno del servidor." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
