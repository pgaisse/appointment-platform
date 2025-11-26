# Configuración Auth0 para Login Custom (Password Grant)

## ⚠️ IMPORTANTE: Habilitar Password Grant

Para usar tu formulario custom, debes habilitar el grant type "Password" en Auth0:

## ⚙️ Paso 1: Habilitar Password Grant Type

1. Ve a **Auth0 Dashboard** → https://manage.auth0.com
2. Ve a **Applications** → Tu aplicación
   - **DEV:** Client ID: `cttrarEE0uFRMOxlx8VGI2AdjETk91Lq`
   - **PROD:** Client ID: `LATv8f4mWoSJeWttinR5tp1hFq1glxeL`
3. Tab **Settings** → **Advanced Settings** (al final de la página)
4. Click en **Grant Types**
5. ✅ **HABILITA "Password"** (este es el crítico!)
6. ✅ También asegúrate que estén habilitados:
   - ✅ **Implicit**
   - ✅ **Authorization Code**
   - ✅ **Refresh Token**
7. 💾 **Guarda los cambios** (botón "Save Changes" al final)

---

## ⚙️ Paso 2: Configurar Allowed Origins (CORS)

1. En la misma aplicación, en **Settings** (tab principal)
2. Scroll hasta **Application URIs**
3. En **Allowed Web Origins**, agrega:
   ```
   http://localhost:3004,http://213.218.240.82:3004
   ```
4. En **Allowed Callback URLs**, agrega:
   ```
   http://localhost:3004,http://213.218.240.82:3004
   ```
5. 💾 **Guarda los cambios**

---

## ⚙️ Paso 3: Verificar Database Connection

1. Ve a **Authentication** → **Database**
2. Encuentra tu conexión (probablemente "Username-Password-Authentication")
3. Tab **Applications**: Asegúrate que tu aplicación esté conectada (debe estar en la lista)
4. Si no está, haz click en tu aplicación para habilitarla
5. 💾 **Guarda**

---

## 🧪 Prueba

Después de estos pasos:
1. Refresca tu navegador (`Ctrl + Shift + R`)
2. Prueba el login con username/password
3. Debería funcionar sin el error de "grant type not allowed"

---

## 🔒 Ventajas de este método

✅ **Mantiene tu UI custom** - No redirige a Auth0
✅ **Seguro** - Usa endpoints permitidos para SPAs
✅ **Soporta todas las features** - MFA, reglas, etc.
✅ **Sin grant types deprecados** - No usa `password` grant

---

## 🚨 Troubleshooting

### Error: "Grant type 'password' not allowed for the client"
- ❌ No habilitaste el grant type "Password" en Auth0
- ✅ Ve a Applications → Settings → Advanced Settings → Grant Types → ✅ Password

### Error: "Invalid credentials"  
- Verifica que el email y password sean correctos
- Confirma que la Database Connection esté habilitada
- Revisa en Auth0 Dashboard → Authentication → Database → Users

### Error: "CORS"
- Agrega tus URLs en "Allowed Web Origins" y "Allowed Callback URLs"

### La página recarga pero no inicia sesión
- Es normal, el código recarga para que Auth0 SDK inicialice con los tokens
- Si después de recargar no estás logueado, revisa la consola del navegador

---

## ⚠️ Nota de Seguridad

El Password Grant está marcado como **legacy** por Auth0 porque:
- Las credenciales pasan por tu frontend
- No soporta MFA nativamente  
- Auth0 recomienda usar Universal Login

**Para producción**, considera migrar a:
- **Universal Login** (redirect a Auth0)
- **Auth0 Lock** (embedded pero más seguro)
- **Passwordless** (email/SMS codes)

Pero para desarrollo y si necesitas tu UI custom, Password Grant funciona.
