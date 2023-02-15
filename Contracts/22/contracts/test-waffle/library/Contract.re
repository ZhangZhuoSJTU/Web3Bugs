open ContractHelpers;
open Globals;
open LetOps;

module PaymentTokenHelpers = {
  let mintAndApprove =
      (
        t: ERC20Mock.t,
        ~user: Ethers.Wallet.t,
        ~amount: Ethers.BigNumber.t,
        ~spender: Ethers.ethAddress,
      ) =>
    t
    ->ERC20Mock.mint(~amount, ~_to=user.address)
    ->JsPromise.then_(_ => {
        t->connect(~address=user)->ERC20Mock.approve(~amount, ~spender)
      });
};

module DataFetchers = {
  let marketIndexOfSynth =
      (longShort: LongShort.t, ~syntheticToken: SyntheticToken.t)
      : JsPromise.t(int) =>
    longShort
    ->LongShort.staker
    ->JsPromise.then_(Staker.at)
    ->JsPromise.then_(Staker.marketIndexOfToken(_, syntheticToken.address));
};

module LongShortHelpers = {
  type marketBalance = {
    longValue: Ethers.BigNumber.t,
    shortValue: Ethers.BigNumber.t,
  };
  let getMarketBalance = (longShort, ~marketIndex) => {
    let%AwaitThen longValue =
      longShort->LongShort.marketSideValueInPaymentToken(
        marketIndex,
        true /*long*/,
      );
    let%Await shortValue =
      longShort->LongShort.marketSideValueInPaymentToken(
        marketIndex,
        false /*short*/,
      );
    {longValue, shortValue};
  };
  let getSyntheticTokenPrice = (longShort, ~marketIndex, ~isLong) => {
    let%AwaitThen syntheticTokenAddress =
      longShort->LongShort.syntheticTokens(marketIndex, isLong);
    let%AwaitThen synthContract =
      ContractHelpers.attachToContract(
        "SyntheticToken",
        ~contractAddress=syntheticTokenAddress,
      );
    let%AwaitThen totalSupply =
      synthContract->Obj.magic->SyntheticToken.totalSupply;

    let%Await marketSideValueInPaymentToken =
      longShort->LongShort.marketSideValueInPaymentToken(marketIndex, isLong);

    let syntheticTokenPrice =
      marketSideValueInPaymentToken
      ->mul(CONSTANTS.tenToThe18)
      ->div(totalSupply);

    syntheticTokenPrice;
  };
  let calcSyntheticTokenPrice = (~amountPaymentToken, ~amountSyntheticToken) => {
    amountPaymentToken->mul(CONSTANTS.tenToThe18)->div(amountSyntheticToken);
  };
  let calcAmountPaymentToken = (~amountSyntheticToken, ~price) => {
    amountSyntheticToken->mul(price)->div(CONSTANTS.tenToThe18);
  };
  let calcAmountSyntheticToken = (~amountPaymentToken, ~price) => {
    amountPaymentToken->mul(CONSTANTS.tenToThe18)->div(price);
  };
  let calcEquivalentAmountSyntheticTokensOnTargetSide =
      (~amountSyntheticTokenOriginSide, ~priceOriginSide, ~priceTargetSide) => {
    amountSyntheticTokenOriginSide
    ->mul(priceOriginSide)
    ->div(priceTargetSide);
  };
};

module SyntheticTokenHelpers = {
  let getIsLong = syntheticToken => {
    let%Await isLong = syntheticToken->SyntheticToken.isLong;
    isLong == true /*long*/;
  };
};

module YieldManagerAaveHelpers = {
  type contractsType = {
    .
    "erc20Mock": ERC20Mock.t,
    "yieldManagerAave": YieldManagerAave.t,
    "paymentToken": ERC20MockSmocked.t,
    "treasury": Ethers.Wallet.t,
    "aaveIncentivesController": AaveIncentivesControllerMockSmocked.t,
  };
};
