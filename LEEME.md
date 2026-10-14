# Mochi

App para tener los apuntes de la facultad ordenados por **año → materia → carpetas**.
Publicada en <https://mochi-facu.vercel.app>.

**Publicar cambios:** todo lo que se sube a la rama `main` de GitHub se publica solo en Vercel.

Todo se guarda en tu Google Drive, en la carpeta **Facultad**. Si algún día la app deja de
andar, tus archivos siguen ahí, en carpetas normales.

## Configurar Google (una sola vez)

1. Entrá a <https://console.cloud.google.com> con tu cuenta de Gmail.
2. Arriba a la izquierda: **Seleccionar proyecto → Proyecto nuevo**. Nombre: `Facu`. Crear.
3. Buscá **Google Drive API** en la barra de búsqueda y tocá **Habilitar**.
4. Andá a **Google Auth Platform** (o "Pantalla de consentimiento de OAuth") → **Comenzar**:
   - Nombre de la app: `Facu`. Correo de asistencia: el tuyo.
   - Público: **Externo**.
   - Datos de contacto: tu correo. Aceptá y **Crear**.
5. En **Acceso a los datos** → **Agregar o quitar permisos**, buscá
   `.../auth/drive.file`, marcalo y guardá.
6. En **Público** tocá **Publicar app** (así la sesión no se cierra cada 7 días).
   No hace falta verificación porque el permiso `drive.file` es básico.
7. En **Clientes** → **Crear cliente**:
   - Tipo: **Aplicación web**. Nombre: `Facu`.
   - URIs de redireccionamiento autorizados: `http://localhost:5173/api/callback`
     (más adelante se agrega también la dirección de internet).
   - Crear. Copiá el **ID de cliente** y el **Secreto del cliente**.
8. Abrí el archivo `.env.local` de esta carpeta y pegalos:

   ```
   GOOGLE_CLIENT_ID=lo-que-copiaste.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-lo-que-copiaste
   SESSION_SECRET=(ya está completo, no lo toques)
   ```

## Clave de API (para compartir apuntes)

Para que un compañero pueda recibir una carpeta compartida, Mochi necesita una clave de API:

1. En <https://console.cloud.google.com/apis/credentials?project=facu-511514> tocá **Crear credenciales → Clave de API**.
2. En la clave nueva, **Restricciones de aplicación → Sitios web**, agregá `https://mochi-facu.vercel.app/*` y `http://localhost:5173/*`.
3. En **Restricciones de API**, elegí **Google Drive API**. Guardá.
4. Pegala en `.env.local` como `VITE_GOOGLE_API_KEY=...` (y en Vercel, en las variables del proyecto).

## Usarla en la compu

```
npm run dev
```

y abrí <http://localhost:5173>.

## Qué tiene la app

- **Inicio:** las materias que estás cursando (de cualquier año), finales pendientes, todas las materias por año y las aprobadas.
- **Materia:** carpetas libres con subcarpetas, cuadraditos con vista previa, búsqueda adentro de los PDF y Word,
  seleccionar varios archivos, mover arrastrando, fechas y notas de la materia.
- **Fechas:** parciales, finales y entregas, con link para agregarlos a Google Calendar.
- **Vos:** promedio, notas finales, tema claro u oscuro, invitar compañeros.
- **Sin conexión:** los archivos que guardes con "Guardar sin conexión" se abren sin internet.

## Cosas para saber

- Lo que borres va a la **papelera de Google Drive** y se puede recuperar durante 30 días.
- La app solo ve los archivos que subiste desde la app, no el resto de tu Drive.
- Las fechas y notas están en el archivo `Mochi - fechas.json` de la carpeta Facultad. No lo borres.
- Para probar la app sin cuenta: `npm run dev` y abrí <http://localhost:5173/?demo> (datos de prueba, solo en la compu).
