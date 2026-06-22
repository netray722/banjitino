import { NbaTradeGroup } from '../nba.types';

export interface NbaTradeDay {
  date: string;
  trades: NbaTradeGroup[];
}
