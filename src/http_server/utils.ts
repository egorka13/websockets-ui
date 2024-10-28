import { GameRoom, Player } from './game';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8);
}

export function checkAllShipsSunk(player: Player): boolean {
  return player.ships.every((ship) => ship.isSunk);
}

export function broadcastMove(
  room: GameRoom,
  move: { playerId: string; x: number; y: number; result: string }
) {
  room.players.forEach((player) => {
    player.ws.send(
      JSON.stringify({
        type: 'move',
        move,
      })
    );
  });
}
