function normalizeTwilioWebhookPayload(src = {}, { parseAttributes = false } = {}) {
  const pick = (...keys) => {
    for (const k of keys) {
      if (src[k] !== undefined && src[k] !== null && src[k] !== '') return src[k];
    }
    return undefined;
  };

  const MessagingServiceSid = pick('MessagingServiceSid', 'messagingServiceSid', 'messagingservicesid', 'Messaging_Service_Sid');
  const EventType = pick('EventType', 'eventType', 'event_type', 'eventtype');
  let Attributes = pick('Attributes', 'attributes', 'attrs', 'meta');
  let Media = pick('Media', 'media', 'MediaJson', 'mediaJson', 'media_json');
  const DateCreated = pick('DateCreated', 'dateCreated', 'date_created', 'datecreated');
  const Index = pick('Index', 'index');
  const ChatServiceSid = pick('ChatServiceSid', 'chatServiceSid', 'chatservicesid', 'ServiceSid', 'serviceSid', 'servicesid');
  const MessageSid = pick('MessageSid', 'messageSid', 'messagesid', 'Sid', 'sid', 'message_sid');
  const AccountSid = pick('AccountSid', 'accountSid', 'accountsid');
  const Source = pick('Source', 'source', 'channel', 'Channel');
  const RetryCount = pick('RetryCount', 'retryCount', 'retry_count', 'retry');
  const Author = pick('Author', 'author', 'From', 'from');
  const ParticipantSid = pick('ParticipantSid', 'participantSid', 'participantsid');
  const ConversationSid = pick('ConversationSid', 'conversationSid', 'conversationsid', 'conversation_sid');

  // Media: garantizar array
  if (typeof Media === 'string') {
    try { Media = JSON.parse(Media); } catch { Media = []; }
  } else if (Array.isArray(Media)) {
    // ok
  } else if (Media && typeof Media === 'object') {
    const maybeArray = Object.values(Media);
    Media = Array.isArray(maybeArray) ? maybeArray : [Media];
  } else {
    Media = [];
  }

  Media = Media.map((m) => ({
    Sid: m.Sid || m.sid || m.SID || null,
    Filename: m.Filename || m.filename || m.fileName || null,
    ContentType: m.ContentType || m.content_type || m.contentType || null,
    Size: m.Size || m.size || null,
    Category: m.Category || m.category || 'media',
  }));

  // Attributes: opcionalmente parsear JSON
  if (parseAttributes && typeof Attributes === 'string') {
    try { Attributes = JSON.parse(Attributes); } catch { /* deja string */ }
  }

  return {
    MessagingServiceSid: MessagingServiceSid ?? '',
    EventType: EventType ?? '',
    Attributes: Attributes ?? '{}',
    Media,
    DateCreated: DateCreated ?? '',
    Index: Index ?? '',
    ChatServiceSid: ChatServiceSid ?? '',
    MessageSid: MessageSid ?? '',
    AccountSid: AccountSid ?? '',
    Source: Source ?? '',
    RetryCount: RetryCount ?? '',
    Author: Author ?? '',
    ParticipantSid: ParticipantSid ?? '',
    ConversationSid: ConversationSid ?? '',
  };
}

function normalizeTwilioFromReq() {
 const result= normalizeTwilioWebhookPayload(
  {
  body: null,
  index: 110,
  author: 'org_bzrwcs0qiw57b8sx',
  date_updated: '2025-08-10T01:44:32Z',
  media: [
    {
      category: 'media',
      filename: null,
      size: 97876,
      content_type: 'image/png',
      sid: 'MEd95b5c4439219bd2acffaedeff51bc12'
    }
  ],
  participant_sid: null,
  conversation_sid: 'CH97f4509328824526bf3f6e3589f0e5d4',
  account_sid: process.env.TWILIO_ACCOUNT_SID,
  delivery: null,
  url: 'https://conversations.twilio.com/v1/Conversations/CH97f4509328824526bf3f6e3589f0e5d4/Messages/IM4dd8f1116ab8434cbb03b3a62cb7e8ba',
  date_created: '2025-08-10T01:44:32Z',
  content_sid: null,
  sid: 'IM4dd8f1116ab8434cbb03b3a62cb7e8ba',
  attributes: '{}',
  links: {
    delivery_receipts: 'https://conversations.twilio.com/v1/Conversations/CH97f4509328824526bf3f6e3589f0e5d4/Messages/IM4dd8f1116ab8434cbb03b3a62cb7e8ba/Receipts',
    channel_metadata: 'https://conversations.twilio.com/v1/Conversations/CH97f4509328824526bf3f6e3589f0e5d4/Messages/IM4dd8f1116ab8434cbb03b3a62cb7e8ba/ChannelMetadata'
  }
},true)
console.log("normalizeTwilioFromReq", result);

}

normalizeTwilioFromReq()

