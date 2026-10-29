import { api, type Api } from './api';

/**
 * Event chat. Screens never call this directly: they use the hooks in `features/chat`, which call this.
 * v1 runs on Supabase tables and Realtime (see docs/DATA_MODEL.md, "Chat"); Stream is not used.
 */
export type ChatService = Pick<
  Api,
  | 'getMyChats'
  | 'getChatMessages'
  | 'sendMessage'
  | 'deleteMessage'
  | 'markChatRead'
  | 'subscribeToEventChat'
  | 'reportMessage'
  | 'blockUser'
>;

export const chatService: ChatService = {
  getMyChats: () => api.getMyChats(),
  getChatMessages: (eventId, beforeId) => api.getChatMessages(eventId, beforeId),
  sendMessage: (eventId, body) => api.sendMessage(eventId, body),
  deleteMessage: (messageId) => api.deleteMessage(messageId),
  markChatRead: (eventId) => api.markChatRead(eventId),
  subscribeToEventChat: (eventId, handlers) => api.subscribeToEventChat(eventId, handlers),
  reportMessage: (messageId, reason) => api.reportMessage(messageId, reason),
  blockUser: (userId) => api.blockUser(userId),
};
