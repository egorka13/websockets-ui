import WebSocket from 'ws';
import { generateId, generateRoomId } from './utils';
import { broadcast } from './websocketHandlers';

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

// Store all players
export const players: Player[] = [];

export function registerUser(username: string, ws: WebSocket): string {
  const playerId = generateId();
  players.push({ id: playerId, ws, ships: [], board: [] });
  return playerId;
}

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

export function addUserToRoom(roomId: string, playerId: string): boolean {
  const room = rooms.find((r) => r.id === roomId);
  if (!room || room.players.length >= 2) return false;

  room.players.push(getPlayer(playerId));
  if (room.players.length === 2) {
    room.status = 'inProgress';
    startGame(room);
  }
  return true;
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

export function startGame(room: GameRoom) {
  // Notify players that the game has started
  broadcast(room, { type: 'gameStart', roomId: room.id });
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

export function addShips(playerId: string, roomId: string, ships: Ship[]) {
  const room = rooms.find((r) => r.id === roomId);
  const player = room?.players.find((p) => p.id === playerId);
  if (player) player.ships = ships;
}

export function turn(roomId: string) {
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return;

  // Toggle turn between the two players
  room.turn = room.players.find((p) => p.id !== room.turn)?.id!;
  broadcast(room, { type: 'turn', playerId: room.turn });
}

export function randomAttack(roomId: string, playerId: string) {
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return;

  const opponent = room.players.find((p) => p.id !== playerId);
  if (!opponent) return;

  // Generate random coordinates for attack
  const x = Math.floor(Math.random() * 10);
  const y = Math.floor(Math.random() * 10);

  makeMove(roomId, playerId, x, y);
}

export function finish(roomId: string, winnerId: string) {
  updateRoom(roomId, 'finished');
  const room = rooms.find((r) => r.id === roomId);
  if (room) {
    broadcast(room, { type: 'gameOver', winner: winnerId });
  }
}

// Utility function to find a player by ID
function getPlayer(playerId: string): Player {
  return players.find((p) => p.id === playerId) as Player;
}

// Update room status to finished
export function updateRoom(roomId: string, status: 'finished') {
  const room = rooms.find((r) => r.id === roomId);
  if (room) room.status = status;
}
