import { constants } from 'ethers'

interface OpticsConfig {
  [chain: string]: {
    [domain: string]: string
  }
}

const config: OpticsConfig = {
  hardhat: {
    1000: constants.AddressZero, // Just an example
  },
  kovan: {
    2000: '0x4071e4E6AB8F8F1620200B7CF0b92ba930D9aBB6', // Kovan
  },
  rinkeby: {
    3000: '0xBfCBCCce35D8a6e8056c92f225768EbBfBbf1293', // Rinkeby
  },
  polygon: {
    6648936: '0xCf9066ee2fF063dD09862B745414c8dEa4Cc0497', // Eth
    1635148152: '0xCf9066ee2fF063dD09862B745414c8dEa4Cc0497', // Avax
    1667591279: '0xCf9066ee2fF063dD09862B745414c8dEa4Cc0497', // Celo
  },
  avax: {
    6648936: '0x101a39eA1143cb252fc8093847399046fc35Db89', // Eth
    1886350457: '0x101a39eA1143cb252fc8093847399046fc35Db89', // Polygon
    1667591279: '0x101a39eA1143cb252fc8093847399046fc35Db89', // Celo
  },
  celo: {
    6648936: '0x913EE05036f3cbc94Ee4afDea87ceb430524648a', // Eth
    1886350457: '0x913EE05036f3cbc94Ee4afDea87ceb430524648a', // Polygon
    1635148152: '0x913EE05036f3cbc94Ee4afDea87ceb430524648a', // Avax
  },
}

export default config
