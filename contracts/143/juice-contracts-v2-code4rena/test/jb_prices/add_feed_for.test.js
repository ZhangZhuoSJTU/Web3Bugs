import { expect } from 'chai';
import { ethers } from 'hardhat';
import jbChainlinkPriceFeed from '../../artifacts/contracts/JBChainlinkV3PriceFeed.sol/JBChainlinkV3PriceFeed.json';
import { deployMockContract } from '@ethereum-waffle/mock-contract';
import errors from '../helpers/errors.json';

describe('JBPrices::addFeed(...)', function () {
  let deployer;
  let addrs;

  let priceFeed;

  let jbPricesFactory;
  let jbPrices;

  beforeEach(async function () {
    [deployer, ...addrs] = await ethers.getSigners();

    priceFeed = await deployMockContract(deployer, jbChainlinkPriceFeed.abi);

    jbPricesFactory = await ethers.getContractFactory('JBPrices');
    jbPrices = await jbPricesFactory.deploy(deployer.address);
  });

  it('Add feed from owner succeeds, but fails if added again', async function () {
    let currency = 1;
    let base = 2;

    // Add a feed for an arbitrary currency.
    let tx = await jbPrices.connect(deployer).addFeedFor(currency, base, priceFeed.address);

    // Expect an event to have been emitted.
    await expect(tx).to.emit(jbPrices, 'AddFeed').withArgs(currency, base, priceFeed.address);

    // Get the stored feed.
    const storedFeed = await jbPrices.feedFor(currency, base);

    // Expect the stored feed values to match.
    expect(storedFeed).to.equal(priceFeed.address);

    // Try to add the same feed again. It should fail with an error indicating that it already
    // exists.
    await expect(
      jbPrices.connect(deployer).addFeedFor(currency, base, priceFeed.address),
    ).to.be.revertedWith(errors.PRICE_FEED_ALREADY_EXISTS);
  });

  it('Add feed from address other than owner fails', async function () {
    await expect(
      jbPrices
        .connect(addrs[0]) // Arbitrary address.
        .addFeedFor(/*currency=*/ 1, /*base=*/ 2, priceFeed.address),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });
});
