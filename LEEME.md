# Facu

App para tener los apuntes de la facultad ordenados por **año → materia → sección**
(Teoría, Práctica, Parciales y finales, Resúmenes, Otros).

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

## Usarla en la compu

```
npm run dev
```

y abrí <http://localhost:5173>.

## Cosas para saber

- Lo que borres va a la **papelera de Google Drive** y se puede recuperar durante 30 días.
- La app solo ve los archivos que subiste desde la app, no el resto de tu Drive.
- El buscador encuentra palabras dentro de los PDF y los Word.
