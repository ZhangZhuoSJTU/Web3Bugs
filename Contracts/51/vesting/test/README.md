# Vesting contract unit testing
All the test functions illustrated below is done locally.

## Testing
### Team Vesting
* Inside `beforeEach` funtion:
	1. create signers `owner`, `owner2` `addr1`, `addr2`, `addr3`, `addr4`
	1. `owner` create, deploy an ERC20 token contract
	1. `owner` create, deploy the TeamVesting contract with address (say `teamVestingC`)
	1. `owner` mint 1 Trillion tokens to itself
	1. `owner` transfer 10% of total tokens to `teamVestingC`
* "`owner` is able to transfer ownership to `owner2`"
* "`owner` is able to pause the `vesting` function"
* "`owner` is able to pause the `revoke` function"
* "`owner` is able to pause the `withdraw` function"
* "`owner` is able to pause the `claimableAmount` function"
* "Reverts execution of `vesting` function when paused"
* "Reverts execution of `revoke` function when paused"
* "Reverts execution of `withdraw` function when paused"
* "Reverts execution of `claimableAmount` function when paused"
* "Reverts during vesting by `owner`, when the `TOTAL_AMOUNT` is already vested"
	1. `owner` successfully vests tokens (say 10 B) for a team member `addr1`
	1. `owner` successfully vests tokens (say 30 B) for another team member `addr2`
	1. `owner` successfully vests tokens (say 40 B) for another team member `addr3`
	1. `owner` successfully vests tokens (say 20 B) for another team member `addr4`
	1. Fails when `owner` further vests tokens
* "`addr1` successfully claim tokens"
	1. `owner` successfully vests tokens (say 10 B) for a team member `addr1`
	1. `addr1` use `withdraw` function when the 1st unlocking happens 
	1. `addr1` use `withdraw` function when the 2nd unlocking happens 
	1. `addr1` use `withdraw` function when the 3rd unlocking happens
* "`owner` is able to revoke a vesting"
	1. `owner` successfully vests tokens (say 10 B) for a team member `addr1`
	1. `owner` use `revoke` function to stop vesting
* "Reverts, when`addr1` claim a revoked vesting"
	1. `owner` successfully vests tokens (say 10 B) for a team member `addr1`
	1. `owner` use `revoke` function to stop vesting
	1. Fails when `addr1` use `claim` function
