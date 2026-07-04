import express from "express";
import path from "path";
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

// Helper to run NVIDIA GLM models in sequence
const callNvidiaGlm = async (prompt: string, maxTokens: number = 1024, singleModelOnly = false): Promise<string | null> => {
  if (!process.env.NVIDIA_API_KEY) return null;
  const modelsToTry = singleModelOnly
    ? ["meta/llama-3.1-8b-instruct"]
    : ["meta/llama-3.1-8b-instruct", "meta/llama-3.1-70b-instruct", "z-ai/glm-5.2"];
  for (const modelName of modelsToTry) {
    try {
      console.log(`Trying NVIDIA model: ${modelName}`);
      // Use AbortController to enforce a per-request timeout of 7s
      // Vercel Hobby plan has a hard 10s limit, so we must finish well under that
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);
      const nimResponse = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: maxTokens,
          top_p: 0.7
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (nimResponse.ok) {
        const nimJson = await nimResponse.json();
        const text = nimJson.choices?.[0]?.message?.content;
        if (text) {
          console.log(`Successfully retrieved response from NVIDIA model ${modelName}`);
          return text;
        }
      } else {
        const errText = await nimResponse.text();
        console.error(`NVIDIA model ${modelName} returned status: ${nimResponse.status}`, errText);
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        console.error(`NVIDIA model ${modelName} timed out after 7s. Trying next fallback...`);
      } else {
        console.error(`NVIDIA model ${modelName} call failed:`, e);
      }
    }
  }
  return null;
};

// Helper to run OpenRouter models in sequence
const callOpenRouter = async (prompt: string, maxTokens: number = 1024): Promise<string | null> => {
  if (!process.env.OPENROUTER_API_KEY) return null;
  const modelsToTry = [
    "google/gemma-4-31b-it:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "openrouter/free"
  ];
  for (const modelName of modelsToTry) {
    try {
      console.log(`Trying OpenRouter model: ${modelName}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://ai.studio",
          "X-Title": "SQM Litio AI"
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: maxTokens
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const json = await response.json();
        const text = json.choices?.[0]?.message?.content;
        if (text) {
          if (text.toLowerCase().includes("user safety")) {
            console.warn(`Skipping safety-moderation classification response from model ${modelName}: "${text}"`);
            continue;
          }
          console.log(`Successfully retrieved response from OpenRouter model ${modelName}`);
          return text;
        }
      } else {
        const errText = await response.text();
        console.error(`OpenRouter model ${modelName} returned status: ${response.status}`, errText);
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        console.error(`OpenRouter model ${modelName} timed out after 5s. Trying next fallback...`);
      } else {
        console.error(`OpenRouter model ${modelName} call failed:`, e);
      }
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

    // Check if user requested OpenRouter
    if (model === "openrouter") {
      console.log("User requested OpenRouter model. Checking API Key...");
      if (!process.env.OPENROUTER_API_KEY) {
        console.warn("OPENROUTER_API_KEY is missing. Falling back to Gemini with notice.");
        const geminiText = await callGemini(prompt);
        if (geminiText) {
          return res.json({
            analysis: geminiText + "\n\n---\n\n*(Nota: Se utilizó Gemini de respaldo debido a que `OPENROUTER_API_KEY` no está configurada en las variables de entorno. Agrega tu API Key de OpenRouter en Configuración para activar Nemotron)*"
          });
        }
      } else {
        const orText = await callOpenRouter(prompt, 2048);
        if (orText) {
          return res.json({ analysis: orText });
        } else {
          console.warn("OpenRouter model failed. Falling back to Gemini...");
          const geminiText = await callGemini(prompt);
          if (geminiText) {
            return res.json({
              analysis: geminiText + "\n\n---\n\n*(Nota: Se activó Gemini de respaldo debido a que los servidores de OpenRouter no respondieron correctamente.)*"
            });
          }
        }
      }
    }

    // Default to Gemini
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

    if (model === "openrouter") {
      if (!process.env.OPENROUTER_API_KEY) {
        return res.status(400).json({ error: "La API Key de OpenRouter no está configurada en las variables de entorno." });
      }
    } else {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "La API Key de Gemini no está configurada." });
      }
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

    if (model === "openrouter") {
      console.log("Calling OpenRouter Refinement...");
      const orText = await callOpenRouter(prompt, 400);
      if (orText) {
        return res.json({ refined: orText.trim().replace(/^["']|["']$/g, '') });
      } else {
        console.warn("OpenRouter Refinement failed. Falling back to Gemini...");
        if (process.env.GEMINI_API_KEY) {
          const geminiText = await callGemini(prompt);
          if (geminiText) {
            return res.json({ refined: geminiText.trim().replace(/^["']|["']$/g, '') });
          }
        }
        return res.status(502).json({ error: "El motor de IA de OpenRouter no respondió correctamente y no hay respaldo de Gemini disponible." });
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

// Conditionally start listening and mount Vite / static files
async function startLocalServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
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

if (!process.env.VERCEL) {
  startLocalServer().catch(err => {
    console.error("Failed to start local server:", err);
  });
}

export default app;
