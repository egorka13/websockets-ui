import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import {
  handleAttack,
  handleJoinRoom,
  handlePlaceShip,
} from './websocketHandlers';

export const httpServer = http.createServer(function (req, res) {
  const __dirname = path.resolve(path.dirname(''));
  const file_path =
    __dirname + (req.url === '/' ? '/front/index.html' : '/front' + req.url);
  fs.readFile(file_path, function (err, data) {
    if (err) {
      res.writeHead(404);
      res.end(JSON.stringify(err));
      return;
    }
    res.writeHead(200);
    res.end(data);
  });
});

const wss = new WebSocketServer({ port: 3000 });

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (message) => {
    console.log(`Received message => ${message}`);
    const { type, data } = JSON.parse(message.toString());

    switch (type) {
      case 'joinRoom':
        handleJoinRoom(ws, data);
        break;
      case 'placeShip':
        handlePlaceShip(ws, data);
        break;
      case 'attack':
        handleAttack(ws, data);
        break;
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

console.log('WebSocket server running on ws://localhost:3000');
