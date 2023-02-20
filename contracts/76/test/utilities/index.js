const { utils } = require('ethers/lib');
const { BigNumber } = require('ethers');

module.exports = {
  prepare: async (thisObject, contracts) => {
    for (let i in contracts) {
      let contract = contracts[i];
      thisObject[contract] = await ethers.getContractFactory(contract);
    }
    thisObject.signers = await ethers.getSigners();

    thisObject.alice = thisObject.signers[0];
    thisObject.bob = thisObject.signers[1];
    thisObject.carol = thisObject.signers[2];
    thisObject.gov = thisObject.signers[3];

    thisObject.alice.address = await thisObject.signers[0].getAddress();
    thisObject.bob.address = await thisObject.signers[1].getAddress();
    thisObject.carol.address = await thisObject.signers[2].getAddress();
    thisObject.gov.address = await thisObject.signers[3].getAddress();

    thisObject.alice.key = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    thisObject.bob.key = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
    thisObject.carol.key = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';
    thisObject.gov.key = '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6';

    thisObject.protocolX = '0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7';
    thisObject.protocolY = '0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c8';
    thisObject.protocolZ = '0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c9';

    thisObject.nonProtocol1 = '0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c1';
    thisObject.nonProtocol2 = '0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c2';
  },
  deploy: async (thisObject, contracts) => {
    for (let i in contracts) {
      let contract = contracts[i];
      thisObject[contract[0]] = await contract[1].deploy(...(contract[2] || []));
      try {
        const decimals = await thisObject[contract[0]].decimals();
        thisObject[contract[0]].dec = decimals;
        thisObject[contract[0]].usdDec = 18 + (18 - decimals);
      } catch (err) {}
      await thisObject[contract[0]].deployed();
    }
  },
  blockNumber: async (tx) => {
    return BigNumber.from(await (await tx).blockNumber);
  },
  meta: async (tx) => {
    data = await tx;
    const block = data.blockNumber;

    data = await data.wait();
    const events = data.events;

    data = await ethers.provider.getBlock(block);
    return {
      time: BigNumber.from(data.timestamp),
      block: BigNumber.from(block),
      events: events,
    };
  },
  events: async (tx) => {
    return (await (await tx).wait()).events;
  },
  Uint16Fragment: function (fragment) {
    const f = BigNumber.from(fragment * 10000);
    return BigNumber.from(2 ** 16 - 1)
      .mul(f)
      .div(10000);
  },
  Uint16Max: BigNumber.from(2 ** 16 - 1),
  Uint32Max: BigNumber.from(2 ** 32 - 1),
};
