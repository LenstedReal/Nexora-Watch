import { WebSocket } from "ws";

type RealtimePeer = WebSocket;

const peersByRoom = new Map<string, Set<RealtimePeer>>();

export function addRealtimePeer(code: string, peer: RealtimePeer): void {
  const roomPeers = peersByRoom.get(code) ?? new Set<RealtimePeer>();
  roomPeers.add(peer);
  peersByRoom.set(code, roomPeers);
}

export function removeRealtimePeer(code: string, peer: RealtimePeer): void {
  const roomPeers = peersByRoom.get(code);
  if (!roomPeers) return;

  roomPeers.delete(peer);

  if (roomPeers.size === 0) {
    peersByRoom.delete(code);
  }
}

export function broadcastRealtime(code: string, data: unknown): void {
  const roomPeers = peersByRoom.get(code);
  if (!roomPeers) return;

  const payload = JSON.stringify(data);

  for (const peer of roomPeers) {
    if (peer.readyState !== WebSocket.OPEN) {
      if (peer.readyState === WebSocket.CLOSED) {
        roomPeers.delete(peer);
      }
      continue;
    }

    try {
      peer.send(payload);
    } catch {
      roomPeers.delete(peer);
    }
  }

  if (roomPeers.size === 0) {
    peersByRoom.delete(code);
  }
}
