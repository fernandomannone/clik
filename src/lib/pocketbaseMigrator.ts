import * as initialData from '../initial_db_data.json';

const BASE_URL = localStorage.getItem("pb_url") || ((window.location.hostname && window.location.hostname !== "localhost") ? `${window.location.protocol}//${window.location.hostname}:8090` : "http://127.0.0.1:8090");

const collectionsToCreate = [
  "usuarios", "clientes", "proveedores", "articulos", "familias", 
  "cuentas", "conceptos", "facturas", "factProv", "pagos", 
  "pagosProv", "movimientos", "ajustesStock", "compras", "utilidadesFCI",
  "estadoResultados", "seacMovs", "seacImportaciones", "seacGanancias",
  "seacMatchManuales", "historialCierres", "historialImport", "kardex", "menuOrder"
];

export async function createCollectionsAndImport(adminEmail: string, adminPass: string, customData?: any) {
  let token = "";
  
  try {
    let authRes = await fetch(`${BASE_URL}/api/collections/_superusers/auth-with-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: adminEmail, password: adminPass })
    });

    if (authRes.status === 404) {
      // Fallback for older PocketBase versions
      authRes = await fetch(`${BASE_URL}/api/admins/auth-with-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity: adminEmail, password: adminPass })
      });
    }
    
    if (!authRes.ok) {
      const errText = await authRes.text();
      throw new Error(`Credenciales inválidas: ${authRes.status} - ${errText}`);
    }
    const authData = await authRes.json();
    token = authData.token;
  } catch(e: any) {
    throw new Error("Error en Login Admin PB: " + e.message);
  }

  const logs: string[] = [];
  const headers = {
    "Content-Type": "application/json",
    "Authorization": token
  };

  for (const cName of collectionsToCreate) {
    try {
      // Intentar obtener la colección
      const getRes = await fetch(`${BASE_URL}/api/collections/${cName}`, { headers });
      
      if (!getRes.ok) {
        // Si no existe, crearla
        const createRes = await fetch(`${BASE_URL}/api/collections`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: cName,
            type: "base",
            listRule: "",
            viewRule: "",
            createRule: "",
            updateRule: "",
            deleteRule: "",
            schema: [
              {
                name: "legacyId",
                type: "text",
                required: true,
              },
              {
                name: "userId",
                type: "text",
                required: false,
              },
              {
                name: "payload",
                type: "json",
                required: true,
              }
            ]
          })
        });
        
        if (!createRes.ok) {
          const errData = await createRes.json();
          throw new Error(`Error al crear colección: ${JSON.stringify(errData)}`);
        }
        logs.push(`Colección ${cName} creada en PB (Desbloqueada).`);
      } else {
        logs.push(`Colección ${cName} ya existe. Desbloqueando Reglas...`);
        // Actualizamos reglas para asegurar que estén desbloqueadas con " " (público) - 403 fix
        const extData = await getRes.json();
        await fetch(`${BASE_URL}/api/collections/${extData.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            listRule: "",
            viewRule: "",
            createRule: "",
            updateRule: "",
            deleteRule: ""
          })
        });
      }

      // Importar datos
      let dataToImport = null;
      if (customData) {
        dataToImport = customData[`clik-${cName}`] || customData[cName];
      }
      if (!dataToImport) {
        try {
          const localData = localStorage.getItem(`clik-${cName}`);
          if (localData) {
            dataToImport = JSON.parse(localData);
          }
        } catch (e) {}
      }

      if (!dataToImport || !Array.isArray(dataToImport) || dataToImport.length === 0) {
        dataToImport = (initialData as any).default?.[cName] || (initialData as any)[cName];
      }

      // Migrate auth users
      if (cName === "usuarios" && dataToImport && Array.isArray(dataToImport)) {
         let usersSubidos = 0;
         const usersBaseUrl = `${BASE_URL}/api/collections/users`;
         
         // Desbloquear usuarios también para asegurar que funcionen
         try {
           const uReq = await fetch(usersBaseUrl, { headers });
           if (uReq.ok) {
             const uData = await uReq.json();
             await fetch(`${BASE_URL}/api/collections/${uData.id}`, {
               method: "PATCH",
               headers,
               body: JSON.stringify({
                 listRule: "",
                 viewRule: "",
               })
             });
           }
         } catch(e) {}
         
         // Update users collection to remove password length restrictions temporarily or just use a fixed password
         // PB requires minimum 8 chars for passwords by default.
         for (const u of dataToImport) {
           const safeUsername = u.usuario.toLowerCase().trim().replace(/[^a-z0-9_.-]/g, '');
           const email = `${safeUsername}@clik.internal`;
           const password = (u.password || "12345678").padEnd(8, '0'); // PB needs >= 8 chars usually
           
           // Check if user exists by email
           const findRes = await fetch(`${usersBaseUrl}/records?filter=(email="${email}")`, { headers });
           let exists = false;
           if (findRes.ok) {
             const fData = await findRes.json();
             exists = fData.totalItems > 0;
           }
           
           if (!exists) {
             const payload = {
               username: safeUsername,
               email: email,
               password: password,
               passwordConfirm: password,
               name: u.nombre,
               emailVisibility: false,
               verified: true,
             };
             const crUserRes = await fetch(`${usersBaseUrl}/records`, {
               method: "POST",
               headers,
               body: JSON.stringify(payload)
             });
             if (crUserRes.ok) {
               usersSubidos++;
             } else {
               const errText = await crUserRes.text();
               logs.push(`- Error creando usuario ${email}: ${errText}`);
             }
           }
         }
         logs.push(`- Auth_Users (PB): ${usersSubidos} credenciales importadas (Pass: misma de app).`);
      }
      
      if (dataToImport && Array.isArray(dataToImport)) {
        
        // Obtener existentes para evitar duplicados
        const extRes = await fetch(`${BASE_URL}/api/collections/${cName}/records?perPage=5000&fields=legacyId`, { headers });
        let existingSet = new Set();
        if (extRes.ok) {
           const extData = await extRes.json();
           existingSet = new Set(extData.items?.map((x: any) => x.legacyId) || []);
        }
        
        let subidos = 0;
        for (const item of dataToImport) {
          const lId = String(item.id);
          if (!existingSet.has(lId)) {
            const createRecordRes = await fetch(`${BASE_URL}/api/collections/${cName}/records`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                legacyId: lId,
                payload: item
              })
            });
            if (createRecordRes.ok) {
              subidos++;
              existingSet.add(lId);
            }
          }
        }
        logs.push(`- ${cName}: ${subidos} registros importados.`);
      }

    } catch (err: any) {
      logs.push(`Error en ${cName}: ${err.message}`);
    }
  }

  return logs;
}

