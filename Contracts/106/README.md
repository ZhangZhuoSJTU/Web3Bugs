## Backed Protocol contest details
- $28,500 USDC main award pot
- $1,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-04-backed-protocol-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts April 5, 2022 00:00 UTC
- Ends April 7, 2022 23:59 UTC

| Contract Name      | Source Lines of Code | 3rd Party Dependencies | External Calls |
| ----------- | ----------- | ----------- | ----------- |
| NFTLoanFacilitator      | 260       | OpenZeppelin Ownable, Solmate SafeTransferLib       | user provided loan asset (ERC20), user provided collateral asset (ERC721), BorrowTicket, LendTicket       |
| NFTLoanTicket   | 30        | Solmate ERC721        | NFTLoansTicketDescriptor (out of audit scope)       |
| LendTicket   | 31        |        |         |
| BorrowTicket   | 12        |        |         |
| INFTLoanFacilitator   | 93        |        |         |
| ILendTicket   | 4        |        |         |
| IERC20Mintable  | 4        |        |         |

## Scope
All of the contracts listed above are in scope for this audit. Anything not listed is not in scope. All of the rest of the code is used for generating the on-chain art for the borrow and lend tickets.

## Protocol Overview

### Summary

Backed protocol enables peer-to-peer loans with NFT collateral. Its main unique features are
1. No back and forth negotations: Borrowers propose minimum viable terms (loan asset, minimum loan amount, minimum duration, max interest rate) and the loan starts immediately once a lender meets or beats the minimum terms. 
2. No oracles: borrowers and lenders agree to loan terms and that's all that matters. The only "liquidation" type event is that lenders can seize the NFT collateral if the loan is past due.
3. Composability: borrowers get Borrow Tickets and lenders get Lend Tickets. Control flows query for the current owner of these ticket, rather than a static borrower/lender address. For example, when a loan is repaid, the funds go to the Lend Ticket holder, whoever that happens to be at the moment of that transaction. 
4. Perpetual lender buyout: a lender can be boughtout at any time by a new lender who meets the existing terms and beats at least one term by at least 10%, e.g. 10% longer duration, 10% higher loan amount, 10% lower interest. The new lender pays the previous lender their principal + any interest owed. The loan duration restarts on buyout.

### Detail
#### Walkthrough
##### Step 1: Create Loan
The first step in the loan process is for a potential borrower to create a loan. In this transaction, (1) the NFT collateral is transferred to the NFT loan facilitator contract (2) the loan terms are set based on values passed by the caller (loan asset, minimum loan amount, maximum interest rate, minimum duration), and (3) a Borrow Ticket NFT is transferred to an address of the callers choosing. The Borrow Ticket is significant in that (1) the holder can close the loan before it is lent to and get the NFT collateral back, (2) when the loan is already lent to, the loan amount is transferred to the Borrow Ticket holder and (3) on repayment, the NFT collateral is sent to the Borrow Ticket holder.

<img width="586" alt="image" src="https://user-images.githubusercontent.com/6678357/161337240-bb86d8f0-9293-4eae-9752-8d51180a8b89.png">

##### Step 2: Lend
Anyone can lend to a loan by submitting terms that meet or beat the loan terms (beating meaning higher amount, lower interest, or longer duration). On lend, the loan amount of the loan asset is transferred from the caller to the NFT loan facilitator contract. The facilitator contract then immediately passes on the loan amount, minus an origination fee, to the address holding the Borrow Ticket corresponding to this loan (Borrow Ticket token id == loan id). The facilitator contract mints and a Lend Ticket NFT to the lender. The Lend Ticket is significant in that (1) On loan repayment, funds are sent to the holder of the Lend Ticket and (2) the holder of the Lend Ticket NFT can seize the NFT collateral if the loan is past due. 

Throughout the loan duration, anyone can buyout the existing lender by meeting the existing terms and beating at least one of them by at least `requiredImprovementRate`, which is initialized at 10%, e.g. 10% longer duration, 10% higher amount, 10% lower interest rate. A buyout requires paying the existing lender their principal plus the interest accrued on the loan so far. A buyout transfers the Lend Ticket to the new lender. 

_Lending to a loan with no existing lender_

<img width="588" alt="image" src="https://user-images.githubusercontent.com/6678357/161337354-e0ab381b-9fad-4bd1-91be-8287bd4525b8.png">

_Lending to a loan with an existing lender_

<img width="680" alt="image" src="https://user-images.githubusercontent.com/6678357/161337432-cf21a6a8-c750-4fc9-bb88-e7c6f8f58a5d.png">

##### Step 3: Repay
Anyone can repay the loan, transferring principal plus interest accrued interest amount of the loan asset to the Lend Ticket holder and transferring the collateral NFT to the Borrow Ticket holder. The loan is then closed. 
<img width="711" alt="image" src="https://user-images.githubusercontent.com/6678357/161337490-604dd795-5420-4f92-a480-0fa276174f3e.png">

##### Step 3: Seize Collateral
If the loan repayment is past due, the Lend Ticket holder can seize the collateral. The collateral NFT will be transferred to an address passed in by the Lend Ticket holder. 


<img width="597" alt="image" src="https://user-images.githubusercontent.com/6678357/161337549-605555c0-c17c-4af3-b347-a74ee3366478.png">


#### Simple flow diagrams
A loan that was closed with no lender

<img width="412" alt="Screen Shot 2022-04-01 at 4 27 33 PM" src="https://user-images.githubusercontent.com/6678357/161338069-8c4f6410-7e42-4e92-a5f7-44406357ba81.png">


A repaid loan

<img width="616" alt="image" src="https://user-images.githubusercontent.com/6678357/161338082-2a150926-1843-47b8-a8e8-fcf678d5b61b.png">

A loan with seized collateral

<img width="622" alt="image" src="https://user-images.githubusercontent.com/6678357/161338113-a3bbfc85-0f82-4d22-9221-c6073eacfadc.png">

### Focus Areas 
The protocol does not custody any ERC20 assets on behalf of users. As far as ERC20s go, the concern is (1) exploits taking advantage of users having approved the contract to move their asset (2) exploits of the facilitator fees held in the contract. 

ERC721s are custodied in the contract. Exploits resulting in improper release of an ERC721 are top concern. The check-effect pattern has been followed, but re-entrancy exploits should be explored, along with anything else one can think of :) 

## Running the code
First install dependencies
```
$ yarn install
```

The repository has both Hardhat and Forge tests, run them with the following commands 
```
$ yarn hardhat test
$ forge test
```

To update `.gas-snapshot`, run 

```
$ forge snapshot
```

To run a particular test with forge, pass `-m` and the test name.
```
$ forge test -m testCreateLoan
```
This will run all tests that have `testCreateLoan` in their function name.

Verbosity of tests can be controlled by passing `-v`, up to `-vvvvv`.

For more on Forge/Foundry, see [here](https://book.getfoundry.sh).

## Testnet deploys
The contracts are deployed to the Rinkeby testnet.
| Contract      | Address |
| ----------- | ----------- |
| NFTLoanFacilitator      | 0x1A74E1254aC2041f24f2b86087e292A7326DbE89       |
| LendTicket   | 0xae59B4097dd87cfA1088DeED1B50319426D1420b        |
| BorrowTicket   | 0x5Fc77dd4987AffB6f2cE8Acb85a53e4f12EDd4cE        |


