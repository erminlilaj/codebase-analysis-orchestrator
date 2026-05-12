import React from 'react';
import { Box, Text } from 'ink';

export const Header: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <Box flexDirection="column" marginBottom={1}>
    <Box>
      <Text bold color="cyan">▸ {title}</Text>
      {subtitle ? <Text dimColor>{'  '}— {subtitle}</Text> : null}
    </Box>
    <Text dimColor>{'─'.repeat(60)}</Text>
  </Box>
);
