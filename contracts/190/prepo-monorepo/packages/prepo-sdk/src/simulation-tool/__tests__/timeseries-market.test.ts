import Actor from "../actor";
import TimeSeriesMarket from "../timeseries-market";

describe("there is some activity on a timeseries market", () => {
  let market: TimeSeriesMarket;
  beforeAll(() => {
    const usdMinted = 10000;
    const lp = new Actor("lp", usdMinted);
    const tradeSize = 1000;
    const trader = new Actor("trader", usdMinted);
    const marketConfig = {
      bounds: { floor: 0.2, ceil: 0.8 },
      fee: 0.02,
      protocolFee: 0.01,
    };
    market = new TimeSeriesMarket("hello", marketConfig, usdMinted, lp);
    const allInLp = new Actor("allInLp", 1000);
    // market.mint(allInLp, 1000);
    // market.depositLiquidityNoLeftover(allInLp);

    market.openPosition(trader, "long", tradeSize);
    market.checkpoint(lp, allInLp);
  });

  test("timeseries can be exported", () => {
    const timeSeries = market.getTimeSeries();
    expect(timeSeries).toMatchSnapshot();
  });
});
