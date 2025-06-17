# Tic-Tac-Toe Multiplayer Game Backend (AWS Serverless)

This is the backend service for a real-time multiplayer Tic-Tac-Toe game using AWS WebSocket API Gateway, Lambda functions, and DynamoDB. It handles player matchmaking, game logic, room management, and player statistics — all in a fully serverless setup.

---

## Architecture

- **API Gateway (WebSocket):** Routes messages by action (`joinRoom`, `makeMove`, `leaveRoom`, etc.)
- **AWS Lambda:** Handles all game logic
- **DynamoDB:** Stores rooms and player states
- **Amazon Cognito:** Authenticates users and provides email/userId
- **CloudWatch Logs:** Tracks events and debugging info

---

## 🗂️ Table Structure

### `GameRooms` (DynamoDB)
| Attribute       | Type        | Description                     |
|----------------|-------------|---------------------------------|
| `roomId`        | String (PK) | Unique identifier for each room|
| `players`       | List        | Array of 1–2 players            |
| `board`         | 2D array    | Current game state              |
| `currentTurn`   | String      | `'X'` or `'O'`                  |

### `Stats` (DynamoDB)
| Attribute     | Type        | Description               |
|--------------|-------------|---------------------------|
| `userId`      | String (PK) | Cognito user UUID         |
| `wins`        | Number      | Number of wins            |
| `losses`      | Number      | Number of losses          |

---

## 🔧 Setup

1. **Install Dependencies:**

```bash
npm install aws-sdk uuid
```

2. **Create Required AWS Resources:**

- DynamoDB tables: `GameRooms`, `Stats`
- API Gateway WebSocket API with routes:
  - `$connect`, `$disconnect`
  - `joinRoom`
  - `makeMove`
  - `leaveRoom`
  - `restartGame`
  - `getStats`

3. **IAM Permissions** (Lambda role must have):
```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:*",
    "execute-api:ManageConnections",
    "cognito-idp:AdminGetUser"
  ],
  "Resource": "*"
}
```

---

## WebSocket Actions

### 1. `joinRoom`
Join a room or create a new one.

```json
{
  "action": "joinRoom",
  "token": "JWT_ID_TOKEN"
}
```

**Response (WebSocket):**
```json
{
  "message": "Joined room as second player",
  "room": {
    "roomId": "abc-123",
    "players": [...],
    "board": [["", "", ""], ...],
    "currentTurn": "X"
  }
}
```

---

### 2. `makeMove`

Make a move in the current room.

```json
{
  "action": "makeMove",
  "token": "JWT_ID_TOKEN",
  "roomId": "abc-123",
  "row": 0,
  "col": 2
}
```

---

### 3. `leaveRoom`

Leave the room, and optionally declare the other player as the winner.

```json
{
  "action": "leaveRoom",
  "token": "JWT_ID_TOKEN"
}
```

---

### 4. `restartGame`

Restart a finished game (both users stay in the room).

```json
{
  "action": "restartGame",
  "token": "JWT_ID_TOKEN",
  "roomId": "abc-123"
}
```

---

### 5. `getStats`

Return game statistics for all users.

```json
{
  "action": "getStats",
  "token": "JWT_ID_TOKEN"
}
```

**Response:**
```json
{
  "message": "stats",
  "data": [
    { "email": "alice@example.com", "wins": 5, "losses": 3 },
    { "email": "bob@example.com", "wins": 2, "losses": 4 }
  ]
}
```

---

## Testing with Postman

To test WebSocket actions:

1. Open **Postman** → New → WebSocket Request
2. Connect to:

```
wss://<API-ID>.execute-api.<region>.amazonaws.com/<stage>
```

3. Send messages with JSON payloads like above.
4. Use valid **Cognito JWT tokens** in the `"token"` field.

---

## Notes

- All users must be authenticated via **Amazon Cognito**
- The backend uses the token to extract `userId` and fetch their `email`
- Game state and player info are broadcast via WebSocket to all connected clients
