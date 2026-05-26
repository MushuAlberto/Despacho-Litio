/**
 * Servicio para integración con Google Gemini API usando fetch nativo (sin dependencias externas).
 */

const getEnvVar = (key: string): string => {
  try {
    return (import.meta as any).env?.[key] || "";
  } catch {
    return "";
  }
};

const API_KEY = getEnvVar("VITE_GEMINI_API_KEY");

export async function analyzeProductData(
  title: string,
  data: any[],
  onChunk: (text: string) => void,
  complianceData?: any[]
): Promise<string> {
  if (!API_KEY) {
    throw new Error("La clave API de Gemini (VITE_GEMINI_API_KEY) no está configurada.");
  }

  // Obtener nombres de productos presentes en los datos de este panel
  const activeProducts = new Set(data.map(d => d.name));

  // Filtrar y limpiar los datos de cumplimiento
  const cleanComplianceData = complianceData?.map(item => {
    return {
      fecha: item.date || item.Fecha || "N/A",
      producto: item.title || item.Producto || "N/A",
      justificacion: item.justificacion_desempeño || item["JUSTIFICACIÓN DE DESEMPEÑO"] || item.comentarios || JSON.stringify(item).substring(0, 500)
    };
  })
  .filter(item => activeProducts.has(item.producto))
  .slice(0, 20);

  const complianceContext = cleanComplianceData && cleanComplianceData.length > 0 
    ? `\nINFORMACIÓN DE AUDITORÍA Y JUSTIFICACIONES (Resumen):\n${JSON.stringify(cleanComplianceData, null, 2)}`
    : "";

  const prompt = `
    Actúa como un experto Analista de Producción Industrial. 
    Analiza los siguientes datos de producción para el panel "${title}".
    
    DATOS DE PRODUCCIÓN (JSON):
    ${JSON.stringify(data)}
    ${complianceContext}
    
    Instrucciones Críticas:
    1. Proporciona un resumen ejecutivo breve (máximo 3 líneas). Menciona hitos de producción o retrasos críticos.
    2. ANALIZA LAS JUSTIFICACIONES: Es CRUCIAL que revises la sección "INFORMACIÓN DE AUDITORÍA Y JUSTIFICACIONES". 
       - Cruza las fechas y productos de las justificaciones con los datos de producción.
       - La capacidad nominal es de 8 a 10 equipos cargados por hora. 
       - Identifica cuellos de botella por "llegadas masivas" (ej. 29 equipos en 2 horas) que generan congestión en Romana y retrasos operativos.
       - Menciona explícitamente si las variaciones en las horas promedio coinciden con los comentarios de "Desviación de Tiempo" o "Atochamiento" reportados.
    3. Identifica el producto con mejor rendimiento (Ton_Real vs Ton_Prog) y el de mayor desviación de tiempo.
    4. Incluye una sección titulada strictly "**Desglose Operativo de Tiempos (HH:MM)**" siguiendo este formato exacto:
       **PRODUCTO**: Meta **HH:MM** | Real **HH:MM** (Comentario: Eficiencia alta, Retraso por congestión, etc.).
    5. IMPORTANTE: Para cualquier mención de tiempo o duración, utiliza estrictamente el formato de reloj HH:MM (ej. "1:24" en lugar de "1.4 horas").
    6. Sugiere una recomendación operativa específica basada en la causa raíz (ej. "Mejorar segregación en llegadas masivas" o "Revisar tiempos de pesaje en Romana").
    7. Usa un tono profesional de Supervisor de Turno de Minería.
    8. Formatea la respuesta en español usando Markdown simple.
  `;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error en API Gemini (${response.status}): ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No se pudo obtener el reader de la respuesta.");
  }

  const decoder = new TextDecoder("utf-8");
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;

      if (cleanLine.startsWith("data: ")) {
        const jsonStr = cleanLine.substring(6);
        try {
          const parsed = JSON.parse(jsonStr);
          const chunkText = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (chunkText) {
            fullText += chunkText;
            onChunk(fullText);
          }
        } catch (e) {
          // Ignorar errores de parseo parciales o de fin de stream
        }
      }
    }
  }

  // Procesar cualquier remanente en el buffer
  if (buffer && buffer.startsWith("data: ")) {
    try {
      const parsed = JSON.parse(buffer.substring(6));
      const chunkText = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (chunkText) {
        fullText += chunkText;
        onChunk(fullText);
      }
    } catch (e) {}
  }

  return fullText;
}
