# Microservices mit GraphQL
Hier werden unterschiedliche Herangehensweisen der Erstellung von Microservices und einem API-Gateway mit GraphQL erläutert. Als Grundlage gilt hier zudem, dass jedes Bestandteil dieser Architektur mit einer GraphQL-Schnittstelle ausgestattet ist. Zunächst wird auf die "altmodische" Art des manuellen Schema-Stitchings in einem API-Gateway eingegangen und anschließend die Herangehensweise mit Apollo-Federation erläutert, welche am 30.05.2019 in seiner ersten Form veröffentlicht wurde. Da Federation noch nicht gänzlich Implementiert ist (noch nicht alle Anforderungen umgesetzt), ist diese Technologie noch nicht vollständig produktiv einsetzbar, wird hier jedoch aufgrund der sehr innovativen und hilfreichen Grundidee erläutert. Neben diesen beiden Ansätzen kann GraphQL natürlich auch als Gateway für unterschiedliche Microservices genutzt werden, welches eine vollständig eigene, ggf. an einen Client angepasste, Schnittstelle anbietet und lediglich über HTTP-Requests oder Websockets auf die Services zugreift um deren Daten abzufragen. Hier wäre dann egal ob diese Services ebenfalls GraphQL oder z.B. REST nutzen. Da dieser Ansatz jedoch keine weiteren Kenntnisse voraussetzt, als GraphQL Grundkenntnisse, wird er hier nicht gesondert aufgeführt.

Zur Erläuterung wird jeweils das selbe Beispiel umgesetzt, welches wie folgt aussieht:

* Es werden zwei Mikroservices und ein Gateway erstellt.
* Der erste Mikroservices verwaltet Nutzer und der zweite Mikroservice Produkte.
* Das vollständige Typensystem des Gateways soll zum Schluss folgende Typen beinhalten:
```javascript
type Query {
  getUsers: [User!]
  getUser(name: String!): User
  getProductsOfProducer(producerId: ID!): [Product!]
  getProductsBoughtBy(userId: ID!): [Product!]
  getProduct(productId: ID!): Product
}

type Mutation {
  createUser(userInput: UserCreateInput!): User!
  createProduct(producerId: ID!, productInput: ProductCreateInput!): Product!
}

type Subscription {
  userAdded: User!
  productAdded(producerId: ID!): Product!
}

interface User {
  id: ID!
  username: String!
  email: String!
  type: UserType!
}

type Consumer implements User {
  id: ID!
  username: String!
  email: String!
  type: UserType!
  purchases: [Product!]
}

type Producer implements User {
  id: ID!
  username: String!
  email: String!
  type: UserType!
  products: [Product!]
}

input UserCreateInput {
  username: String!
  email: String!
  type: UserType!
}

enum UserType {
  PRODUCER
  CONSUMER
}

type Product {
  id: ID!
  name: String!
  unit: Unit!
  price_per_unit: Float!
  description: String
}

input ProductCreateInput {
  name: String!
  unit: Unit!
  price_per_unit: Float!
  description: String
}

input ProductQueryInput {
  name: String
  productId: ID
  producerId: ID
}

enum Unit {
  QUANTITY
  LITER
  KILOGRAM
}
```

## Manuelles Schema-Stitching
Die vollständigen Code-Beispiele können in [diesem GitHub-Repo](https://github.com/ddubbert/GraphQL_Microservice_Research) eingesehen und zum ausprobieren heruntergeladen werden.
### Aufbau der Services
In jedem Service werden lediglich die Typen definiert, welche im direkten Zusammenhang mit der Thematik des Services stehen. Im User-Service werden dementsprechend alle User spezifischen Typen definiert, jedoch noch keine Produkte referenziert (da dieser Service nicht für Produkte zuständig ist). Das Typensystem dieses Services sieht somit wie folgt aus:

```javascript
type Query {
  getUsers: [User!]
  getUser(name: String!): User
}

type Mutation {
  createUser(userInput: UserCreateInput!): User!
}

type Subscription {
  userAdded: User!
}

interface User {
  id: ID!
  username: String!
  email: String!
  type: UserType!
}

type Consumer implements User {
  id: ID!
  username: String!
  email: String!
  type: UserType!
}

type Producer implements User {
  id: ID!
  username: String!
  email: String!
  type: UserType!
}

input UserCreateInput {
  username: String!
  email: String!
  type: UserType!
}

enum UserType {
  PRODUCER
  CONSUMER
}
```

Auch wenn ein Produzent natürlich Produkte anbieten wird, so werden diese im Produkt-Service definiert und der Zusammenhang zwischen Usern und Produkten erst im Gateway ergänzt. Das Typensystem des Produkt-Services ist nun wie folgt aufgebaut:

```javascript
type Query {
  getProductsOfProducer(producerId: ID!): [Product!]
  getProductsBoughtBy(userId: ID!): [Product!]
  getProduct(productId: ID!): Product
}

type Mutation {
  createProduct(producerId: ID!, productInput: ProductCreateInput!): Product!
}

type Subscription {
  productAdded(producerId: ID!): Product!
}

type Product {
  id: ID!
  name: String!
  unit: Unit!
  price_per_unit: Float!
  description: String
}

input ProductCreateInput {
  name: String!
  unit: Unit!
  price_per_unit: Float!
  description: String
}

input ProductQueryInput {
  name: String
  productId: ID
  producerId: ID
}

enum Unit {
  QUANTITY
  LITER
  KILOGRAM
}
```

Die Implementierung der Resolver, sowie das Starten der Services wird in diesem Abschnitt nicht besprochen, da es sich von der herkömmlichen Herangehensweise nicht unterscheidet. Der Quellcode des hier genannten Beispiels findet sich jedoch [hier](https://github.com/ddubbert/GraphQL_Microservice_Research), sodass diese Aspekte stets einsehbar sind.

Beim manuellen Schema-Stitching ist das wichtigste darauf zu achten, dass in den Services keine Typ-Dopplungen auftreten (Typen, welche in unterschiedlichen Services definiert werden), da dann bei dem späteren Stitching ein Fehler geworfen wird. Dennoch kann es teilweise von Vorteil sein, Referenzen zu Objekten von anderen Services zu speichern, da jeder Service auch gesondert vom Gateway verwendet werden könnte. In diesem Beispiel könnte beispielsweise eine Referenz vom Producer auf dessen Produkte hilfreich sein. In diesem Falle kann dem Producer ein Attribut "productIds: [ID!]" hinzugefügt werden, welches lediglich die IDs der Produkte beinhaltet und nicht Objekte vom Typ Produkt selbst. Optional können diese zudem noch mit dem @deprecated-[Directive](https://www.apollographql.com/docs/graphql-tools/schema-directives/) oder einem eigen definierten Directive versehen werden, um anzuzeigen, dass im Gateway eine bessere Alternative geboten wird.

### Gateway: Remote-Schemas
Die erste Aufgabe des Gateways ist die Sammlung und Verschmelzung aller Service-Schemas. Weiterhin muss es sicherstellen, dass ein Aufruf an den jeweiligen Service weitergeleitet wird (welche dann als Remote-Schema bezeichnet werden). Hierzu können die Funktion "introspectSchema", "makeRemoteExecutableSchema" sowie "mergeSchemas" des [graphql-tools](https://github.com/apollographql/graphql-tools)-Moduls von Apollo genutzt werden. Weiterhin wird ein fetch-Modul (hier [node-fetch](https://www.npmjs.com/package/node-fetch)) und ein Link-Modul für die Weiterleitungen der Anfragen benötigt (Apollo bieten auch hierfür eigene Implementierungen mit [apollo-link](https://github.com/apollographql/apollo-link)).

Zunächst müssen HttpLinks angelegt werden, welche als Verknüpfung zu den Endpunkten der Services dienen. Diese benötigten die URI des Endpunktes und einen Fetcher.

```javascript
const { HttpLink } = require('apollo-link-http')
const fetch = require('node-fetch')

function createHttpLink(urlToEndpoint) {
  return new HttpLink({ uri: urlToEndpoint, fetch })
}

const endpoints = [
  'http://localhost:3001/graphql', // user service
  'http://localhost:3002/graphql', // product service
]
```

Anschließend können mithilfe dieser Links zunächst die Schemas der Services angefragt (introspectSchema) und anschließend ein Remote-Schema erstellt werden (makeRemoteExecutableSchema), welche nun einen Aufruf direkt an den jeweiligen Service weiterleiten.

```javascript
const {
  makeRemoteExecutableSchema,
  introspectSchema,
} = require('graphql-tools')

(async () => {

  const remoteSchemas = await Promise.all(endpoints.map(async (url) => {
    const link = createHttpLink(url)

    return makeRemoteExecutableSchema({
      link,
      schema: await introspectSchema(link),
    })
  }))

})()
```

Abschließend müssen nun lediglich die Remote-Schemas zu einem einzigen Schema vereint werden (mergeSchemas). Anschließend kann das Gateway gestartet und genutzt werden.

```javascript
const { GraphQLServer } = require('graphql-yoga')

const { mergeSchemas } = require('graphql-tools')

(async () => {

  const remoteSchemas = ... // siehe oben

  const fullSchema = mergeSchemas({
    schemas: remoteSchemas,
  })

  const server = new GraphQLServer({
    schema: fullSchema,
  })

  const options = {
    port: 3000,
  }

  server.start(options, () => console.log('Server is running on http://localhost:3000'))

})()
```

Auf diese Weise werden nun die Schnittstellen der Services vollständig über das Gateway angeboten.

### Gateway: Extensions
Im Gateway können die Typen der unterschiedlichen Services nun auch mit dem "extend"-Schlagwort erweitert werden. Auf diese Weise sind nun die benötigten Verbindungen zwischen Typen unterschiedlicher Services einzubinden. Hierzu muss nun zuerst eine weitere Typ-Definition im Gateway erstellt werden.

```javascript
// extendTypes.graphql

extend type Consumer {
    purchases: [Product!]
}

extend type Producer {
    products: [Product!]
}
```

Hier wurden nun dem Consumer ein Array von Produkten die er bereits gekauft hat und dem Producer ein Array von Produkten die er anbietet hinzugefügt. Diese neuen Attribute benötigen jetzt jedoch wiederum Resolver, da das Gateway noch nicht weiß, wie es an die benötigten Daten gelangen kann. In diesen Resolvern wird nun auf den Produkt-Service zugegriffen um die jeweiligen Produkte zu erhalten. Im Falle des Consumer-Feldes "purchases" wird die getProductsBoughtBy(userId: ID!)-Query verwendet und im Falle des Producer-Feldes "products" die getProductsOfProducer(producerId: ID!)-Query. Beide Queries sind bereits in unserem Remote-Schema für den Produkt-Service enthalten, sodass wir diese Aufrufe einfach an dieses Schema delegieren können (über das infor-Objekt -> info.mergeInfo.delegateToSchema()). Hier muss das Remote-Schema, sowie die auszuführende Query angegeben werden.

```javascript
// app.js
const server = new GraphQLServer({
    schema: fullSchema,
    context: () => ({
      remoteSchemas: {
        userSchema: remoteSchemas[0],
        productSchema: remoteSchemas[1],
      },
    }),
  })

// Resolver
module.exports = {
  Producer: {
    products: {
      fragment: '... on Producer { id }',
      resolve(producer, _args, context, info) {
        const { remoteSchemas } = context

        return info.mergeInfo.delegateToSchema({
          schema: remoteSchemas.productSchema,
          operation: 'query',
          fieldName: 'getProducts',
          args: {
            producerId: producer.id,
          },
          context,
          info,
        })
      },
    },
  },
  Consumer: {
    purchases: {
      fragment: '... on Consumer { id }',
      resolve(consumer, _args, context, info) {
        const { remoteSchemas } = context

        return info.mergeInfo.delegateToSchema({
          schema: remoteSchemas.productSchema,
          operation: 'query',
          fieldName: 'getProductsBoughtBy',
          args: {
            userId: consumer.id,
          },
          context,
          info,
        })
      },
    },
  },
}
```

Damit die Resolver Zugriff auf die Remote-Schemas haben, wurden diese beim Serverstart an das context-Objekt gebunden. Weiterhin benötigen diese Queries immer spezielle Attribute von dem jeweiligen User, um die passenden Produkte herauszufinden. Damit diese zuvor stets vom User-Service angefragt werden, selbst wenn ein Client diese nicht selbst angefragt hat, kann ein Fragment definiert werden. In diesem Fragment wird die Attribute angegeben, welche für die Ausführung dieses Resolvers benötigt werden (hier jeweils das id-Feld vom Consumer bzw. Producer).

Nun müssen bei der Verschmelzung der Schemas zusätzlich die erweiterten Typen und Resolver angegeben werden.
```javascript
// app.js
(async () => {
  ...

  const remoteSchemas = // create Remote Schemas
  const extendedSchema = // get new (extend) Schema
  const extendedResolver = // get new Resolvers

  const fullSchema = mergeSchemas({
    schemas: [
      ...remoteSchemas,
      extendedSchema,
    ],
    resolvers: extendedResolver,
  })

  ...
})()
```

Nun wurden die bestehenden Typen in der Gateway-Schnittstelle mit den neuen Attributen erweitert. (Das Gateway ist nichts Anderes als ein normaler GraphQL-Server, also könnten hier auch neue Typen erstellt werden, falls nötig)

### Gateway: Subscriptions
Die bestehende Lösung funktioniert für jegliche Art von Queries und Mutations, also für alle einfachen HTTP-Requests, jedoch nicht für Subscriptions, welche auf WebSockets basieren. Damit diese funktionieren, muss neben dem HttpLink zudem ein [WebSocketLink](https://www.apollographql.com/docs/link/links/ws/) verwendet werden. Dieser benötigt einen WebSocket-Client, welcher hier mithilfe von [subscriptions-transport-ws](https://github.com/apollographql/subscriptions-transport-ws) von Apollo erstellt wird.

```javascript
const WebSocket = require('ws')
const { SubscriptionClient } = require('subscriptions-transport-ws')
const { WebSocketLink } = require('apollo-link-ws')

function createWsLink(urlToWsEndpoint) {
  const wsClient = new SubscriptionClient(
    urlToWsEndpoint,
    {
      reconnect: true,
    },
    WebSocket,
  )

  return new WebSocketLink(wsClient)
}
```

Da ein Remote-Schema lediglich einen Link entgegen nimmt, wird folglich ein dritter (Retry-) Link erstellt, welcher den HttpLink und den WebSocketLink nutzt und je nach Anfrage entscheidet, welcher zu nutzen ist (ist die Operation eines Query-Objektes 'subscription' der WebSocketLink, ansonsten der HttpLink).

```javascript
const { RetryLink } = require('apollo-link-retry')
const { getMainDefinition } = require('apollo-utilities')

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
```

Dieser Link kann nun an das jeweilige Remote-Schema übergeben und anschließend auch dessen Subscriptions genutzt werden.

### Gateway: Transforms
Extensions ermöglichen die Erweiterung von Typen eines Schemas, mit [Transformationen](https://www.apollographql.com/docs/graphql-tools/schema-transforms/) kann ein Schema jedoch auch vollständig verändert werden. Hierfür werden die Schemata direkt angepasst und nicht erst durch die Verschmelzung mit einem weiteren Schema ergänzt. Vom [graphql-tools](https://www.apollographql.com/docs/graphql-tools/)-Modul werden bereits einige vorgefertigte Transformationen angeboten, welche z.B. das Umbenennen und Entfernen von Typen beinhalten (siehe [hier](https://www.apollographql.com/docs/graphql-tools/schema-transforms/)). Es können jedoch auch eigene Transformationen definiert werden (ebenfalls [hier](https://www.apollographql.com/docs/graphql-tools/schema-transforms/) einzusehen). Im folgenden Beispiel werden mithilfe der RenameType-Transormation die Typen der Services mit einem Prefix versehen um Namenskonflikte zu vermeiden (dies ist kein Best-Practice und soll lediglich die Anwendung solcher Transformationen präsentieren):

```javascript
const {
  mergeSchemas,
  transformSchema,
  RenameTypes,
} = require('graphql-tools')

...

const userSchema = // get user schema
const productSchema = // get product schema

const prefixedUserSchema = transformSchema(userSchema, [
  new RenameTypes(typeName => `UserService_${typeName}`),
])

const prefixedProductSchema = transformSchema(productSchema, [
  new RenameTypes(typeName => `ProductService_${typeName}`),
])

const fullSchema = mergeSchemas({
  schemas: [
    prefixedUserSchema,
    prefixedProductSchema,
  ]
})

...
```

## Apollo Federation
Apollo Federation ermöglicht es Services die Typen anderer Services zu referenzieren und mit Feldern anzureichern. Durch diese Art der Vernetzung kann jeder Service vollständig entkoppelt aufgebaut werden und es entfällt der Aufwand für die manuelle Zusammenführung im Gateway. (siehe [Apollo-Docs: Federation](https://www.apollographql.com/docs/apollo-server/federation/introduction/))

Die vollständigen Code-Beispiele können in [diesem GitHub-Repo](https://github.com/ddubbert/GraphQL_Microservice_Research) eingesehen und zum ausprobieren heruntergeladen werden.

### Service: Keys
Mit Federation wurde das Key-Directive hinzugefügt, welches eine Entität / einen Typen für andere Services erreichbar macht.

```javascript
interface User @key(fields: "id") {
    id: ID!
    member_since: DateTime!
    username: String!
    email: String!
    address: Address!
    type: UserType!
}
```

In diesem Beispiel wurde das Interface User des User-Services auch für andere Services sichtbar gemacht. Um diesen zu erreichen muss der andere Service lediglich dessen id-Attribut kennen. Solche Keys müssen immer Einzigartig sein. Es können pro Entität auch mehrere Keys angegeben werden. Im folgenden Beispiel ist ein User auch über dessen einzigartiges username-Feld suchbar:

```javascript
interface User @key(fields: "id") @key(fields: "username"){
    id: ID!
    member_since: DateTime!
    username: String!
    email: String!
    address: Address!
    type: UserType!
}
```

Keys können auch komponiert werden und auf verschachtelte Attribute zugreifen. In dem folgenden Beispiel (entnommen aus den [Apollo-Docs](https://www.apollographql.com/docs/apollo-server/federation/advanced-features/)), ist ein User nur innerhalb seiner Organisation einzigartig, sodass dessen id, zusammen mit der id der Organisation den Key ergeben:

```javascript
type User @key(fields: "id organization { id }") {
  id: ID!
  organization: Organization!
}

type Organization {
  id: ID!
}
```
Zu jeder @key-Directive muss ein entsprechender Resolver geschaffen werden, welcher die Entität anhand des Keys ermittelt und zurückgibt. Für das User-Interface ist dieser wie folgt aufgebaut:

```javascript
User: {
  __resolveReference(reference) {
    return userDB.getUserById(reference.id)
  },
},
```

Der Resolver erhält ein Referenz-Objekt, in welchem sich das als Key ausgewählte Feld befindet. Mit diesem Key kann er nun auf die User-Datenbank zugreifen und die gewünschte Entität zurückgeben.

### Service: Typen referenzieren
Um externe Typen anderer Services referenzieren zu können, muss ein Service zunächst eine eigene Repräsentation dieses Typen erstellen, auch Stub-Type genannt. Hierbei muss jedoch nur das als Key ausgewählte Attribut angegeben werden. Wichtig ist zudem, dass die Signatur des Typen mit dem extends-Symbol und einem Key-Directive versehen wird. In diesem Key-Directive muss der Key des Typen angegeben werden, welcher durch den Service angeboten wird (nicht alle möglichen Keys).

```javascript
// Product-Service
type Product @key(fields: "id") @key(fields: "name"){
    id: ID!
    name: String!
    unit: Unit!
    price_per_unit: Float!
    description: String
}

// User-Service
extend type Product @key(fields: "id") {
  id: ID! @external
}

type Consumer implements User @key(fields: "id") {
    id: ID!
    purchases: [Product!]
}
```

In diesem Code-Beispiel gibt ein Produkt-Service seinen Produkt-Typen nach außen frei. Der User-Service referenziert diesen Typen, nutzt hierbei jedoch lediglich das Key-Feld id. Dieses Feld ist zusätzlich mit dem @external-Directive versehen worden, was aussagt, dass das Feld bzw. der Typ des Feldes extern definiert wurde (in diesem Falle ist der Typ ID! und wurde im Produkt-Service definiert). Nur Felder, welche als Key definiert wurden, oder in einem @requires- und @provides-Directive genannt wurden (siehe [Weitere Directives](#weitere-directives)), dürfen als externes Feld übernommen werden. Anschließend kann der User-Service den Product-Typen nutzen, als hätte er diesen selber erstellt. 

Damit diese Referenz jetzt jedoch aufgelöst werden kann, muss zum einen der Produkt-Service angeben, wie eine Entität anhand ihres Keys gefunden werden kann (siehe __resolveReference-Resolver in dem vorherigen Unterkapitel). Weiterhin muss jedoch auch der User-Service angeben, wie er bei einer Anfrage an das Key-Feld bzw. dessen Wert gelangt, welches benötigt wird um die Entität anzufragen. Dies geschieht mithilfe eines einfachen Feld-Resolvers, welcher eine abstrakte Repräsentation der Entität zurück gibt. Diese Repräsentation muss stets den Namen des Feld-Typen und den Key beinhalten: ```{ __typename: "TypName", key: Value }```. Für das obere Beispiel würde er etwas anders aussehen. Hier wird ein Array von Produkten referenziert also muss auch ein Array dieser abstrakten Form zurückgegeben werden:

```javascript
Consumer: {
  purchases: consumer => consumer.purchasedProductIds.map(id => ({ __typename: 'Product', id }))
}
```
(In der Datenbank hält der Service zu jedem Konsumenten die von ihm gekauften Produkte als Id-Array unter dem purchasedProductIds-Attribut)

### Service: Typen erweitern
Mithilfe der Stub-Types können externe Typen auch erweitert werden. Hierzu muss ein Service diesen Stub-Typen um weitere Felder ergänzen, ohne diese mit dem @external-Directive zu versehen. So ist bekannt, dass diese Felder nicht zu dem Originaltypen gehören und lediglich von dem Service, in welchem sie definiert wurden, angeboten werden. Im folgenden Beispiel ergänzt der Produkt-Service den Produzenten, welcher vom User-Service definiert wurde, um das Feld products, welches die angebotenen Produkte dieses Produzenten darstellen soll.

```javascript
// User-Service types
type Producer implements User @key(fields: "id") {
    id: ID!
    member_since: DateTime!
    username: String!
    email: String!
    address: Address!
    type: UserType!
}

// Product-Service types
extend type Producer @key(fields: "id") {
  id: ID! @external
  products: [Product!]
}
```

Nun muss der Produkt-Service zusätzlich einen Resolver implementieren, welcher für den Produzenten die Produkte ermittelt. Dieser erhält den referenzierten Produzenten, jedoch lediglich dessen Felder, welche als Key angegeben wurden.

```javascript
Producer: {
  products: (producer) => {
    const { id } = producer
    return productDB.getProductsMatchingQuery({ producerId: id })
  }
}
```

### Service: Queries, Mutations, Scalars, Enums
Da Queries und Mutations Root-Types sind, welche in jedem Service geschrieben werden müssen, sind diese in den Services stets mit dem extends-Symbol zu kennzeichnen. Im Gateway werden diese Typen einmal definiert und mit den Extensions angereichert.

Scalar-Typen und Enums können zwischen Services geteilt und trotzdem normal ohne extends deklariert werden. Wichtig bei Enums ist jedoch, dass die Deklarationen stets identisch sind (auch wenn ein Service eine gewisse Ausprägung nicht benötigt muss er diese trotzdem angeben). Scalar-Typen sollten ebenfalls in jedem Service identisch umgesetzt sein, um einen gleichmäßigen Umgang mit diesen zu ermöglichen.

### Weitere Directives
Neben den @key- und @external-Directives wurden mit Federation noch zwei weitere Directives integriert: @requires und @provides.

Das @requires-Directive kann genutzt werden, wenn ein Typ erweitert werden soll, hierfür jedoch weitere Felder abseits der Keys benötigt werden. Im folgenden Beispiel werden die Namen der Produkte zusätzlich mit dem Namen des Produzenten angereichert. Hierfür wird jedoch neben der Id des Produzenten auch sein Name benötigt, welcher nun im @requires-Directive angegeben wird. Zusätzlich muss nun der Stub-Type um das username-Feld mit dem @external-Directive ergänzt werden.

```javscript
// Product-Service types
extend type Producer @key(fields: "id") {
  id: ID! @external
  username: String! @external
  products: [Product!] @requires(fields: "username")
}

// Product-Service resolvers
Producer: {
  products: (producer) => {
    const { id, username } = producer
    const products = productDB.getProductsMatchingQuery({ producerId: id })
    return products.map(product => ({ ...product, name: `${username}_${product.name}` }))
  },
},
```

Das @provides-Directive dient der Reduzierung von unnötiger Kommunikation zwischen Services. Kann ein Service bereits Felder eines referenzierten Typen ausliefern, so kann er diese mit dem @provides-Feld kennzeichnen. Bei einer Anfrage werden nun unnötige Anfragen für diese Felder vermieden und stattdessen die Daten des Services genutzt. Hätte das Produkt beispielsweise eine Referenz des Produzenten und der Produkt-Service zu jedem Produkt den Produzenten-Namen, sowie das Key-Feld id, so könnte dies mithilfe des @provides-Directives wie folgt aussehen:

```javascript
// Product-Service types
type Product @key(fields: "id"){
    id: ID!
    name: String!
    unit: Unit!
    price_per_unit: Float!
    description: String
    producer: Producer! @provides(fields: "username")
}

extend type Producer @key(fields: "id") {
  id: ID! @external
  username: String! @external
}

// Product-Service resolvers
Product: {
  producer: product => ({ id: product.producerId, username: product.producerName }),
},
```

Wichtig ist nun, dass in dem Resolver neben dem Key-Feld (hier id) auch der username des Produzenten zurückgegeben wird. Wird nun ein Produkt angefragt und von dessen Produzenten lediglich der username, so wird keine weitere Anfrage an den User-Service benötigt.

### Service: Server starten
Beim starten eines Services, welcher mit Apollo-Federation erstellt wurde, muss das Schema mithilfe der [buildFederatedSchema-Funktion](https://www.apollographql.com/docs/apollo-server/api/apollo-federation/#buildfederatedschema) des Moduls [@apollo/federation](https://www.npmjs.com/package/@apollo/federation) erstellt werden, da diese die zuvor genannten Directives integriert. 

```javascript
const { ApolloServer } = require('apollo-server')
const { buildFederatedSchema } = require('@apollo/federation')

const typeDefs = // get types
const resolvers = // get resolvers
const schema = buildFederatedSchema([{ typeDefs, resolvers }])

const server = new ApolloServer({ schema })

server
  .listen({ port: config.app.port, endpoint: config.app.endpoint })
  .then(({ url }) => {
    console.log(`Server is running on ${url}`)
  })
```

Mithilfe dieser Funktion können auch mehrere Schema-Module zu einem Schema zusammengefügt werden, welches dem Federation-Prinzip folgt.

### Gateway
Das Gateway übernimmt nun lediglich die Rolle diese Federation-Services zu einer Schnittstelle zusammen zu fassen. Weitere Vernetzungen müssen entgegengesetzt zum Schema-Stitching Ansatz im Gateway nicht mehr vollzogen werden. Hierfür bietet das Modul [@apollo/gateway](https://www.npmjs.com/package/@apollo/gateway) mit ApolloGateway die Möglichkeit, solch ein Gateway anhand von verschiedenen Service-Links aufzubauen.

```javascript
const { ApolloGateway } = require('@apollo/gateway')

const gateway = new ApolloGateway({
  serviceList: [
    { name: 'users', url: 'http://localhost:3001' },
    { name: 'products', url: 'http://localhost:3002' },
  ],
})
```

Zu jedem Service wird eine Url und ein Name angegeben, wobei Letzterer vorwiegend für debug-Zwecke vorhanden ist. Anpassungsmöglichkeiten beim Erstellen eines Gateways können [hier](https://www.apollographql.com/docs/apollo-server/api/apollo-gateway/) eingesehen werden.

Nachdem das Gateway erstellt wurde kann es einem mithilfe der load-Methode die Typdefinitionen und Executors (Resolvers) erstellen, welche anschließend zum starten eines GraphQL-Servers genutzt werden können.

```javascript
// Vollständiger Gateway-Code

const { ApolloServer } = require('apollo-server')
const { ApolloGateway } = require('@apollo/gateway')

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
    executor
  })

  server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`)
  })
})()
```

Nun ist das Gateway vollständig einsatzbereit. Werden neben diesen Queries und Mutations auch Subscriptions benötigt, welche Federation noch nicht unterstützt, so kann der Workaround aus diesem [Apollo Issue](https://github.com/apollographql/apollo-server/issues/2776#issuecomment-503361983) verfolgt werden.
