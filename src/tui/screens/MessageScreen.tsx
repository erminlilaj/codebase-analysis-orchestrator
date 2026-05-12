import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { NavigationApi } from '../navigation';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

export const MessageScreen: React.FC<{
  nav: NavigationApi;
  title: string;
  body: string;
}> = ({ nav, title, body }) => {
  useInput((_input, key) => {
    if (key.return || key.escape) nav.pop();
  });

  return (
    <Box flexDirection="column">
      <Header title={title} />
      <Box flexDirection="column" marginBottom={1}>
        {body.split('\n').map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </Box>
      <Footer hints={[{ key: '⏎', label: 'back' }, { key: 'esc', label: 'back' }]} />
    </Box>
  );
};
