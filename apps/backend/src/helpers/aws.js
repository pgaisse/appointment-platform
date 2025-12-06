const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl: getCloudFrontSignedUrl } = require('@aws-sdk/cloudfront-signer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const TwilioService = require('../services/TwilioService');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// 🧾 Leer clave privada


// 📦 Cliente S3
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// 🔼 Subir imagen a S3 con SDK v3
async function uploadImage(buffer, key, mimeType) {
    const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
    });

    await s3.send(command);
    return key;
}

function extFromMime(mime) {
    if (!mime) return '';
    const m = mime.toLowerCase();
    if (m.includes('image/jpeg') || m.includes('image/jpg')) return '.jpg';
    if (m.includes('image/png')) return '.png';
    if (m.includes('image/webp')) return '.webp';
    if (m.includes('image/gif')) return '.gif';
    if (m.includes('image/svg+xml')) return '.svg';
    return ''; // default sin extensión
}

async function uploadFileFromBuffer(
    buffer,
    folderName,
    options = {}
) {
    if (!buffer || !Buffer.isBuffer(buffer)) {
        throw new Error('uploadFileFromBuffer: buffer inválido o ausente');
    }

    const {
        contentType,    // ej: 'image/jpeg'
        originalName,   // ej: 'foto.png'
        fileName,       // si quieres forzar un nombre final
        prefix,         // ej: 'image-' (se antepone si no hay fileName)
    } = options;

    const mimeType = contentType || 'application/octet-stream';
    const extFromName = originalName ? path.extname(originalName) : '';
    const ext = extFromName || extFromMime(mimeType) || '';
    const safeFolder = (folderName || 'uploads').replace(/\/+$/, '');

    const finalFileName =
        fileName ||
        `${prefix || 'image-'}${Date.now()}${ext}`;

    const key = safeFolder ? `${safeFolder}/${finalFileName}` : finalFileName;

    await uploadImage(buffer, key, mimeType);
    return key; // devuelves la key que luego puedes firmar con getSignedUrl
}
// 🌐 Subir imagen desde URL
async function uploadImageFromUrl(imageUrl, folderName, options = {}) {
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });

  const buffer = Buffer.from(response.data, 'binary');
  const mimeType = options.contentType || response.headers['content-type'];
  const extFromName = options.originalName ? path.extname(options.originalName) : '';
  const extension = extFromName || path.extname(new URL(imageUrl).pathname) || '.jpg';

  const safeFolder = folderName.replace(/\/+$/, '');
  const finalFileName =
    options.fileName || `${options.prefix || 'image-'}${Date.now()}${extension.replace(/\?.*$/, '')}`;

  const key = safeFolder ? `${safeFolder}/${finalFileName}` : finalFileName;

  await uploadImage(buffer, key, mimeType);
  return key;
}




// 🔐 Firmar URL con CloudFront
async function getSignedUrl(key) {
    const url = `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`;
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hora
    const privateKey = fs.readFileSync(process.env.PRIVATE_KEY_PATH, "utf8");

    const signedUrl = await getCloudFrontSignedUrl({
        url,
        keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID,
        dateLessThan: expires,
        privateKey: privateKey
    });

    return signedUrl;
}

async function getDirectMediaUrl(chatServiceSid, mediaSid, org_id) {
  const url = `https://mcs.us1.twilio.com/v1/Services/${chatServiceSid}/Media/${mediaSid}`;
  console.log(url);
  
  // Obtener credenciales de Twilio desde la base de datos
  let username, password;
  try {
    if (org_id) {
      const { settings } = await TwilioService.getClient(org_id);
      username = settings.accountSid;
      password = settings.authToken;
    }
  } catch (err) {
    console.warn('⚠️ Error getting Twilio credentials, falling back to env:', err.message);
  }
  
  // Fallback a variables de entorno si no se pudo obtener de la BD
  username = username || process.env.TWILIO_ACCOUNT_SID;
  password = password || process.env.TWILIO_AUTH_TOKEN;
  
  const response = await axios.get(url, {
    auth: { username, password }
  });

  return response.data.links.content_direct_temporary;
}

module.exports = {
    getDirectMediaUrl,
    uploadFileFromBuffer,
    uploadImageFromUrl,
    getSignedUrl,
};
