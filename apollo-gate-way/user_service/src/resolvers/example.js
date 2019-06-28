const UserType = require('../utils/enums/UserType')
const Channels = require('../utils/enums/ChannelNames')

const userDB = require('../utils/databases/user.db')

module.exports = {
  Query: {
    getUsers: (_parent, _args, _context, _info) => {
      const users = userDB.getAllUsers()
      return (users.length > 0) ? users : null
    },
    getUser: (_parent, args, _context, _info) => {
      const { name } = args
      return userDB.getUserByName(name)
    },
  },
  Mutation: {
    createUser: (_parent, args, context, _info) => {
      const { userInput } = args
      const { pubsub } = context

      const user = userDB.createUser(userInput)

      pubsub.publish(Channels.USER_ADDED_CHANNEL, { userAdded: user })

      return user
    },
  },
  Subscription: {
    userAdded: {
      subscribe: (_parent, _args, context, _info) => {
        const { pubsub } = context
        return pubsub.asyncIterator(Channels.USER_ADDED_CHANNEL)
      },
    },
  },
  User: {
    __resolveType: (user) => {
      switch (user.type) {
        case UserType.CONSUMER: return 'Consumer'
        case UserType.PRODUCER: return 'Producer'
        default: throw new Error('User could not be identified.')
      }
    },
    __resolveReference(reference) {
      return userDB.getUserById(reference.id)
    },
  },
  Consumer: {
    __resolveReference(reference) {
      return userDB.getUserById(reference.id)
    },
    purchases: ({ purchasedProductIds }) => purchasedProductIds.map(id => ({ __typename: 'Product', id })),
  },
  Producer: {
    __resolveReference(reference) {
      return userDB.getUserById(reference.id)
    },
  },
  UserType: {
    PRODUCER: UserType.PRODUCER,
    CONSUMER: UserType.CONSUMER,
  },
}
