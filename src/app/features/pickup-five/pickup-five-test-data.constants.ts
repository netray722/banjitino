import { PlayerRole } from './pickup-five.types';

export const NBA_TEST_PLAYERS: ReadonlyArray<{
  playerNumber: number;
  displayName: string;
  role: PlayerRole;
}> = [
  { playerNumber: 30, displayName: 'Stephen Curry', role: 'Guard' },
  { playerNumber: 23, displayName: 'Michael Jordan', role: 'Wing' },
  { playerNumber: 6, displayName: 'LeBron James', role: 'Wing' },
  { playerNumber: 24, displayName: 'Kobe Bryant', role: 'Wing' },
  { playerNumber: 32, displayName: 'Magic Johnson', role: 'Guard' },
  { playerNumber: 33, displayName: 'Larry Bird', role: 'Wing' },
  { playerNumber: 34, displayName: "Shaquille O'Neal", role: 'Big' },
  { playerNumber: 21, displayName: 'Tim Duncan', role: 'Big' },
  { playerNumber: 15, displayName: 'Nikola Jokic', role: 'Big' },
  { playerNumber: 35, displayName: 'Kevin Durant', role: 'Wing' },
  { playerNumber: 3, displayName: 'Allen Iverson', role: 'Guard' },
  { playerNumber: 41, displayName: 'Dirk Nowitzki', role: 'Big' },
  { playerNumber: 2, displayName: 'Kawhi Leonard', role: 'Wing' },
  { playerNumber: 11, displayName: 'Kyrie Irving', role: 'Guard' },
  { playerNumber: 14, displayName: 'Oscar Robertson', role: 'Guard' },
  { playerNumber: 13, displayName: 'Wilt Chamberlain', role: 'Big' },
  { playerNumber: 77, displayName: 'Luka Doncic', role: 'Guard' },
  { playerNumber: 0, displayName: 'Jayson Tatum', role: 'Wing' },
  { playerNumber: 5, displayName: 'Jason Kidd', role: 'Guard' },
  { playerNumber: 22, displayName: 'Elgin Baylor', role: 'Wing' }
];
