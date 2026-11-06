import type { Message, Room } from "./server";

const rooms = new Map<string, Room>();
const messages = new Map<string, Message[]>();

export function getMemoryRoom(code: string): Room | null {
  return rooms.get(code) ?? null;
}

export function saveMemoryRoom(room: Room): Room {
  rooms.set(room.code, room);
  return room;
}

export function getMemoryMessages(code: string): Message[] {
  return messages.get(code) ?? [];
}

export function addMemoryMessage(code: string, message: Message): Message {
  const list = messages.get(code) ?? [];
  list.push(message);

  if (list.length > 500) {
    list.splice(0, list.length - 500);
  }

  messages.set(code, list);
  return message;
}
