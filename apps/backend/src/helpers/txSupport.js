let _supportsTransactions = null;
async function mongoSupportsTransactions() {
  if (_supportsTransactions !== null) return _supportsTransactions;
  try {
    const mongoose = require('mongoose');
    const admin = mongoose.connection.db.admin();
    const info = await admin.command({ hello: 1 }).catch(() => admin.command({ isMaster: 1 }));
    _supportsTransactions = Boolean(info.setName);
  } catch {
    _supportsTransactions = false;
  }
  return _supportsTransactions;
}
module.exports = { mongoSupportsTransactions };
