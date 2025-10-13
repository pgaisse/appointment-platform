const mongoose = require('mongoose');
module.exports = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);