type RealtimePeer = {
  send: (data: unknown) => void;
};

const peers = new Map<string, Set<RealtimePeer>>();

function topic(code: string) {
  return `nexora-room:${code.toUpperCase()}`;
}

export function addRealtimePeer(code: string, peer: RealtimePeer) {
  const key = topic(code);
  let set = peers.get(key);

  if (!set) {
    set = new Set();
    peers.set(key, set);
  }

  set.add(peer);
}

export function removeRealtimePeer(code: string, peer: RealtimePeer) {
  const key = topic(code);
  const set = peers.get(key);

  if (!set) return;

  set.delete(peer);

  if (set.size === 0) {
    peers.delete(key);
  }
}

export function broadcastRealtime(code: string, data: unknown) {
  const set = peers.get(topic(code));

  if (!set) return;

  for (const peer of set) {
    try {
      peer.send(data);
    } catch {
      set.delete(peer);
    }
  }
}
