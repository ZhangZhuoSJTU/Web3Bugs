open LetOps;
open Contract;
open Globals;

let mintDirect =
    (
      ~marketIndex,
      ~amount,
      ~token,
      ~user: Ethers.Wallet.t,
      ~longShort: LongShort.t,
      ~oracleManagerMock: OracleManagerMock.t,
      ~isLong: bool,
    ) => {
  let%AwaitThen _ =
    token->Contract.PaymentTokenHelpers.mintAndApprove(
      ~amount,
      ~user,
      ~spender=longShort.address,
    );
  let contract = longShort->ContractHelpers.connect(~address=user);
  let%AwaitThen currentOraclePrice =
    oracleManagerMock->OracleManagerMock.getLatestPrice;
  let tempOraclePrice = currentOraclePrice->add(bnFromInt(1));
  let _ =
    oracleManagerMock->OracleManagerMock.setPrice(~newPrice=tempOraclePrice);
  let%AwaitThen _ = contract->LongShort.updateSystemState(~marketIndex);
  let%AwaitThen _mintNextPrice =
    if (isLong) {
      contract->LongShort.mintLongNextPrice(~marketIndex, ~amount);
    } else {
      contract->LongShort.mintShortNextPrice(~marketIndex, ~amount);
    };
  // NOTE: this code changes the oracle price then resets it back to the original value which should the same value (for the sake of simplicity in the tests)
  let _ =
    oracleManagerMock->OracleManagerMock.setPrice(
      ~newPrice=currentOraclePrice,
    );
  contract->LongShort.updateSystemState(~marketIndex);
};
let mintAndStakeDirect =
    (
      ~marketIndex,
      ~amount,
      ~token,
      ~user: Ethers.Wallet.t,
      ~longShort: LongShort.t,
      ~oracleManagerMock: OracleManagerMock.t,
      ~syntheticToken: SyntheticToken.t,
    ) => {
  let%AwaitThen isLong =
    syntheticToken->Contract.SyntheticTokenHelpers.getIsLong;
  let%AwaitThen balanceBeforeMinting =
    syntheticToken->SyntheticToken.balanceOf(~account=user.address);
  let%AwaitThen _mintDirect =
    mintDirect(
      ~marketIndex,
      ~amount,
      ~token,
      ~user,
      ~longShort,
      ~oracleManagerMock,
      ~isLong,
    );
  let%AwaitThen availableToStakeAfter =
    syntheticToken->SyntheticToken.balanceOf(~account=user.address);
  let amountToStake = availableToStakeAfter->sub(balanceBeforeMinting);
  let syntheticTokenConnected =
    syntheticToken->ContractHelpers.connect(~address=user);
  syntheticTokenConnected->SyntheticToken.stake(~amount=amountToStake);
};

type randomStakeInfo = {
  marketIndex: int,
  synth: SyntheticToken.t,
  amount: Ethers.BigNumber.t,
  priceOfSynthForAction: Ethers.BigNumber.t,
  valueInEntrySide: Ethers.BigNumber.t,
  valueInOtherSide: Ethers.BigNumber.t,
};
let stakeRandomlyInMarkets =
    (
      ~marketsToStakeIn: array(Helpers.markets),
      ~userToStakeWith: Ethers.Wallet.t,
      ~longShort: LongShort.t,
    ) =>
  [|marketsToStakeIn->Array.getUnsafe(0)|]
  ->Belt.Array.reduce(
      JsPromise.resolve(([||], [||])),
      (
        currentValues,
        {paymentToken, longSynth, shortSynth, marketIndex, oracleManager},
      ) => {
        let%AwaitThen (synthsUserHasStakedIn, marketsUserHasStakedIn) = currentValues;
        let mintStake =
          mintAndStakeDirect(
            ~marketIndex,
            ~token=paymentToken,
            ~user=userToStakeWith,
            ~longShort,
            ~oracleManagerMock=oracleManager,
          );

        let%AwaitThen {
          longValue: valueLongBefore,
          shortValue: valueShortBefore,
        } =
          longShort->LongShortHelpers.getMarketBalance(~marketIndex);

        let%Await newSynthsUserHasStakedIn =
          switch (Helpers.randomMintLongShort()) {
          | Long(amount) =>
            let%AwaitThen _ = mintStake(~syntheticToken=longSynth, ~amount);
            let%Await longTokenPrice =
              longShort->LongShortHelpers.getSyntheticTokenPrice(
                ~marketIndex,
                ~isLong=true,
              );

            synthsUserHasStakedIn->Array.concat([|
              {
                marketIndex,
                synth: longSynth,
                amount,
                priceOfSynthForAction: longTokenPrice,
                valueInEntrySide: valueLongBefore,
                valueInOtherSide: valueShortBefore,
              },
            |]);
          | Short(amount) =>
            let%AwaitThen _ = mintStake(~syntheticToken=shortSynth, ~amount);
            let%Await shortTokenPrice =
              longShort->LongShortHelpers.getSyntheticTokenPrice(
                ~marketIndex,
                ~isLong=false,
              );
            synthsUserHasStakedIn->Array.concat([|
              {
                marketIndex,
                synth: shortSynth,
                amount,
                priceOfSynthForAction: shortTokenPrice,
                valueInOtherSide: valueLongBefore,
                valueInEntrySide: valueShortBefore,
              },
            |]);
          | Both(longAmount, shortAmount) =>
            let%AwaitThen _ =
              mintStake(~syntheticToken=longSynth, ~amount=longAmount);
            let%AwaitThen longTokenPrice =
              longShort->LongShortHelpers.getSyntheticTokenPrice(
                ~marketIndex,
                ~isLong=true,
              );
            let newSynthsUserHasStakedIn =
              synthsUserHasStakedIn->Array.concat([|
                {
                  marketIndex,
                  synth: longSynth,
                  amount: longAmount,
                  priceOfSynthForAction: longTokenPrice,
                  valueInEntrySide: valueLongBefore,
                  valueInOtherSide: valueShortBefore,
                },
              |]);
            let%AwaitThen {
              longValue: valueLongBefore,
              shortValue: valueShortBefore,
            } =
              longShort->LongShortHelpers.getMarketBalance(~marketIndex);
            let%AwaitThen _ =
              mintStake(~syntheticToken=shortSynth, ~amount=shortAmount);
            let%Await shortTokenPrice =
              longShort->LongShortHelpers.getSyntheticTokenPrice(
                ~marketIndex,
                ~isLong=false,
              );
            newSynthsUserHasStakedIn->Array.concat([|
              {
                marketIndex,
                synth: shortSynth,
                amount: shortAmount,
                priceOfSynthForAction: shortTokenPrice,
                valueInOtherSide: valueLongBefore,
                valueInEntrySide: valueShortBefore,
              },
            |]);
          };

        (
          newSynthsUserHasStakedIn,
          marketsUserHasStakedIn->Array.concat([|marketIndex|]),
        );
      },
    );

let stakeRandomlyInBothSidesOfMarket =
    (
      ~marketsToStakeIn: array(Helpers.markets),
      ~userToStakeWith: Ethers.Wallet.t,
      ~longShort: LongShort.t,
    ) =>
  marketsToStakeIn->Belt.Array.reduce(
    JsPromise.resolve(),
    (
      prevPromise,
      {paymentToken, marketIndex, longSynth, shortSynth, oracleManager},
    ) => {
      let%AwaitThen _ = prevPromise;

      let mintStake =
        mintAndStakeDirect(
          ~marketIndex,
          ~token=paymentToken,
          ~user=userToStakeWith,
          ~longShort,
          ~oracleManagerMock=oracleManager,
        );
      let%AwaitThen _ =
        mintStake(
          ~syntheticToken=longSynth,
          ~amount=Helpers.randomTokenAmount(),
        );
      let%Await _ =
        mintStake(
          ~syntheticToken=shortSynth,
          ~amount=Helpers.randomTokenAmount(),
        );
      ();
    },
  );
