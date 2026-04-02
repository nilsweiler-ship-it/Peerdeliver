import { prisma } from '../config';

export async function getMessages(deliveryRequestId: string) {
  return prisma.message.findMany({
    where: { deliveryRequestId },
    orderBy: { createdAt: 'asc' },
    include: { sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
  });
}

export async function createMessage(deliveryRequestId: string, senderId: string, content: string) {
  return prisma.message.create({
    data: { deliveryRequestId, senderId, content },
    include: { sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
  });
}

export async function markMessagesAsRead(deliveryRequestId: string, userId: string) {
  await prisma.message.updateMany({
    where: {
      deliveryRequestId,
      senderId: { not: userId },
      readAt: null,
    },
    data: { readAt: new Date() },
  });
}

export async function getConversations(userId: string) {
  // Find all delivery requests where user is sender or driver and has messages
  const deliveries = await prisma.deliveryRequest.findMany({
    where: {
      OR: [
        { senderId: userId },
        { driverId: userId },
      ],
      messages: { some: {} },
    },
    include: {
      sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      driver: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Transform into Conversation shape
  const conversations = await Promise.all(
    deliveries.map(async (delivery) => {
      const unreadCount = await prisma.message.count({
        where: {
          deliveryRequestId: delivery.id,
          senderId: { not: userId },
          readAt: null,
        },
      });

      const participants = [delivery.sender, delivery.driver].filter(Boolean);
      const lastMessage = delivery.messages[0] || undefined;

      return {
        id: delivery.id,
        deliveryRequestId: delivery.id,
        participants,
        lastMessage,
        unreadCount,
        createdAt: delivery.createdAt.toISOString(),
        updatedAt: delivery.updatedAt.toISOString(),
      };
    })
  );

  return conversations;
}
