import WebSocket from 'ws';
import { generateRoomId } from './utils';

export interface Position {
  x: number;
  y: number;
}

export interface Ship {
  positions: Position[]; // Holds all positions occupied by the ship
  isSunk: boolean;
}

export interface Player {
  id: string;
  ships: Ship[];
  board: number[][]; // 2D array to represent the player's board: 0 = empty, 1 = ship, -1 = hit, -2 = miss
  ws: WebSocket; // The player's WebSocket connection for sending updates
}

export interface GameRoom {
  id: string;
  players: Player[];
  turn: string; // ID of the player whose turn it is
  status: 'waiting' | 'inProgress' | 'finished'; // Track game status
}

// All active game rooms are stored here
export const rooms: GameRoom[] = [];

export function createRoom(playerId: string, ws: WebSocket): GameRoom {
  const room: GameRoom = {
    id: generateRoomId(),
    players: [
      { id: playerId, ships: [], board: Array(10).fill(Array(10).fill(0)), ws },
    ],
    turn: playerId,
    status: 'waiting',
  };
  rooms.push(room);
  return room;
}

export function joinRoom(
  roomId: string,
  playerId: string,
  ws: WebSocket
): GameRoom | null {
  const room = rooms.find((r) => r.id === roomId);
  if (!room || room.players.length >= 2) return null;

  room.players.push({
    id: playerId,
    ships: [],
    board: Array(10).fill(Array(10).fill(0)),
    ws,
  });
  room.status = 'inProgress';

  // Notify players that the game has started
  room.players.forEach((p) =>
    p.ws.send(JSON.stringify({ type: 'gameStart', roomId }))
  );

  return room;
}

export function placeShip(
  playerId: string,
  roomId: string,
  ship: Ship
): boolean {
  const room = rooms.find((r) => r.id === roomId);
  const player = room?.players.find((p) => p.id === playerId);

  if (!player) return false;

  // Validate ship positions are within bounds and not overlapping
  for (let position of ship.positions) {
    if (
      position.x < 0 ||
      position.x >= 10 ||
      position.y < 0 ||
      position.y >= 10
    )
      return false;
    if (player.board[position.y][position.x] !== 0) return false;
  }

  // Place ship
  ship.positions.forEach((position) => {
    player.board[position.y][position.x] = 1; // Mark ship position
  });
  player.ships.push(ship);

  return true;
}

export function makeMove(
  roomId: string,
  playerId: string,
  x: number,
  y: number
): string {
  const room = rooms.find((r) => r.id === roomId);
  if (!room || room.status !== 'inProgress' || room.turn !== playerId)
    return 'notYourTurn';

  const opponent = room.players.find((p) => p.id !== playerId);
  if (!opponent) return 'noOpponent';

  // Check if the move is a hit or miss
  const targetCell = opponent.board[y][x];
  if (targetCell === 1) {
    opponent.board[y][x] = -1; // Mark as hit
    const hitShip = opponent.ships.find((ship) =>
      ship.positions.some((pos) => pos.x === x && pos.y === y)
    );
    if (hitShip) {
      // Check if all parts of the ship are hit
      hitShip.isSunk = hitShip.positions.every(
        (pos) => opponent.board[pos.y][pos.x] === -1
      );
    }

    // Check for game-over condition
    const allShipsSunk = opponent.ships.every((ship) => ship.isSunk);
    if (allShipsSunk) {
      room.status = 'finished';
      room.players.forEach((p) =>
        p.ws.send(JSON.stringify({ type: 'gameOver', winner: playerId }))
      );
      return 'gameOver';
    }

    return 'hit';
  } else if (targetCell === 0) {
    opponent.board[y][x] = -2; // Mark as miss
    room.turn = opponent.id; // Switch turn to the opponent
    return 'miss';
  } else {
    return 'invalidMove'; // Cell was already targeted
  }
}
