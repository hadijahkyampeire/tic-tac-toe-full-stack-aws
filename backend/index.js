const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
const { verifyCognitoToken } = require("./utils/auth");

const ddb = new AWS.DynamoDB.DocumentClient();
const ROOMS_TABLE = "GameRooms";
const CONNECTIONS_TABLE = "Connections";
const USERS_TABLE = "UserStats";
const apiGateway = new AWS.ApiGatewayManagementApi({
  apiVersion: "2018-11-29",
  endpoint: "09dm0d29vl.execute-api.us-east-1.amazonaws.com/production",
});

exports.handler = async (event) => {
  console.log("Incoming event:", JSON.stringify(event, null, 2));
  const { requestContext } = event;
  const routeKey = requestContext.routeKey;
  const connId = requestContext.connectionId;

  let token;
  let parsedBody = {};

  try {
    if (event.body) {
      parsedBody = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
      token = parsedBody.token;
    }
    if (!token && event.queryStringParameters) {
      token = event.queryStringParameters.token;
    }
  } catch (err) {
    console.error("Failed to parse body or extract token:", err);
    return { statusCode: 400, body: "Bad request format" };
  }

  const user = await verifyCognitoToken(token);
  if (!user) return { statusCode: 401, body: "Unauthorized" };
  const userId = user.sub;

  switch (routeKey) {
    case "$connect":
      await ddb.put({ TableName: CONNECTIONS_TABLE, Item: { connectionId: connId, userId } }).promise();
      return { statusCode: 200 };

    case "$disconnect":
      await handleDisconnect(connId);
      return { statusCode: 200 };

    case "joinRoom":
      return await joinRoom(userId, connId);

    case "makeMove":
      return await handleMove(parsedBody, userId, connId);

    case "leaveRoom":
      return await leaveRoom(userId, parsedBody.roomId)

    case "restart":
      console.log("restart connId:", connId);
      return await restartGame(userId, connId, parsedBody.roomId);
      
    case "getStats":
      console.log("getStats event:", event);
      return await getAllUserStats(connId);

    default:
      return { statusCode: 400, body: "Unknown action" };
  }
};

async function joinRoom(userId, connId) {
  let roomId;
  let room;
  const availableRooms = await ddb.scan({
    TableName: ROOMS_TABLE,
    FilterExpression: "size(players) = :size",
    ExpressionAttributeValues: { ":size": 1 }
  }).promise();

  if (availableRooms.Items.length > 0) {
    room = availableRooms.Items[0];
    room.players.push({ userId, connId, symbol: "O" });
    await ddb.put({ TableName: ROOMS_TABLE, Item: room }).promise();
    roomId = room.roomId;
  } else {
    roomId = uuidv4();
    room = {
      roomId,
      players: [{ userId, connId, symbol: "X" }],
      board: [["", "", ""], ["", "", ""], ["", "", ""]],
      currentTurn: "X"
    };
    await ddb.put({ TableName: ROOMS_TABLE, Item: room }).promise();
  }

  const playersWithEmails = await Promise.all(
    room.players.map(async player => ({
      ...player,
      email: await getUserEmail(player.userId)
    }))
  );

  const message = {
    message: "roomUpdate",
    room: { ...room, players: playersWithEmails }
  };

  for (const player of room.players) {
    try {
      await apiGateway.postToConnection({
        ConnectionId: player.connId,
        Data: JSON.stringify(message)
      }).promise();
    } catch (err) {
      console.error(`Notify failed: ${player.connId}`, err);
    }
  }

  return { statusCode: 200 };
}

async function leaveRoom(userId, roomId) {
  const res = await ddb.get({
    TableName: ROOMS_TABLE,
    Key: { roomId }
  }).promise();

  const room = res.Item;
  if (!room) return { statusCode: 404, body: "Room not found" };

  const leavingPlayer = room.players.find(p => p.userId === userId);
  if (!leavingPlayer) {
    return { statusCode: 400, body: "User not in room" };
  }

  const updatedPlayers = room.players.filter(p => p.userId !== userId);

  console.log("🧪 room.players before:", JSON.stringify(room.players));
  console.log("🧪 leavingPlayer:", JSON.stringify(leavingPlayer));

  if (updatedPlayers.length === 1) {
    console.log("only one player");
    const winner = updatedPlayers[0];

    // Delete the old room first
    await ddb.delete({ TableName: ROOMS_TABLE, Key: { roomId } }).promise();

    // Create new room with reset state
    const newRoom = {
      roomId,
      players: [winner],
      board: [["", "", ""], ["", "", ""], ["", "", ""]],
      currentTurn: "X",
      winner: null,
      draw: false,
    };

    await updateScores([winner, leavingPlayer], winner.symbol);
    await ddb.put({ TableName: ROOMS_TABLE, Item: newRoom }).promise();

    const playersWithEmails = await Promise.all(
      newRoom.players.map(async player => ({
        ...player,
        email: await getUserEmail(player.userId)
      }))
    );

    const message = {
      message: "leaveRoom",
      room: { ...newRoom, players: playersWithEmails },
      info: `Player ${leavingPlayer.userId} left. ${winner.userId} wins and remains.`
    };

    try {
      console.log("Notifying remaining player:", winner.connId);
      await apiGateway.postToConnection({
        ConnectionId: winner.connId,
        Data: JSON.stringify(message)
      }).promise();
    } catch (err) {
      console.error(`Failed to notify ${winner.connId}`, err);
    }

  } else if (updatedPlayers.length === 0) {
    console.log("zero player");
    await ddb.delete({ TableName: ROOMS_TABLE, Key: { roomId } }).promise();
    console.log("🗑️ Room deleted because last player left.");
  } else {
    console.warn("Unexpected number of players in room after removal.");
  }

  return { statusCode: 200 };
}


function checkWinner(board) {
  const lines = [
    [board[0][0], board[0][1], board[0][2]],
    [board[1][0], board[1][1], board[1][2]],
    [board[2][0], board[2][1], board[2][2]],
    [board[0][0], board[1][0], board[2][0]],
    [board[0][1], board[1][1], board[2][1]],
    [board[0][2], board[1][2], board[2][2]],
    [board[0][0], board[1][1], board[2][2]],
    [board[0][2], board[1][1], board[2][0]]
  ];
  for (const line of lines) {
    if (line[0] && line[0] === line[1] && line[1] === line[2]) return line[0];
  }
  return null;
}

async function handleMove(data, userId, connId) {
  const { roomId, row, col } = data;
  const res = await ddb.get({ TableName: ROOMS_TABLE, Key: { roomId } }).promise();
  const room = res.Item;
  if (!room) return { statusCode: 404, body: "Room not found" };

  const player = room.players.find(p => p.userId === userId);
  if (!player || room.currentTurn !== player.symbol || room.board[row][col]) {
    return { statusCode: 400, body: "Invalid move" };
  }

  room.board[row][col] = player.symbol;
  const winner = checkWinner(room.board);
  const isDraw = room.board.flat().every(cell => cell);

  if (winner || isDraw) {
    await updateScores(room.players, winner);
    await ddb.delete({ TableName: ROOMS_TABLE, Key: { roomId } }).promise();
  } else {
    room.currentTurn = room.currentTurn === "X" ? "O" : "X";
    await ddb.put({ TableName: ROOMS_TABLE, Item: room }).promise();
  }

  const playersWithEmails = await Promise.all(
    room.players.map(async player => ({
      ...player,
      email: await getUserEmail(player.userId)
    }))
  );

  const message = {
    message: "moveUpdate",
    room: { ...room, players: playersWithEmails },
    ...(winner || isDraw ? { gameOver: true, winner: winner || "draw" } : {})
  };

  for (const player of room.players) {
    try {
      await apiGateway.postToConnection({
        ConnectionId: player.connId,
        Data: JSON.stringify(message)
      }).promise();
    } catch (err) {
      console.error(`Notify failed: ${player.connId}`, err);
    }
  }

  return { statusCode: 200 };
}

async function updateScores(players, winnerSymbol) {
  for (const player of players) {
    const res = await ddb.get({ TableName: USERS_TABLE, Key: { userId: player.userId } }).promise();
    const stats = res.Item || { userId: player.userId, gamesPlayed: 0, wins: 0, losses: 0, draws: 0 };

    stats.gamesPlayed += 1;
    if (!winnerSymbol || winnerSymbol === 'draw') {
      stats.draws += 1;
    } else if (player.symbol === winnerSymbol) {
      stats.wins += 1;
    } else {
      stats.losses += 1;
    }

    await ddb.put({ TableName: USERS_TABLE, Item: stats }).promise();
  }
}

async function getAllUserStats(connId) {
  const scanResult = await ddb.scan({ TableName: USERS_TABLE }).promise();

  const users = await Promise.all(
    scanResult.Items.map(async user => {
      const email = await getUserEmail(user.userId);
      return { ...user, email };
    })
  );

  const message = {
    message: "statsUpdate",
    users
  };

  try {
    await apiGateway.postToConnection({
      ConnectionId: connId,
      Data: JSON.stringify(message)
    }).promise();
  } catch (err) {
    console.error(`❌ Failed to send stats to ${connId}`, err);
  }

  return { statusCode: 200 };
}

async function restartGame(userId, connId, roomId) {
  console.log("Restart request received:", { userId, connId, roomId });

  const res = await ddb.get({ TableName: ROOMS_TABLE, Key: { roomId } }).promise();
  const room = res.Item;
  if (!room) {
    console.log("Room not found");
    return { statusCode: 404, body: "Room not found" };
  }

  const player = room.players.find(p => p.userId === userId);
  if (!player) {
    console.log("User not part of this room");
    return { statusCode: 403, body: "Not part of this room" };
  }

  console.log("🧪 room.players before:", JSON.stringify(room.players));

  // Force reset of board regardless of current state
  room.board = [["", "", ""], ["", "", ""], ["", "", ""]];
  room.currentTurn = "X";
  room.winner = null; // Optional, if winner tracking is implemented
  room.isDraw = false; // Optional, if draw tracking is implemented

  await ddb.put({ TableName: ROOMS_TABLE, Item: room }).promise();
  console.log("Room board reset and saved to DB");

  // Enrich players with email
  const playersWithEmails = await Promise.all(
    room.players.map(async (p) => ({
      ...p,
      email: await getUserEmail(p.userId)
    }))
  );

  const message = {
    message: "roomRestarted",
    room: { ...room, players: playersWithEmails }
  };

  // Send message to all players via WebSocket
  for (const p of room.players) {
    try {
      console.log("Sending restart message to:", p.connId);
      await apiGateway.postToConnection({
        ConnectionId: p.connId,
        Data: JSON.stringify(message)
      }).promise();
    } catch (err) {
      console.error(`❌ Failed to notify ${p.connId}`, err);
    }
  }

  return { statusCode: 200 };
}

async function handleDisconnect(connId) {
  // 1. Delete connection from the Connections table
  await ddb.delete({
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId: connId }
  }).promise();

  // 2. Find the room containing this connection
  const roomsData = await ddb.scan({ TableName: ROOMS_TABLE }).promise();
  const room = roomsData.Items.find(r => r.players.some(p => p.connId === connId));

  if (!room) return;

  // 3. Remove the disconnected player
  room.players = room.players.filter(p => p.connId !== connId);

  if (room.players.length === 0) {
    // No players left — delete the room, no need to notify anyone
    await ddb.delete({
      TableName: ROOMS_TABLE,
      Key: { roomId: room.roomId }
    }).promise();
    console.log("Room deleted because no players remained.");
  } else {
    // One player left — declare them the winner and notify
    const remainingPlayer = room.players[0];

    // Update stats: give win to remaining player
    await updateScores([remainingPlayer], remainingPlayer.symbol);

    // Reset game state
    room.board = [["", "", ""], ["", "", ""], ["", "", ""]];
    room.currentTurn = "X";

    // Add email to the remaining player
    const playersWithEmails = await Promise.all(
      room.players.map(async player => ({
        ...player,
        email: await getUserEmail(player.userId)
      }))
    );

    const message = {
      message: "disconnected",
      room: { ...room, players: playersWithEmails }
    };

    try {
      await apiGateway.postToConnection({
        ConnectionId: remainingPlayer.connId,
        Data: JSON.stringify(message)
      }).promise();
    } catch (err) {
      console.error("❌ Failed to notify remaining player", err);
    }

    // Save updated room state
    await ddb.put({
      TableName: ROOMS_TABLE,
      Item: room
    }).promise();
  }
}

async function getUserEmail(userId) {
  const cognito = new AWS.CognitoIdentityServiceProvider();
  const userPoolId = "us-east-1_6VPoqWJgk";
  const user = await cognito.adminGetUser({
    UserPoolId: userPoolId,
    Username: userId
  }).promise();
  const emailAttr = user.UserAttributes.find(attr => attr.Name === "email");
  return emailAttr?.Value || "unknown@example.com";
}