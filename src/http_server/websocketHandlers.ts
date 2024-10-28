import WebSocket from 'ws';
import {
  addUserToRoom,
  createRoom,
  finish,
  GameRoom,
  joinRoom,
  makeMove,
  placeShip,
  randomAttack,
  registerUser,
  rooms,
  Ship,
  startGame,
} from './game';

export function handleRegistration(ws: WebSocket, data: { username: string }) {
  const playerId = registerUser(data.username, ws);
  ws.send(JSON.stringify({ type: 'regSuccess', playerId }));
}

export function handleCreateRoom(ws: WebSocket, data: { playerId: string }) {
  const room = createRoom(data.playerId, ws);
  ws.send(JSON.stringify({ type: 'roomCreated', roomId: room.id }));
}

export function handleAddUserToRoom(
  ws: WebSocket,
  data: { playerId: string; roomId: string }
) {
  const success = addUserToRoom(data.roomId, data.playerId);
  ws.send(
    JSON.stringify({
      type: success ? 'roomJoined' : 'error',
      message: success ? 'Room joined' : 'Room full or not found',
    })
  );
}

export function handleStartGame(ws: WebSocket, data: { roomId: string }) {
  const room = rooms.find((r) => r.id === data.roomId);
  if (room && room.players.length === 2) {
    startGame(room);
  } else {
    ws.send(JSON.stringify({ type: 'error', message: 'Not enough players' }));
  }
}

export function handleRandomAttack(
  ws: WebSocket,
  data: { playerId: string; roomId: string }
) {
  randomAttack(data.roomId, data.playerId);
}

export function handleFinish(
  ws: WebSocket,
  data: { roomId: string; winnerId: string }
) {
  finish(data.roomId, data.winnerId);
}

export function handleJoinRoom(
  ws: WebSocket,
  data: { playerId: string; roomId?: string }
) {
  let room: GameRoom | null;

  // If roomId is provided, attempt to join that room
  if (data.roomId) {
    room = joinRoom(data.roomId, data.playerId, ws);
    if (!room) {
      ws.send(
        JSON.stringify({
          type: 'error',
          message: 'Room not found or already full',
        })
      );
      return;
    }
  } else {
    // If no roomId is provided, create a new room
    room = createRoom(data.playerId, ws);
  }

  ws.send(
    JSON.stringify({
      type: 'roomJoined',
      roomId: room.id,
      playerId: data.playerId,
    })
  );

  // If room is now full, start the game
  if (room.players.length === 2) {
    broadcast(room, { type: 'gameStart', roomId: room.id });
  }
}

export function handlePlaceShip(
  ws: WebSocket,
  data: { playerId: string; roomId: string; ship: Ship }
) {
  const room = rooms.find((r) => r.id === data.roomId);
  if (!room) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
    return;
  }

  const success = placeShip(data.playerId, data.roomId, data.ship);
  if (!success) {
    ws.send(
      JSON.stringify({ type: 'error', message: 'Invalid ship placement' })
    );
    return;
  }

  broadcast(room, {
    type: 'shipPlaced',
    playerId: data.playerId,
    positions: data.ship.positions,
  });
}

export function handleAttack(
  ws: WebSocket,
  data: { playerId: string; roomId: string; x: number; y: number }
) {
  const room = rooms.find((r) => r.id === data.roomId);
  if (!room) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
    return;
  }

  const result = makeMove(data.roomId, data.playerId, data.x, data.y);

  if (result === 'notYourTurn') {
    ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
  } else if (result === 'invalidMove') {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid move' }));
  } else {
    broadcast(room, {
      type: 'attackResult',
      playerId: data.playerId,
      x: data.x,
      y: data.y,
      result,
    });

    // If game over, send a final message
    if (result === 'gameOver') {
      broadcast(room, { type: 'gameOver', winner: data.playerId });
    }
  }
}

export function handleDisconnect(
  ws: WebSocket,
  data: { playerId: string; roomId: string }
) {
  const room = rooms.find((r) => r.id === data.roomId);
  if (!room) return;

  broadcast(room, {
    type: 'playerDisconnected',
    message: `Player ${data.playerId} has disconnected.`,
  });

  room.status = 'finished';
}

export function broadcast(room: GameRoom, message: any) {
  room.players.forEach((player) => {
    player.ws.send(JSON.stringify(message));
  });
}

export function notifyGameStart(room: GameRoom) {
  broadcast(room, {
    type: 'gameStart',
    message: 'Game has started!',
    roomId: room.id,
    players: room.players.map((p) => p.id),
  });
}

export function notifyTurn(room: GameRoom) {
  broadcast(room, {
    type: 'turn',
    playerId: room.turn,
    message: `It's now player ${room.turn}'s turn.`,
  });
}

export function notifyShipPlacement(
  playerId: string,
  room: GameRoom,
  ship: Ship
) {
  const message = {
    type: 'shipPlaced',
    playerId,
    positions: ship.positions,
  };
  broadcast(room, message);
}

export function notifyGameOver(room: GameRoom, winnerId: string) {
  broadcast(room, {
    type: 'gameOver',
    winner: winnerId,
    message: `Player ${winnerId} has won the game!`,
  });
}
