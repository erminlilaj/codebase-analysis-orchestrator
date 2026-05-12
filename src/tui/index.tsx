import React from 'react';
import { render } from 'ink';
import { App } from './App';

const argApi = process.argv.find((a) => a.startsWith('--api-url='))?.slice('--api-url='.length);
const apiUrl = argApi ?? process.env.TUI_API_URL ?? `http://127.0.0.1:${process.env.PORT ?? '3000'}`;

const { waitUntilExit } = render(<App apiUrl={apiUrl} />);

waitUntilExit().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
