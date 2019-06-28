require('dotenv').config()

const { ApolloServer } = require('apollo-server')
const { ApolloGateway } = require('@apollo/gateway')
const config = require('../config')

const gateway = new ApolloGateway({
  serviceList: [
    { name: 'users', url: 'http://localhost:3001' },
    { name: 'products', url: 'http://localhost:3002' },
  ],
});

(async () => {
  const { schema, executor } = await gateway.load()

  const server = new ApolloServer({
    schema,
    executor,
    context: req => ({
      ...req,
    }),
    playground: {
      endpoint: config.app.playground,
    },
    subscriptions: config.app.subscriptions,
  })

  server.listen({ port: config.app.port, endpoint: config.app.endpoint }).then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`)
  })
})()
