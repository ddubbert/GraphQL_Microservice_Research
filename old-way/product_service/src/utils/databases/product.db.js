const uniqid = require('uniqid')
const Unit = require('../enums/Unit')

const products = [
  {
    id: 'b4867cbd',
    name: 'Tomate',
    description: 'Peters Traum-Tomate. Komplett Bio.',
    unit: Unit.QUANTITY,
    price_per_unit: 0.50,
    producerId: 'd467f50a',
    boughtBy: ['8935b480'],
  },
  {
    id: '32abfe84',
    name: 'Apfel',
    description: 'Peters Traum-Apfel. Komplett Bio.',
    unit: Unit.KILOGRAM,
    price_per_unit: 1.99,
    producerId: 'd467f50a',
    boughtBy: ['8935b480'],
  },
  {
    id: '44080730',
    name: 'Apfel',
    description: 'Bester Apfel (bestimmt nicht aus Peters Garten....).',
    unit: Unit.QUANTITY,
    price_per_unit: 0.20,
    producerId: 'da8ab4c0',
    boughtBy: ['8935b480'],
  },
  {
    id: 'fee2da81',
    name: 'Apfelsaft',
    description: 'Bester Apfelsaft (Materialien bestimmt nicht aus Peters Garten....).',
    unit: Unit.LITER,
    price_per_unit: 3.50,
    producerId: 'da8ab4c0',
  },
]

const getAllProducts = () => products

const getProductsByIdArray = productIds => products
  .filter(product => productIds.includes(product.id))

const getProductById = (productId) => {
  const matchingProduct = products.filter(product => productId === product.id)
  return (matchingProduct.length > 0) ? matchingProduct[0] : null
}

const isProductMatchingQuery = (product, query) => {
  const updatedQuery = { ...query }
  if (updatedQuery.productId) {
    updatedQuery.id = updatedQuery.productId
    delete updatedQuery.productId
  }

  return Object
    .keys(updatedQuery)
    .every(key => !updatedQuery[key] || product[key] === updatedQuery[key])
}

const getProductsMatchingQuery = (productQuery) => {
  const matchingProducts = products.filter(product => isProductMatchingQuery(product, productQuery))
  return matchingProducts
}

const createProductForProducer = (producerId, productInput) => {
  const product = {
    producerId,
    ...productInput,
    id: uniqid.time(),
  }

  products.push(product)
  return product
}

const getProductsBoughtBy = (userId) => {
  const matchingProducts = products
    .filter(product => product.boughtBy && product.boughtBy.includes(userId))

  return matchingProducts
}

module.exports = Object.freeze({
  getAllProducts,
  getProductById,
  getProductsByIdArray,
  getProductsMatchingQuery,
  createProductForProducer,
  getProductsBoughtBy,
})
