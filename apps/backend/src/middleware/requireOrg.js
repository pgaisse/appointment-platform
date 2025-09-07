module.exports = function requireOrg(matchFrom) {
  // matchFrom: "header" | "param" | "query"
  return (req, res, next) => {
    const tokenOrg = req.user?.org_id || req.user?.organization || req.user?.orgs?.[0] || null;
    let requestedOrg = null;
    if (matchFrom === "header") requestedOrg = req.get("X-Org-Id");
    if (matchFrom === "param") requestedOrg = req.params.orgId;
    if (matchFrom === "query") requestedOrg = req.query.orgId;

    if (requestedOrg && tokenOrg && requestedOrg !== tokenOrg) {
      return res.status(403).json({ error: "org_mismatch" });
    }
    // Opcional: si tu endpoint requiere org sí o sí:
    // if (!tokenOrg) return res.status(400).json({ error: "missing_org" });

    next();
  };
};
