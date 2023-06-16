import { createClient } from 'graphql-ws';
import WebSocket from 'ws';

const client = createClient({
  url: 'ws://localhost:4000/graphql',
  webSocketImpl: WebSocket,
});

(async () => {
  try {
    client.subscribe(
      {
        query: '{ greetings }',
      },
      {
        next: (data) => {
          console.log(data);
        },
        error: (err) => console.log(err),
        complete: () => null,
      }
    );
  } catch (e) {
    console.log(e);
  }
})();
