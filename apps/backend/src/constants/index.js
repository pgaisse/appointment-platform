// constants/contactStatus.js

/**
 * Lista de estados posibles de contacto.
 */
const ContactStatus = {
  Pending: 'Pending',
  Rejected: 'Rejected',
  Confirmed: "Confirmed",
  Contacted: 'Contacted',
  Failed: 'Failed',
  NoContacted: 'NoContacted',
  NotStarted: 'NoStarted',
  Declined: 'Declined'
};

const MsgType = {
  Message: 'Message',
  Confirmation: 'Confirmation'
}

/**
 * @typedef {keyof typeof ContactStatus, keyof typeof MsgType} ContactStatusType
 */

/**
 * @typedef {keyof typeof MsgType} MsgTypeType
 */

module.exports = { ContactStatus, MsgType, DEFAULT_RANK_STEP: 10 };
