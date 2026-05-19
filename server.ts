import express from "express";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Route: Gemini Proxy for Invoices
  app.post("/api/ai/extract-invoice", async (req, res) => {
    try {
      // IA temporalmente deshabilitada
      return res.json({
        proveedorMatch: "Funcionalidad IA Deshabilitada",
        cuitProveedor: "00-00000000-0",
        fechaMatch: new Date().toISOString().split('T')[0],
        numeroFactura: "0000-00000000",
        items: [],
        subtotalGlobal: 0,
        impuestosInternosGlobal: 0,
        ivaGlobal: 0,
        totalGlobal: 0
      });
    } catch (error: any) {
      console.error("Error en extract-invoice proxy:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Gemini Proxy for Payments
  app.post("/api/ai/extract-payment", async (req, res) => {
    try {
      // IA temporalmente deshabilitada
      return res.json({
        monto: 0,
        proveedorMatch: "Funcionalidad IA Deshabilitada",
        cuentaMatch: "",
        fechaMatch: new Date().toISOString().split('T')[0],
        obsMatch: "IA Deshabilitada"
      });
    } catch (error: any) {
      console.error("Error en extract-payment proxy:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
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

startServer();
