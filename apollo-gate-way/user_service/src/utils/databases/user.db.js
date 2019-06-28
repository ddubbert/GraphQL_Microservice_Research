const uniqid = require('uniqid')
const UserType = require('../enums/UserType')

const users = [
  {
    id: 'd467f50a',
    type: UserType.PRODUCER,
    member_since: new Date(),
    username: 'peter-lustig',
    email: 'peter@lustig.com',
    address: {
      street_name: 'Lustigstraße',
      street_number: '16a',
      city: 'Lustighausen',
      zip_code: '12345',
      country: 'LaLaLand',
    },
    description: 'Leidenschaftlicher Kleingärtner und Ukulelist. Nebenberuflich in der Lehre tätig.',
  },
  {
    id: 'da8ab4c0',
    type: UserType.PRODUCER,
    member_since: new Date(),
    username: 'klaus-dieter',
    email: 'klaus@dieter.com',
    address: {
      street_name: 'Lustigstraße',
      street_number: '16a',
      city: 'Lustighausen',
      zip_code: '12345',
      country: 'LaLaLand',
    },
    description: 'Trotz seiner Größe und Bewegungseinschränkung ein begeisterter Gärtner. Hängt sehr an seinem Bauwagen.',
  },
  {
    id: '8935b480',
    type: UserType.CONSUMER,
    member_since: new Date(),
    username: 'hermann-paschulke',
    email: 'hermann@paschulke.com',
    address: {
      street_name: 'Lustigstraße',
      street_number: '15a',
      city: 'Lustighausen',
      zip_code: '12345',
      country: 'LaLaLand',
    },
    purchasedProductIds: ['b4867cbd', '32abfe84', '44080730']
  },
]

const getAllUsers = () => users

const getAllUsersOfType = userType => users.filter(user => user.type === userType)

const getUsersByIdArray = userIds => users.filter(user => userIds.includes(user.id))

const getUserById = (userId) => {
  const matchingUser = users.filter(user => userId === user.id)
  return (matchingUser.length > 0) ? matchingUser[0] : null
}

const getUserByName = (username) => {
  const matchingUser = users.filter(user => username === user.username)
  return (matchingUser.length > 0) ? matchingUser[0] : null
}

const isProducer = (userId) => {
  const matchingUser = getUserById(userId)
  return matchingUser !== null && matchingUser.type === UserType.PRODUCER
}

const isUser = userId => getUserById(userId) !== null

const isUserInputValid = (input) => {
  const { email, username } = input
  return users
    .every(user => user.username !== username && user.email.toLowerCase() !== email.toLowerCase())
}

const createUser = (userInput) => {
  if (!isUserInputValid(userInput)) throw new Error('Email or Username already taken.')

  const user = {
    ...userInput,
    id: uniqid.time(),
    member_since: new Date(),
  }

  users.push(user)

  return user
}

module.exports = Object.freeze({
  getAllUsers,
  getAllUsersOfType,
  getUserById,
  getUserByName,
  getUsersByIdArray,
  isUser,
  isProducer,
  createUser,
})
