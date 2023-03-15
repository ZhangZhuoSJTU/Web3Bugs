// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

/** 
  @member amount The total amount the fee was taken from, as a fixed point number with the same number of decimals as the terminal in which this struct was created.
  @member fee The percent of the fee, out of MAX_FEE.
  @member feeDiscount The discount of the fee.
  @member beneficiary The address that will receive the tokens that are minted as a result of the fee payment.
*/
struct JBFee {
  uint256 amount;
  uint32 fee;
  uint32 feeDiscount;
  address beneficiary;
}
