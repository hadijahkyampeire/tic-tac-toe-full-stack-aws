import React, { useEffect, useState } from 'react';
import {
  Drawer,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  Box,
  IconButton
} from '@mui/material';
import { Close } from '@mui/icons-material';

type UserStat = {
  userId: string;
  email: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  statsData: UserStat[];
  currentUserEmail: string;
};

export const StatsOverlay: React.FC<Props> = ({
  open,
  onClose,
  statsData,
  currentUserEmail,
}) => {
  const [currentUserStats, setCurrentUserStats] = useState<UserStat | null>(
    null
  );
  const [leaderboard, setLeaderboard] = useState<UserStat[]>([]);

  useEffect(() => {
    // Find current user stats by email
    const userStats =
      statsData.find((stat) => stat.email === currentUserEmail) || null;
    setCurrentUserStats(userStats);

    // Sort leaderboard by wins descending
    const sortedLeaderboard = [...statsData].sort((a, b) => b.wins - a.wins);
    setLeaderboard(sortedLeaderboard);
  }, [statsData, currentUserEmail]);

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box
        sx={{
          width: 600,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header with title and close icon */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            borderBottom: '1px solid #ddd',
          }}
        >
          <Typography variant="h6">Game Stats & Leaderboard</Typography>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>

        {/* Scrollable content */}
        <Box sx={{ p: 3, overflowY: 'auto', flexGrow: 1 }}>
          <Typography variant="subtitle1" gutterBottom>
            Your Stats
          </Typography>
          {currentUserStats ? (
            <>
              <Typography>
                Games Played: {currentUserStats.gamesPlayed}
              </Typography>
              <Typography>Wins: {currentUserStats.wins}</Typography>
              <Typography>Losses: {currentUserStats.losses}</Typography>
              <Typography>Draws: {currentUserStats.draws}</Typography>
            </>
          ) : (
            <Typography>No stats available for you yet.</Typography>
          )}

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" gutterBottom>
            Leaderboard
          </Typography>
          <List>
            {leaderboard.map((stat, idx) => (
              <ListItem key={stat.userId} disablePadding>
                <ListItemButton selected={stat.email === currentUserEmail}>
                  <ListItemText
                    primary={`${idx + 1}. ${stat.email}`}
                    secondary={`Wins: ${stat.wins} | Played: ${stat.gamesPlayed}`}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Box>
    </Drawer>
  );
};
