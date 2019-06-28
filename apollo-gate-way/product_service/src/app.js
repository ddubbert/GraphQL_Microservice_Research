require('dotenv').config()

const { ApolloServer, gql, PubSub } = require('apollo-server')
const { buildFederatedSchema } = require('@apollo/federation')
const fs = require('fs')
const path = require('path')
const config = require('../config')
const resolvers = require('./resolvers/example')

const types = fs.readFileSync(path.join(__dirname, './schemas/example.graphql'), 'utf8')

const pubsub = new PubSub()

const schema = buildFederatedSchema([{ typeDefs: gql`${types}`, resolvers }])

const server = new ApolloServer({
  schema,
  context: req => ({
    ...req,
    pubsub,
  }),
  playground: {
    endpoint: config.app.playground,
  },
  subscriptions: config.app.subscriptions,
})

server
  .listen({ port: config.app.port, endpoint: config.app.endpoint })
  .then(({ url, subscriptionsPath }) => {
    console.log(url)
    console.log(subscriptionsPath)
    console.log(`Server is running on ${url}`)
  })
