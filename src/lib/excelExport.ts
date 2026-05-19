import XLSX from 'xlsx-js-style';

export interface ExcelExportOptions {
  titulo?: string;
  columnas: string[];
  filas: any[][];
  fileName: string;
  sheetName?: string;
}

export function exportarAExcel({ titulo, columnas, filas, fileName, sheetName }: ExcelExportOptions) {
  try {
    const data: any[][] = [];
    
    // Intentar obtener info de la empresa
    let empresa: any = {};
    try {
      empresa = JSON.parse(localStorage.getItem("gp_empresa") || "{}");
    } catch (e) {}

    // 1. Encabezado de Empresa
    if (empresa.razonSocial) {
      data.push([empresa.razonSocial.toUpperCase()]);
      if (empresa.cuit || empresa.email) {
        data.push([`${empresa.cuit ? "CUIT: " + empresa.cuit : ""} ${empresa.email ? " - " + empresa.email : ""}`.trim()]);
      }
    } else {
      data.push(["CLIK - SISTEMA DE GESTIÓN"]);
    }

    // 2. Título del Reporte
    const realTitulo = titulo ? titulo.replace(/(\d{4})-(\d{2})-(\d{2})/g, "$3/$2/$1") : "REPORTE";
    data.push([realTitulo]);

    // 3. Fecha de Emisión
    const ahora = new Date();
    const fechaEmision = `Emisión: ${ahora.toLocaleDateString("es-AR")} ${ahora.toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' })}`;
    data.push([fechaEmision]);
    data.push([]); // Espacio en blanco

    const headerRowIdx = data.length;
    data.push(columnas);
    
    // Forzamos números puros para que Excel los procese correctamente.
    filas.forEach(f => {
      const filaParseada = f.map(celda => {
        if (celda === null || celda === undefined) return "";
        if (typeof celda === "string") {
            let limpa = celda.replace(/(\d{4})-(\d{2})-(\d{2})/g, "$3/$2/$1").trim();
            if (limpa.startsWith('"') && limpa.endsWith('"')) {
                limpa = limpa.substring(1, limpa.length - 1);
                limpa = limpa.replace(/""/g, '"');
            }
            return limpa;
        }
        return celda;
      });
      data.push(filaParseada);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);

    // --- ESTILOS ---
    const CLIK_ORANGE = "ED6C02";
    const WHITE = "FFFFFF";

    // Estilo para el Título (Fila 3, índice 2 de data)
    const titleCellRef = XLSX.utils.encode_cell({ r: 2, c: 0 });
    if (ws[titleCellRef]) {
      ws[titleCellRef].s = {
        font: { bold: true, sz: 14, color: { rgb: "333333" } }
      };
    }

    // Estilo para el Encabezado de Columnas (Naranja de Clik)
    columnas.forEach((_, colIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: headerRowIdx, c: colIdx });
      if (ws[cellRef]) {
        ws[cellRef].s = {
          fill: { fgColor: { rgb: CLIK_ORANGE } },
          font: { color: { rgb: WHITE }, bold: true },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
          }
        };
      }
    });

    // Auto-ajustar columnas
    const colWidths = columnas.map((_, colIndex) => {
      let max = 12;
      for (let r = 0; r < data.length; r++) {
         const v = data[r][colIndex];
         const cellValue = v !== null && v !== undefined ? String(v) : "";
         if (cellValue.length > max) {
            max = cellValue.length;
         }
      }
      return { wch: Math.min(max + 4, 60) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    
    // Añadir metadatos para que el archivo sea más "formal"
    wb.Props = {
      Title: realTitulo,
      Subject: "Reporte de Gestión Clik",
      Author: empresa.razonSocial || "Clik Sistema",
      Company: empresa.razonSocial || "Clik Gestiones",
      CreatedDate: ahora
    };

    XLSX.utils.book_append_sheet(wb, ws, sheetName || "Hoja1");
    
    const safeFileName = fileName.replace(/(\d{4})-(\d{2})-(\d{2})/g, "$3-$2-$1");
    XLSX.writeFile(wb, safeFileName.endsWith('.xlsx') ? safeFileName : `${safeFileName}.xlsx`);
  } catch (error) {
    console.error("Error al exportar a Excel:", error);
    alert("Hubo un error al generar el archivo Excel.");
  }
}
