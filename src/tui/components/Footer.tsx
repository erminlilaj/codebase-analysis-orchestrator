import React from 'react';
import { Box, Text } from 'ink';

export type Hint = { key: string; label: string };

export const Footer: React.FC<{ hints: Hint[] }> = ({ hints }) => (
  <Box marginTop={1} flexDirection="column">
    <Text dimColor>{'─'.repeat(60)}</Text>
    <Box>
      {hints.map((h, i) => (
        <Box key={h.key} marginRight={2}>
          <Text color="yellow">[{h.key}]</Text>
          <Text> {h.label}</Text>
          {i < hints.length - 1 ? <Text dimColor>  </Text> : null}
        </Box>
      ))}
    </Box>
  </Box>
);
