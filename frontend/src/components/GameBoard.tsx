import { Container, Grid, Paper, Typography, Box, Button } from '@mui/material';
import { sendMessage } from '../lib/websocket';
import { formatUsername } from '../pages/GamePage';

export type Player = 'X' | 'O';
export type Cell = Player | null;

type GameBoardProps = {
  mySymbol: Player | null;
  myName: string;
  opponentName: string;
  initialBoard: Cell[][] | null;
  currentTurn: Player | null;
  winner: boolean;
  handleRestart: () => void;
};

export const GameBoard = ({
  mySymbol,
  opponentName,
  initialBoard,
  currentTurn,
  winner,
  handleRestart,
}: GameBoardProps) => {
  const handleMove = (row: number, col: number) => {
    if (
      !initialBoard ||
      initialBoard[row][col] ||
      winner ||
      currentTurn !== mySymbol
    ) {
      return;
    }

    console.log('Made a move');
    // Send move via websocket
    sendMessage({
      action: 'makeMove',
      token: localStorage.getItem('token'),
      roomId: localStorage.getItem('roomId'),
      row,
      col,
    });
  };

  return (
    <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
      <Typography variant="h6">You are {mySymbol}</Typography>
      <Typography variant="subtitle2">
        Opponent: {formatUsername(opponentName)}
      </Typography>
      <Box my={2}>
        {winner ? (
          <Typography>Game over</Typography>
        ) : (
          <Typography>{currentTurn}'s turn</Typography>
        )}
      </Box>

      <Grid container spacing={1} sx={{ width: '50%', margin: 'auto' }}>
        {initialBoard &&
          initialBoard.map((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <Grid size={4} key={`${rowIndex}-${colIndex}`}>
                <Paper
                  elevation={3}
                  onClick={() => handleMove(rowIndex, colIndex)}
                  sx={(theme) => ({
                    aspectRatio: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    cursor:
                      cell || winner || currentTurn !== mySymbol
                        ? 'not-allowed'
                        : 'pointer',
                    backgroundColor: cell
                      ? cell === 'X'
                        ? theme.palette.primary.main
                        : theme.palette.secondary.main
                      : theme.palette.background.paper,
                    color: cell ? '#ffffff' : theme.palette.text.primary,
                    fontWeight: 'bold',
                    userSelect: 'none',
                    border: `2px solid ${theme.palette.divider}`,
                  })}
                >
                  {cell}
                </Paper>
              </Grid>
            ))
          )}
      </Grid>

      <Button
        onClick={handleRestart}
        color="secondary"
        variant="contained"
        sx={{ border: 'none', marginTop: '1rem' }}
      >
        Restart
      </Button>
    </Container>
  );
};
