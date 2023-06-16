import { createServer } from 'http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import express from 'express';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';

const pubsub = new RedisPubSub({
  connection: {
    host: 'localhost',
    port: 6379,
    db: 0,
  }
});

const app = express();
app.use(express.json());
const httpServer = createServer(app);

const typeDefs = `#graphql
  # Comments in GraphQL strings (such as this one) start with the hash (#) symbol.
  # This "Book" type defines the queryable fields for every book in our data source.
  type Book {
    title: String
    author: String
  }

  type Post {
    comment: String
    author: String
  }

  type Result {
    id: String
  }

  # The "Query" type is special: it lists all of the available queries that
  # clients can execute, along with the return type for each. In this
  # case, the "books" query returns an array of zero or more Books (defined above).
  type Query {
    books: [Book]
    hello: String
  }

  type Subscription {
    greetings: String
    postCreated: Post
    somethingChanged: Result
  }
`;

const books = [
  {
    title: 'The Awakening',
    author: 'Kate Chopin',
  },
  {
    title: 'City of Glass',
    author: 'Paul Auster',
  }
];

const EVENT = {
  SOMETHING_CHANGED: 'something_changed',
}

const resolvers = {
  Query: {
    books: () => books,
    hello: () => {
      pubsub.publish(EVENT.SOMETHING_CHANGED, { somethingChanged: { id: 'OK' } })
      return 'Hello'
    }
  },
  Subscription: {
    greetings: {
      // Example using an async generator
      subscribe: async function* () {
        for await (const word of ['Hello', 'Bonjour', 'Ciao']) {
          yield { greetings: word };
        }
      },
    },
    somethingChanged: {
      subscribe: () => pubsub.asyncIterator(EVENT.SOMETHING_CHANGED)
    }
  },
}


const schema = makeExecutableSchema({ typeDefs, resolvers });
const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql',
});
const serverCleanup = useServer({ schema }, wsServer);

const server = new ApolloServer({
  schema,
  plugins: [
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          }
        }
      }
    }
  ]
})


await server.start();


app.use('/graphql', expressMiddleware(server));

httpServer.listen(4000, () => {
  console.log(`🚀 Server ready at: http://localhost:4000/graphql`);
})
