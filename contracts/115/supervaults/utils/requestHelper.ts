import axios from "axios";

type OneInchSwapParams = {
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;
  fromAddress: string;
  slippage: number;
  disableEstimate: boolean;
};

type ParaswapRouteParams = {
  srcToken: string;
  destToken: string;
  side: string;
  network: number;
  srcDecimals: number;
  destDecimals: number;
  amount: string;
};

type ParaswapSwapBody = {
  srcToken: string;
  destToken: string;
  priceRoute: ParaswapRouteParams;
  srcAmount: string;
  slippage: number;
  userAddress: string;
};

// Get tx data for a oneInch swap
export const getOneInchTxData = async (params: OneInchSwapParams) => {
  const res = await axios.get(`https://api.1inch.exchange/v3.0/137/swap`, {
    params,
  });
  return res;
};

// Get price route for use in getParaswapTxData
export const getParaswapPriceRoute = async (params: ParaswapRouteParams) => {
  const res = await axios.get(`https://apiv5.paraswap.io/prices/`, {
    params,
  });
  return res;
};

// Get tx data for a Paraswap swap
export const getParaswapTxData = async (bodyParams: ParaswapSwapBody) => {
  const res = await axios.post(`https://apiv5.paraswap.io/transactions/137`, bodyParams, {
    params: {
      ignoreChecks: true,
    },
  });
  return res;
};
