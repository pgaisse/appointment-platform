const express = require('express');
const AppointmentProvider = require('../models/AppointmentProvider');
const Provider = require('../models/Provider/Provider');
const Appointment = require('../models/Appointments').Appointment;
const router = express.Router();

// GET /api/appointment-providers?appointment=:id
router.get('/', async (req, res) => {
  try {
    const { appointment, provider } = req.query;
    
    let filter = {};
    if (req.user?.org_id) filter.org_id = req.user.org_id;
    if (appointment) filter.appointment = appointment;
    if (provider) filter.provider = provider;
    
    let assignments = await AppointmentProvider
      .find(filter)
      .populate('provider', 'firstName lastName color _id')
      .populate('appointment', 'nameInput lastNameInput selectedAppDates')
      .sort({ startDate: 1 });

    // Filter out any assignments that reference a missing/deleted appointment
    assignments = assignments.filter(a => a.appointment);

    res.json(assignments);
  } catch (error) {
    console.error('Error fetching appointment providers:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/appointment-providers/:id
router.get('/:id', async (req, res) => {
  try {
    const assignment = await AppointmentProvider
      .findById(req.params.id)
      .populate('provider', 'firstName lastName color _id')
      .populate('appointment', 'nameInput lastNameInput selectedAppDates');

    // If the referenced appointment was deleted/doesn't exist, treat as not found
    if (!assignment || !assignment.appointment) {
      return res.status(404).json({ error: 'Assignment not found or appointment missing' });
    }

    res.json(assignment);
  } catch (error) {
    console.error('Error fetching appointment provider:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/appointment-providers
router.post('/', async (req, res) => {
  try {
    const { appointment, provider, slotId, startDate, endDate, context } = req.body;
    
    if (!appointment || !provider || !startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Missing required fields: appointment, provider, startDate, endDate' 
      });
    }
    
    // Verify appointment and provider exist and belong to same org
    const [appt, prov] = await Promise.all([
      Appointment.findById(appointment).select('org_id'),
      Provider.findById(provider).select('org_id')
    ]);
    
    if (!appt || !prov) {
      return res.status(404).json({ error: 'Appointment or Provider not found' });
    }
    
    if (appt.org_id !== prov.org_id) {
      return res.status(400).json({ error: 'Appointment and Provider must belong to same organization' });
    }
    
    const assignmentData = {
      appointment,
      provider,
      slotId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      org_id: appt.org_id,
      context
    };
    
    // Create assignment (unique index will prevent duplicates)
    const assignment = await AppointmentProvider.create(assignmentData);
    
    // Add to provider's calendar
    await Provider.updateOne(
      { _id: provider },
      { $addToSet: { appointmentsCalendar: assignment._id } }
    );
    
    // Update appointment's providers array for backward compatibility
    // Check if provider is already in the array before attempting to add
    const existingAppointment = await Appointment.findById(appointment).select('providers');
    if (existingAppointment && !existingAppointment.providers.includes(provider)) {
      try {
        await Appointment.updateOne(
          { _id: appointment },
          { $addToSet: { providers: provider } }
        );
      } catch (error) {
        // If there's still a conflict, just log it but don't fail the request
        console.log('Non-critical error updating appointment providers array:', error.message);
      }
    }
    
    const populatedAssignment = await AppointmentProvider
      .findById(assignment._id)
      .populate('provider', 'firstName lastName color _id')
      .populate('appointment', 'nameInput lastNameInput');
    
    res.status(201).json(populatedAssignment);
  } catch (error) {
    console.error('Error creating appointment provider:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({ 
        error: 'Assignment already exists for this appointment, provider, and slot' 
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/appointment-providers/:id
router.put('/:id', async (req, res) => {
  try {
    const { provider, startDate, endDate, context } = req.body;
    
    const currentAssignment = await AppointmentProvider.findById(req.params.id);
    if (!currentAssignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    
    const updateData = {};
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);
    if (context !== undefined) updateData.context = context;
    
    // If changing provider
    if (provider && String(provider) !== String(currentAssignment.provider)) {
      // Verify new provider exists and belongs to same org
      const [newProv, appt] = await Promise.all([
        Provider.findById(provider).select('org_id'),
        Appointment.findById(currentAssignment.appointment).select('org_id providers')
      ]);
      
      if (!newProv || !appt) {
        return res.status(404).json({ error: 'Provider or Appointment not found' });
      }
      
      if (newProv.org_id !== appt.org_id) {
        return res.status(400).json({ error: 'Provider must belong to same organization' });
      }
      
      // Remove from old provider's calendar
      await Provider.updateOne(
        { _id: currentAssignment.provider },
        { $pull: { appointmentsCalendar: currentAssignment._id } }
      );
      
      // Add to new provider's calendar
      await Provider.updateOne(
        { _id: provider },
        { $addToSet: { appointmentsCalendar: currentAssignment._id } }
      );
      
      updateData.provider = provider;
      
      // Update appointment's providers array
      try {
        await Appointment.updateOne(
          { _id: currentAssignment.appointment },
          { 
            $pull: { providers: currentAssignment.provider },
            $addToSet: { providers: provider }
          }
        );
      } catch (error) {
        // If there's a conflict, just log it but don't fail the request
        console.log('Non-critical error updating appointment providers array during update:', error.message);
      }
    }
    
    const updatedAssignment = await AppointmentProvider.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('provider', 'firstName lastName color _id');
    
    res.json(updatedAssignment);
  } catch (error) {
    console.error('Error updating appointment provider:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/appointment-providers/:id
router.delete('/:id', async (req, res) => {
  try {
    const assignment = await AppointmentProvider.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    
    // Remove from provider's calendar
    await Provider.updateOne(
      { _id: assignment.provider },
      { $pull: { appointmentsCalendar: assignment._id } }
    );
    
    // Check if this was the last assignment for this provider in this appointment
    const remainingAssignments = await AppointmentProvider.countDocuments({
      appointment: assignment.appointment,
      provider: assignment.provider,
      _id: { $ne: assignment._id }
    });
    
    // If no more assignments, remove provider from appointment's providers array
    if (remainingAssignments === 0) {
      try {
        await Appointment.updateOne(
          { _id: assignment.appointment },
          { $pull: { providers: assignment.provider } }
        );
      } catch (error) {
        // If there's a conflict, just log it but don't fail the request
        console.log('Non-critical error updating appointment providers array during deletion:', error.message);
      }
    }
    
    await AppointmentProvider.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Error deleting appointment provider:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;