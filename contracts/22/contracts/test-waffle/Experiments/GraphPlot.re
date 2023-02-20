open Globals;
open LetOps;
open Mocha;

let generateTestData =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts: ref(array(Ethers.Wallet.t)),
      ~initialPrice: Ethers.BigNumber.t,
      ~initialAmountShort: Ethers.BigNumber.t,
      ~initialAmountLong: Ethers.BigNumber.t,
      ~prices: ref(array((string, string, string))),
      ~name: string,
    ) =>
  describe(
    "generating graph" ++ name,
    () => {
      let numberOfItems = initialPrice->div(CONSTANTS.tenToThe18)->bnToInt;
      before_each(() => {
        let {longShort, markets} = contracts.contents;
        let {oracleManager, paymentToken, marketIndex} =
          markets->Array.getUnsafe(0);
        let testUser = accounts.contents->Array.getUnsafe(1);
        let%AwaitThen _ =
          oracleManager->OracleManagerMock.setPrice(~newPrice=initialPrice);

        let%AwaitThen _ =
          longShort->LongShort.updateSystemState(~marketIndex);

        let%AwaitThen _ =
          paymentToken->Contract.PaymentTokenHelpers.mintAndApprove(
            ~user=testUser,
            ~spender=longShort.address,
            ~amount=
              Ethers.BigNumber.fromUnsafe("10000000000000000000000000000"),
          );

        let%AwaitThen _ =
          HelperActions.mintDirect(
            ~marketIndex,
            ~amount=initialAmountLong,
            ~token=paymentToken,
            ~user=testUser,
            ~longShort,
            ~oracleManagerMock=oracleManager,
            ~isLong=true,
          );

        ()->JsPromise.resolve;
      });
      it("below", () => {
        let {longShort, markets} = contracts.contents;
        let {oracleManager, marketIndex, paymentToken} =
          markets->Array.getUnsafe(0);
        let testUser = accounts.contents->Array.getUnsafe(1);

        let%AwaitThen _ =
          HelperActions.mintDirect(
            ~marketIndex,
            ~amount=initialAmountShort,
            ~token=paymentToken,
            ~user=testUser,
            ~longShort,
            ~oracleManagerMock=oracleManager,
            ~isLong=false,
          );
        let pricesBelow = Belt.Array.makeBy(numberOfItems - 1, i => i);

        let%AwaitThen (_, resultsBelow) =
          pricesBelow->Array.reduce(
            (initialPrice, [||])->JsPromise.resolve,
            (lastPromise, _) => {
              let%AwaitThen (lastPrice, results) = lastPromise;
              let newPrice = lastPrice->sub(CONSTANTS.tenToThe18);
              let%AwaitThen _ =
                oracleManager->OracleManagerMock.setPrice(~newPrice);

              let%AwaitThen _ =
                longShort->LongShort.updateSystemState(~marketIndex);
              let%AwaitThen shortValue =
                longShort->LongShort.marketSideValueInPaymentToken(
                  marketIndex,
                  false /*short*/,
                );
              let%AwaitThen longValue =
                longShort->LongShort.marketSideValueInPaymentToken(
                  marketIndex,
                  true /*long*/,
                );

              (
                newPrice,
                [|
                  (
                    newPrice->Ethers.Utils.formatEther,
                    shortValue->Ethers.Utils.formatEther,
                    longValue->Ethers.Utils.formatEther,
                  ),
                |]
                ->Array.concat(results),
              )
              ->JsPromise.resolve;
            },
          );
        prices :=
          prices.contents
          ->Array.concat(resultsBelow)
          ->Array.concat([|
              (
                initialPrice->Ethers.Utils.formatEther,
                initialAmountShort->Ethers.Utils.formatEther,
                initialAmountLong->Ethers.Utils.formatEther,
              ),
            |]);
        ()->JsPromise.resolve;
      });
      it("above", () => {
        let {longShort, markets} = contracts.contents;
        let {oracleManager, marketIndex, paymentToken} =
          markets->Array.getUnsafe(0);
        let testUser = accounts.contents->Array.getUnsafe(1);

        let%AwaitThen _ =
          HelperActions.mintDirect(
            ~marketIndex,
            ~amount=initialAmountShort,
            ~token=paymentToken,
            ~user=testUser,
            ~longShort,
            ~oracleManagerMock=oracleManager,
            ~isLong=false,
          );

        let pricesAbove = Belt.Array.makeBy(numberOfItems * 4, i => i);

        let%AwaitThen (_, resultsAbove) =
          pricesAbove->Array.reduce(
            (initialPrice, [||])->JsPromise.resolve,
            (lastPromise, _) => {
              let%AwaitThen (lastPrice, results) = lastPromise;
              let newPrice = lastPrice->add(CONSTANTS.tenToThe18);
              let%AwaitThen _ =
                oracleManager->OracleManagerMock.setPrice(~newPrice);
              let%AwaitThen _ =
                longShort->LongShort.updateSystemState(~marketIndex);
              let%AwaitThen shortValue =
                longShort->LongShort.marketSideValueInPaymentToken(
                  marketIndex,
                  false /*short*/,
                );
              let%AwaitThen longValue =
                longShort->LongShort.marketSideValueInPaymentToken(
                  marketIndex,
                  true /*long*/,
                );

              (
                newPrice,
                results->Array.concat([|
                  (
                    newPrice->Ethers.Utils.formatEther,
                    shortValue->Ethers.Utils.formatEther,
                    longValue->Ethers.Utils.formatEther,
                  ),
                |]),
              )
              ->JsPromise.resolve;
            },
          );
        prices := prices.contents->Array.concat(resultsAbove);

        Node.Fs.writeFileAsUtf8Sync(
          "./generatedDataForModels/" ++ name ++ ".txt",
          prices.contents
          ->Array.reduce("", (priceString, (price, long, short)) => {
              priceString ++ "\n" ++ price ++ "," ++ long ++ "," ++ short
            }),
        );
        ()->JsPromise.resolve;
      });
    },
  );
let describeSkippable = Config.runValueSimulations ? describe : describe_skip;
describeSkippable("Float System", () => {
  let contracts: ref(Helpers.coreContracts) = ref(None->Obj.magic);
  let accounts: ref(array(Ethers.Wallet.t)) = ref(None->Obj.magic);

  before(() => {
    let%Await loadedAccounts = Ethers.getSigners();
    accounts := loadedAccounts;
  });

  before_each(() => {
    let%Await deployedContracts =
      Helpers.initialize(
        ~admin=accounts.contents->Array.getUnsafe(0),
        ~exposeInternals=false,
      );
    contracts := deployedContracts;
    ();
  });

  let initialPrice = bnFromInt(50)->mul(CONSTANTS.tenToThe18);
  let initialAmountLong = bnFromInt(100)->mul(CONSTANTS.tenToThe18);
  let initialAmountShort = bnFromInt(100)->mul(CONSTANTS.tenToThe18);
  let prices = ref([||]);

  generateTestData(
    ~contracts,
    ~accounts,
    ~initialPrice,
    ~initialAmountShort,
    ~initialAmountLong,
    ~prices,
    ~name="balancedStart",
  );

  let initialPrice = bnFromInt(50)->mul(CONSTANTS.tenToThe18);
  let initialAmountLong = bnFromInt(200)->mul(CONSTANTS.tenToThe18);
  let initialAmountShort = bnFromInt(100)->mul(CONSTANTS.tenToThe18);
  let prices = ref([||]);

  generateTestData(
    ~contracts,
    ~accounts,
    ~initialPrice,
    ~initialAmountShort,
    ~initialAmountLong,
    ~prices,
    ~name="imbalancedLong",
  );

  let initialPrice = bnFromInt(50)->mul(CONSTANTS.tenToThe18);
  let initialAmountLong = bnFromInt(100)->mul(CONSTANTS.tenToThe18);
  let initialAmountShort = bnFromInt(200)->mul(CONSTANTS.tenToThe18);
  let prices = ref([||]);

  generateTestData(
    ~contracts,
    ~accounts,
    ~initialPrice,
    ~initialAmountShort,
    ~initialAmountLong,
    ~prices,
    ~name="imbalancedShort",
  );
});
