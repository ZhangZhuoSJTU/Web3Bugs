# Credit lines

The credit line contract allows lenders to lend assets to unverified borrowers. Credit lines do not have a fixed end term, i.e the borrower can borrow and repay multiple loans with the same specifications untill the credit line is closed.

The borrower can request a credit line from the lender of choice with the specifications of the loan (borrow asset, collateral asset, minimum collateral ratio, borrow limit, etc.). Once the lender accepts the credit line request using the `creditline.accept`, the borrower can borrow assets from the lender after depositing collateral, using the `creditline.depositCollateral`, based on the collateral ratio. The credit line can also be requested by the lender with specifications of the loan and in this case the loan request needs to be accepted by the borrower.

Since the borrower borrows assets directly from the lender's savings account, the lender needs to have some amount borrow asset balance. The lender could have less balance than the borrow limit and can add more assets later on.

[code](/contracts/CreditLine/CreditLine.sol)

### CreditLineVariables

This struct stores the current status of a loan. Each variable of the struct is discussed below

### CreditLineVariables.status

This variable stores the current status of the loan. The loan can be one of the following status:

- `NOT_CREATED` : The credit line is said to be in NOT_CREATED stage if it is not yet resquested. Credit line would go back to NOT_CREATED stage after it is closed or liquidated.
- `REQUESTED` : The credit line is said to be in REQUESTED stage when the borrower has requested for the loan and the lender has not yet accepted the loan. Credit line can be requested by borower or lender, indicated by the boolean `_requestByLender`. 
- `ACTIVE` : The credit line is said to be in ACTIVE stage when the loan gets accepted. Based on `_requestByLender`, the lender or borrower can accept the loan depending on who requested the credit line. The lender accpets the credit line, when the credit line is requested by a borrower and vice versa. All the lending and borrowing can only happen in the active stage.

### CreditLineVariables.principal

This variable stores the actual amount of borrow assets the borrower has borrowed so far. The principal gets updated every time the borrower borrows more amount or repays amount. 

```solidity
creditLineVariables[_id].principal = creditLineVariables[_id].principal.add(_tokenDiffBalance);
```

When the borrower borrows some borrow assets from the credit line by calling the `creditline.borrow` funtion, the amount borrowed is added to the principal.

```solidity
creditLineVariables[_id].principal = _totalCurrentDebt.sub(_amount);
```

When the borrower repays some amount, using `creditline.repay`, the interest gets paid first followed by the principal. If the amount repaid is greater than the interest accrued, the excess amount ( amount - interest) gets subtracted from the principal.

### CreditLineVariables.totalInterestRepaid

This variable stores the total interest repaid by the borrower. `CreditLineVariables.totalInterestRepaid` gets reset to zero if the credit line is fully repaid, i.e the principal and the total interest amount.

`totalInterestRepaid` gets updated with the interest amount repaid by the borrower.

```solidity
if (_amount > _interestToPay) {
    creditLineVariables[_id].totalInterestRepaid = _totalInterestAccrued;
} else {
    creditLineVariables[_id].totalInterestRepaid = creditLineVariables[_id].totalInterestRepaid.add(_amount);
}
```

### CreditLineVariables.lastPrincipalUpdateTime

This variable stores the time stamp at which the principal gets updated. `lastPrincipalUpdateTime` gets reset to zero when the credit line is fully paid.

```solidity
creditLineVariables[_id].lastPrincipalUpdateTime = block.timestamp;
```
The `lastPrincipalUpdateTime` variable gets updated when the borrower borrows more borrow assets that in turn updates the principal.

```solidity
if (_amount > _interestToPay) {
    creditLineVariables[_id].lastPrincipalUpdateTime = block.timestamp;
}
```
The `lastPrincipalUpdateTime` variable gets updated when the borrower repays the amount more than the interest accrued on the principal.

### CreditLineVariables.interestAccruedTillLastPrincipalUpdate

This variable stores the interest accrued till the last time the principal was updated. `interestAccruedTillLastPrincipalUpdate` gets reset when the credit line is fully repaid.

```solidity
creditLineVariables[_id].interestAccruedTillLastPrincipalUpdate = calculateInterestAccrued(_id);
```

The `interestAccruedTillLastPrincipalUpdate` gets updated with the current interest when the borrower borrows assets from the credit line.

```solidity
creditLineVariables[_id].interestAccruedTillLastPrincipalUpdate = _totalInterestAccrued;
```

The `interestAccruedTillLastPrincipalUpdate` gets updated with the current interest when the borrower repays assets to the credit line.

### Credit line methods

The operations that can be done using the credit line contract are listed below. 

### Creditline.accept

The `creditline.accept` function is used by the lender or the borrower to accept a loan request, based on who has requested the credit line. The accept function can only be called in the requested stage.

### Creditline.depositCollateral

The `creditline.depositCollateral` function is used to deposit collateral into the credit line based on the agreed upon ideal collateral ratio to be able to borrow assets. Any user, except the lender can deposit collateral into the credit line. Users can deposit collateral either from their wallet or from savings account.

### CreditLine.withdrawCollateral

The borrower can withdraw collateral from the credit line using the `creditLine.withdrawCollateral` or `creditLine.withdrawAllCollateral`. Collateral can be withdrawn from the credit line only in the ACTIVE stage. `creditLine.withdrawCollateral` function allows the borrower to withdraw any amount of excess collateral from the credit line provided the collateral ratio is maintained. `creditLine.withdrawAllCollateral` function allows the borrower to withdraw all excess collateral from the credit line.

### CreditLine.cancel

The credit line can be cancelled, using `creditline.cancel`, in the requested stage. This credit line function can be called by the lender or the borrower.

### CreditLine.close

The credit line can be closed, by the borrower or the lender, once all principal and interest is repaid by the borrower using the `creditline.close` function. The `creditline.close` function can only be called in the active stage. The close function transfers all the collateral in credit line back to the borrower before closing the credit line.

### CreditLine.liquidate

The lender has the option to liquidate the creditline when the borrower defaults the loan. When the borrower fails to maintain the collateral ratio above the minimum collateral ratio, as identified in the credit line request, the loan can be liquidated.

Any user can call the liquidate function if the `creditLineConstant.autoLiquidate` is set to true. A third party user (except lender) needs to pay borrow tokens to be able to liquidate the credit line.

In case the ideal collateral ratio = 0, Borrower can borrow tokens without depositing any collateral. When liquidating a credit line with 0 creditLineConstants[_id].idealCollateralRatio, the condition `_currentCollateralRatio < creditLineConstants[_id].idealCollateralRatio` will always revert. This avoids the liquidation of unsecured loans even when the borrower is defaulting on the loan. An if condition allows only the lender to bypass the collateral ratio check in such conditions, allows liquidation of the credit line and helps flagging the borrower as defaulter.

