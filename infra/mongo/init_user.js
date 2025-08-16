db = db.getSiblingDB("productionDB");
db.createUser({
  user: "pgaisse",
  pwd: "Patoch-2202",
  roles: [{ role: "readWrite", db: "productionDB" }]
});
