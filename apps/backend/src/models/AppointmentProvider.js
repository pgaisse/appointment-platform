const mongoose = require('mongoose');

const AppointmentProviderSchema = new mongoose.Schema({
  org_id: { type: String, index: true },

  // referencia al Appointment principal
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },

  // referencia al provider
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },

  // id del slot dentro de appointment.selectedAppDates (puede ser ObjectId o string)
  slotId: { type: mongoose.Schema.Types.Mixed, required: false, index: true },

  // snapshot de la ventana para lectura rápida
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },

  // metadata
  context: { type: String }, // optional
}, { timestamps: true });

// Índice único para evitar duplicados exactos (mismo appointment, provider, slot Y tiempo exacto)
// Removemos la restricción unique que causaba conflictos - ahora permitimos múltiples providers por slot
AppointmentProviderSchema.index({ appointment: 1, provider: 1, slotId: 1, startDate: 1, endDate: 1 }, { sparse: true });

// Índice para casos sin slotId (sin unique para permitir flexibilidad)
AppointmentProviderSchema.index({ appointment: 1, provider: 1, startDate: 1, endDate: 1 });

// Índices adicionales para consultas rápidas
AppointmentProviderSchema.index({ provider: 1, startDate: 1 });
AppointmentProviderSchema.index({ appointment: 1, startDate: 1 });

module.exports = mongoose.model('AppointmentProvider', AppointmentProviderSchema);