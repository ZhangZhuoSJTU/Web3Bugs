import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { MockContract } from "ethereum-waffle";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import * as requests from "../utils/requestHelper";
import * as utils from "../utils/TestUtils";
import { SuperVault, SuperVaultFactory } from "../typechain";
import { ContractFactory } from "ethers";

type externalMockContracts = {
  mockAddressProvider: MockContract;
  mockVaultsCore: MockContract;
  mockPar: MockContract;
  mockGovernanceAddressProvider: MockContract;
  mockMimo: MockContract;
  mockwmatic: MockContract;
  mockVaultsData: MockContract;
  mockMiner: MockContract;
};

type TestAccounts = Record<string, string>;

type TestSigners = SignerWithAddress[];
type TestContracts = {
  superVaultFactory: SuperVaultFactory;
  baseSuperVault: SuperVault;
};

type setupData = {
  setupContracts: TestContracts;
  setupAccounts: TestAccounts;
  setupSigners: TestSigners;
};

const parToSell = ethers.utils.parseEther(".75");
const depositAmount = utils.ONE;
const leverageTimes = 150; // 1.5x leverage
const borrowAmount = depositAmount.mul(leverageTimes - 100).div(100); // How much of the leveraged asset to borrow in AAVE
const aggregator = utils.aggregators.ONEINCH;

let mockContracts: externalMockContracts;

let aAddr: string;
let coreAddr: string;
let parAddr: string;
let gaAddr: string;
let mimoAddr: string;
let wmaticAddr: string;
let vaultsDataAddr: string;
let minerAddr: string;

let superVaultFactory: SuperVaultFactory;
let initializedSuperVaultInstance: SuperVault;
let accounts: TestAccounts;
let accountSigners: TestSigners;
let owner: SignerWithAddress;
let user: SignerWithAddress;
let baseSuperVault: SuperVault;

const setup = deployments.createFixture(async (): Promise<setupData> => {
  await deployments.fixture(["SuperVault", "SuperVaultFactory"]);
  const setupAccounts: TestAccounts = await getNamedAccounts();
  const setupSigners: TestSigners = await ethers.getSigners();

  const superVaultFactory: SuperVaultFactory = await ethers.getContract("SuperVaultFactory");
  baseSuperVault = await ethers.getContract("SuperVault");

  const setupContracts: TestContracts = { baseSuperVault, superVaultFactory };

  return { setupSigners, setupContracts, setupAccounts };
});

// For before both test cases
before(async () => {
  const { setupAccounts, setupContracts, setupSigners } = await setup();
  ({ baseSuperVault, superVaultFactory } = setupContracts);
  accounts = setupAccounts;
  accountSigners = setupSigners;
  [owner, user] = accountSigners;
});

describe("SuperVault Contract Initialization", async () => {
  let superVaultContractFactory: ContractFactory;
  before(async () => {
    superVaultContractFactory = await ethers.getContractFactory("SuperVault"); // Used to call encodeFunctionData
    initializedSuperVaultInstance = await utils.getSuperVaultInstance(owner.address, aAddr, gaAddr);
  });
  it("Can't initialize supervault contract with 0 address as the Address Provider address", async () => {
    const superVaultData = superVaultContractFactory.interface.encodeFunctionData("initialize", [
      ethers.constants.AddressZero,
      utils.GOVERNANCE_ADDRESS_PROVIDER,
      utils.AAVE_LENDING_POOL,
      accounts.owner,
      utils.DEX_ADDRESS_PROVIDER,
    ]);
    await expect(superVaultFactory.clone(superVaultData)).to.be.reverted;
  });

  it("Can't initialize supervault contract with 0 address as the DexAddressProvider address", async () => {
    const superVaultData = superVaultContractFactory.interface.encodeFunctionData("initialize", [
      utils.ADDRESS_PROVIDER,
      utils.GOVERNANCE_ADDRESS_PROVIDER,
      utils.AAVE_LENDING_POOL,
      accounts.owner,
      ethers.constants.AddressZero,
    ]);
    await expect(superVaultFactory.clone(superVaultData)).to.be.reverted;
  });

  it("Can't initialize superVault contract with 0 address as the Governance Adress Provider address", async () => {
    const superVaultData = superVaultContractFactory.interface.encodeFunctionData("initialize", [
      utils.ADDRESS_PROVIDER,
      ethers.constants.AddressZero,
      utils.AAVE_LENDING_POOL,
      accounts.owner,
      utils.DEX_ADDRESS_PROVIDER,
    ]);
    await expect(superVaultFactory.clone(superVaultData)).to.be.reverted;
  });

  it("Can't initialize supervault contract with 0 address as the Lending Pool address", async () => {
    const superVaultData = superVaultContractFactory.interface.encodeFunctionData("initialize", [
      utils.ADDRESS_PROVIDER,
      utils.GOVERNANCE_ADDRESS_PROVIDER,
      ethers.constants.AddressZero,
      accounts.owner,
      utils.DEX_ADDRESS_PROVIDER,
    ]);
    await expect(superVaultFactory.clone(superVaultData)).to.be.reverted;
  });

  it("I can't initialize a superVault contract more than once", async () => {
    await expect(
      initializedSuperVaultInstance.initialize(
        utils.ADDRESS_PROVIDER,
        utils.GOVERNANCE_ADDRESS_PROVIDER,
        utils.AAVE_LENDING_POOL,
        owner.address,
        utils.DEX_ADDRESS_PROVIDER,
      ),
    ).to.be.revertedWith("Initializable: contract is already initialized");
  });
});

describe("SuperVault Access Control Unit Tests", async () => {
  // Only for before SuperVault Access Control Unit Tests
  before(async () => {
    mockContracts = await utils.setupMockContracts(owner);
    aAddr = mockContracts.mockAddressProvider.address;
    coreAddr = mockContracts.mockVaultsCore.address;
    parAddr = mockContracts.mockPar.address;
    gaAddr = mockContracts.mockGovernanceAddressProvider.address;
    mimoAddr = mockContracts.mockMimo.address;
    wmaticAddr = mockContracts.mockwmatic.address;
    vaultsDataAddr = mockContracts.mockVaultsData.address;
    minerAddr = mockContracts.mockMiner.address;

    await mockContracts.mockAddressProvider.mock.core.returns(coreAddr);
    await mockContracts.mockAddressProvider.mock.stablex.returns(parAddr);
    await mockContracts.mockPar.mock.balanceOf.returns(ethers.utils.parseEther("1"));
    await mockContracts.mockPar.mock.transfer.returns(true);
    await mockContracts.mockVaultsCore.mock.borrow.returns();
    await mockContracts.mockVaultsCore.mock.withdraw.returns();
    await mockContracts.mockAddressProvider.mock.vaultsData.returns(vaultsDataAddr);
    await mockContracts.mockGovernanceAddressProvider.mock.mimo.returns(mimoAddr);
    await mockContracts.mockMimo.mock.balanceOf.returns(ethers.utils.parseEther("1"));
    await mockContracts.mockMimo.mock.transfer.returns(true);

    await mockContracts.mockVaultsData.mock.vaultCollateralType.returns(wmaticAddr);
    await mockContracts.mockwmatic.mock.transfer.returns(true);
    await mockContracts.mockwmatic.mock.balanceOf.returns(ethers.utils.parseEther("1"));
    await mockContracts.mockwmatic.mock.transferFrom.returns(true);
    await mockContracts.mockwmatic.mock.approve.returns(true);
    await mockContracts.mockMiner.mock.releaseMIMO.returns();

    initializedSuperVaultInstance = await utils.getSuperVaultInstance(owner.address, aAddr, gaAddr);
  });

  describe("leverage", () => {
    // Full test for leverage is in integration tests
    it("Only the owner of the supervault contract can leverage", async () => {
      // Call oneInch api here to avoid any other errors
      const OneInchSwapParams = {
        fromTokenAddress: utils.PAR,
        toTokenAddress: utils.WMATIC,
        amount: parToSell.toString(),
        fromAddress: initializedSuperVaultInstance.address,
        slippage: 1,
        disableEstimate: true,
      };
      const { data } = await requests.getOneInchTxData(OneInchSwapParams);
      await expect(
        initializedSuperVaultInstance
          .connect(user)
          .leverage(utils.WMATIC, depositAmount, borrowAmount, parToSell, data.tx.data, aggregator),
      ).to.be.revertedWith(utils.SENDER_MUST_BE_OWNER);
    });
  });

  describe("executeOperation", () => {
    it("Only the AAVE lendingPool can call executeOperation", async () => {
      const premium = borrowAmount.mul(1009).div(1000);
      await expect(
        initializedSuperVaultInstance.connect(owner).executeOperation(
          [utils.WMATIC],
          [borrowAmount],
          [premium],
          owner.address, // This param is not used in call but is present to have the right function signature
          [],
        ),
      ).to.be.revertedWith(utils.CALLER_MUST_BE_LENDING_POOL);
    });
  });

  describe("withdrawFromVault", () => {
    it("I can use the supervault contracts I'm a owner of to withdraw collaterals from vaults", async () => {
      await initializedSuperVaultInstance.withdrawFromVault(1, borrowAmount);
    });

    it("I can't use supervault contracts to withdraw from vaults if I don't own the supervault contracts", async () => {
      await expect(initializedSuperVaultInstance.connect(user).withdrawFromVault(1, borrowAmount)).to.be.revertedWith(
        utils.SENDER_MUST_BE_OWNER,
      );
    });
  });

  describe("borrowFromVault", () => {
    const vaultBorrowAmount = borrowAmount.div(10);

    it("I can use a supervault contract to borrow from a vault if I own the supervault contract", async () => {
      await initializedSuperVaultInstance.borrowFromVault(1, vaultBorrowAmount);
    });

    it("I can't use a supervault contract to borrow from a vault if I'm not an owner of the supervault contract", async () => {
      await expect(
        initializedSuperVaultInstance.connect(user).borrowFromVault(1, vaultBorrowAmount),
      ).to.be.revertedWith(utils.SENDER_MUST_BE_OWNER);
    });

    it("Can't borrow from vault if PAR transfer fails", async () => {
      await mockContracts.mockPar.mock.transfer.returns(false);
      await expect(initializedSuperVaultInstance.borrowFromVault(1, vaultBorrowAmount)).to.be.reverted;
    });
  });

  describe("depositAndBorrowFromVault", async () => {
    const borrowAmount = depositAmount.mul(50).div(100); // Different than deposit amount for leverage since this is just a simple deposit + borrow

    it("I can withdraw from a vault if I'm the owner", async () => {
      await mockContracts.mockPar.mock.transfer.returns(true);
      await mockContracts.mockVaultsCore.mock.depositAndBorrow.returns();
      await initializedSuperVaultInstance.depositAndBorrowFromVault(wmaticAddr, depositAmount, borrowAmount);
    });

    it("I can't deposit and withdraw from a vault if I'm not the owner", async () => {
      await mockContracts.mockVaultsCore.mock.depositAndBorrow.returns();
      await expect(
        initializedSuperVaultInstance.connect(user).depositAndBorrowFromVault(wmaticAddr, depositAmount, borrowAmount),
      ).to.be.revertedWith(utils.SENDER_MUST_BE_OWNER);
    });
  });

  describe("depositToVault", async () => {
    it("I can deposit to a vault", async () => {
      await mockContracts.mockVaultsCore.mock.deposit.returns();
      await initializedSuperVaultInstance.depositToVault(wmaticAddr, depositAmount);
    });
  });

  describe("depositETHToVault", async () => {
    it("I can deposit chain-native currency to a vault", async () => {
      await mockContracts.mockVaultsCore.mock.depositETH.returns();
      await initializedSuperVaultInstance.depositETHToVault({ value: depositAmount });
    });
  });

  describe("depositETHAndBorrowFromVault", async () => {
    const borrowAmount = depositAmount.mul(50).div(100); // Different than deposit amount for leverage since this is just a simple deposit + borrow

    it("I can deposit & borrow ETH from a vault if I'm the owner", async () => {
      await mockContracts.mockVaultsCore.mock.depositETHAndBorrow.returns();
      await initializedSuperVaultInstance.depositETHAndBorrowFromVault(borrowAmount, { value: depositAmount });
    });

    it("I can't deposit and borrow ETH from a vault if I'm not the owner", async () => {
      await mockContracts.mockVaultsCore.mock.depositETHAndBorrow.returns();
      await expect(
        initializedSuperVaultInstance
          .connect(user)
          .depositETHAndBorrowFromVault(borrowAmount, { value: depositAmount }),
      ).to.be.revertedWith(utils.SENDER_MUST_BE_OWNER);
    });
  });

  describe("withdrawAsset", () => {
    it("I can withdraw collateral from a superVault contract if I own the contract", async () => {
      await initializedSuperVaultInstance.withdrawAsset(wmaticAddr);
    });

    it("I can't withdraw collateral from a superVault contract if I don't own the contract", async () => {
      await expect(initializedSuperVaultInstance.connect(user).withdrawAsset(utils.WMATIC)).to.be.revertedWith(
        utils.SENDER_MUST_BE_OWNER,
      );
    });
  });

  describe("releaseMIMO", () => {
    it("I can release the MIMO in a superVault contract to myself if I'm the owner", async () => {
      await initializedSuperVaultInstance.releaseMIMO(minerAddr);
    });

    it("I can't release MIMO if I'm not the owner", async () => {
      await expect(initializedSuperVaultInstance.connect(user).releaseMIMO(minerAddr)).to.be.revertedWith(
        utils.SENDER_MUST_BE_OWNER,
      );
    });
  });

  describe("checkAndSendMimo", async () => {
    it("CheckAndSendMimo should revert if mimo transfer fails", async () => {
      await mockContracts.mockMimo.mock.transfer.returns(false);
      // This could be checked with any function that calls checkAndSendMIMO
      await expect(initializedSuperVaultInstance.releaseMIMO(minerAddr)).to.be.reverted;
    });
  });

  describe("emptyVault", async () => {
    const repayAmount = utils.ONE;

    it("I can't empty a vault I'm not the owner of ", async () => {
      const OneInchSwapParams = {
        fromTokenAddress: utils.PAR,
        toTokenAddress: utils.WMATIC,
        amount: parToSell.toString(),
        fromAddress: initializedSuperVaultInstance.address,
        slippage: 1,
        disableEstimate: true,
      };
      const { data } = await requests.getOneInchTxData(OneInchSwapParams);
      await expect(
        initializedSuperVaultInstance
          .connect(user)
          .emptyVault(1, utils.WMATIC, repayAmount, data.tx.data, utils.aggregators.ONEINCH),
      ).to.be.revertedWith(utils.SENDER_MUST_BE_OWNER);
    });
  });
});
