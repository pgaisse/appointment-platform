// src/utils/orgId.js
function parseJwtNoVerify(bearerOrToken) {
  const token = bearerOrToken?.startsWith?.("Bearer ") ? bearerOrToken.slice(7) : bearerOrToken;
  if (!token || token.split(".").length !== 3) throw new Error("Invalid JWT");
  const payloadB64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const pad = payloadB64.length % 4 === 2 ? "==" : payloadB64.length % 4 === 3 ? "=" : "";
  const json = Buffer.from(payloadB64 + pad, "base64").toString("utf8");
  return JSON.parse(json);
}

/** Intenta en este orden:
 * 1) req.user.org_id (o req.user.organization) que ya te deja attachUserInfo
 * 2) decodifica el Authorization y toma org_id / organization / claim namespaced
 */
function getOrgIdFromRequest(req) {
  if (req?.user?.org_id) return req.user.org_id;
  if (req?.user?.organization) return req.user.organization;

  const authHeader = req.headers?.authorization;
  if (!authHeader) return null;

  try {
    const p = parseJwtNoVerify(authHeader);
    return p.org_id || p.organization || p["https://letsmarter.com/organization"] || null;
  } catch {
    return null;
  }
}

module.exports = { getOrgIdFromRequest, parseJwtNoVerify };
