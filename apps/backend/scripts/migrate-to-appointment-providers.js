#!/usr/bin/env node
// Run: node apps/backend/scripts/migrate-to-appointment-providers.js

require('dotenv').config();
const mongoose = require('mongoose');
const { Appointment } = require('../src/models/Appointments');
const Provider = require('../src/models/Provider/Provider');
const AppointmentProvider = require('../src/models/AppointmentProvider');

async function main() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/productionDB');
    console.log('✅ Connected to MongoDB');

    let totalProcessed = 0;
    let totalCreated = 0;
    let totalErrors = 0;

    console.log('🔍 Finding appointments with providersAssignments...');
    
    // Use cursor for memory efficiency with large datasets
    const cursor = Appointment.find({
      $or: [
        { 'providersAssignments.0': { $exists: true } },
        { providersAssignments: { $ne: [] } }
      ]
    }).cursor();

    for (let appt = await cursor.next(); appt != null; appt = await cursor.next()) {
      totalProcessed++;
      
      if (totalProcessed % 100 === 0) {
        console.log(`📊 Processed ${totalProcessed} appointments...`);
      }

      const orgId = appt.org_id;
      const apptId = appt._id;
      const assigns = appt.providersAssignments || [];

      for (const assignment of assigns) {
        if (!assignment.provider || !assignment.startDate || !assignment.endDate) {
          console.warn(`⚠️  Skipping invalid assignment in appointment ${apptId}`);
          continue;
        }

        // Find matching slotId from selectedAppDates if not present
        let slotId = assignment.slotId;
        if (!slotId && assignment.startDate && assignment.endDate) {
          const matchingSlot = (appt.selectedAppDates || []).find(slot => {
            const slotStart = new Date(slot.startDate).getTime();
            const slotEnd = new Date(slot.endDate).getTime();
            const assignStart = new Date(assignment.startDate).getTime();
            const assignEnd = new Date(assignment.endDate).getTime();
            return slotStart === assignStart && slotEnd === assignEnd;
          });
          
          if (matchingSlot) {
            slotId = matchingSlot._id;
          } else {
            console.warn(`⚠️  No matching slot found for assignment in appointment ${apptId}`);
            continue;
          }
        }

        try {
          // Create or update AppointmentProvider document (idempotent)
          const filter = { 
            appointment: apptId, 
            provider: assignment.provider, 
            slotId: slotId 
          };
          
          const update = {
            $setOnInsert: {
              appointment: apptId,
              provider: assignment.provider,
              slotId: slotId,
              startDate: new Date(assignment.startDate),
              endDate: new Date(assignment.endDate),
              org_id: orgId,
              context: 'migrated_from_providersAssignments'
            },
          };

          const appointmentProvider = await AppointmentProvider.findOneAndUpdate(
            filter, 
            update, 
            { upsert: true, new: true }
          );

          // Add to provider's appointmentsCalendar if not already present
          await Provider.updateOne(
            { _id: assignment.provider },
            { $addToSet: { appointmentsCalendar: appointmentProvider._id } }
          );

          totalCreated++;
        } catch (error) {
          totalErrors++;
          if (error.code === 11000) {
            // Duplicate key - this is expected and OK in idempotent migration
            console.log(`📝 Duplicate assignment skipped for appointment ${apptId}, provider ${assignment.provider}`);
          } else {
            console.error(`❌ Error creating assignment for appointment ${apptId}:`, error.message);
          }
        }
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   Appointments processed: ${totalProcessed}`);
    console.log(`   AppointmentProvider docs created: ${totalCreated}`);
    console.log(`   Errors encountered: ${totalErrors}`);

    // Optional: Verify migration
    console.log('\n🔍 Verifying migration...');
    const appointmentProviderCount = await AppointmentProvider.countDocuments();
    const providersWithCalendar = await Provider.countDocuments({ 
      appointmentsCalendar: { $exists: true, $ne: [] } 
    });
    
    console.log(`   Total AppointmentProvider documents: ${appointmentProviderCount}`);
    console.log(`   Providers with appointmentsCalendar: ${providersWithCalendar}`);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Test the new AppointmentProvider endpoints');
    console.log('   2. Verify frontend is working with new structure');
    console.log('   3. Consider removing providersAssignments field from existing documents');
    console.log('      (Run: db.appointments.updateMany({}, {$unset: {providersAssignments: 1}}))');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⏹️  Migration interrupted by user');
  await mongoose.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⏹️  Migration terminated');
  await mongoose.disconnect();
  process.exit(0);
});

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = main;