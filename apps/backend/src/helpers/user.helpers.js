// apps/backend/src/helpers/user.helpers.js
const { getSignedUrl } = require('./aws');

/**
 * Convert S3 keys to signed URLs for user pictures
 * @param {Object|Array} users - Single user or array of users
 * @returns {Promise<Object|Array>} User(s) with signed URLs
 */
async function attachSignedUrls(users) {
  if (!users) return users;
  
  const userArray = Array.isArray(users) ? users : [users];
  
  const usersWithUrls = await Promise.all(
    userArray.map(async (user) => {
      if (user && user.picture && typeof user.picture === 'string' && !user.picture.startsWith('http')) {
        // It's an S3 key, generate signed URL
        try {
          user.picture = await getSignedUrl(user.picture);
        } catch (e) {
          console.error('[attachSignedUrls] Error generating signed URL:', e?.message);
          // Keep original key if signing fails
        }
      }
      return user;
    })
  );
  
  return Array.isArray(users) ? usersWithUrls : usersWithUrls[0];
}

/**
 * Process populated user fields in documents (for Mongoose populate results)
 * Works with single docs, arrays of docs, and nested user fields
 * @param {Object|Array} docs - Documents with populated user fields
 * @returns {Promise<Object|Array>} Docs with signed URLs for user pictures
 */
async function attachSignedUrlsToPopulated(docs) {
  if (!docs) return docs;
  
  const docArray = Array.isArray(docs) ? docs : [docs];
  
  const processedDocs = await Promise.all(
    docArray.map(async (doc) => {
      if (!doc) return doc;
      
      // Process direct user field
      if (doc.user && typeof doc.user === 'object' && doc.user.picture) {
        doc.user = await attachSignedUrls(doc.user);
      }
      
      // Process users array field
      if (Array.isArray(doc.users)) {
        doc.users = await attachSignedUrls(doc.users);
      }
      
      return doc;
    })
  );
  
  return Array.isArray(docs) ? processedDocs : processedDocs[0];
}

module.exports = {
  attachSignedUrls,
  attachSignedUrlsToPopulated,
};
