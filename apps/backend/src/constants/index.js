// constants/contactStatus.js

/**
 * Lista de estados posibles de contacto.
 */
const ContactStatus = {
  Pending: 'Pending',
  Rejected:'Rejected',
  Confirmed: "Confirmed",
  Contacted: 'Contacted',
  Failed: 'Failed',
  NoContacted: 'No Contacted',
  NotStarted:'Not started'
};

/**
 * @typedef {keyof typeof ContactStatus} ContactStatusType
 */

module.exports = { ContactStatus };
