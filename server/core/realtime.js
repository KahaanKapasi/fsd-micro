// Holds the Socket.io instance so HTTP routes and services can broadcast without circular imports.
// Room names are conversationId strings (team contract); each user also has a private `user:<id>` room.
let io = null;

export const setIO = (instance) => {
  io = instance;
};
export const getIO = () => io;

export const emitToConversation = (conversationId, event, payload) => {
  io?.to(String(conversationId)).emit(event, payload);
};

export const emitToUser = (userId, event, payload) => {
  io?.to(`user:${userId}`).emit(event, payload);
};

// Make every live socket of these users join a (newly created) conversation room.
export const joinUsersToRoom = (userIds, conversationId) => {
  for (const id of userIds) io?.in(`user:${id}`).socketsJoin(String(conversationId));
};
