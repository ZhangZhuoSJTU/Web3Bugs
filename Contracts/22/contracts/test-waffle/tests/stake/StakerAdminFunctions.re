open Globals;
open LetOps;
open StakerHelpers;
open Mocha;

let testUnit =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts: ref(array(Ethers.Wallet.t)),
    ) => {
  describe("Staker Admin Functions", () => {
    let marketIndex = Helpers.randomJsInteger();
    let randomAddress1 = Helpers.randomAddress();

    describe("changeAdmin", () => {
      let txPromiseRef: ref(JsPromise.t(ContractHelpers.transaction)) =
        ref(()->JsPromise.resolve->Obj.magic);

      before_once'(() => {
        let%Await _ =
          deployAndSetupStakerToUnitTest(
            ~functionName="changeAdmin",
            ~contracts,
            ~accounts,
          );

        txPromiseRef :=
          contracts.contents.staker->Staker.changeAdmin(~admin=randomAddress1);
        txPromiseRef.contents;
      });

      it("should call the onlyAdmin modifier", () => {
        StakerSmocked.InternalMock.onlyAdminModifierLogicCalls()
        ->Array.length
        ->Chai.intEqual(1)
      });

      it("emits ChangeAdmin with correct argument", () => {
        Chai.callEmitEvents(
          ~call=txPromiseRef.contents,
          ~contract=contracts.contents.staker->Obj.magic,
          ~eventName="ChangeAdmin",
        )
        ->Chai.withArgs2(randomAddress1)
      });

      it("should allow admin to change admin correctly", () => {
        let newAdmin = Helpers.randomAddress();
        let currentAdmin = accounts.contents->Array.getUnsafe(0);

        let%Await _ =
          contracts.contents.staker
          ->ContractHelpers.connect(~address=currentAdmin)
          ->Staker.changeAdmin(~admin=newAdmin);

        let%Await updatedAdmin =
          contracts.contents.staker->Staker.Exposed.admin;

        Chai.addressEqual(
          updatedAdmin,
          ~otherAddress=newAdmin,
          ~message="staker admin is not newAdmin",
        );
      });
    });

    describe("changeFloatPercentage", () => {
      let newFloatPerc = bnFromString("42000000000000000");

      let txPromiseRef: ref(JsPromise.t(ContractHelpers.transaction)) =
        ref(()->JsPromise.resolve->Obj.magic);

      before_once'(() => {
        let%Await _ =
          deployAndSetupStakerToUnitTest(
            ~functionName="changeFloatPercentage",
            ~contracts,
            ~accounts,
          );

        txPromiseRef :=
          contracts.contents.staker
          ->Staker.Exposed.changeFloatPercentage(
              ~newFloatPercentage=newFloatPerc,
            );

        txPromiseRef.contents;
      });

      it("should call the onlyAdmin modifier", () => {
        StakerSmocked.InternalMock.onlyAdminModifierLogicCalls()
        ->Array.length
        ->Chai.intEqual(1)
      });

      it("should call _changeFloatPercentage with correct argument", () => {
        StakerSmocked.InternalMock._changeFloatPercentageCalls()
        ->Array.getUnsafe(0)
        ->Chai.recordEqualFlat({newFloatPercentage: newFloatPerc})
      });

      it("emits FloatPercentageUpdated with correct argument", () => {
        Chai.callEmitEvents(
          ~call=txPromiseRef.contents,
          ~contract=contracts.contents.staker->Obj.magic,
          ~eventName="FloatPercentageUpdated",
        )
        ->Chai.withArgs2(newFloatPerc)
      });

      it("should revert if !(0 < newFloatPercentage <= 100 percent)", () => {
        let testValueWithinBounds = bnFromString("420000000000000000");
        let testValueOutOfBoundsLowSide = bnFromInt(0);
        let testValueOutOfBoundsHighSide =
          bnFromString("1010000000000000000");

        let%Await _ =
          contracts.contents.staker
          ->Staker.Exposed._changeFloatPercentageExposed(
              ~newFloatPercentage=testValueWithinBounds,
            );

        let%Await _ =
          Chai.expectRevert(
            ~transaction=
              contracts.contents.staker
              ->Staker.Exposed._changeFloatPercentageExposed(
                  ~newFloatPercentage=testValueOutOfBoundsLowSide,
                ),
            ~reason="",
          );

        Chai.expectRevert(
          ~transaction=
            contracts.contents.staker
            ->Staker.Exposed._changeFloatPercentageExposed(
                ~newFloatPercentage=testValueOutOfBoundsHighSide,
              ),
          ~reason="",
        );
      });

      it("should update floatPercentage correctly", () => {
        let randomNewFloatPerc =
          Helpers.randomInteger()->mul(bnFromString("10000000"));

        let%Await _ =
          contracts.contents.staker
          ->Staker.Exposed._changeFloatPercentageExposed(
              ~newFloatPercentage=randomNewFloatPerc,
            );

        let%Await floatPercAfterCall =
          contracts.contents.staker->Staker.Exposed.floatPercentage;

        Chai.bnEqual(randomNewFloatPerc, floatPercAfterCall);
      });
    });

    describe("changeUnstakeFee", () => {
      let unstakeFeeBasisPoints = Helpers.randomInteger();

      let txPromiseRef: ref(JsPromise.t(ContractHelpers.transaction)) =
        ref(()->JsPromise.resolve->Obj.magic);

      before_once'(() => {
        let%Await _ =
          deployAndSetupStakerToUnitTest(
            ~functionName="changeUnstakeFee",
            ~contracts,
            ~accounts,
          );

        txPromiseRef :=
          contracts.contents.staker
          ->Staker.Exposed.changeUnstakeFee(
              ~marketIndex,
              ~newMarketUnstakeFee_e18=unstakeFeeBasisPoints,
            );
        txPromiseRef.contents;
      });

      it("should call _changeUnstakeFee with correct arguments", () => {
        StakerSmocked.InternalMock._changeUnstakeFeeCalls()
        ->Array.getUnsafe(0)
        ->Chai.recordEqualFlat({
            marketIndex,
            newMarketUnstakeFee_e18: unstakeFeeBasisPoints,
          })
      });

      it("should emit StakeWithdrawalFeeUpdated with correct arguments", () => {
        Chai.callEmitEvents(
          ~call=txPromiseRef.contents,
          ~contract=contracts.contents.staker->Obj.magic,
          ~eventName="StakeWithdrawalFeeUpdated",
        )
        ->Chai.withArgs2(marketIndex, unstakeFeeBasisPoints)
      });

      it("should not allow new unstake fee greater than 5 percent", () => {
        let adminWallet = accounts.contents->Array.getUnsafe(0);
        let sixPercent = bnFromString("60000000000000000");

        let%Await _ =
          Chai.expectRevert(
            ~transaction=
              contracts.contents.staker
              ->ContractHelpers.connect(~address=adminWallet)
              ->Staker.Exposed._changeUnstakeFeeExposed(
                  ~marketIndex,
                  ~newMarketUnstakeFee_e18=sixPercent,
                ),
            ~reason="",
          );
        ();
      });

      it("should update unstake fee correctly", () => {
        let adminWallet = accounts.contents->Array.getUnsafe(0);
        let newFeePercentageRandom =
          Helpers.randomInteger()->mul(bnFromString("10000000"));

        let%Await _ =
          contracts.contents.staker
          ->ContractHelpers.connect(~address=adminWallet)
          ->Staker.Exposed._changeUnstakeFeeExposed(
              ~marketIndex=1,
              ~newMarketUnstakeFee_e18=newFeePercentageRandom,
            );

        let%Await feeAfterCall =
          contracts.contents.staker->Staker.Exposed.marketUnstakeFee_e18(1);

        Chai.bnEqual(feeAfterCall, newFeePercentageRandom);
      });
    });

    describe("changeBalanceIncentiveExponent", () => {
      let marketIndex = 23;
      let startingTestExponent = bnFromInt(1);
      let updatedExponent = bnFromInt(2);

      let txPromiseRef: ref(JsPromise.t(ContractHelpers.transaction)) =
        ref(()->JsPromise.resolve->Obj.magic);

      before_once'(() => {
        let%Await _ =
          deployAndSetupStakerToUnitTest(
            ~functionName="changeBalanceIncentiveExponent",
            ~contracts,
            ~accounts,
          );

        StakerSmocked.InternalMock.mock_changeBalanceIncentiveExponentToReturn();
        let stakerAddress = accounts.contents->Array.getUnsafe(5);

        txPromiseRef :=
          contracts.contents.staker
          ->ContractHelpers.connect(~address=stakerAddress)
          ->Staker.changeBalanceIncentiveExponent(
              ~marketIndex,
              ~balanceIncentiveCurve_exponent=startingTestExponent,
            );
        txPromiseRef.contents;
      });

      it("should call the onlyAdmin Modifier", () => {
        let%Await _ =
          contracts.contents.staker
          ->Staker.changeBalanceIncentiveExponent(
              ~marketIndex,
              ~balanceIncentiveCurve_exponent=updatedExponent,
            );
        StakerSmocked.InternalMock.onlyAdminModifierLogicCalls()
        ->Array.length
        ->Chai.intEqual(1);
      });

      it(
        "should call _changeBalanceIncentiveExponent with correct arguments",
        () => {
        StakerSmocked.InternalMock._changeBalanceIncentiveExponentCalls()
        ->Array.getUnsafe(0)
        ->Chai.recordEqualFlat({
            marketIndex,
            balanceIncentiveCurve_exponent: updatedExponent,
          })
      });

      it(
        "should emit BalanceIncentiveExponentUpdated with correct arguments",
        () => {
        Chai.callEmitEvents(
          ~call=txPromiseRef^,
          ~contract=contracts.contents.staker->Obj.magic,
          ~eventName="BalanceIncentiveExponentUpdated",
        )
        ->Chai.withArgs2(marketIndex, startingTestExponent)
      });

      it("should only allow (0 < new exponent < 6 percent)", () => {
        let adminWallet = accounts.contents->Array.getUnsafe(0);
        let newExponentOutOfBoundsHighSide = bnFromInt(6);
        let newExponentOutOfBoundsLowSide = bnFromInt(0);

        let%Await _ =
          Chai.expectRevert(
            ~transaction=
              contracts.contents.staker
              ->ContractHelpers.connect(~address=adminWallet)
              ->Staker.Exposed._changeBalanceIncentiveExponentExposed(
                  ~marketIndex,
                  ~balanceIncentiveCurve_exponent=newExponentOutOfBoundsHighSide,
                ),
            ~reason="",
          );

        Chai.expectRevert(
          ~transaction=
            contracts.contents.staker
            ->ContractHelpers.connect(~address=adminWallet)
            ->Staker.Exposed._changeBalanceIncentiveExponentExposed(
                ~marketIndex,
                ~balanceIncentiveCurve_exponent=newExponentOutOfBoundsLowSide,
              ),
          ~reason="",
        );
      });

      it("should update incentive exponent correctly", () => {
        let adminWallet = accounts.contents->Array.getUnsafe(0);
        let newExponent = bnFromInt(4);

        let%Await _ =
          contracts.contents.staker
          ->ContractHelpers.connect(~address=adminWallet)
          ->Staker.Exposed._changeBalanceIncentiveExponentExposed(
              ~marketIndex,
              ~balanceIncentiveCurve_exponent=newExponent,
            );

        let%Await exponentAfterCall =
          contracts.contents.staker
          ->Staker.Exposed.balanceIncentiveCurve_exponent(marketIndex);

        Chai.bnEqual(exponentAfterCall, newExponent);
      });
    });

    describe("changeBalanceIncentiveEquilibriumOffset", () => {
      let marketIndex = 15;
      let startingEquilibriumOffset = Helpers.randomInteger();
      let updatedEquilibriumOffset = Helpers.randomInteger();

      let txPromiseRef: ref(JsPromise.t(ContractHelpers.transaction)) =
        ref(()->JsPromise.resolve->Obj.magic);

      before_once'(() => {
        let%Await _ =
          deployAndSetupStakerToUnitTest(
            ~functionName="changeBalanceIncentiveEquilibriumOffset",
            ~contracts,
            ~accounts,
          );

        StakerSmocked.InternalMock.mock_changeBalanceIncentiveEquilibriumOffsetToReturn();
        let stakerAddress = accounts.contents->Array.getUnsafe(5);

        txPromiseRef :=
          contracts.contents.staker
          ->ContractHelpers.connect(~address=stakerAddress)
          ->Staker.changeBalanceIncentiveEquilibriumOffset(
              ~marketIndex,
              ~balanceIncentiveCurve_equilibriumOffset=startingEquilibriumOffset,
            );
        txPromiseRef.contents;
      });

      it("should call the onlyAdmin Modifier", () => {
        let%Await _ =
          contracts.contents.staker
          ->Staker.changeBalanceIncentiveEquilibriumOffset(
              ~marketIndex,
              ~balanceIncentiveCurve_equilibriumOffset=updatedEquilibriumOffset,
            );
        StakerSmocked.InternalMock.onlyAdminModifierLogicCalls()
        ->Array.length
        ->Chai.intEqual(1);
      });

      it(
        "should call _changeBalanceIncentiveEquilibriumOffset with correct arguments",
        () => {
        StakerSmocked.InternalMock._changeBalanceIncentiveEquilibriumOffsetCalls()
        ->Array.getUnsafe(0)
        ->Chai.recordEqualFlat({
            marketIndex,
            balanceIncentiveCurve_equilibriumOffset: updatedEquilibriumOffset,
          })
      });

      it(
        "should emit BalanceIncentiveEquilibriumOffsetUpdated with correct arguments",
        () => {
        Chai.callEmitEvents(
          ~call=txPromiseRef^,
          ~contract=contracts.contents.staker->Obj.magic,
          ~eventName="BalanceIncentiveEquilibriumOffsetUpdated",
        )
        ->Chai.withArgs2(marketIndex, startingEquilibriumOffset)
      });

      it("should ensure (-9e17 < new equilibrium offset < 9e17)", () => {
        let adminWallet = accounts.contents->Array.getUnsafe(0);
        let newOffsetOutOfBoundsHighSide =
          bnFromString("900000000000000000")
          ->add(Helpers.randomTokenAmount());
        let newOffsetOutOfBoundsLowSide =
          bnFromString("-900000000000000000")
          ->sub(Helpers.randomTokenAmount());

        let%Await _ =
          Chai.expectRevert(
            ~transaction=
              contracts.contents.staker
              ->ContractHelpers.connect(~address=adminWallet)
              ->Staker.Exposed._changeBalanceIncentiveEquilibriumOffsetExposed(
                  ~marketIndex,
                  ~balanceIncentiveCurve_equilibriumOffset=newOffsetOutOfBoundsHighSide,
                ),
            ~reason="",
          );

        let%Await _ =
          Chai.expectRevert(
            ~transaction=
              contracts.contents.staker
              ->ContractHelpers.connect(~address=adminWallet)
              ->Staker.Exposed._changeBalanceIncentiveEquilibriumOffsetExposed(
                  ~marketIndex,
                  ~balanceIncentiveCurve_equilibriumOffset=newOffsetOutOfBoundsLowSide,
                ),
            ~reason="",
          );
        ();
      });

      it("should update incentive equilibrium offset correctly", () => {
        let adminWallet = accounts.contents->Array.getUnsafe(0);
        let updatedEquilibriumOffset2 = Helpers.randomInteger();

        let%Await _ =
          contracts.contents.staker
          ->ContractHelpers.connect(~address=adminWallet)
          ->Staker.Exposed._changeBalanceIncentiveEquilibriumOffsetExposed(
              ~marketIndex,
              ~balanceIncentiveCurve_equilibriumOffset=updatedEquilibriumOffset2,
            );

        let%Await exponentAfterCall =
          contracts.contents.staker
          ->Staker.Exposed.balanceIncentiveCurve_equilibriumOffset(
              marketIndex,
            );

        Chai.bnEqual(exponentAfterCall, updatedEquilibriumOffset2);
      });
    });
  });
};
