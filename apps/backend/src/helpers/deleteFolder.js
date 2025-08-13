const path = require('path');
const { google } = require('googleapis');

const serviceAccountPath = path.resolve(__dirname, '../../secret/service-account.json');
const FOLDER_NAME_TO_DELETE = 'org_BzRwcS0qiW57b8SX'; // 👈 Nombre exacto de la carpeta

async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: serviceAccountPath,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
}

async function findAllFolderIdsByName(folderName) {
  const drive = await getDriveClient();

  const query = [
    `name='${folderName.replace(/'/g, "\\'")}'`,
    `mimeType='application/vnd.google-apps.folder'`,
    `trashed=false`,
  ].join(' and ');

  let folders = [];
  let pageToken = null;

  do {
    const res = await drive.files.list({
      q: query,
      fields: 'nextPageToken, files(id, name)',
      spaces: 'drive',
      pageToken,
    });

    folders = folders.concat(res.data.files);
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return folders;
}

async function deleteAllFoldersByName(folderName) {
  const drive = await getDriveClient();
  const folders = await findAllFolderIdsByName(folderName);

  if (folders.length === 0) {
    console.log(`❌ No se encontraron carpetas con nombre "${folderName}"`);
    return;
  }

  for (const folder of folders) {
    try {
      await drive.files.delete({ fileId: folder.id });
      console.log(`✅ Carpeta eliminada: "${folder.name}" (ID: ${folder.id})`);
    } catch (err) {
      console.error(`❌ Error al eliminar carpeta ID ${folder.id}:`, err.message || err);
    }
  }
}

deleteAllFoldersByName(FOLDER_NAME_TO_DELETE);
