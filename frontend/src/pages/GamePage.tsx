import { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Alert,
  Box,
  Paper,
  Button,
  Snackbar,
} from '@mui/material';
import { GameBoard } from '../components/GameBoard';
import { useWebSocket } from '../context/useWebSocket';
import { addGamePageListener } from '../lib/websocket';
import { type WebSocketMessage, type UserStat } from '../types';
import { StatsOverlay } from '../components/StatsOverlay';
import { useNavigate } from 'react-router-dom';

export type Player = 'X' | 'O';

type PlayerData = {
  name: string;
  symbol: Player;
  id: string;
};

export const formatUsername = (email?: string) => {
  if (!email) return '---';
  const username = email.split('@')[0];
  return username.charAt(0).toUpperCase() + username.slice(1);
};

const getStatusColor = (
  status: 'connected' | 'disconnected' | 'connecting...'
) => {
  switch (status) {
    case 'connected':
      return 'green';
    case 'disconnected':
      return 'orange';
    case 'connecting...':
      return 'blue';
    default:
      return 'black';
  }
};

const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const [statsOpen, setStatsOpen] = useState(false);
  const [opponentName, setOpponentName] = useState(
    localStorage.getItem('opponent') || ''
  );
  const [infoMsg, setInfoMsg] = useState('');
  const [error, setError] = useState('');
  const [gameBoardKey, setGameBoardKey] = useState(0);
  const [winnerMsg, setWinnerMsg] = useState('');
  const [allStats, setAllStats] = useState<UserStat[]>([]);

  const [joinedRoom, setJoinedRoom] = useState(() => {
    const saved = localStorage.getItem('joinedRoom');
    return saved === 'true';
  });

  const [roomId, setRoomId] = useState(
    () => localStorage.getItem('roomId') || ''
  );
  const [players, setPlayers] = useState(() => {
    const saved = localStorage.getItem('players');
    return saved ? JSON.parse(saved) : { X: null, O: null };
  });
  const [mySymbol, setMySymbol] = useState(
    () => localStorage.getItem('mySymbol') || ''
  );
  const [myName, setMyName] = useState(
    () => localStorage.getItem('myName') || ''
  );
  const [board, setBoard] = useState(() => {
    const saved = localStorage.getItem('board');
    return saved ? JSON.parse(saved) : null;
  });
  const [currentTurn, setCurrentTurn] = useState(() =>
    localStorage.getItem('currentTurn')
  );

  const { sendMessage, status, reconnect } = useWebSocket();

  const token = localStorage.getItem('token');
  const email = localStorage.getItem('userEmail');
  const userID = localStorage.getItem('userId');

  useEffect(() => {
    const savedJoinedRoom = localStorage.getItem('joinedRoom');
    if (savedJoinedRoom === 'true') {
      setJoinedRoom(true);
    }

    const savedRoomId = localStorage.getItem('roomId');
    if (savedRoomId) setRoomId(savedRoomId);

    const savedPlayers = localStorage.getItem('players');
    if (savedPlayers) setPlayers(JSON.parse(savedPlayers));

    const savedSymbol = localStorage.getItem('mySymbol');
    if (savedSymbol === 'X' || savedSymbol === 'O') setMySymbol(savedSymbol);

    const savedName = localStorage.getItem('myName');
    if (savedName) setMyName(savedName);

    const savedBoard = localStorage.getItem('board');
    if (savedBoard) setBoard(JSON.parse(savedBoard));

    const savedTurn = localStorage.getItem('currentTurn');
    if (savedTurn === 'X' || savedTurn === 'O') setCurrentTurn(savedTurn);
  }, []);

  useEffect(() => {
    if (joinedRoom) {
      localStorage.setItem('joinedRoom', 'true');
    } else {
      localStorage.removeItem('joinedRoom');
    }

    if (roomId) {
      localStorage.setItem('roomId', roomId);
    } else {
      localStorage.removeItem('roomId');
    }

    if (players && (players.X !== null || players.O !== null)) {
      localStorage.setItem('players', JSON.stringify(players));
    }

    if (mySymbol) {
      localStorage.setItem('mySymbol', mySymbol);
    } else {
      localStorage.removeItem('mySymbol');
    }

    if (myName) {
      localStorage.setItem('myName', myName);
    } else {
      localStorage.removeItem('myName');
    }

    if (board) {
      localStorage.setItem('board', JSON.stringify(board));
    }

    if (currentTurn) {
      localStorage.setItem('currentTurn', currentTurn);
    }
  }, [joinedRoom, roomId, players, mySymbol, myName, board, currentTurn]);

  const handleMessage = (data: unknown) => {
    const wsData = data as WebSocketMessage;
    console.log('WebSocket message received in GamePage:', wsData);
    localStorage.setItem('data', JSON.stringify(wsData));

    if (wsData.message?.includes('roomUpdate')) {
      setJoinedRoom(true);
      setRoomId(wsData.room?.roomId || '');
      localStorage.setItem('roomId', wsData.room?.roomId || '');

      if (wsData.room?.board) setBoard(wsData.room.board);
      if (wsData.room?.currentTurn) setCurrentTurn(wsData.room.currentTurn);

      const map: Record<Player, PlayerData | null> = { X: null, O: null };
      wsData.room?.players?.forEach((p: unknown) => {
        const player = p as { userId: string; symbol: Player; email: string };
        map[player.symbol as Player] = {
          name: player.email,
          id: player.userId,
          symbol: player.symbol,
        };
      });

      setPlayers(map);
      const me = wsData.room?.players
        ? wsData.room.players.find(
            (p: { userId: string; email?: string; symbol: Player }) =>
              p.userId === userID || p.email === email
          )
        : undefined;

      if (me) setMySymbol(me.symbol);

      const opp = me?.symbol === 'X' ? map.O : map.X;
      setOpponentName(opp?.name || '');
      localStorage.setItem('opponent', opp?.name || '');

      setInfoMsg(wsData.message || '');
      return;
    }

    if (wsData.message === 'moveUpdate') {
      if (wsData?.room?.board) {
        setBoard(wsData?.room?.board);
        localStorage.setItem('board', JSON.stringify(wsData?.room?.board));
      }

      if (wsData?.room?.currentTurn) {
        setCurrentTurn(wsData?.room?.currentTurn);
        localStorage.setItem('currentTurn', wsData?.room?.currentTurn);
      }

      if (wsData.gameOver) {
        console.log('Is Game Over', wsData.gameOver);
        setWinnerMsg(
          wsData.winner === 'draw'
            ? 'Game is a draw!'
            : `${wsData.winner} wins!`
        );
        setGameBoardKey((k) => k + 1);
      }
    }

    if (wsData.type === 'playerUpdate') {
      const map: Record<Player, PlayerData | null> = { X: null, O: null };
      if (wsData.players) {
        wsData.players.forEach(
          (p: { userId: string; email?: string; symbol: Player }) => {
            map[p.symbol as Player] = {
              name: p.email || '',
              symbol: p.symbol,
              id: p.userId,
            };
          }
        );
      }
      setPlayers(map);
      const opp = mySymbol === 'X' ? map.O : map.X;
      setOpponentName(opp?.name || '');
    }

    if (wsData.type === 'gameOver') {
      alert(
        wsData.winner === 'draw' ? 'Game is a draw!' : `${wsData.winner} wins!`
      );
      setGameBoardKey((k) => k + 1);
    }

    if (wsData.message === 'statsUpdate' && Array.isArray(wsData.users)) {
      localStorage.setItem('gameStats', JSON.stringify(wsData.users))
      setAllStats(wsData.users);
    }

    if (wsData.message === 'leaveRoom') {
      setJoinedRoom(false);
      localStorage.clear();
      setInfoMsg('You have left the room.');
      return;
    }

    if (wsData.message === 'roomRestarted') {
      if (wsData?.room?.board) {
        setBoard(wsData?.room?.board);
        localStorage.setItem('board', JSON.stringify(wsData?.room?.board));
      }

      if (wsData?.room?.currentTurn) {
        setCurrentTurn(wsData?.room?.currentTurn);
        localStorage.setItem('currentTurn', wsData?.room?.currentTurn);
      }
      setWinnerMsg('');
      setGameBoardKey((k) => k + 1);
      setInfoMsg('Game has been restarted.');
      return;
    }
  };

  useEffect(() => {
    if (!token || !email) {
      setError('Missing user token or email');
      return;
    }

    setMyName(email);

    addGamePageListener(handleMessage);
  }, []);

  const handleJoinRoom = () => {
    if (!token) return;
    sendMessage({ action: 'joinRoom', token });
  };

  const handleLeaveRoom = () => {
    if (!token) return;
    console.log('leaving room...');
    sendMessage({ action: 'leaveRoom', token, roomId });
    localStorage.clear();
    navigate('/');
  };

  const handleRestartGame = () => {
    if (!token) return;
    console.log('Restarting Game...', roomId)
    sendMessage({ action: 'restart', token, roomId });
  };

  const handleGetStats = () => {
    if (!token) return;
    console.log('Getting stats...');
    sendMessage({ action: 'getStats', token });
  };

  const bothPlayersJoined = players.X && players.O && mySymbol;
  const isAlreadyInRoom = players.X?.id === userID || players.O?.id === userID;

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography sx={{ mb: 1 }}>
          WebSocket status:{' '}
          <strong
            style={{
              color: getStatusColor(
                status as 'connected' | 'disconnected' | 'connecting...'
              ),
            }}
          >
            {status}
          </strong>
        </Typography>
        {status !== 'connected' && (
          <Button
            onClick={reconnect}
            size="small"
            variant="outlined"
            sx={{ ml: 2 }}
          >
            Retry Connection
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {infoMsg && (
        <>
          <Alert severity="success" sx={{ mb: 2 }}>
            {infoMsg}
          </Alert>

          <Snackbar
            open={!!infoMsg}
            autoHideDuration={3000}
            onClose={() => setInfoMsg('')}
            message={infoMsg}
          />
        </>
      )}

      {winnerMsg && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {winnerMsg}
        </Alert>
      )}

      {!joinedRoom ? (
        <Box textAlign="center" mt={5}>
          <Button
            variant="contained"
            size="large"
            disabled={joinedRoom || isAlreadyInRoom}
            onClick={handleJoinRoom}
          >
            Join Game Room
          </Button>
        </Box>
      ) : (
        <>
          {mySymbol && (
            <Alert severity="info" sx={{ mb: 3 }}>
              Welcome {myName}, you are player <strong>{mySymbol}</strong>
              {roomId && (
                <span style={{ display: 'block' }}>
                  Room ID: <code>{roomId}</code>
                </span>
              )}
            </Alert>
          )}

          <Box
            sx={{
              borderBottom: '1px solid black',
              mb: 3,
              pb: 2,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            <Button
              variant="outlined"
              onClick={() => {
                handleGetStats();
                setStatsOpen(true);
              }}
            >
              Show Stats / Leaderboard
            </Button>
            <Button variant="outlined" color="error" onClick={handleLeaveRoom}>
              Leave Room
            </Button>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: ['column', 'row'],
              gap: 4,
              alignItems: 'flex-start',
            }}
          >
            <Box flex={1}>
              {bothPlayersJoined && board ? (
                <GameBoard
                  key={gameBoardKey}
                  mySymbol={
                    mySymbol === 'X' || mySymbol === 'O'
                      ? (mySymbol as Player)
                      : null
                  }
                  myName={myName}
                  opponentName={opponentName}
                  initialBoard={board}
                  winner={winnerMsg !== ''}
                  currentTurn={currentTurn as Player | null}
                  handleRestart={handleRestartGame}
                />
              ) : (
                <Typography align="center" sx={{ mt: 5 }}>
                  Waiting for a second player to join...
                </Typography>
              )}
            </Box>

            <Paper sx={{ p: 2, minWidth: 240 }}>
              <Typography variant="subtitle1" gutterBottom>
                Players:
              </Typography>
              <Typography>
                X: {players.X?.name ? formatUsername(players.X?.name) : '---'}
              </Typography>
              <Typography>
                O: {players.O?.name ? formatUsername(players.O?.name) : '---'}
              </Typography>
              {currentTurn && (
                <Typography sx={{ mt: 1 }}>
                  <strong>Current Turn:</strong> {currentTurn}
                </Typography>
              )}
            </Paper>
          </Box>
        </>
      )}

      <StatsOverlay
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        statsData={allStats}
        currentUserEmail={email || ''}
      />
    </Container>
  );
};

export { GamePage };
