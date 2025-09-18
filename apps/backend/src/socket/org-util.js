// apps/backend/src/socket/org-util.js
function normalizeOrgId(orgId) {
  return (orgId || '').toString().trim().toLowerCase();
}
function orgRoom(orgId) {
  return `org:${normalizeOrgId(orgId)}`;
}
module.exports = { normalizeOrgId, orgRoom };
