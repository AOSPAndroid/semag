import { once } from 'node:events';
import WebSocket from 'ws';

export class Peer {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.messages = [];
    this.waiters = new Set();
    this.socket.on('message', data => {
      const message = JSON.parse(data.toString());
      this.messages.push(message);
      for (const waiter of [...this.waiters]) {
        if (waiter.predicate(message)) waiter.resolve(message);
      }
    });
  }

  async connect() {
    await once(this.socket, 'open');
    return this.waitFor(message => message.type === 'welcome');
  }

  send(message) {
    this.socket.send(JSON.stringify(message));
  }

  waitFor(predicate, { after = 0, timeout = 2500 } = {}) {
    const present = this.messages.slice(after).find(predicate);
    if (present) return Promise.resolve(present);
    return new Promise((resolve, reject) => {
      const finish = (method, value) => {
        clearTimeout(timer);
        this.waiters.delete(waiter);
        method(value);
      };
      const waiter = { predicate, resolve: value => finish(resolve, value) };
      const timer = setTimeout(() => finish(reject, new Error('Timed out waiting for a server message')), timeout);
      this.waiters.add(waiter);
    });
  }

  async untilState(predicate, options) {
    return this.waitFor(message => message.type === 'state' && predicate(message), options);
  }
}

export async function flushPeer(peer) {
  const after = peer.messages.length;
  const time = Math.random();
  peer.send({ type: 'ping', time });
  await peer.waitFor(message => message.type === 'pong' && message.time === time, { after });
}
