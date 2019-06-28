require('dotenv').config()

const { GraphQLServer } = require('graphql-yoga')
const { express: middleware } = require('graphql-voyager/middleware')
const { fileLoader, mergeTypes, mergeResolvers } = require('merge-graphql-schemas')

const fetch = require('node-fetch')
const {
  makeRemoteExecutableSchema,
  introspectSchema,
  mergeSchemas,
  transformSchema,
  RenameTypes,
} = require('graphql-tools')
const WebSocket = require('ws')
const { HttpLink } = require('apollo-link-http')
const { WebSocketLink } = require('apollo-link-ws')
const { RetryLink } = require('apollo-link-retry')
const { SubscriptionClient } = require('subscriptions-transport-ws')
const { getMainDefinition } = require('apollo-utilities')


const path = require('path')
const config = require('../config')

const endpoints = [
  'localhost:3001',
  'localhost:3002',
]

function createHttpLink(url) {
  const uri = `http://${url}${config.app.endpoint}`
  return new HttpLink({ uri, fetch })
}

function createWsLink(url) {
  const wsUri = `ws://${url}${config.app.subscriptions}`
  const wsClient = new SubscriptionClient(
    wsUri,
    {
      reconnect: true,
    },
    WebSocket,
  )

  return new WebSocketLink(wsClient)
}

function createLink(url) {
  const httpLink = createHttpLink(url)
  const wsLink = createWsLink(url)

  const link = new RetryLink()
    .split(
      ({ query }) => {
        const { kind, operation } = getMainDefinition(query)
        return kind === 'OperationDefinition' && operation === 'subscription'
      },
      wsLink,
      httpLink,
    )

  return link
}

(async () => {
  const schemaList = fileLoader(path.join(__dirname, './schemas'))
  const resolverList = fileLoader(path.join(__dirname, './resolvers'))

  const remoteSchemas = await Promise.all(endpoints.map(async (url) => {
    const link = createLink(url)

    return makeRemoteExecutableSchema({
      link,
      schema: await introspectSchema(link),
    })
  }))

  const extendedSchema = mergeTypes(schemaList, { all: true })
  const extendedResolver = mergeResolvers(resolverList, { all: true })

  const fullSchema = mergeSchemas({
    schemas: [
      ...remoteSchemas,
      extendedSchema,
    ],
    resolvers: extendedResolver,
  })

  const transformed = transformSchema(fullSchema, [
    new RenameTypes(typeName => `Gateway_${typeName}`),
  ])

  const server = new GraphQLServer({
    schema: transformed,
    context: req => ({
      ...req,
      remoteSchemas: {
        userSchema: remoteSchemas[0],
        productSchema: remoteSchemas[1],
      },
    }),
  })

  server.express
    .use(config.app.voyager, middleware({ endpointUrl: config.app.endpoint }))

  const options = {
    port: config.app.port,
    playground: config.app.playground,
    endpoint: config.app.endpoint,
    subscriptions: config.app.subscriptions,
    debug: false,
  }

  server
    .start(options, () => console.log(`Server is running on ${config.app.root}:${config.app.port}`))
})()
