// scripts/migrate-providers-to-first-slot.js
// Migra treatment, priority, providers y duration del root al primer slot de selectedAppDates

const mongoose = require('mongoose');
const path = require('path');

// Conectar directamente al puerto expuesto de Docker
const MONGO_URI = 'mongodb://pgaisse:Patoch-2202@localhost:27019/productionDB?authSource=admin&replicaSet=rs0&directConnection=true';

async function migrateProvidersToFirstSlot() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const appointmentsCollection = db.collection('appointments');
    
    // Encuentra todos los appointments que tienen selectedAppDates con al menos un slot
    const cursor = appointmentsCollection.find({
      selectedAppDates: { $exists: true, $ne: [], $not: { $size: 0 } }
    });
    
    let total = 0;
    let modified = 0;
    let skipped = 0;
    let errors = 0;
    
    console.log('\n🔄 Starting migration...\n');
    
    while (await cursor.hasNext()) {
      const appt = await cursor.next();
      total++;
      
      try {
        const firstSlot = appt.selectedAppDates[0];
        const updateFields = {};
        let needsUpdate = false;
        
        // Copiar treatment si existe en root y no existe en slot
        if (appt.treatment && !firstSlot.treatment) {
          updateFields['selectedAppDates.0.treatment'] = appt.treatment;
          needsUpdate = true;
        }
        
        // Copiar priority si existe en root y no existe en slot
        if (appt.priority && !firstSlot.priority) {
          updateFields['selectedAppDates.0.priority'] = appt.priority;
          needsUpdate = true;
        }
        
        // Copiar providers si existe en root y no existe o está vacío en slot
        if (appt.providers && appt.providers.length > 0 && (!firstSlot.providers || firstSlot.providers.length === 0)) {
          updateFields['selectedAppDates.0.providers'] = appt.providers;
          needsUpdate = true;
        }
        
        // Agregar duration si no existe (default 60)
        if (!firstSlot.duration) {
          updateFields['selectedAppDates.0.duration'] = 60;
          needsUpdate = true;
        }
        
        // Agregar providerNotes si no existe
        if (!firstSlot.providerNotes) {
          updateFields['selectedAppDates.0.providerNotes'] = '';
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          await appointmentsCollection.updateOne(
            { _id: appt._id },
            { $set: updateFields }
          );
          modified++;
          
          if (modified % 100 === 0) {
            console.log(`✓ Processed ${modified} appointments...`);
          }
        } else {
          skipped++;
        }
        
      } catch (err) {
        errors++;
        console.error(`❌ Error processing appointment ${appt._id}:`, err.message);
      }
    }
    
    console.log('\n📊 Migration Complete!');
    console.log('─────────────────────────');
    console.log(`Total appointments: ${total}`);
    console.log(`Modified: ${modified}`);
    console.log(`Skipped (already migrated): ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log('─────────────────────────\n');
    
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  migrateProvidersToFirstSlot();
}

module.exports = { migrateProvidersToFirstSlot };
