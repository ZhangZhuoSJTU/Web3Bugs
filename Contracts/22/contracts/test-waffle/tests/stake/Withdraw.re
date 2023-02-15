open Globals;
open LetOps;
open Mocha;

let testUnit =
    (
      ~contracts: ref(Helpers.stakerUnitTestContracts),
      ~accounts: ref(array(Ethers.Wallet.t)),
    ) => {
  describeUnit("Withdraw functions", () => {
    let marketIndex = Helpers.randomJsInteger();
    let amountStaked = Helpers.randomTokenAmount();

    describe("_withdraw", () => {
      let userWallet: ref(Ethers.Wallet.t) = ref(None->Obj.magic);
      let treasury = Helpers.randomAddress();
      let amountWithdrawn =
        amountStaked->div(Js.Math.random_int(1, 20)->bnFromInt);
      let fees = Helpers.randomRatio1e18();
      let call: ref(JsPromise.t(ContractHelpers.transaction)) =
        ref(None->Obj.magic);
      let connectedStaker: ref(Staker.t) = ref(None->Obj.magic);

      let setup = amountStaked => {
        userWallet := accounts.contents->Array.getUnsafe(5);
        let {staker, syntheticTokenSmocked} = contracts.contents;
        let%Await _ =
          staker->Staker.Exposed.set_withdrawGlobals(
            ~marketIndex,
            ~syntheticToken=syntheticTokenSmocked.address,
            ~user=userWallet.contents.address,
            ~amountStaked,
            ~fees,
            ~treasury,
          );
        syntheticTokenSmocked->SyntheticTokenSmocked.mockTransferToReturn(
          true,
        );
        StakerSmocked.InternalMock.mock_mintAccumulatedFloatToReturn();

        connectedStaker :=
          staker->ContractHelpers.connect(~address=userWallet.contents);
        call :=
          connectedStaker.contents
          ->Staker.Exposed._withdrawExposed(
              ~token=syntheticTokenSmocked.address,
              ~marketIndex,
              ~amount=amountWithdrawn,
            );
      };

      describe("happy case", () => {
        before_once'(() => {
          let%AwaitThen _ = setup(amountStaked);
          call.contents;
        });
        it("calls transfer on the synthetic token with correct args", () => {
          let fees = amountWithdrawn->mul(fees)->div(tenToThe18);
          contracts.contents.syntheticTokenSmocked
          ->SyntheticTokenSmocked.transferCalls
          ->Chai.recordArrayDeepEqualFlat([|
              {recipient: treasury, amount: fees},
              {
                recipient: userWallet.contents.address,
                amount: amountWithdrawn->sub(fees),
              },
            |]);
        });

        it("calls _mintAccumulatedFloat with correct args", () => {
          StakerSmocked.InternalMock._mintAccumulatedFloatCalls()
          ->Chai.recordArrayDeepEqualFlat([|
              {user: userWallet.contents.address, marketIndex},
            |])
        });

        it("mutates userAmountStaked", () => {
          let%Await amountStakedAfter =
            contracts.contents.staker
            ->Staker.userAmountStaked(
                contracts.contents.syntheticTokenSmocked.address,
                userWallet.contents.address,
              );

          amountStakedAfter->Chai.bnEqual(
            amountStaked->sub(amountWithdrawn),
          );
        });

        it("emits a StakeWithdrawn event with correct args", () =>
          Chai.callEmitEvents(
            ~call=call.contents,
            ~contract=connectedStaker.contents->Obj.magic,
            ~eventName="StakeWithdrawn",
          )
          ->Chai.withArgs3(
              userWallet.contents.address,
              contracts.contents.syntheticTokenSmocked.address,
              amountWithdrawn,
            )
        );
      });

      describe("sad case", () => {
        before_once'(() => setup(zeroBn));
        it("reverts if nothing to withdraw", () => {
          Chai.expectRevert(
            ~transaction=call.contents,
            ~reason="nothing to withdraw",
          )
        });
      });
    });

    describe("withdraw", () => {
      let token = Helpers.randomAddress();
      let amountWithdrawn = Helpers.randomTokenAmount();
      before_once'(() => {
        let%AwaitThen _ =
          contracts.contents.staker
          ->Staker.Exposed.setWithdrawGlobals(
              ~longShort=contracts.contents.longShortSmocked.address,
              ~marketIndex,
              ~token,
            );

        contracts.contents.longShortSmocked
        ->LongShortSmocked.mockUpdateSystemStateToReturn;

        contracts.contents.staker
        ->Staker.withdraw(~token, ~amount=amountWithdrawn);
      });

      it("calls updateSystemState on longShort with correct args", () => {
        contracts.contents.longShortSmocked
        ->LongShortSmocked.updateSystemStateCalls
        ->Chai.recordArrayDeepEqualFlat([|{marketIndex: marketIndex}|])
      });
      it("calls _withdraw with correct args", () =>
        StakerSmocked.InternalMock._withdrawCalls()
        ->Chai.recordArrayDeepEqualFlat([|
            {marketIndex, token, amount: amountWithdrawn},
          |])
      );
    });

    describe("withdrawAll", () => {
      let token = Helpers.randomAddress();
      let userWallet: ref(Ethers.Wallet.t) = ref(None->Obj.magic);
      before_once'(() => {
        userWallet := accounts.contents->Array.getUnsafe(5);
        let%AwaitThen _ =
          contracts.contents.staker
          ->Staker.Exposed.setWithdrawAllGlobals(
              ~longShort=contracts.contents.longShortSmocked.address,
              ~marketIndex,
              ~token,
              ~user=userWallet.contents.address,
              ~amountStaked,
            );

        contracts.contents.longShortSmocked
        ->LongShortSmocked.mockUpdateSystemStateToReturn;

        contracts.contents.staker
        ->ContractHelpers.connect(~address=userWallet.contents)
        ->Staker.withdrawAll(~token);
      });

      it("calls updateSystemState on longShort with correct args", () => {
        contracts.contents.longShortSmocked
        ->LongShortSmocked.updateSystemStateCalls
        ->Chai.recordArrayDeepEqualFlat([|{marketIndex: marketIndex}|])
      });
      it("calls _withdraw with correct args", () =>
        StakerSmocked.InternalMock._withdrawCalls()
        ->Chai.recordArrayDeepEqualFlat([|
            {marketIndex, token, amount: amountStaked},
          |])
      );
    });
  });
};
