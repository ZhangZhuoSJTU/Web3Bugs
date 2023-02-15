# @version 0.2.11


interface Vault:
    def token() -> address: view
    def apiVersion() -> String[28]: view
    def governance() -> address: view
    def initialize(
        token: address,
        governance: address,
        rewards: address,
        name: String[64],
        symbol: String[32],
        guardian: address,
    ): nonpayable


# len(releases)
numReleases: public(uint256)
releases: public(HashMap[uint256, address])

# Token => len(vaults)
numVaults: public(HashMap[address, uint256])
vaults: public(HashMap[address, HashMap[uint256, address]])

# Index of token added => token address
tokens: public(HashMap[uint256, address])
# len(tokens)
numTokens: public(uint256)
# Inclusion check for token
isRegistered: public(HashMap[address, bool])

# 2-phase commit
governance: public(address)
pendingGovernance: public(address)

tags: public(HashMap[address, String[120]])
banksy: public(HashMap[address, bool])  # could be anyone

event NewRelease:
    release_id: indexed(uint256)
    template: address
    api_version: String[28]

event NewVault:
    token: indexed(address)
    vault_id: indexed(uint256)
    vault: address
    api_version: String[28]

event NewExperimentalVault:
    token: indexed(address)
    deployer: indexed(address)
    vault: address
    api_version: String[28]

event NewGovernance:
    governance: address

event VaultTagged:
    vault: address
    tag: String[120]

@external
def __init__():
    self.governance = msg.sender


@external
def setGovernance(governance: address):
    """
    @notice Starts the 1st phase of the governance transfer.
    @dev Throws if the caller is not current governance.
    @param governance The next governance address
    """
    assert msg.sender == self.governance  # dev: unauthorized
    self.pendingGovernance = governance


@external
def acceptGovernance():
    """
    @notice Completes the 2nd phase of the governance transfer.
    @dev
        Throws if the caller is not the pending caller.
        Emits a `NewGovernance` event.
    """
    assert msg.sender == self.pendingGovernance  # dev: unauthorized
    self.governance = msg.sender
    log NewGovernance(msg.sender)


@view
@external
def latestRelease() -> String[28]:
    """
    @notice Returns the api version of the latest release.
    @dev Throws if no releases are registered yet.
    @return The api version of the latest release.
    """
    # NOTE: Throws if there has not been a release yet
    return Vault(self.releases[self.numReleases - 1]).apiVersion()  # dev: no release


@view
@external
def latestVault(token: address) -> address:
    """
    @notice Returns the latest deployed vault for the given token.
    @dev Throws if no vaults are endorsed yet for the given token.
    @param token The token address to find the latest vault for.
    @return The address of the latest vault for the given token.
    """
    # NOTE: Throws if there has not been a deployed vault yet for this token
    return self.vaults[token][self.numVaults[token] - 1]  # dev: no vault for token


@external
def newRelease(vault: address):
    """
    @notice
        Add a previously deployed Vault as the template contract for the latest release,
        to be used by further "forwarder-style" delegatecall proxy contracts that can be
        deployed from the registry throw other methods (to save gas).
    @dev
        Throws if caller isn't `self.governance`.
        Throws if `vault`'s governance isn't `self.governance`.
        Throws if the api version is the same as the previous release.
        Emits a `NewVault` event.
    @param vault The vault that will be used as the template contract for the next release.
    """
    assert msg.sender == self.governance  # dev: unauthorized

    # Check if the release is different from the current one
    # NOTE: This doesn't check for strict semver-style linearly increasing release versions
    release_id: uint256 = self.numReleases  # Next id in series
    if release_id > 0:
        assert (
            Vault(self.releases[release_id - 1]).apiVersion()
            != Vault(vault).apiVersion()
        )  # dev: same api version
    # else: we are adding the first release to the Registry!

    # Update latest release
    self.releases[release_id] = vault
    self.numReleases = release_id + 1

    # Log the release for external listeners (e.g. Graph)
    log NewRelease(release_id, vault, Vault(vault).apiVersion())


@internal
def _newProxyVault(
    token: address,
    governance: address,
    rewards: address,
    guardian: address,
    name: String[64],
    symbol: String[32],
    releaseTarget: uint256,
) -> address:
    release: address = self.releases[releaseTarget]
    assert release != ZERO_ADDRESS  # dev: unknown release
    vault: address = create_forwarder_to(release)

    # NOTE: Must initialize the Vault atomically with deploying it
    Vault(vault).initialize(token, governance, rewards, name, symbol, guardian)

    return vault


@internal
def _registerVault(token: address, vault: address):
    # Check if there is an existing deployment for this token at the particular api version
    # NOTE: This doesn't check for strict semver-style linearly increasing release versions
    vault_id: uint256 = self.numVaults[token]  # Next id in series
    if vault_id > 0:
        assert (
            Vault(self.vaults[token][vault_id - 1]).apiVersion()
            != Vault(vault).apiVersion()
        )  # dev: same api version
    # else: we are adding a new token to the Registry

    # Update the latest deployment
    self.vaults[token][vault_id] = vault
    self.numVaults[token] = vault_id + 1

    # Register tokens for endorsed vaults
    if not self.isRegistered[token]:
        self.isRegistered[token] = True
        self.tokens[self.numTokens] = token
        self.numTokens += 1

    # Log the deployment for external listeners (e.g. Graph)
    log NewVault(token, vault_id, vault, Vault(vault).apiVersion())


@external
def newVault(
    token: address,
    guardian: address,
    rewards: address,
    name: String[64],
    symbol: String[32],
    releaseDelta: uint256 = 0,  # NOTE: Uses latest by default
) -> address:
    """
    @notice
        Create a new vault for the given token using the latest release in the registry,
        as a simple "forwarder-style" delegatecall proxy to the latest release. Also adds
        the new vault to the list of "endorsed" vaults for that token.
    @dev
        `governance` is set in the new vault as `self.governance`, with no ability to override.
        Throws if caller isn't `self.governance`.
        Throws if no releases are registered yet.
        Throws if there already is a registered vault for the given token with the latest api version.
        Emits a `NewVault` event.
    @param token The token that may be deposited into the new Vault.
    @param guardian The address authorized for guardian interactions in the new Vault.
    @param rewards The address to use for collecting rewards in the new Vault
    @param name Specify a custom Vault name. Set to empty string for default choice.
    @param symbol Specify a custom Vault symbol name. Set to empty string for default choice.
    @param releaseDelta Specify the number of releases prior to the latest to use as a target. Default is latest.
    @return The address of the newly-deployed vault
    """
    assert msg.sender == self.governance  # dev: unauthorized

    # NOTE: Underflow if no releases created yet, or targeting prior to release history
    releaseTarget: uint256 = self.numReleases - 1 - releaseDelta  # dev: no releases
    vault: address = self._newProxyVault(token, msg.sender, rewards, guardian, name, symbol, releaseTarget)

    self._registerVault(token, vault)

    return vault


@external
def newExperimentalVault(
    token: address,
    governance: address,
    guardian: address,
    rewards: address,
    name: String[64],
    symbol: String[32],
    releaseDelta: uint256 = 0,  # NOTE: Uses latest by default
) -> address:
    """
    @notice
        Create a new vault for the given token using the latest release in the registry,
        as a simple "forwarder-style" delegatecall proxy to the latest release. Does not add
        the new vault to the list of "endorsed" vaults for that token.
    @dev
        Throws if no releases are registered yet.
        Emits a `NewExperimentalVault` event.
    @param token The token that may be deposited into the new Vault.
    @param governance The address authorized for governance interactions in the new Vault.
    @param guardian The address authorized for guardian interactions in the new Vault.
    @param rewards The address to use for collecting rewards in the new Vault
    @param name Specify a custom Vault name. Set to empty string for default choice.
    @param symbol Specify a custom Vault symbol name. Set to empty string for default choice.
    @param releaseDelta Specify the number of releases prior to the latest to use as a target. Default is latest.
    @return The address of the newly-deployed vault
    """
    # NOTE: Underflow if no releases created yet, or targeting prior to release history
    releaseTarget: uint256 = self.numReleases - 1 - releaseDelta  # dev: no releases
    # NOTE: Anyone can call this method, as a convenience to Strategist' experiments
    vault: address = self._newProxyVault(token, governance, rewards, guardian, name, symbol, releaseTarget)

    # NOTE: Not registered, so emit an "experiment" event here instead
    log NewExperimentalVault(token, msg.sender, vault, Vault(vault).apiVersion())

    return vault


@external
def endorseVault(vault: address, releaseDelta: uint256 = 0):
    """
    @notice
        Adds an existing vault to the list of "endorsed" vaults for that token.
    @dev
        `governance` is set in the new vault as `self.governance`, with no ability to override.
        Throws if caller isn't `self.governance`.
        Throws if `vault`'s governance isn't `self.governance`.
        Throws if no releases are registered yet.
        Throws if `vault`'s api version does not match latest release.
        Throws if there already is a deployment for the vault's token with the latest api version.
        Emits a `NewVault` event.
    @param vault The vault that will be endorsed by the Registry.
    @param releaseDelta Specify the number of releases prior to the latest to use as a target. Default is latest.
    """
    assert msg.sender == self.governance  # dev: unauthorized
    assert Vault(vault).governance() == msg.sender  # dev: not governed

    # NOTE: Underflow if no releases created yet, or targeting prior to release history
    releaseTarget: uint256 = self.numReleases - 1 - releaseDelta  # dev: no releases
    api_version: String[28] = Vault(self.releases[releaseTarget]).apiVersion()
    assert Vault(vault).apiVersion() == api_version  # dev: not target release

    # Add to the end of the list of vaults for token
    self._registerVault(Vault(vault).token(), vault)


@external
def setBanksy(tagger: address, allowed: bool = True):
    """
    @notice Set the ability of a particular tagger to tag current vaults.
    @dev Throws if caller is not `self.governance`.
    @param tagger The address to approve or deny access to tagging.
    @param allowed Whether to approve or deny `tagger`. Defaults to approve.
    """
    assert msg.sender == self.governance  # dev: unauthorized
    self.banksy[tagger] = allowed


@external
def tagVault(vault: address, tag: String[120]):
    """
    @notice Tag a Vault with a message.
    @dev
        Throws if caller is not `self.governance` or an approved tagger.
        Emits a `VaultTagged` event.
    @param vault The address to tag with the given `tag` message.
    @param tag The message to tag `vault` with.
    """
    if msg.sender != self.governance:
        assert self.banksy[msg.sender]  # dev: not banksy
    # else: we are governance, we can do anything banksy can do

    self.tags[vault] = tag
    log VaultTagged(vault, tag)
