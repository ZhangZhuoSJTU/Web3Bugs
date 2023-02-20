import { Borrow } from '.'
import { now } from '../shared/Helper'

export async function pay(): Promise<Borrow[]> {
  const nt = await now()
  const TestCases = [
    {
      assetIn: 4256603941076597821300000000000000n,
      collateralIn: 2043960857347999192700000000000000n,
      interestIncrease: 21420843164921365138000000000000n,
      cdpIncrease: 618966353867802076160000000000000n,
      maturity: 3291558876n,
      currentTimeStamp: nt,
      borrowAssetOut: 467846458729114903615248164610047n,
      borrowCollateralIn: 1505846136010385633700000000000000n,
      borrowInterestIncrease: 1525106271021345557365248164610047n,
      borrowCdpIncrease: 2286665252333512776185248164610047n,
    },
    {
      assetIn: 3384965145655911321300000000000000n,
      collateralIn: 530704822014748925640000000000000n,
      interestIncrease: 26167398543414326343000000000000n,
      cdpIncrease: 732924719082945454830000000000000n,
      maturity: 3291558876n,
      currentTimeStamp: nt,
      borrowAssetOut: 903665856439458153615248164610047n,
      borrowCollateralIn: 2021334910807891593550000000000000n,
      borrowInterestIncrease: 1287778502096697497115248164610047n,
      borrowCdpIncrease: 2229686069725941086850248164610047n,
    },
    {
      assetIn: 2278995182855247385000000000000000n,
      collateralIn: 1830318292264265316800000000000000n,
      interestIncrease: 8630497076576432368000000000000n,
      cdpIncrease: 1775997773597187752700000000000000n,
      maturity: 3291558876n,
      currentTimeStamp: nt,
      borrowAssetOut: 1456650837839790121765248164610047n,
      borrowCollateralIn: 2430942800147541499100000000000000n,
      borrowInterestIncrease: 2164623575438592195865248164610047n,
      borrowCdpIncrease: 1708149542468819937915248164610047n,
    },
  ]
  return TestCases
}

export interface PayParams {
  ids: bigint[]
  debtIn: bigint[]
  collateralOut: bigint[]
}
