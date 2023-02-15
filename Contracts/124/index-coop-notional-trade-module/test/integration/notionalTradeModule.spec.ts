import "module-alias/register";

import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { Account, ForkedTokens } from "@utils/test/types";
import DeployHelper from "@utils/deploys";
import { ether } from "@utils/index";
import {
  getAccounts,
  getForkedTokens,
  getSystemFixture,
  getWaffleExpect,
  initializeForkedTokens,
} from "@utils/test/index";

import { SystemFixture } from "@utils/fixtures";
import {
  SetToken,
  DebtIssuanceModuleV2,
  ManagerIssuanceHookMock,
  NotionalTradeModule,
  WrappedfCash,
  WrappedfCashFactory,
} from "@utils/contracts";

import { IERC20 } from "@typechain/IERC20";
import { IERC20Metadata } from "@typechain/IERC20Metadata";
import { ICErc20 } from "@typechain/ICErc20";
import { ICEth } from "@typechain/ICEth";
import {
  upgradeNotionalProxy,
  deployWrappedfCashInstance,
  deployWrappedfCashFactory,
  getCurrencyIdAndMaturity,
  mintWrappedFCash,
} from "../utils";

const expect = getWaffleExpect();

const tokenAddresses: Record<string, string> = {
  cDai: "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643",
  cUsdc: "0x39AA39c021dfbaE8faC545936693aC917d5E7563",
  cEth: "0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5",
};

const underlyingTokens: Record<string, string> = {
  cDai: "dai",
  cUsdc: "usdc",
  cEth: "weth",
};

describe("Notional trade module integration [ @forked-mainnet ]", () => {
  let owner: Account;
  let manager: Account;
  let tokens: ForkedTokens;
  let deployer: DeployHelper;
  let setup: SystemFixture;
  before(async () => {
    [owner, manager] = await getAccounts();
    deployer = new DeployHelper(owner.wallet);
    setup = getSystemFixture(owner.address);
    await setup.initialize();

    // Setup ForkedTokens
    await initializeForkedTokens(deployer);
    tokens = getForkedTokens();
  });
  describe("When notional proxy is upgraded and wrapper factory deployed", () => {
    before(async () => {
      await upgradeNotionalProxy(owner.wallet);
    });
    for (const [assetTokenName, assetTokenAddress] of Object.entries(tokenAddresses)) {
      describe(`When asset token is ${assetTokenName}`, () => {
        let assetToken: ICErc20 | ICEth;
        let underlyingToken: IERC20Metadata;

        before(async () => {
          underlyingToken = (await ethers.getContractAt(
            "IERC20Metadata",
            tokens[underlyingTokens[assetTokenName]].address,
            tokens[underlyingTokens[assetTokenName]].signer,
          )) as IERC20Metadata;
          if (assetTokenName == "cEth") {
            assetToken = (await ethers.getContractAt("ICEth", assetTokenAddress)) as ICEth;
          } else {
            assetToken = (await ethers.getContractAt("ICErc20", assetTokenAddress)) as ICErc20;
          }
        });

        describe("When WrappedfCash is deployed", () => {
          let wrappedFCashInstance: WrappedfCash;
          let currencyId: number;
          let maturity: BigNumber;
          let underlyingTokenAmount: BigNumber;
          let fCashAmount: BigNumber;
          let snapshotId: string;
          let wrappedFCashFactory: WrappedfCashFactory;

          before(async () => {
            wrappedFCashFactory = await deployWrappedfCashFactory(
              deployer,
              owner.wallet,
              tokens.weth.address,
            );
            ({ currencyId, maturity } = await getCurrencyIdAndMaturity(assetTokenAddress, 0));
            wrappedFCashInstance = await deployWrappedfCashInstance(
              wrappedFCashFactory,
              currencyId,
              maturity,
            );
            underlyingTokenAmount = ethers.utils.parseUnits("1", await underlyingToken.decimals());
            fCashAmount = ethers.utils.parseUnits("1", 8);
            await underlyingToken.transfer(owner.address, underlyingTokenAmount);
          });

          beforeEach(async () => {
            snapshotId = await network.provider.send("evm_snapshot", []);
          });

          afterEach(async () => {
            await network.provider.send("evm_revert", [snapshotId]);
          });

          describe("When setToken with wrappedFCash component is deployed", () => {
            let debtIssuanceModule: DebtIssuanceModuleV2;
            let mockPreIssuanceHook: ManagerIssuanceHookMock;
            let notionalTradeModule: NotionalTradeModule;
            let setToken: SetToken;
            let wrappedFCashPosition: BigNumber;
            let snapshotId: string;

            before(async () => {
              // Deploy DebtIssuanceModuleV2
              debtIssuanceModule = await deployer.modules.deployDebtIssuanceModuleV2(
                setup.controller.address,
              );
              await setup.controller.addModule(debtIssuanceModule.address);

              // Deploy NotionalTradeModule
              notionalTradeModule = await deployer.modules.deployNotionalTradeModule(
                setup.controller.address,
                wrappedFCashFactory.address,
                tokens.weth.address,
              );
              await setup.controller.addModule(notionalTradeModule.address);

              // Deploy mock issuance hook to pass as arg in DebtIssuance module initialization
              mockPreIssuanceHook = await deployer.mocks.deployManagerIssuanceHookMock();

              wrappedFCashPosition = ethers.utils.parseUnits(
                "2",
                await wrappedFCashInstance.decimals(),
              );

              await initialize();
            });
            beforeEach(async () => {
              snapshotId = await network.provider.send("evm_snapshot", []);
            });

            afterEach(async () => {
              await network.provider.send("evm_revert", [snapshotId]);
            });

            async function initialize() {
              // Create Set token
              setToken = await setup.createSetToken(
                [wrappedFCashInstance.address],
                [wrappedFCashPosition],
                [debtIssuanceModule.address, notionalTradeModule.address],
                manager.address,
              );

              // Fund owner with stETH
              await tokens.steth.transfer(owner.address, ether(11000));

              // Initialize debIssuance module
              await debtIssuanceModule.connect(manager.wallet).initialize(
                setToken.address,
                ether(0.1),
                ether(0), // No issue fee
                ether(0), // No redeem fee
                owner.address,
                mockPreIssuanceHook.address,
              );

              await setup.integrationRegistry.addIntegration(
                notionalTradeModule.address,
                "DefaultIssuanceModule",
                debtIssuanceModule.address,
              );
              await notionalTradeModule.updateAllowedSetToken(setToken.address, true);
              await notionalTradeModule.connect(manager.wallet).initialize(setToken.address);
            }

            it("Should be able to issue set from wrappedFCash", async () => {
              underlyingTokenAmount = ethers.utils.parseUnits(
                "10",
                await underlyingToken.decimals(),
              );
              fCashAmount = ethers.utils.parseUnits("9", 8);
              const setAmount = ethers.utils.parseEther("1");
              await underlyingToken.transfer(owner.address, underlyingTokenAmount);

              await mintWrappedFCash(
                owner.wallet,
                underlyingToken,
                underlyingTokenAmount,
                fCashAmount,
                assetToken,
                wrappedFCashInstance,
                false,
              );

              await wrappedFCashInstance
                .connect(owner.wallet)
                .approve(debtIssuanceModule.address, ethers.constants.MaxUint256);
              await wrappedFCashInstance
                .connect(owner.wallet)
                .approve(setToken.address, ethers.constants.MaxUint256);

              const setBalanceBefore = await setToken.balanceOf(owner.address);
              await debtIssuanceModule
                .connect(owner.wallet)
                .issue(setToken.address, setAmount, owner.address);
              const setBalanceAfter = await setToken.balanceOf(owner.address);

              expect(setBalanceAfter.sub(setBalanceBefore)).to.eq(setAmount);
            });
            describe("When initial amount of set token has been issued", () => {
              beforeEach(async () => {
                const setAmountNumber = assetTokenName == "cEth" ? 5 : 1000;
                underlyingTokenAmount = ethers.utils.parseUnits(
                  (setAmountNumber * 2).toString(),
                  await underlyingToken.decimals(),
                );
                fCashAmount = ethers.utils.parseUnits((setAmountNumber * 2).toString(), 8);
                const setAmount = ethers.utils.parseEther(setAmountNumber.toString());

                if (assetTokenName != "cEth") {
                  await underlyingToken.transfer(owner.address, underlyingTokenAmount);
                }

                await mintWrappedFCash(
                  owner.wallet,
                  underlyingToken,
                  underlyingTokenAmount,
                  fCashAmount,
                  assetToken,
                  wrappedFCashInstance,
                  false,
                );

                await wrappedFCashInstance
                  .connect(owner.wallet)
                  .approve(debtIssuanceModule.address, ethers.constants.MaxUint256);
                await wrappedFCashInstance
                  .connect(owner.wallet)
                  .approve(setToken.address, ethers.constants.MaxUint256);

                await debtIssuanceModule
                  .connect(owner.wallet)
                  .issue(setToken.address, setAmount, owner.address);
              });
              describe("#mint/redeemFCashPosition", () => {
                let receiveToken: IERC20;
                let sendToken: IERC20;
                let subjectSetToken: string;
                let subjectSendToken: string;
                let subjectSendQuantity: BigNumber;
                let subjectReceiveToken: string;
                let subjectMinReceiveQuantity: BigNumber;
                let caller: SignerWithAddress;

                beforeEach(async () => {
                  subjectSetToken = setToken.address;
                  caller = manager.wallet;
                });

                ["buying", "selling"].forEach(tradeDirection => {
                  ["underlyingToken", "assetToken"].forEach(tokenType => {
                    describe(`When ${tradeDirection} fCash for ${tokenType}`, () => {
                      let sendTokenType: string;
                      let receiveTokenType: string;
                      let otherToken: IERC20;
                      let subjectCurrencyId: number;
                      let subjectMaturity: BigNumber;
                      beforeEach(async () => {
                        subjectCurrencyId = currencyId;
                        subjectMaturity = maturity;
                        const underlyingTokenQuantity = ethers.utils.parseUnits(
                          "1",
                          await underlyingToken.decimals(),
                        );
                        const fTokenQuantity = ethers.utils.parseUnits("1", 8);

                        otherToken = tokenType == "assetToken" ? assetToken : underlyingToken;
                        sendToken = tradeDirection == "buying" ? otherToken : wrappedFCashInstance;
                        sendTokenType = tradeDirection == "buying" ? tokenType : "wrappedFCash";
                        receiveTokenType = tradeDirection == "selling" ? tokenType : "wrappedFCash";
                        subjectSendToken = sendToken.address;

                        receiveToken =
                          tradeDirection == "buying" ? wrappedFCashInstance : otherToken;
                        subjectReceiveToken = receiveToken.address;

                        if (tradeDirection == "buying") {
                          subjectMinReceiveQuantity = fTokenQuantity;
                          if (sendTokenType == "assetToken") {
                            const assetTokenBalanceBefore = await otherToken.balanceOf(
                              owner.address,
                            );

                            if (assetTokenName == "cEth") {
                              assetToken = assetToken as ICEth;
                              await assetToken
                                .connect(owner.wallet)
                                .mint({ value: underlyingTokenQuantity });
                            } else {
                              await underlyingToken
                                .connect(owner.wallet)
                                .approve(assetToken.address, underlyingTokenQuantity);
                              assetToken = assetToken as ICErc20;
                              await assetToken.connect(owner.wallet).mint(underlyingTokenQuantity);
                            }
                            const assetTokenBalanceAfter = await otherToken.balanceOf(
                              owner.address,
                            );
                            subjectSendQuantity = assetTokenBalanceAfter.sub(
                              assetTokenBalanceBefore,
                            );
                          } else {
                            subjectSendQuantity = underlyingTokenQuantity;
                          }
                          // Apparently it is not possible to trade tokens that are not a set component
                          // Also sending extra tokens to the trade module might break it
                          // TODO: Review
                          await notionalTradeModule
                            .connect(manager.wallet)
                            .redeemFCashPosition(
                              setToken.address,
                              subjectCurrencyId,
                              subjectMaturity,
                              fTokenQuantity.mul(2),
                              sendToken.address,
                              subjectSendQuantity,
                            );
                        } else {
                          subjectSendQuantity = fTokenQuantity;
                          if (tokenType == "assetToken") {
                            subjectMinReceiveQuantity = ethers.utils.parseUnits("0.4", 8);
                          } else {
                            subjectMinReceiveQuantity = ethers.utils.parseUnits(
                              "0.9",
                              await underlyingToken.decimals(),
                            );
                          }
                        }
                      });

                      const subject = () => {
                        if (tradeDirection == "buying") {
                          return notionalTradeModule
                            .connect(caller)
                            .mintFCashPosition(
                              subjectSetToken,
                              subjectCurrencyId,
                              subjectMaturity,
                              subjectMinReceiveQuantity,
                              subjectSendToken,
                              subjectSendQuantity,
                            );
                        } else {
                          return notionalTradeModule
                            .connect(caller)
                            .redeemFCashPosition(
                              subjectSetToken,
                              subjectCurrencyId,
                              subjectMaturity,
                              subjectSendQuantity,
                              subjectReceiveToken,
                              subjectMinReceiveQuantity,
                            );
                        }
                      };

                      const subjectCall = () => {
                        if (tradeDirection == "buying") {
                          return notionalTradeModule
                            .connect(caller)
                            .callStatic.mintFCashPosition(
                              subjectSetToken,
                              subjectCurrencyId,
                              subjectMaturity,
                              subjectMinReceiveQuantity,
                              subjectSendToken,
                              subjectSendQuantity,
                            );
                        } else {
                          return notionalTradeModule
                            .connect(caller)
                            .callStatic.redeemFCashPosition(
                              subjectSetToken,
                              subjectCurrencyId,
                              subjectMaturity,
                              subjectSendQuantity,
                              subjectReceiveToken,
                              subjectMinReceiveQuantity,
                            );
                        }
                      };

                      ["new", "existing"].forEach(wrapperType => {
                        describe(`when using ${wrapperType} wrapper`, () => {
                          beforeEach(async () => {
                            if (wrapperType == "new") {
                              const newWrapperId = await getCurrencyIdAndMaturity(
                                assetTokenAddress,
                                1,
                              );
                              subjectMaturity = newWrapperId.maturity;
                              subjectCurrencyId = newWrapperId.currencyId;
                              const newWrapperAddress = await wrappedFCashFactory.computeAddress(
                                subjectCurrencyId,
                                subjectMaturity,
                              );

                              receiveToken = (await ethers.getContractAt(
                                "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
                                newWrapperAddress,
                              )) as IERC20;
                            }
                          });
                          if (tradeDirection == "selling" && wrapperType == "new") {
                            it("should revert", async () => {
                              await expect(subject()).to.be.revertedWith(
                                "WrappedfCash not deployed for given parameters",
                              );
                            });
                          } else {
                            it("setToken should receive receiver token", async () => {
                              const receiveTokenBalanceBefore =
                                wrapperType == "new"
                                  ? 0
                                  : await receiveToken.balanceOf(subjectSetToken);
                              await subject();
                              const receiveTokenBalanceAfter = await receiveToken.balanceOf(
                                subjectSetToken,
                              );
                              expect(
                                receiveTokenBalanceAfter.sub(receiveTokenBalanceBefore),
                              ).to.be.gte(subjectMinReceiveQuantity);
                            });

                            it("setTokens sendToken balance should be adjusted accordingly", async () => {
                              const sendTokenBalanceBefore = await sendToken.balanceOf(
                                setToken.address,
                              );
                              await subject();
                              const sendTokenBalanceAfter = await sendToken.balanceOf(
                                setToken.address,
                              );
                              if (tradeDirection == "selling") {
                                expect(sendTokenBalanceBefore.sub(sendTokenBalanceAfter)).to.eq(
                                  subjectSendQuantity,
                                );
                              } else {
                                expect(sendTokenBalanceBefore.sub(sendTokenBalanceAfter)).to.be.lte(
                                  subjectSendQuantity,
                                );
                              }
                            });

                            it("should return spent / received amount of non-fcash-token", async () => {
                              const otherTokenBalanceBefore = await otherToken.balanceOf(
                                setToken.address,
                              );
                              const result = await subjectCall();
                              await subject();
                              const otherTokenBalanceAfter = await otherToken.balanceOf(
                                setToken.address,
                              );

                              let expectedResult;
                              if (tradeDirection == "selling") {
                                expectedResult = otherTokenBalanceAfter.sub(
                                  otherTokenBalanceBefore,
                                );
                              } else {
                                expectedResult = otherTokenBalanceBefore.sub(
                                  otherTokenBalanceAfter,
                                );
                              }

                              // TODO: Review why there is some deviation
                              const allowedDeviationPercent = 1;
                              expect(result).to.be.gte(
                                expectedResult.mul(100 - allowedDeviationPercent).div(100),
                              );
                              expect(result).to.be.lte(
                                expectedResult.mul(100 + allowedDeviationPercent).div(100),
                              );
                            });

                            it("should adjust the components position of the receiveToken correctly", async () => {
                              const positionBefore = await setToken.getDefaultPositionRealUnit(
                                receiveToken.address,
                              );
                              const tradeAmount = await subjectCall();
                              const receiveTokenAmount =
                                tradeDirection == "buying"
                                  ? subjectMinReceiveQuantity
                                  : tradeAmount;
                              await subject();
                              const positionAfter = await setToken.getDefaultPositionRealUnit(
                                receiveToken.address,
                              );

                              const positionChange = positionAfter.sub(positionBefore);
                              const totalSetSupplyWei = await setToken.totalSupply();
                              const totalSetSupplyEther = totalSetSupplyWei.div(
                                BigNumber.from(10).pow(18),
                              );

                              let receiveTokenAmountNormalized;
                              if (receiveTokenType == "underlyingToken") {
                                receiveTokenAmountNormalized = receiveTokenAmount.div(
                                  totalSetSupplyEther,
                                );
                              } else {
                                const precision = 10 ** 3;
                                receiveTokenAmountNormalized = BigNumber.from(
                                  Math.floor(
                                    receiveTokenAmount
                                      .mul(precision)
                                      .div(totalSetSupplyEther)
                                      .toNumber() / precision,
                                  ),
                                );
                              }

                              // TODO: Review why there is some deviation
                              const allowedDeviation = receiveTokenAmountNormalized.div(10000);
                              expect(receiveTokenAmountNormalized).to.be.gte(
                                positionChange.sub(allowedDeviation),
                              );
                              expect(receiveTokenAmountNormalized).to.be.lte(
                                positionChange.add(allowedDeviation),
                              );
                            });

                            it("should adjust the components position of the sendToken correctly", async () => {
                              const positionBefore = await setToken.getDefaultPositionRealUnit(
                                sendToken.address,
                              );
                              const tradeAmount = await subjectCall();
                              const sendTokenAmount =
                                tradeDirection == "selling" ? subjectSendQuantity : tradeAmount;
                              await subject();
                              const positionAfter = await setToken.getDefaultPositionRealUnit(
                                sendToken.address,
                              );

                              const positionChange = positionBefore.sub(positionAfter);
                              const totalSetSupplyWei = await setToken.totalSupply();
                              const totalSetSupplyEther = totalSetSupplyWei.div(
                                BigNumber.from(10).pow(18),
                              );

                              let sendTokenAmountNormalized;
                              if (sendTokenType == "underlyingToken") {
                                sendTokenAmountNormalized = sendTokenAmount.div(
                                  totalSetSupplyEther,
                                );
                              } else {
                                sendTokenAmountNormalized = BigNumber.from(
                                  // TODO: Why do we have to use round here and floor with the receive token ?
                                  Math.round(
                                    sendTokenAmount.mul(10).div(totalSetSupplyEther).toNumber() /
                                      10,
                                  ),
                                );
                              }

                              // TODO: Returned trade amount seems to be slighly off / or one of the calculations above has a rounding error. Review
                              expect(sendTokenAmountNormalized).to.closeTo(
                                positionChange,
                                Math.max(positionChange.div(10 ** 6).toNumber(), 1),
                              );
                            });

                            if (tradeDirection == "buying") {
                              describe("When sendQuantity is too low", () => {
                                beforeEach(() => {
                                  subjectSendQuantity = BigNumber.from(1000);
                                });
                                it("should revert", async () => {
                                  const revertReason =
                                    sendTokenType == "underlyingToken" && assetTokenName == "cDai"
                                      ? "Dai/insufficient-balance"
                                      : sendTokenType == "assetToken" && assetTokenName == "cDai"
                                        ? "0x11"
                                        : sendTokenType == "underlyingToken" &&
                                        assetTokenName == "cEth"
                                          ? "Insufficient cash"
                                          : "ERC20";
                                  await expect(subject()).to.be.revertedWith(revertReason);
                                });
                              });
                            }
                          }
                        });
                      });
                    });
                  });
                });

                describe("#moduleIssue/RedeemHook", () => {
                  ["underlying", "asset"].forEach(redeemToken => {
                    describe(`when redeeming to ${redeemToken}`, () => {
                      let outputToken: IERC20;
                      beforeEach(async () => {
                        const toUnderlying = redeemToken == "underlying";
                        await notionalTradeModule
                          .connect(manager.wallet)
                          .setRedeemToUnderlying(subjectSetToken, toUnderlying);
                        outputToken = redeemToken == "underlying" ? underlyingToken : assetToken;
                      });
                      ["issue", "redeem", "manualTrigger"].forEach(triggerAction => {
                        describe(`When hook is triggered by ${triggerAction}`, () => {
                          let subjectSetToken: string;
                          let subjectReceiver: string;
                          let subjectAmount: BigNumber;
                          let caller: SignerWithAddress;
                          beforeEach(async () => {
                            subjectSetToken = setToken.address;
                            subjectAmount = ethers.utils.parseEther("1");
                            caller = owner.wallet;
                            subjectReceiver = caller.address;

                            if (triggerAction == "redeem") {
                              const underlyingTokenAmount = ethers.utils.parseUnits(
                                "2.1",
                                await underlyingToken.decimals(),
                              );
                              const fCashAmount = ethers.utils.parseUnits("2", 8);
                              await underlyingToken.transfer(owner.address, underlyingTokenAmount);
                              await mintWrappedFCash(
                                owner.wallet,
                                underlyingToken,
                                underlyingTokenAmount,
                                fCashAmount,
                                assetToken,
                                wrappedFCashInstance,
                                false,
                              );
                              await debtIssuanceModule
                                .connect(owner.wallet)
                                .issue(subjectSetToken, subjectAmount, caller.address);
                              await setToken
                                .connect(caller)
                                .approve(debtIssuanceModule.address, subjectAmount);
                            } else if (triggerAction == "issue") {
                              if (redeemToken == "asset") {
                                if (assetTokenName == "cEth") {
                                  assetToken = assetToken as ICEth;
                                  await assetToken
                                    .connect(caller)
                                    .mint({ value: underlyingTokenAmount });
                                } else {
                                  await underlyingToken.transfer(
                                    caller.address,
                                    underlyingTokenAmount,
                                  );
                                  await underlyingToken
                                    .connect(caller)
                                    .approve(assetToken.address, ethers.constants.MaxUint256);
                                  await assetToken.connect(caller).mint(underlyingTokenAmount);
                                }
                                await assetToken
                                  .connect(caller)
                                  .approve(debtIssuanceModule.address, ethers.constants.MaxUint256);
                              } else {
                                await underlyingToken.transfer(
                                  caller.address,
                                  underlyingTokenAmount,
                                );
                                await underlyingToken
                                  .connect(caller)
                                  .approve(debtIssuanceModule.address, ethers.constants.MaxUint256);
                              }
                            }
                          });

                          const subject = () => {
                            if (triggerAction == "issue") {
                              return debtIssuanceModule
                                .connect(caller)
                                .issue(subjectSetToken, subjectAmount, subjectReceiver);
                            } else if (triggerAction == "redeem") {
                              return debtIssuanceModule
                                .connect(caller)
                                .redeem(subjectSetToken, subjectAmount, subjectReceiver);
                            } else {
                              return notionalTradeModule
                                .connect(caller)
                                .redeemMaturedPositions(subjectSetToken);
                            }
                          };

                          describe("When component has not matured yet", () => {
                            beforeEach(async () => {
                              if (triggerAction == "issue") {
                                const underlyingTokenAmount = ethers.utils.parseUnits(
                                  "2.1",
                                  await underlyingToken.decimals(),
                                );
                                const fCashAmount = ethers.utils.parseUnits("2", 8);
                                await underlyingToken.transfer(
                                  caller.address,
                                  underlyingTokenAmount,
                                );

                                await mintWrappedFCash(
                                  caller,
                                  underlyingToken,
                                  underlyingTokenAmount,
                                  fCashAmount,
                                  assetToken,
                                  wrappedFCashInstance,
                                  false,
                                );

                                await wrappedFCashInstance
                                  .connect(caller)
                                  .approve(debtIssuanceModule.address, fCashAmount);
                              }
                              expect(await wrappedFCashInstance.hasMatured()).to.be.false;
                            });
                            it("fCash position remains the same", async () => {
                              const positionBefore = await setToken.getDefaultPositionRealUnit(
                                wrappedFCashInstance.address,
                              );
                              await subject();
                              const positionAfter = await setToken.getDefaultPositionRealUnit(
                                wrappedFCashInstance.address,
                              );
                              expect(positionAfter).to.eq(positionBefore);
                            });
                          });

                          describe("When component has matured", () => {
                            let snapshotId: string;
                            beforeEach(async () => {
                              snapshotId = await network.provider.send("evm_snapshot", []);
                              const maturity = await wrappedFCashInstance.getMaturity();
                              await network.provider.send("evm_setNextBlockTimestamp", [
                                maturity + 1,
                              ]);
                              await network.provider.send("evm_mine");
                              expect(await wrappedFCashInstance.hasMatured()).to.be.true;
                            });
                            afterEach(async () => {
                              await network.provider.send("evm_revert", [snapshotId]);
                            });

                            if (triggerAction != "manualTrigger") {
                              it("callers token balance is adjusted in the correct direction", async () => {
                                const outputTokenBalanceBefore = await outputToken.balanceOf(
                                  caller.address,
                                );
                                await subject();
                                const outputTokenBalanceAfter = await outputToken.balanceOf(
                                  caller.address,
                                );
                                const amountOutputTokenTransfered =
                                  triggerAction == "redeem"
                                    ? outputTokenBalanceAfter.sub(outputTokenBalanceBefore)
                                    : outputTokenBalanceBefore.sub(outputTokenBalanceAfter);

                                expect(amountOutputTokenTransfered).to.be.gt(0);
                              });

                              it(`should ${triggerAction} correct amount of set tokens`, async () => {
                                const setTokenBalanceBefore = await setToken.balanceOf(
                                  caller.address,
                                );
                                await subject();
                                const setTokenBalanceAfter = await setToken.balanceOf(
                                  caller.address,
                                );
                                const expectedBalanceChange =
                                  triggerAction == "issue" ? subjectAmount : subjectAmount.mul(-1);
                                expect(setTokenBalanceAfter.sub(setTokenBalanceBefore)).to.eq(
                                  expectedBalanceChange,
                                );
                              });
                            }

                            it("Adjusts balances and positions correctly", async () => {
                              const outputTokenBalanceBefore = await outputToken.balanceOf(
                                subjectSetToken,
                              );

                              await subject();

                              // Check that fcash balance is 0 after
                              const fCashBalanceAfter = await wrappedFCashInstance.balanceOf(
                                subjectSetToken,
                              );
                              expect(fCashBalanceAfter).to.eq(0);

                              // Check that fcash was removed from component list
                              expect(await setToken.isComponent(wrappedFCashInstance.address)).to.be
                                .false;

                              // Check that output token was added to component list
                              expect(await setToken.isComponent(outputToken.address)).to.be.true;

                              // Check that output balance is positive afterwards
                              const outputTokenBalanceAfter = await outputToken.balanceOf(
                                subjectSetToken,
                              );
                              expect(
                                outputTokenBalanceAfter.sub(outputTokenBalanceBefore),
                              ).to.be.gt(0);

                              // Check that output token position is positive afterwards
                              const outputTokenPositionAfter = await setToken.getDefaultPositionRealUnit(
                                outputToken.address,
                              );
                              expect(outputTokenPositionAfter).to.be.gt(0);
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    }
  });
});
