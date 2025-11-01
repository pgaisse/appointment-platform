export type OpenMessagesPayload = {
  conversationId?: string;
  phone?: string; // raw, any formatting; consumer will normalize
};

export const MESSAGES_OPEN_EVENT = "messages:open" as const;

export function openMessagesChat(payload: OpenMessagesPayload) {
  window.dispatchEvent(new CustomEvent(MESSAGES_OPEN_EVENT, { detail: payload }));
}
