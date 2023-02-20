const { BN, toBN } = require('web3-utils');

const ratioBaseNum = toBN(10).pow(toBN(4));

function calcActualProfit(profit, vaultAssets, pwrdAssets) {
  const totalAssets = vaultAssets.add(pwrdAssets);
  const vaultProfit = profit.mul(vaultAssets).div(totalAssets);
  const pwrdProfit = profit.mul(pwrdAssets).div(totalAssets);
  let ratio = pwrdAssets.mul(ratioBaseNum).div(vaultAssets);
  if (ratio < 8000) {
    // 30% + ⅜*ratio
    ratio = ratio.mul(toBN(3)).div(toBN(8)).add(toBN(3000));
  } else if (ratio > 10000) {
    ratio = toBN(10000);
  } else {
    // 60% + 2*(ratio - 80%)
    ratio = ratio.sub(toBN(8000)).mul(toBN(2)).add(toBN(6000));
  }
  const portionFromPWRDProfit = pwrdProfit.mul(ratio).div(ratioBaseNum);
  const vaultActualProfit = vaultProfit.add(portionFromPWRDProfit);
  const pwrdActualProfit = pwrdProfit.sub(portionFromPWRDProfit);
  return [vaultActualProfit, pwrdActualProfit];
}

function distributeProfit(profit, vaultAssets, pwrdAssets) {
  const [vaultActualProfit, pwrdActualProfit] = calcActualProfit(
    profit, vaultAssets, pwrdAssets);
  const afterVaultAssets = vaultAssets.add(vaultActualProfit);
  const afterPWRDAssets = pwrdAssets.add(pwrdActualProfit);
  return [afterVaultAssets, afterPWRDAssets, vaultActualProfit, pwrdActualProfit];
}

async function userPnL(profit, token, account) {
  const totalSupply = await token.totalSupply();
  const balance = await token.balanceOf(account);
  return profit.mul(balance).div(totalSupply);
}

module.exports = {
  distributeProfit, userPnL,
};
