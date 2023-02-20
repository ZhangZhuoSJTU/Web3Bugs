interface NXTPConfig {
  [key: string]: {
    txManagerAddress: string
  }
}

const config: NXTPConfig = {
  hardhat: {
    txManagerAddress: '0x9492224B81aCf442da114ea1313C0284A584f858',
  },
  mainnet: {
    txManagerAddress: '0x31eFc4AeAA7c39e54A33FDc3C46ee2Bd70ae0A09',
  },
  rinkeby: {
    txManagerAddress: '0x9492224B81aCf442da114ea1313C0284A584f858',
  },
  ropsten: {
    txManagerAddress: '0x8a3E48fD59E201E342D913092e508E539E14674A',
  },
  goerli: {
    txManagerAddress: '0xb6cb4893F7e27aDF1bdda1d283A6b344A1F57D58',
  },
  polygon: {
    txManagerAddress: '0x6090De2EC76eb1Dc3B5d632734415c93c44Fd113',
  },
  xdai: {
    txManagerAddress: '0x115909BDcbaB21954bEb4ab65FC2aBEE9866fa93',
  },
  bsc: {
    txManagerAddress: '0x2A9EA5e8cDDf40730f4f4F839F673a51600C314e',
  },
  fuse: {
    txManagerAddress: '0x31efc4aeaa7c39e54a33fdc3c46ee2bd70ae0a09',
  },
  fantom: {
    txManagerAddress: '0x0D29d9Fa94a23e0D2F06EfC79c25144A8F51Fc4b',
  },
  mumbai: {
    txManagerAddress: '0x46C45F027af8e0F47f6C579f586CD0c6c3E92893',
  },
  arbitrum_rinkeby: {
    txManagerAddress: '0xd14d61FE8E1369957711C99a427d38A0d8Cc141C',
  },
  avax: {
    txManagerAddress: '0x31eFc4AeAA7c39e54A33FDc3C46ee2Bd70ae0A09',
  },
  moonbeam: {
    txManagerAddress: '0x31eFc4AeAA7c39e54A33FDc3C46ee2Bd70ae0A09',
  },
  moon_river: {
    txManagerAddress: '0x373ba9aa0f48b27A977F73423039E6dE341a0C7C',
  },
  arbitrum: {
    txManagerAddress: '0xcF4d2994088a8CDE52FB584fE29608b63Ec063B2',
  },
  optimism: {
    txManagerAddress: '0x31eFc4AeAA7c39e54A33FDc3C46ee2Bd70ae0A09',
  },
}

export default config
