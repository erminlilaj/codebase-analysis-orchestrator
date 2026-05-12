import React from 'react';
import { Box, Text } from 'ink';

export const ProgressBar: React.FC<{
  done: number;
  total: number;
  width?: number;
  failed?: number;
}> = ({ done, total, width = 30, failed = 0 }) => {
  if (total === 0) {
    return <Text dimColor>{'░'.repeat(width)}  0 / 0</Text>;
  }

  const doneCells = Math.round((done / total) * width);
  const failedCells = Math.round((failed / total) * width);
  const remaining = Math.max(0, width - doneCells - failedCells);

  return (
    <Box>
      <Text color="green">{'█'.repeat(doneCells)}</Text>
      <Text color="red">{'█'.repeat(failedCells)}</Text>
      <Text dimColor>{'░'.repeat(remaining)}</Text>
      <Text>  {done}{failed > 0 ? ` (+${failed} failed)` : ''} / {total}</Text>
    </Box>
  );
};
