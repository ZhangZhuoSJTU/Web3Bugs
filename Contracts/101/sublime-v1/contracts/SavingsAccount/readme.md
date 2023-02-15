# SavingsAccount

Savings account is a vault in which tokens can be deposited to invest in registered yield strategies. You can choose among which of the available strategies you want to invest the tokens into. The invested tokens can be transferred and withdrawn freely.

## deposit

```solidity
function deposit(
        address _token,
        address _strategy,
        address _to,
        uint256 _amount
) external override nonReentrant returns (uint256);
```

Deposit function is used to deposit tokens in the savings account. The savings account in turn will deposit the token in a yield strategy for investment. Savings account uses [StrategyRegistry](/contracts/yield/readme.md) to determine if the given strategy is valid. This method can be called by anyone to deposit tokens in the savings account.

Once the tokens are deposited the savings account saves the amount of shares received from the yield strategy.

## transfer

Savings account has transfer methods which work very similarly to how ERC20 transfer works. If the `msg.sender` is transferring tokens there is no need to increase allowance. Otherwise, there are allowance management methods which can be used to give allowance to 3rd party addresses which can perform the transfer the tokens or shares to another address.

Transfer method has 2 variants one for transferring the tokens `transfer` and the other for transferring the shares `transferShares`.

Transfer will move the shares of the `from` address to the `to` address.

## withdraw

Withdraw function can be used to withdraw tokens and receive them on the specified address. Withdraw function gives the option to determine if you want to receive the tokens or the shares at the receiving address. If you choose to receive the tokens the locked shares in the yield strategy will be withdrawn. If you choose to receive shares, the shares will be transferred form the savings account to the receiver.

Withdraw function also has 2 variants, one which takes the token amount as input and the other which takes the shares as the input. The output we have noted above depends on the option if you want to receive the tokens or the shares.