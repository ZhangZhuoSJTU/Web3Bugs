# Error Codes

Documents all the Error Codes in Timeswap-V1-Core.

## `Factory.sol`

### E101

Address Zero error.

The address (or the address of the ERC20 token) passed is 0.

Can occur in `constructor`, `createPair` or `setOwner`.

Check the address passed, and verify if it is not 0.

### E102

Not the intended caller.

The caller doesn't have enough privileges to call the function.

Can occur in `setOwner` or `acceptOwner`.

If the error occurs in `setOwner` check if `owner` is calling the function. If the error occurs in `acceptOwner` check if the `pendingOwner` is calling the function.

### E103

Identical asset and collateral.

The asset token and collateral token passed are identical.

Can occur in `createPair`.

Check the `asset` and the `collateral` passed, and verify that they are not the same.

### E104

A similar Pair contract exists.

A pair contract with the same asset and collateral already exists.

Can occur in `createPair`

Check the `asset` and the `collateral` passed, and verify that they are the intended tokens. If they are the intended tokens then don't proceed to create a pair, and try getting the existing pair.

## `Pair.sol`

### E201

Address Zero error.

The address (or the address of the ERC20 token) passed is 0.

Can occur in `mint`, `burn`, `lend`, `withdraw`, `borrow` or `pay`.

Check the address passed, and verify if it is not 0.

### E202

Trying to do an operation on a pool which has already matured.

Some operations like mint, lend, etc. can't be performed on a pool which has already matured.

Can occur in `mint`, `lend`, `borrow` or `pay`.

Check the maturity and verify that the pool has not yet matured.

### E203

Trying to do an operation on a pool which hasn't yet matured.

Operations like burn and withdraw can only be performed on a pool after maturity.

Can occur in `burn` or `withdraw`.

Check the maturity and verify that the pool has matured.

### E204

The address passed is the address of the Pair Contract.

The address passed to functions, cannot be the address of the Pair Contract itself.

Can occur in `mint`, `burn`, `lend`, `withdraw`, `borrow` or `pay`.

Check the address passed, and verify it is not the Pair Contract's address.

### E205

The parameters passed are 0.

The parameters passed to the function can't be 0 (or can't be both 0). In `pay` the length of the arrays passed must be the same.

Can occur in `mint`, `burn`, `lend`, `withdraw`, `borrow` or `pay`.

Check the parameters passed to the function.

### E206

Total liquidity of the pool is 0.

Lend or borrow can only be done if the pool has some liquidity.

Can occur in `lend` or `borrow`.

Check the total liquidity of the pool and ensure it is not 0.

### E207

The start block of the due is the same as the current block for pay.

Borrow and Pay back can't happen in the same block.

Can occur in `pay`.

Check the transactions.

### E208

Difference between now and maturity is greater than 2\*\*32.

### E211

Reentrancy guard error.

### E212

`MintMath.getLiquidity` returned 0.

### E213

`collateralsOut[i]` is not equal to 0 for the owner who is not the one to call the function.

### E214

y parameter is increased than the max y increase.

### E215

z parameter is increased than the max z increase.

## E216

Can only be called by the factory owner.

## Libraries

### E301

Invariance error. When the new constant product is greater than the old constant product.

### E303

Product of `assetIn` and `due.collateral` must be greater than or equal to the product of `collateralOut` and `due.debt`.

### E304

Asset Safe Balance.

### E305

Collateral Safe Balance.
