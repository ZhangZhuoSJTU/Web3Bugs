import { providers, Contract, Signer, BigNumber, constants } from 'ethers';
import {
  ICSSRRouter,
  MochiEngine,
  Mochi,
  USDM,
  MinterV0,
  VMochi,
  MochiProfileV0,
  DiscountProfileV0,
  NoDiscountProfile,
  DutchAuctionLiquidator,
  FeePoolV0,
  NoMochiFeePool,
  ReferralFeePoolV0,
  NoMochiReferralFeePool,
  MochiTreasuryV0,
  MochiVaultFactory,
  MochiNFT,
} from './types';
import {
  ICSSRRouter__factory,
  MinterV0__factory,
  MochiEngine__factory,
  MochiVault__factory,
  Mochi__factory,
  USDM__factory,
  VMochi__factory,
  MochiProfileV0__factory,
  DiscountProfileV0__factory,
  NoDiscountProfile__factory,
  DutchAuctionLiquidator__factory,
  FeePoolV0__factory,
  NoMochiFeePool__factory,
  ReferralFeePoolV0__factory,
  NoMochiReferralFeePool__factory,
  MochiTreasuryV0__factory,
  MochiVaultFactory__factory,
  MochiNFT__factory,
} from './types';

interface AuctionDetail {
  auctionId: BigNumber;
  nftId: BigNumber;
  vault: string;
  startedAt: BigNumber;
  collateral: BigNumber;
  debt: BigNumber;
  price: BigNumber;
}

export class MochiCore {
  deployer: Signer;
  provider: providers.Provider;

  engine: MochiEngine;
  vaultFactory: MochiVaultFactory;
  nft: MochiNFT;
  //asset
  mochi: Mochi;
  usdm: USDM;
  minter: MinterV0;
  vMochi: VMochi;
  //profile
  mochiProfile: MochiProfileV0;
  discountProfile: NoDiscountProfile;

  //liquidator
  liquidator: DutchAuctionLiquidator;
  //feePool
  feePool: NoMochiFeePool;
  referralFeePool: NoMochiReferralFeePool;
  //treasury
  treasury: MochiTreasuryV0;
  cssr: ICSSRRouter;

  constructor(provider: providers.Provider, deployer: Signer) {
    this.deployer = deployer;
    this.provider = provider;
  }

  async setEngine(engine: string) {
    this.engine = MochiEngine__factory.connect(engine, this.provider);
    this.usdm = USDM__factory.connect(await this.engine.usdm(), this.provider);
    this.mochiProfile = MochiProfileV0__factory.connect(
      await this.engine.mochiProfile(),
      this.provider,
    );
    this.discountProfile = NoDiscountProfile__factory.connect(
      await this.engine.discountProfile(),
      this.provider,
    );
    this.liquidator = DutchAuctionLiquidator__factory.connect(
      await this.engine.liquidator(),
      this.provider,
    );
    this.feePool = NoMochiFeePool__factory.connect(
      await this.engine.feePool(),
      this.provider,
    );
    this.referralFeePool = NoMochiReferralFeePool__factory.connect(
      await this.engine.referralFeePool(),
      this.provider,
    );
    this.treasury = MochiTreasuryV0__factory.connect(
      await this.engine.treasury(),
      this.provider,
    );
    this.cssr = ICSSRRouter__factory.connect(
      await this.engine.cssr(),
      this.provider,
    );
    this.vaultFactory = MochiVaultFactory__factory.connect(
      await this.engine.vaultFactory(),
      this.provider,
    );
    this.nft = MochiNFT__factory.connect(
      await this.engine.nft(),
      this.provider,
    );
  }

  printAddress() {
    console.log('engine : ' + this.engine.address);
    console.log('vaultFactory : ' + this.vaultFactory.address);
    console.log('nft : ' + this.nft.address);
    console.log('treasury : ' + this.treasury.address);
    console.log('usdm : ' + this.usdm.address);
    console.log('mochiProfile : ' + this.mochiProfile.address);
    console.log('discountProfile : ' + this.discountProfile.address);
    console.log('liquidator : ' + this.liquidator.address);
    console.log('feePool : ' + this.feePool.address);
    console.log('referralFeePool : ' + this.referralFeePool.address);
  }

  async deployAssets() {
    // assets
    this.mochi = await new Mochi__factory(this.deployer).deploy();
    this.vMochi = await new VMochi__factory(this.deployer).deploy(
      this.mochi.address,
    );

    await this.engine.changeMochi(this.mochi.address);
    await this.engine.changeVMochi(this.vMochi.address);
  }

  async deployTemplate() {
    const template = await new MochiVault__factory(this.deployer).deploy(
      this.engine.address,
    );

    await this.vaultFactory
      .connect(this.deployer)
      .updateTemplate(template.address);
    await this.printAddress();
  }

  async changeTreasury(address : string) {
    await this.engine.connect(this.deployer).changeTreasury(address);
  }

  async deployMinter() {
    this.minter = await new MinterV0__factory(this.deployer).deploy(
      this.engine.address,
    );
    console.log("minter : " + this.minter.address);
    await this.engine.connect(this.deployer).changeMinter(this.minter.address);
  }

  async deployProfile() {
    // profiles
    this.mochiProfile = await new MochiProfileV0__factory(this.deployer).deploy(
      this.engine.address,
    );
    await this.engine
      .connect(this.deployer)
      .changeProfile(this.mochiProfile.address);
  }

  async deployUSDM() {
    this.usdm = await new USDM__factory(this.deployer).deploy(
      this.engine.address,
    );
    await this.engine.connect(this.deployer).changeUSDM(this.usdm.address);
  }

  async deployDiscountProfile() {
    this.discountProfile = await new NoDiscountProfile__factory(
      this.deployer,
    ).deploy();
    await this.engine
      .connect(this.deployer)
      .changeDiscountProfile(this.discountProfile.address);
  }

  async deployLiquidator() {
    this.liquidator = await new DutchAuctionLiquidator__factory(
      this.deployer,
    ).deploy(this.engine.address);
    await this.engine
      .connect(this.deployer)
      .changeLiquidator(this.liquidator.address);
  }

  async deployFeePool() {
    this.feePool = await new NoMochiFeePool__factory(this.deployer).deploy(
      await this.deployer.getAddress(),
      this.engine.address,
    );
    await this.engine.connect(this.deployer).changeFeePool(this.feePool.address);
  }

  async deployReferralFeePool() {
    this.referralFeePool = await new NoMochiReferralFeePool__factory(
      this.deployer,
    ).deploy(this.engine.address);
    await this.engine.connect(this.deployer).changeReferralFeePool(this.referralFeePool.address);
  }

  async deployNft() {
    this.nft = await new MochiNFT__factory(this.deployer).deploy(
      this.engine.address,
    );

    await this.engine.connect(this.deployer).changeNFT(this.nft.address);
  }

  async deploy(treasury: string, uniswap: string) {
    // deploy engine
    this.engine = await new MochiEngine__factory(this.deployer).deploy(
      await this.deployer.getAddress(),
    );
    await this.engine.connect(this.deployer).changeTreasury(treasury);
    this.vaultFactory = MochiVaultFactory__factory.connect(
      await this.engine.vaultFactory(),
      this.provider,
    );

    const template = await new MochiVault__factory(this.deployer).deploy(
      this.engine.address,
    );

    await this.vaultFactory
      .connect(this.deployer)
      .updateTemplate(template.address);

    this.usdm = await new USDM__factory(this.deployer).deploy(
      this.engine.address,
    );
    this.minter = await new MinterV0__factory(this.deployer).deploy(
      this.engine.address,
    );

    await this.engine.connect(this.deployer).changeUSDM(this.usdm.address);
    await this.engine.connect(this.deployer).changeMinter(this.minter.address);

    // profiles
    this.mochiProfile = await new MochiProfileV0__factory(this.deployer).deploy(
      this.engine.address,
    );
    this.discountProfile = await new NoDiscountProfile__factory(
      this.deployer,
    ).deploy();

    await this.engine
      .connect(this.deployer)
      .changeProfile(this.mochiProfile.address);
    await this.engine
      .connect(this.deployer)
      .changeDiscountProfile(this.discountProfile.address);

    //liquidator
    this.liquidator = await new DutchAuctionLiquidator__factory(
      this.deployer,
    ).deploy(this.engine.address);
    await this.engine
      .connect(this.deployer)
      .changeLiquidator(this.liquidator.address);

    //fee pool
    this.feePool = await new NoMochiFeePool__factory(this.deployer).deploy(
      await this.deployer.getAddress(),
      this.engine.address,
    );
    this.referralFeePool = await new NoMochiReferralFeePool__factory(
      this.deployer,
    ).deploy(this.engine.address);

    await this.engine.changeFeePool(this.feePool.address);
    await this.engine.changeReferralFeePool(this.referralFeePool.address);

    this.nft = await new MochiNFT__factory(this.deployer).deploy(
      this.engine.address,
    );

    await this.engine.changeNFT(this.nft.address);
  }

  async setCSSR(cssr: Contract) {
    await this.engine.connect(this.deployer).changeCSSR(cssr.address);
    this.cssr = ICSSRRouter__factory.connect(cssr.address, this.provider);
  }

  async getNftOf(user: string): Promise<BigNumber[]> {
    const nft = MochiNFT__factory.connect(
      await this.engine.nft(),
      this.provider,
    );
    const len = (await nft.balanceOf(user)).toNumber();
    let nfts: BigNumber[] = new Array();
    for (let i = 0; i < len; i++) {
      nfts.push(await nft.tokenOfOwnerByIndex(user, i));
    }
    return nfts;
  }

  async getCssrAddress(): Promise<string> {
    const addr = await this.engine.cssr();
    console.log("cssr : " + addr);
    return addr;
  }

  async getActiveAuction(): Promise<AuctionDetail[]> {
    const list = (
      await this.liquidator.queryFilter(this.liquidator.filters.Triggered())
    ).filter(async (x) =>
      (await this.liquidator.auctions(x.args._auctionId)).boughtAt.eq(0),
    );
    const auctions = list.map(async (x): Promise<AuctionDetail> => {
      const auction = await this.liquidator.auctions(x.args._auctionId);
      const price = await this.liquidator.price(x.args._auctionId);
      return {
        auctionId: x.args._auctionId,
        nftId: auction.nftId,
        vault: auction.vault,
        startedAt: auction.startedAt,
        collateral: auction.collateral,
        debt: auction.debt,
        price: price,
      };
    });
    return await Promise.all(auctions);
  }
}
