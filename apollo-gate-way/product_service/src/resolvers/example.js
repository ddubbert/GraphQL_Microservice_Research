const { withFilter } = require('graphql-yoga')

const Unit = require('../utils/enums/Unit')
const Channels = require('../utils/enums/ChannelNames')

const productDB = require('../utils/databases/product.db')

module.exports = {
  Query: {
    getProducts: (_parent, args, _context, _info) => {
      const { producerId } = args
      const products = productDB.getProductsMatchingQuery({ producerId })
      return (products.length > 0) ? products : null
    },
    getProductsBoughtBy: (_parent, args, _context, _info) => {
      const { userId } = args
      const products = productDB.getProductsBoughtBy(userId)
      return (products.length > 0) ? products : null
    },
    getProduct: (_parent, args, _context, _info) => {
      const { productId } = args
      return productDB.getProductById(productId)
    },
  },
  Mutation: {
    createProduct: (_parent, args, context, _info) => {
      const { producerId, productInput } = args
      const { pubsub } = context

      const product = productDB.createProductForProducer(producerId, productInput)

      pubsub.publish(Channels.PRODUCT_ADDED_CHANNEL, { productAdded: product })

      return product
    },
  },
  Subscription: {
    productAdded: {
      subscribe: withFilter(
        (_parent, _args, context, _info) => {
          const { pubsub } = context
          return pubsub.asyncIterator(Channels.PRODUCT_ADDED_CHANNEL)
        },
        (payload, variables) => payload.productAdded.producerId === variables.producerId,
      ),
    },
  },
  Product: {
    __resolveReference(reference) {
      return productDB.getProductById(reference.id)
    },
  },
  Unit: {
    QUANTITY: Unit.QUANTITY,
    KILOGRAM: Unit.KILOGRAM,
    LITER: Unit.LITER,
  },
  Producer: {
    products: (producer) => {
      const { id } = producer
      return productDB.getProductsMatchingQuery({ producerId: id })
    }
  }
}