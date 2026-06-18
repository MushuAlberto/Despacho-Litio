import { formatDecimalToHHMM } from '../components/CambioAnalisisComparativoChart';

interface AnalysisData {
  name: string;
  producto: string;
  Ton_Prog: number;
  Ton_Real: number;
  faenaMetaHours: number;
  faenaRealHours: number;
}

export async function analyzeProductData(
  title: string,
  data: AnalysisData[],
  onChunk: (text: string) => void,
  complianceData?: any[]
): Promise<string> {
  // Simulate a very fast analysis delay to mimic processing and keep the UX natural
  await new Promise((resolve) => setTimeout(resolve, 600));

  if (!data || data.length === 0) {
    const emptyMsg = "No hay datos de producción disponibles para generar el análisis.";
    onChunk(emptyMsg);
    return emptyMsg;
  }

  // 1. Calculations
  const totalProg = data.reduce((acc, item) => acc + (item.Ton_Prog || 0), 0);
  const totalReal = data.reduce((acc, item) => acc + (item.Ton_Real || 0), 0);
  const pctCumplimiento = totalProg > 0 ? (totalReal / totalProg) * 100 : 0;

  // Best product (Ratio real vs programado)
  let bestProduct = data[0];
  let bestRatio = -1;
  // Product with the highest time deviation
  let worstTimeDeviationDesc = "";
  let highestDeviation = -9999;
  let worstProduct: AnalysisData | null = null;

  for (const item of data) {
    const ratio = item.Ton_Prog > 0 ? item.Ton_Real / item.Ton_Prog : 1;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestProduct = item;
    }

    const dev = item.faenaRealHours - item.faenaMetaHours;
    if (dev > highestDeviation) {
      highestDeviation = dev;
      worstProduct = item;
    }
  }

  // Format hours helper locally (or use imports safely)
  const formatHHMM = (dec: number) => {
    if (isNaN(dec) || dec < 0) return "00:00";
    const hours = Math.floor(dec);
    const mins = Math.round((dec - hours) * 60);
    return `${hours}:${mins.toString().padStart(2, "0")}`;
  };

  // Compile unique active products
  const activeProducts = new Set(data.map(d => d.name));

  // 2. Process compliance data (justifications)
  const cleanComplianceData = complianceData
    ?.map(item => {
      const fechaRaw = item.date || item.Fecha || "N/A";
      // format date nicely
      let formattedDate = fechaRaw;
      if (fechaRaw && fechaRaw.includes("-")) {
        const [y, m, d] = fechaRaw.split("-");
        if (y && m && d) formattedDate = `${d}/${m}/${y}`;
      }
      return {
        fecha: formattedDate,
        producto: item.title || item.Producto || "N/A",
        justificacion: item.justificacion_desempeño || item["JUSTIFICACIÓN DE DESEMPEÑO"] || item.comentarios || ""
      };
    })
    .filter(item => activeProducts.has(item.producto) && item.justificacion.trim() !== "")
    .slice(0, 5) || [];

  // Build markdown text block by block
  let text = `### Resumen Ejecutivo - ${title}\n\n`;
  text += `Durante el periodo seleccionado de la faena **${title}**, se planificó un total de **${Math.round(totalProg).toLocaleString()} Ton** de carga, alcanzando una ejecución de carga real de **${Math.round(totalReal).toLocaleString()} Ton** (que representa un **${pctCumplimiento.toFixed(1)}% de cumplimiento**).\n\n`;

  // Comment on progress / delays
  if (pctCumplimiento >= 100) {
    text += `La operación superó la meta definida con un excelente flujo de carguío y tránsito libre en boleterías y pesajes.\n\n`;
  } else if (pctCumplimiento >= 85) {
    text += `Se registra un ritmo constante dentro de los límites aceptables de la tolerancia operativa ordinaria, alcanzando un progreso cercano al óptimo.\n\n`;
  } else {
    text += `Se evidencia una desviación operativa con un cumplimiento inferior a la meta programada. Se recomienda revisar tiempos de demora no identificados y cuellos de botella.\n\n`;
  }

  // 3. Justifications section
  text += `### Análisis de Justificaciones de Desempeño\n\n`;
  if (cleanComplianceData.length > 0) {
    text += `Se identificaron reportes y justificaciones registradas por supervisores para este periodo:\n\n`;
    cleanComplianceData.forEach(item => {
      text += `- **${item.fecha} - ${item.producto}**: "${item.justificacion}"\n`;
    });
    text += `\n`;
  } else {
    text += `No se encontraron justificaciones o retrasos anómalos declarados formalmente para los productos analizados en este intervalo. Por lo tanto, el flujo de tolvas y equipos en tránsito operó bajo condiciones estándar.\n\n`;
  }

  // 4. Product performance summary
  text += `### Rendimiento General por Productos\n\n`;
  text += `- **Mejor rendimiento relativo**: **${bestProduct.name}** con un **${(bestRatio * 100).toFixed(1)}%** respecto a su programa (${Math.round(bestProduct.Ton_Real).toLocaleString()} Ton logradas).\n`;
  if (worstProduct && highestDeviation > 0.1) {
    text += `- **Mayor desviación de tiempo**: **${worstProduct.name}** con una demora de **+${formatHHMM(highestDeviation)} horas** adicionales respecto a la planificación estimada.\n\n`;
  } else {
    text += `- **Control de tiempos**: Todos los productos operaron en estrecho apego a las metas horarias estipuladas, sin desviaciones significativas en Romana ni esperas prolongadas en carguío.\n\n`;
  }

  // 5. Desglose de tiempos
  text += `### **Desglose Operativo de Tiempos (HH:MM)**\n\n`;
  for (const item of data) {
    const sign = item.faenaRealHours >= item.faenaMetaHours ? "Desvío" : "Ahorro";
    const diff = Math.abs(item.faenaRealHours - item.faenaMetaHours);
    let stateComment = "Operación eficiente y estable.";
    if (item.faenaRealHours > item.faenaMetaHours * 1.15) {
      stateComment = "Demoras críticas detectadas. Posible atochamiento en pesaje o Romana.";
    } else if (item.faenaRealHours > item.faenaMetaHours) {
      stateComment = "Retraso leve en tiempos de tránsito.";
    } else if (item.faenaRealHours < item.faenaMetaHours) {
      stateComment = "Optimización de ciclo de transporte y carguío rápido.";
    }

    text += `- **${item.name.toUpperCase()}**: Meta **${formatHHMM(item.faenaMetaHours)}** | Real **${formatHHMM(item.faenaRealHours)}** (${sign}: **${formatHHMM(diff)}** - *${stateComment}*)\n`;
  }
  text += `\n`;

  // 6. Recommendations
  text += `### Recomendaciones de Supervisión\n\n`;
  if (highestDeviation > 0.5 && worstProduct) {
    text += `1. **Redistribución de Equipos en ${worstProduct.name}**: Implementar una segregación coordinada del tránsito de camiones ante el desvío de **+${formatHHMM(highestDeviation)} horas** identificado para nivelar el flujo y descongestionar Romana.\n`;
    text += `2. **Contingencia por Llegadas Masivas**: Reforzar el control de despacho si la capacidad nominal disminuye de los 8-10 equipos cargados por hora previstos.\n`;
  } else {
    text += `1. **Mantención Preventiva de Ciclos**: Continuar con las pautas de despacho programadas, manteniendo el óptimo flujo de Romana que ha demostrado ser eficiente en esta jornada.\n`;
    text += `2. **Consolidación de Datos**: Incentivar el registro riguroso de novedades operativas para asegurar la trazabilidad continua de cada producto.\n`;
  }

  onChunk(text);
  return text;
}
