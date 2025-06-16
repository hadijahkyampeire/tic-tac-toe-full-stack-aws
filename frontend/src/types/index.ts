export type Player = 'X' | 'O';
export type Cell = Player | null;
export type Board = Cell[];

export type UserStat = {
  userId: string;
  email: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
};

export interface UserStatsResponse {
  message: 'statsUpdate';
  users: UserStat[];
};
export interface WebSocketMessage  {
  message?: string;
  type?: string;
  room?: {
    roomId: string;
    board: unknown;
    currentTurn?: Player;
    players?: Array<{
      userId: string;
      email?: string;
      symbol: Player;
    }>;
  };
  players?: Array<{
    userId: string;
    userEmail?: string;
    symbol: Player;
  }>;
  currentTurn?: Player;
  gameOver?: boolean;
  winner?: string;
  users?: UserStat[];
};