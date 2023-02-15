# Yield strategies

Borrow asset and collateral asset deposited in the savings account is invested in various yield bearing protocols for maximum returns for users.

## StrategyRegistry

This contract is used to whitelist yield strategy contracts where user funds can be invested for yield.

## CompoundYield

```solidity
function lockTokens(
        address _user,
        address _asset,
        uint256 _amount
) external;
```

Compound protocol has C-Tokens which are yield bearing. When user selects to invest the funds in Compound protocol the Savings account contract will lock the provided token in the C-Token contract which will mint the equivalent amount of C-Tokens.

## NoYield

This contact is used as a placeholder when the user does not want to invest in Compound protocol. As the name suggests this contract will give no yield.



