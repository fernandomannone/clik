import React, { useState, useEffect, useMemo } from "react";
import { THEMES, USERS_INIT } from "./constants";
import { Ctx } from "./context/AppContext";
import { DataProvider, useData } from "./context/DataContext";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import Login from "./components/Auth/Login";
import AppShell from "./components/layout/AppShell";
import Dashboard from "./components/features/Dashboard/Dashboard";
import Clientes from "./components/features/Clientes/Clientes";
import Proveedores from "./components/features/Proveedores/Proveedores";
import Articulos from "./components/features/Articulos/Articulos";
import Caja from "./components/features/Caja/Caja";
import Estadisticas from "./components/features/Estadisticas/Estadisticas";
import Configuracion from "./components/features/Config/Configuracion";
import WhatsAppDashboard from "./components/features/WhatsApp/WhatsAppDashboard";
import { pb } from "./lib/pocketbase";

export default function App() {
  const [tema, setTema] = useState<any>(() => {
    const saved = localStorage.getItem("clik-theme") || "light";
    if (saved === "light" || saved === "clik" || saved === "solar_neon" || saved === "blue_light") return "clik";
    return "clik_dark";
  });

  const [sec, setSec] = useState("dashboard");

  useEffect(() => {
    localStorage.setItem("clik-theme", tema);
  }, [tema]);

  const t = useMemo(() => {
    return THEMES[tema] || THEMES.clik;
  }, [tema]);

  const contextValue = useMemo(
    () => ({
      t,
      isDark: tema === "clik_dark",
      tema,
      setTema,
      claveMaestra: "4415",
    }),
    [tema, t],
  );

  return (
    <Ctx.Provider value={contextValue}>
      <DataProvider>
        <AppImpl sec={sec} setSec={setSec} t={t} contextValue={contextValue} />
      </DataProvider>
    </Ctx.Provider>
  );
}

function AppImpl({ sec, setSec, t, contextValue }: any) {
  const [user, setUser] = useState<any>(null);
  const data = useData();
  const { usuarios } = data;

  useEffect(() => {
    // Escuchar cambios de Auth en PocketBase
    const handleAuthChange = () => {
      if (pb.authStore.isValid && pb.authStore.model) {
        const pbUser = pb.authStore.model;
        const email = pbUser.email || "";
        const uClean =
          pbUser.username || email.split("@")[0].toLowerCase().trim();

        console.log("Auth detectado para:", email);

        // Intentar encontrar el perfil en la lista de usuarios original de CLIK
        const profile = usuarios.find(
          (u: any) =>
            u.usuario?.toLowerCase().trim() === uClean ||
            u.usuario?.toLowerCase().trim() === email.toLowerCase().trim(),
        );

        if (profile) {
          // Si es un admin conocido, aseguramos que tenga rol maestro y todos los permisos
          const isAdminEmail =
            email === "fernandomannone@gmail.com" ||
            email === "admin@clik.internal" ||
            email === "ana@clik.internal" ||
            email === "ferna@clik.internal";
          const finalProfile = {
            ...profile,
            rol: isAdminEmail ? "maestro" : profile.rol || "usuario",
            permisos: isAdminEmail
              ? {
                  caja: true,
                  estadisticas: true,
                  costos: true,
                  editarCC: true,
                  borrarClientes: true,
                  agregarConceptos: true,
                  anularPagos: true,
                  cuentasVisibles: [],
                  widgetsVisibles: [],
                }
              : profile.permisos || { caja: false },
          };
          setUser(finalProfile);
          localStorage.setItem("clik-user", JSON.stringify(finalProfile));
        } else if (
          email === "fernandomannone@gmail.com" ||
          email === "admin@clik.internal" ||
          email === "ana@clik.internal" ||
          email === "ferna@clik.internal"
        ) {
          const maestro = {
            id: pbUser.id,
            nombre:
              email === "ana@clik.internal"
                ? "Ana"
                : email === "admin@clik.internal" || email === "fernandomannone@gmail.com"
                  ? "Administrador"
                  : "Admin Maestro",
            usuario: uClean,
            rol: "maestro",
            permisos: {
              caja: true,
              estadisticas: true,
              costos: true,
              editarCC: true,
              borrarClientes: true,
              agregarConceptos: true,
              anularPagos: true,
              cuentasVisibles: [],
              widgetsVisibles: [],
            },
          };
          setUser(maestro);
          localStorage.setItem("clik-user", JSON.stringify(maestro));
        } else {
          console.log("Perfil no encontrado todavía para:", email);
        }
      } else {
        setUser(null);
        localStorage.removeItem("clik-user");
      }
    };

    // Registrar watcher
    const unsub = pb.authStore.onChange(handleAuthChange);
    // Ejecutar inicial
    handleAuthChange();

    return () => unsub();
  }, [usuarios.length]); // Dependemos de que la lista de usuarios cargue

  useEffect(() => {
    // Carga inicial ultra-rápida desde localStorage
    const localUser = localStorage.getItem("clik-user");
    if (localUser && !user) {
      try {
        setUser(JSON.parse(localUser));
      } catch (e) {
        localStorage.removeItem("clik-user");
      }
    }
  }, []);

  useEffect(() => {
    // SCRIPT DE LIMPIEZA SOLICITADO
    if (
      user &&
      data &&
      data.cuentas?.length > 0 &&
      data.cloudSync?.deleteFromCloud
    ) {
      // Eliminar cuentas a medias (sin nombre válido o caja efectivo en 0)
      data.cuentas.forEach((c: any) => {
        if (
          !c.nombre ||
          typeof c.nombre !== "string" ||
          c.nombre.trim().length <= 1 ||
          c.nombre.trim() === "Nueva Cuenta" ||
          (c.nombre.toLowerCase().trim() === "caja efectivo" &&
            (c.saldo || 0) === 0)
        ) {
          data.cloudSync.deleteFromCloud("cuentas", String(c.id));
        }
      });

      if (localStorage.getItem("db_cleaned_sanjuan_v5")) return;

      console.log("EJECUTANDO LIMPIEZA DE RAIZ Y RECALCULO V5...");
      const targetCuentas = data.cuentas
        .filter((c: any) => {
          const n = (c.nombre || "").toLowerCase();
          return (
            n.includes("san juan") ||
            n.includes("patagonia") ||
            n.includes("caja") ||
            n.includes("efectivo")
          );
        })
        .map((c: any) => String(c.id));

      const toDeleteMovs = data.movimientos.filter((m: any) => {
        if (!targetCuentas.includes(String(m.cuentaId))) return false;
        let huerfano = false;
        if (
          m.reciboId &&
          !data.pagos.find(
            (p: any) =>
              p.id === m.reciboId || String(p.id) === String(m.reciboId),
          )
        )
          huerfano = true;
        if (
          m.pagoProvId &&
          !data.pagosProv.find(
            (p: any) =>
              p.id === m.pagoProvId || String(p.id) === String(m.pagoProvId),
          )
        )
          huerfano = true;
        return huerfano;
      });

      console.log(`Borrando ${toDeleteMovs.length} movimientos huerfanos...`);
      toDeleteMovs.forEach((m: any) =>
        data.cloudSync.deleteFromCloud("movimientos", String(m.id)),
      );

      console.log(
        `Borrando ${data.historialCierres.length} cierres historicos de caja...`,
      );
      data.historialCierres.forEach((h: any) =>
        data.cloudSync.deleteFromCloud("historialCierres", String(h.id)),
      );

      // El usuario dice "planilla del día sigue mostrando un saldo anterior que no debería registrar pues el sistema no ha entrado en rigor."
      const viejos = data.movimientos.filter(
        (m: any) =>
          targetCuentas.includes(String(m.cuentaId)) &&
          m.fecha &&
          m.fecha < "2026-05-03" &&
          !toDeleteMovs.includes(m),
      );

      console.log(
        `Borrando ${viejos.length} movimientos viejos antes de entrar en rigor en estas cuentas...`,
      );
      viejos.forEach((m: any) =>
        data.cloudSync.deleteFromCloud("movimientos", String(m.id)),
      );

      const cobrosViejos = data.pagos.filter(
        (p: any) =>
          targetCuentas.includes(String(p.cuentaId)) && p.fecha < "2026-05-03",
      );
      console.log(
        `Borrando ${cobrosViejos.length} cobros viejos antes de entrar en rigor en estas cuentas...`,
      );
      cobrosViejos.forEach((p: any) =>
        data.cloudSync.deleteFromCloud("pagos", String(p.id)),
      );

      const ppViejos = data.pagosProv.filter(
        (p: any) =>
          targetCuentas.includes(String(p.cuentaId)) && p.fecha < "2026-05-03",
      );
      console.log(
        `Borrando ${ppViejos.length} pagosProv viejos antes de entrar en rigor en estas cuentas...`,
      );
      ppViejos.forEach((p: any) =>
        data.cloudSync.deleteFromCloud("pagosProv", String(p.id)),
      );

      const allToDeleteMovs = [...toDeleteMovs, ...viejos];
      const validMovs = data.movimientos.filter(
        (m: any) => !allToDeleteMovs.includes(m),
      );
      const validPagos = data.pagos.filter(
        (p: any) => !p.anulado && !cobrosViejos.includes(p),
      );
      const validPagosProv = data.pagosProv.filter(
        (p: any) => !p.anulado && !ppViejos.includes(p),
      );

      // Recalcular saldo oficial
      data.cuentas.forEach((c: any) => {
        let saldoReal = 0;

        const movs = validMovs.filter(
          (m: any) => String(m.cuentaId) === String(c.id) && !m.informativo,
        );
        movs.forEach((m: any) => {
          if (m.tipo === "ingreso") saldoReal += m.monto || 0;
          else saldoReal -= m.monto || 0;
        });

        const cobros = validPagos.filter(
          (p: any) => String(p.cuentaId) === String(c.id),
        );
        cobros.forEach((p: any) => {
          if (
            !movs.find(
              (m: any) =>
                m.reciboId === p.id || String(m.reciboId) === String(p.id),
            )
          ) {
            saldoReal += p.monto || 0;
          }
        });

        const pp = validPagosProv.filter(
          (p: any) => String(p.cuentaId) === String(c.id),
        );
        pp.forEach((p: any) => {
          if (
            !movs.find(
              (m: any) =>
                m.pagoProvId === p.id || String(m.pagoProvId) === String(p.id),
            )
          ) {
            saldoReal -= p.monto || 0;
          }
        });

        if (c.saldo !== saldoReal) {
          console.log(
            `Corrigiendo saldo de ${c.nombre}: de ${c.saldo} a ${saldoReal}`,
          );
          data.cloudSync.saveToCloud("cuentas", { ...c, saldo: saldoReal });
        }
      });

      localStorage.setItem("db_cleaned_sanjuan_v5", "true");
    }
  }, [user, data.cuentas, data.historialCierres, data.cloudSync]);

  const handleLogout = async () => {
    pb.authStore.clear();
    localStorage.removeItem("clik-user");
    setUser(null);
    setSec("dashboard");
  };

  useEffect(() => {
    if (!user) return;

    let timeoutId: any;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      // 30 minutes of inactivity
      timeoutId = setTimeout(() => {
        console.log("Inactividad detectada. Cerrando sesión...");
        handleLogout();
      }, 30 * 60 * 1000); 
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(name => window.addEventListener(name, resetTimer, true));
    
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(name => window.removeEventListener(name, resetTimer, true));
    };
  }, [user]);

  const handleLogin = (u: any) => {
    localStorage.setItem("clik-user", JSON.stringify(u));
    setUser(u);
    setSec("dashboard");
  };

  contextValue.claveMaestra = user?.password || "4415";

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${t.bg}; color: ${t.text}; font-family: 'Segoe UI', Tahoma, sans-serif; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: ${t.surf}; }
        ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 4px; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        input::placeholder { color: ${t.muted}; }
        select option { background: ${t.surf}; color: ${t.text}; }
      `}</style>

      {!user ? (
        <Login onLogin={handleLogin} usuarios={usuarios} />
      ) : (
        <AppShell
          user={user}
          currentSec={sec}
          setSec={setSec}
          onLogout={handleLogout}
        >
          <ErrorBoundary>
            {sec === "dashboard" && <Dashboard user={user} {...data} />}
            {sec === "whatsapp" && <WhatsAppDashboard />}
            {sec === "clientes" && <Clientes user={user} {...data} />}
            {sec === "proveedores" && <Proveedores user={user} {...data} />}
            {sec === "articulos" && <Articulos user={user} {...data} />}
            {sec === "caja" && <Caja user={user} {...data} />}
            {sec === "stats" && <Estadisticas user={user} {...data} />}
            {sec === "config" && <Configuracion user={user} {...data} />}
          </ErrorBoundary>
        </AppShell>
      )}
    </>
  );
}
