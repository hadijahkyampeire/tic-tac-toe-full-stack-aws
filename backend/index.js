// === index.js ===
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
const { verifyCognitoToken } = require("./utils/auth");

const ddb = new AWS.DynamoDB.DocumentClient();
const ROOMS_TABLE = "GameRooms";
const CONNECTIONS_TABLE = "Connections";
const USERS_TABLE = "UserStats";
const apiGateway = new AWS.ApiGatewayManagementApi({
  apiVersion: "2018-11-29",
  endpoint: "821gxv78hl.execute-api.us-east-2.amazonaws.com/production",
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
      await ddb.delete({ TableName: CONNECTIONS_TABLE, Key: { connectionId: connId } }).promise();
      return { statusCode: 200 };

    case "joinRoom":
      return await joinRoom(userId, connId);

    case "makeMove":
      return await handleMove(parsedBody, userId, connId);

    case "leaveRoom":
      return await leaveRoom(userId);

    case "getStats":
      return await getUserStats(userId, connId);

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

async function leaveRoom(userId) {
  const rooms = await ddb.scan({
    TableName: ROOMS_TABLE,
    FilterExpression: "contains(players, :userId)",
    ExpressionAttributeValues: { ":userId": userId }
  }).promise();

  if (rooms.Items.length === 0) return { statusCode: 404, body: "Room not found" };

  const room = rooms.Items[0];
  room.players = room.players.filter(p => p.userId !== userId);

  if (room.players.length === 1) {
    // Update stats: remaining user wins
    await updateScores([room.players[0], { userId }], room.players[0].symbol);
    await ddb.put({ TableName: ROOMS_TABLE, Item: room }).promise();

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
  } else {
    await ddb.delete({ TableName: ROOMS_TABLE, Key: { roomId: room.roomId } }).promise();
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

async function getUserStats(userId, connId) {
  const statsRes = await ddb.get({
    TableName: USERS_TABLE,
    Key: { userId }
  }).promise();

  const stats = statsRes.Item || {
    userId,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0
  };

  const email = await getUserEmail(userId);

  const message = {
    type: "userStats",
    email,
    stats
  };

  try {
    await apiGateway.postToConnection({
      ConnectionId: connId,
      Data: JSON.stringify(message)
    }).promise();
  } catch (err) {
    console.error("❌ Failed to send stats:", err);
  }

  return { statusCode: 200 };
}

async function getUserEmail(userId) {
  const cognito = new AWS.CognitoIdentityServiceProvider();
  const userPoolId = "us-east-2_azti5AuYe";
  const user = await cognito.adminGetUser({
    UserPoolId: userPoolId,
    Username: userId
  }).promise();
  const emailAttr = user.UserAttributes.find(attr => attr.Name === "email");
  return emailAttr?.Value || "unknown@example.com";
}