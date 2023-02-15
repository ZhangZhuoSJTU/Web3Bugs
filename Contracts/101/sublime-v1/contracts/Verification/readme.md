# Verification contracts

Verification contract is used to verify if the addresses are whitelisted for interaction with the contract or not. For example, you can choose `TwitterVerification` to determine which addresses are valid to become lenders and `AdminVerification` to verify which addresses are valid to become borrowers.

This contract is used to register available verification contracts and also store the whitelisted addresses against each verification contract.

The Verifier contracts interact with the Verification contract to register master addresses and linked addresses

### master address

```solidity
function registerMasterAddress(address _masterAddress, bool _isMasterLinked) external override onlyVerifier;
```

the master address needs to be verified first. It can be used to verify more linked addresses later.

### linked address

```solidity
function requestAddressLinking(address _linkedAddress) external;
```

A linked address is considered as valid if the master address is valid and active and the linked address is also active.


## TwitterVerification

```solidity
function registerSelf(
        bool _isMasterLinked,
        uint8 _v,
        bytes32 _r,
        bytes32 _s,
        string memory _twitterId,
        string memory _tweetId,
        uint256 _timestamp
) external;
```

Twitter verifier is used to verify users using twitter account ids by tweeting signed tweets on twitter. The users will tweet a message which contains the address of the user along with a signature from the verification bot.

The user data stored against the master address in twitter verifier contains the tweet id which was used to display the address and the twiiter handle. Thus, anyone can verify the twitter identity of the address using twitter verifier contract.

## AdminVerification

Admin verification just uses the signed data from the stored signer address to verify the address. A user with valid signature data can verify themselves. The difference between twitter verifier and admin verifier is the mechanism of obtaining the signature data and the stored user data against the master address.

For admin verifier the data is of no use essentially.

