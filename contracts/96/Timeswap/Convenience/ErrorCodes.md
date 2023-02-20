# Error Codes

Documents all the Error Codes in Timeswap-V1-Convenience

## Contracts

### E401

The callback should be from pair.

### E402

The callback should be from Collateralized Debt Token.

### E403

Only convenience contract can call the function.

### E404

TokenURI doesn't exist.

## Libraries

### E501

Pair doesn't exist.

### E502

Natives don't exist for that pair and maturity.

### E503

Natives exist for that pair and maturity.

### E504

Current timestamp is after deadline.

### E505

Percent is out of range.

Percent variable is supposed to be between 0 and 2^32 both inclusive.

### E506

New liquidity can only be call to initialize a new pool.

### E507

Add liquidity can only be called to an already initialized pool.

### E508

Maturity is less that current Timestamp.

### E511

Liquidity is less than min Liquidity.

### E512

Debt is greater than max Debt.

### E513

Collateral is greater than max Collateral.

### E514

Bond is less than min Bond.

### E515

Insurance is less than min Insurance.

### E516

Debt In is less than or equal to Asset In.

### E517

Bond Out is less than or equal to Asset In.

### E518

Debt In is less than or equal to Asset Out.

### E519

Asset In is greater than max Asset.

### E520

Ids length and maxAssetsIn length do not match.

### E521

ETH transfer failed

## Base

### E601

`to` is null Address.

### E602

Current timestamp is after the deadline

### E603

Signer is not the owner

### E604

ERC721 already minted

### E605

Approval to the current owner

### E606

Signer should be a valid address

### E607

Cannot approve to the caller

### E608

Not safe transfer

### E609

Approve caller is not owner nor approved for all

### E610

Transfer to non ERC721Receiver implementer

### E611

Not approved to transfer

### E612

Factory address should not be the weth address

### E613

`owner` is null address

### E614

Token does not exist

## Callback

### E701

Invalid Sender
