const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.resolve(__dirname, '../../secret/service-account.json');

// 🔐 Autenticación con cuenta de servicio
async function getDriveClient() {
    const auth = new google.auth.GoogleAuth({
        keyFile: serviceAccountPath,
        scopes: ['https://www.googleapis.com/auth/drive'],
    });

    return google.drive({ version: 'v3', auth });
}

// 📂 Lista archivos dentro de una carpeta
async function listFilesInFolder(drive, folderId = 'root') {
    const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType)',
    });

    return res.data.files || [];
}

// 🌳 Función recursiva para mostrar el árbol
async function printDriveTree(drive, folderId = 'root', indent = '') {
    const files = await listFilesInFolder(drive, folderId);

    for (const file of files) {
        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
        const icon = isFolder ? '📁' : '📄';
        console.log(`${indent}${icon} ${file.name}`);

        if (isFolder) {
            await printDriveTree(drive, file.id, indent + '  ');
        }
    }
}

// ▶️ Ejecutar
(async () => {
    try {
        const drive = await getDriveClient();
        console.log('📦 Árbol de archivos de Google Drive:\n');
        await printDriveTree(drive);
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
})();
