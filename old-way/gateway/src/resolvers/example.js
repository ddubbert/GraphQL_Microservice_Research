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
