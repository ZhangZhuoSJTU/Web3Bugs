open LetOps;
open Mocha;

let before_once' = fn => {
  let ranRef = ref(false);
  before_each(() =>
    if (ranRef^) {
      ()->JsPromise.resolve;
    } else {
      let%Await _ = fn();
      ranRef := true;
    }
  );
};

let (
  add,
  sub,
  pow,
  bnFromString,
  bnFromInt,
  mul,
  div,
  bnToString,
  bnToInt,
  bnGt,
  bnGte,
  bnLt,
) =
  Ethers.BigNumber.(
    add,
    sub,
    pow,
    fromUnsafe,
    fromInt,
    mul,
    div,
    toString,
    toNumber,
    gt,
    gte,
    lt,
  );

let bnMin = (a, b) => a->bnGt(b) ? b : a;

let (zeroBn, twoBn, oneBn, tenToThe18) =
  CONSTANTS.(zeroBn, twoBn, oneBn, tenToThe18);

let describeIntegration =
  Config.dontRunIntegrationTests ? describe_skip : describe;

let describeUnit = Config.dontRunUnitTests ? describe_skip : describe;

// Some tests should be counted towards the integration test code-coverage - but are really unit tests. For those tests use the bellow
let describeBoth =
  if (Config.isCI) {
    // In CI it is only run as an integration test
    //   this doesn't really matter - if integration tests are slower than unit tests, rather make this run as a unit test
    if (Config.dontRunIntegrationTests) {describe_skip} else {
      describe
    };
  } else {
    describe;
  };
