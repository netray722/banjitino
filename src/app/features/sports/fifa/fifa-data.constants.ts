export const STAT_DEFINITIONS = [
  { label: 'Shots', aliases: ['shots', 'total shots', 'total attempts', 'attempts on goal'] },
  { label: 'Shots on target', aliases: ['shots on target', 'attempts on target', 'on target'] },
  { label: 'Possession', aliases: ['possession', 'ball possession'], suffix: '%' }
];

export const ESPN_STAT_DEFINITIONS = [
  { name: 'totalShots', label: 'Shots' },
  { name: 'shotsOnTarget', label: 'Shots on target' },
  { name: 'possessionPct', label: 'Possession', suffix: '%' },
  { name: 'wonCorners', label: 'Corners' },
  { name: 'foulsCommitted', label: 'Fouls', lowerIsBetter: true },
  { name: 'yellowCards', label: 'Yellow cards', lowerIsBetter: true },
  { name: 'redCards', label: 'Red cards', lowerIsBetter: true },
  { name: 'offsides', label: 'Offsides', lowerIsBetter: true }
];
