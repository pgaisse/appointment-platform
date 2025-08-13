const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const mime = require('mime-types');
const axios = require('axios');
const crypto = require('crypto');
/**
 * Inicializa el cliente de Google Drive.
 */
const serviceAccountPath = path.resolve(__dirname, '../../secret/service-account.json');

async function getDriveClient() {


    const auth = new google.auth.GoogleAuth({
        keyFile: serviceAccountPath,
        scopes: ['https://www.googleapis.com/auth/drive'],
    });

    return google.drive({ version: 'v3', auth });
}

/**
 * Sube una imagen a Google Drive.
 *
 * @param {string} localFilePath - Ruta del archivo local.
 * @param {string} driveFolderId - ID de la carpeta destino en Drive.
 * @param {boolean} removeAfterUpload - Si se debe borrar el archivo local.
 * @returns {Promise<object>} - Información del archivo subido.
 */
async function uploadImageToDrive(localFilePath, driveFolderId, removeAfterUpload = true) {
    const drive = await getDriveClient();

    const resolvedPath = path.resolve(localFilePath);
    const fileName = path.basename(resolvedPath);
    const mimeType = mime.lookup(resolvedPath) || 'application/octet-stream';

    const fileMetadata = {
        name: fileName,
        parents: [driveFolderId],
    };

    const media = {
        mimeType: mimeType.toString(),
        body: fs.createReadStream(resolvedPath),
    };

    try {
        const response = await drive.files.create({
            requestBody: fileMetadata,
            media,
            fields: 'id, name, webViewLink, webContentLink',
        });

        if (removeAfterUpload) {
            fs.unlinkSync(resolvedPath);
        }

        return response.data;
    } catch (error) {
        console.error('❌ Error al subir a Google Drive:', error.message);
        throw new Error('Falló la subida del archivo a Google Drive');
    }
}

async function createFolder(folderName, parentId = 'root') {
    const drive = await getDriveClient();

    // 1️⃣ Buscar si ya existe una carpeta con ese nombre en el parent especificado
    const query = [
        `'${parentId}' in parents`,
        `name='${folderName.replace(/'/g, "\\'")}'`,
        `mimeType='application/vnd.google-apps.folder'`,
        `trashed=false`,
    ].join(' and ');

    const res = await drive.files.list({
        q: query,
        fields: 'files(id, name, minType)',
    });

    const res2 = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType)',
    });
    

    if (res.data.files.length > 0) {
        const existing = res.data.files[0];
        console.log(`📁 Carpeta ya existe: ${existing.name} (ID: ${existing.id})`);
        return { id: existing.id, name: existing.name };
    }

    // 2️⃣ Crear carpeta si no existe
    const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
    };

    const createRes = await drive.files.create({
        resource: folderMetadata,
        fields: 'id, name',
    });

    const created = createRes.data;
    console.log(`🆕 Carpeta creada: ${created.name} (ID: ${created.id})`);
    return { id: created.id, name: created.name };
}
async function uploadImageFromUrl(imageUrl, folderName) {
    const auth = new google.auth.GoogleAuth({
        keyFile: serviceAccountPath,
        scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const drive = google.drive({ version: 'v3', auth });

    try {
        // 📁 Obtener o crear carpeta
        const { id: folderId } = await createFolder(folderName);

        // 🌐 Descargar imagen como stream
        const response = await axios.get(imageUrl, { responseType: 'stream' });
        const contentType = response.headers['content-type'];

        // 🧩 Determinar extensión segura
        let ext = path.extname(new URL(imageUrl).pathname);
        if (!ext || ext === '.') {
            ext = mime.extension(contentType) || 'jpg';
            ext = `.${ext}`;
        }

        const uniqueFilename = `image-${crypto.randomUUID()}${ext}`;

        // 📦 Metadatos del archivo
        const fileMetadata = {
            name: uniqueFilename,
            parents: [folderId],
        };

        const media = {
            mimeType: contentType,
            body: response.data,
        };

        const { data: file } = await drive.files.create({
            resource: fileMetadata,
            media,
            fields: 'id',
        });

        console.log(`✅ Imagen subida: ${uniqueFilename} (ID: ${file.id})`);
        return file.id;
    } catch (error) {
        console.error('❌ Error al subir imagen:', error.message || error);
        throw error;
    }
}


/**
 * Obtiene la metadata de un archivo en Google Drive.
 *
 * @param {string} fileId - ID del archivo en Drive.
 * @returns {Promise<object>} - Metadata del archivo.
 */
async function getFileMetadata(fileId) {
    try {
        const drive = await getDriveClient();

        const response = await drive.files.get({
            fileId,
            fields: 'id, name, mimeType, size, createdTime, modifiedTime',
        });

        return response.data;
    } catch (err) {
        console.error('❌ Error al obtener metadata:', err.message || err);
        throw new Error('No se pudo obtener metadata del archivo');
    }
}

/**
 * Devuelve un stream de un archivo en Drive.
 *
 * @param {string} fileId - ID del archivo.
 * @returns {Promise<ReadableStream>} - Stream del archivo.
 */
async function streamDriveFile(fileId) {
    try {
        const drive = await getDriveClient();

        const res = await drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'stream' }
        );

        return res.data; // Es un stream legible
    } catch (err) {
        console.error('❌ Error al obtener stream del archivo:', err.message || err);
        throw new Error('No se pudo obtener la imagen de Drive');
    }
}

/**
 * @param { string } fileId - ID del archivo en Google Drive
    * @returns { Promise < string >} - Enlace público directo a la imagen
        */
async function getPublicImageLink(fileId) {
    const drive = await getDriveClient();

    try {
        // Establece el permiso "reader" para "anyone"
        await drive.permissions.create({
            fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
            supportsAllDrives: true,
        });

        // Devuelve el enlace directo para mostrar en <img>
        return `https://drive.google.com/uc?export=view&id=${fileId}`;
    } catch (err) {
        console.error('❌ Error al generar link público de imagen:', err.message);
        throw new Error('No se pudo generar el enlace de la imagen.');
    }
}



module.exports = {
    getPublicImageLink,
    uploadImageFromUrl,
    uploadImageToDrive,
    createFolder,
    getFileMetadata,
    streamDriveFile // ✅ nuevo export
};
