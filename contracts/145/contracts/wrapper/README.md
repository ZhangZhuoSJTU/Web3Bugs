# ENS Name Wrapper

The ENS Name Wrapper is a smart contract that wraps existing ENS names, providing several new features:

- Wrapped names are ERC1155 tokens
- Better permission control over wrapped names
- Native expiry support for all names
- Consistent API for names at any level of the hierarchy

In addition to implementing ERC1155, wrapped names have an ERC721-compatible `ownerOf` function to return the owner of a wrapped name.

Making ENS names ERC1155 compatible allows them to be displayed, transferred and traded in any wallet that supports the standard.

`NameWrapper` implements the optional ERC1155 metadata extension; presently this is via an HTTPS URL to a service ENS operates, but this can be changed in future as better options become available.

With the exception of the functionality to upgrade the metadata generation for tokens. 

## Wrapping a name

`.eth` 2LDs (second-level domains) such as `example.eth` can be wrapped by calling `wrapETH2LD(label, wrappedOwner, fuses, expiry resolver)`. `label` is the first part of the domain name (eg, `'example'` for `example.eth`), `wrappedOwner` is the desired owner for the wrapped name, and `fuses` is a bitfield representing permissions over the name that should be irrevoacably burned (see 'Fuses' below). A `fuses` value of `0` represents no restrictions on the name. The resolver can also optionally be set here and would need to be a _wrapper aware_ resolver that uses the NameWrapper ownership over the Registry ownership.

In order to wrap a `.eth` 2LD, the owner of the name must have authorised the wrapper by calling `setApprovalForAll` on the registrar, and the caller of `wrapETH2LD` must be either the owner, or authorised by the owner on either the wrapper or the registrar.

All other domains (non `.eth` names as well as `.eth` subdomains such as `sub.example.eth` can be wrapped by calling `wrap(dnsEncodedName, wrappedOwner, resolver)`. `parentNode` is the namehash of the name one level higher than the name to be wrapped, `dnsEncodedName` is the full [DNS encoded name](http://www.tcpipguide.com/free/t_DNSNameNotationandMessageCompressionTechnique.htm#:~:text=Instead%2C%20DNS%20uses%20a%20special,are%20encoded%2C%20one%20per%20byte.), `wrappedOwner` is the address that should own the wrapped name. To wrap `sub.example.eth`, you should call `wrap(encodeDNSName('sub.example.eth'), owner, resolver)`. 

In order to wrap a domain that is not a `.eth` 2LD, the owner of the name must have authorised the wrapper by calling `setApprovalForAll` on the registry, and the caller of `wrap` must be either the owner, or authorised by the owner on either the wrapper or the registry.

## Wrapping a name by sending the `.eth` token

An alternative way to wrap `.eth` names is to send the name to the NameWrapper contract, this bypasses the need to `setApprovalForAll` on the registrar and is preferable when only wrapping one name.

To wrap a name by sending to the contract, you must use `safeTransferFrom(address,address,uint256,bytes)` with the extra data (the last parameter) ABI formatted as `[string label, address owner, uint32 fuses, uint64 expiry, address resolver]`.

Example:

```js
// Using ethers.js v5
abiCoder.encode(
  ['string', 'address', 'uint32', 'uint64', 'address'],
  ['vitalik', '0x...', 1, 0, '0x...']
)
```

## Unwrapping a name

Wrapped names can be unwrapped by calling either `unwrapETH2LD(labelHash, newRegistrant, newController)` or `unwrap(parentNode, label, newController)` as appropriate. `label` and `parentNode` have meanings as described under "Wrapping a name", while `newRegistrant` is the address that should own the .eth registrar token, and `newController` is the address that should be set as the owner of the ENS registry record.

## Working with wrapped names

The wrapper exposes almost all the registry functionality via its own methods - `setRecord`, `setResolver` and `setTTL` are all implemented with the same functionality as the registry, and pass through to it after doing authorisation checks. Transfers are handled via ERC1155's transfer methods rather than mirroring the registry's `setOwner` method.

In addition, `setSubnodeOwner` and `setSubnodeRecord` methods are enhanced, which create or replace subdomains while automatically wrapping the resulting subdomain if it is not already wrapped. 

All functions for working with wrapped names utilise ERC1155's authorisation mechanism, meaning an account that is authorised to act on behalf of another account can manage all its names.

## Fuses

`NameWrapper` also implements a permissions mechanism called 'fuses'. Each name has a set of fuses representing permissions over that name. Fuses can be 'burned' either at the time the name is wrapped or at any subsequent time when the owner or authorised operator calls `burnFuses` or `burnChildFuses`. Once a fuse is burned, it cannot be 'unburned' - the permission that fuse represents is permanently revoked.

Before any fuses can be burned on a name, the name's `PARENT_CANNOT_CONTROL` fuse has to be burned first. Without this restriction, any permissions revoked via fuses can be evaded by the owner of the parent or the name itself replacing the subdomain and then re-wrapping it with a more permissive fuse field. This is enforced by the contract reverting if that fuse has not been burned if you try to burn any fuses. Only the parent domain or a .eth name owner can burn this fuse.

When any fuses on a name are burned, the "unwrap" fuse must also be burned, to prevent the name being directly unwrapped and re-wrapped to reset the fuses. This restriction is also enforced by the contract and reverts if you try to burn fuses on a name that does not have those fuses burned.

In addition to burning these two fuses a name must also have an expiry of less than the current date. If the name has expired, the fuses will automatically be set to 0. This is enforced by the contract, but does *not* revert, however no fuses will be burned. Expiry will be explained in more detail below.

The ENS root and the .eth 2LD are treated as having the "replace subdomain" and "unwrap" fuses burned. There is one edge-case here insofar as a .eth name's registration can expire; at that point the name can be purchased by a new registrant and effectively becomes unwrapped despite any fuse restrictions. When that name is re-wrapped, fuse fields can be set to a more permissive value than the name previously had. Any application relying on fuse values for .eth subdomains should check the expiration date of the .eth name and warn users if this is likely to expire soon.

The fuses field is 32 bits, and only 7 fuses are defined by the `NameWrapper` contract itself. Applications may use additional fuse bits to encode their own restrictions on applications. Any application wishing to do so should submit a PR to this README in order to record the use of the value and ensure there is no unintentional overlap.

Each fuse is represented by a single bit. If that bit is cleared (0) the restriction is not applied, and if it is set (1) the restriction is applied. Any updates to the fuse field for a name are treated as a logical-OR; as a result bits can only be set, never cleared.


### CANNOT_UNWRAP = 1

If this fuse is burned, the name cannot be unwrapped, and calls to `unwrap` and `unwrapETH2LD` will fail.

### CANNOT_BURN_FUSES = 2

If this fuse is burned, no further fuses can be burned. This has the effect of 'locking open' some set of permissions on the name. Calls to `burnFuses` will fail.

### CANNOT_TRANSFER = 4

If this fuse is burned, the name cannot be transferred. Calls to `safeTransferFrom` and `safeBatchTransferFrom` will fail.

### CANNOT_SET_RESOLVER = 8

If this fuse is burned, the resolver cannot be changed. Calls to `setResolver` and `setRecord` will fail.

### CANNOT_SET_TTL = 16

If this fuse is burned, the TTL cannot be changed. Calls to `setTTL` and `setRecord` will fail.

### CANNOT_CREATE_SUBDOMAIN = 32

If this fuse is burned, new subdomains cannot be created. Calls to `setSubnodeOwner` and `setSubnodeRecord` will fail if they reference a name that does not already exist.

### PARENT_CANNOT_CONTROL = 64

If this fuse is burned, existing subdomains cannot be replaced by the parent name and the parent can no longer burn other fuses on this child. Calls to `setSubnodeOwner` and `setSubnodeRecord`, will fail if they reference a name that already exists. This fuse can only be burnt by the parent of a node.

### Expiry

Each name has an expiry field that is associated with each wrapped name. A valid expiry enforces all fuses and conversely an invalid expiry changes all the fuses of a name to 0. If a name has fuses burned and the expiry is still in the future, it is guaranteed to be safe until that time. Expiry can *only* be extended and never reversed and only the owner of the parent (except for .eth 2LDs) can change the expiry. It can *only* be extended up to the parent's current expiry. Adding these restrictions means that you only have to look at the name itself's fuses and expiry (without traversing the hierarchy) to understand what guarantees you have.

Expiry for .eth name is not the same as the expiry date in the BaseRegistrar. The expiry of a .eth name can be set by the owner of the name itself (not just the parent) and can be anything up to the expiry in the BaseRegistrar.

### Checking Fuses using `allFusesBurned(node, fuseMask)`

To check whether or not a fuse is burnt you can use this function that takes a fuse mask of all fuses you want to check.

```js
const areBurned = await allFusesBurned(
  namehash('vitalik.eth'),
  CANNOT_TRANSFER | CANNOT_SET_RESOLVER
)
// if CANNOT_UNWRAP AND CANNOT_SET_RESOLVER are *both* burned this will return true
```

### Get current fuses and expiry using `getFuses(node)`

Get fuses gets the raw fuses for a current node and also the expiry of those fuses. The raw fuses it returns will be a `uint32` and you will have to decode this yourself. If you just need to check a fuse has been burned, you can call `allFusesBurned` as it will use less gas.

## Installation and setup

```bash
npm install
```

## Testing

```bash
npm run test
```

Any contract with `2` at the end, is referring to the contract being called by `account2`, rather than `account1`. This is for tests that require authorising another user.

## Deploying test contracts into Rinkeby

### Create .env

```
cp .env.org .env
```

### Set credentials

```
PRIVATE_KEY=
ETHERSCAN_API_KEY=
INFURA_API_KEY=
```

Please leave the following fields as blank

```
SEED_NAME=
METADATA_ADDRESS=
WRAPPER_ADDRESS=
RESOLVER_ADDRESS=
```

### Run deploy script

`yarn deploy:rinkeby` will deploy to rinkeby and verify its source code

NOTE: If you want to override the default metadata url, set `METADATA_HOST=` to `.env`

```
$yarn deploy:rinkeby
yarn run v1.22.10
$ npx hardhat run --network rinkeby scripts/deploy.js
Deploying contracts to rinkeby with the account:0x97bA55F61345665cF08c4233b9D6E61051A43B18
Account balance: 1934772596667918724 true
{
  registryAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
  registrarAddress: '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85'
}
Setting metadata service to https://ens-metadata-service.appspot.com/name/0x{id}
Metadata address: 0x08f2D8D8240fC70FD777358b0c63e539714DD473
Wrapper address: 0x88ce50eFeA21996B20838d5E71994191562758f9
Resolver address: 0x784b7B9BA0Fc04b90187c06C0C7efC51AeA06aFB
wait for 5 sec until bytecodes are uploaded into etherscan
verify  0x08f2D8D8240fC70FD777358b0c63e539714DD473 with arguments https://ens-metadata-service.appspot.com/name/0x{id}
verify  0x88ce50eFeA21996B20838d5E71994191562758f9 with arguments 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e,0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85,0x08f2D8D8240fC70FD777358b0c63e539714DD473
verify  0x784b7B9BA0Fc04b90187c06C0C7efC51AeA06aFB with arguments 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e,0x88ce50eFeA21996B20838d5E71994191562758f9
```

After running the script it sets addresses to `.env`. If you want to redeploy some of contracts, remove the contract address from `.env` and runs the script again.

## Seeding test data into Rinkeby

1. Register a name using the account you used to deploy the contract
2. Set the label (`matoken` for `matoken.eth`) to `SEED_NAME=` on `.env`
3. Run `yarn seed:rinkeby`

```
~/.../ens/name-wrapper (seed)$yarn seed:rinkeby
yarn run v1.22.10
$ npx hardhat run --network rinkeby scripts/seed.js
Account balance: 1925134991223891632
{
  registryAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
  registrarAddress: '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85',
  wrapperAddress: '0x88ce50eFeA21996B20838d5E71994191562758f9',
  resolverAddress: '0x784b7B9BA0Fc04b90187c06C0C7efC51AeA06aFB',
  firstAddress: '0x97bA55F61345665cF08c4233b9D6E61051A43B18',
  name: 'wrappertest4'
}
Wrapped NFT for wrappertest4.eth is available at https://testnets.opensea.io/assets/0x88ce50eFeA21996B20838d5E71994191562758f9/42538507198368349158588132934279877358592939677496199760991827793914037599925
Wrapped NFT for sub2.wrappertest4.eth is available at https://testnets.opensea.io/assets/0x88ce50eFeA21996B20838d5E71994191562758f9/22588238952906792220944282072078294622689934598844133294480594786812258911617
```

## Notes on upgrading the Name Wrapper

The Name Wrapper has a built-in upgrade function that allows the owner of the Name Wrapper to set a new contract for all names to be migrated to as a last resort migration. Upgrading a name is optional and is only able to be done by the owner of the name in the original NameWrapper. A name can only be migrated when the parent has been migrated to the new registrar. By default the `ROOT_NODE` and `ETH_NODE` should be wrapped in the constructor of the new Name Wrapper.

The upgraded namewrapper must include the interface `INameWrapperUpgrade.sol`, which mandates two functions that already exist in the new wrapper: `wrapETH2LD` and `setSubnodeRecord`. The `wrapETH2LD` function can be used as-is, however the `setSubnodeRecord` needs one additional permission, which checks for if the parent of the name you are wrapping has already been wrapped and the `msg.sender` is the old wrapper.

```solidity
// Example of that check in solidity
require(isTokenOwnerOrApproved(parentNode) || msg.sender == oldWrapperAddress && registrar.ownerOf(parentLabelHash) == address(this))
```

It is recommended to have this check after the normal checks, so normal usage in the new wrapper does not cost any additional gas (unless the require actually reverts)