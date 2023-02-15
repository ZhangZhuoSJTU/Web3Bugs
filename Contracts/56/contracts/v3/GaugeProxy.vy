# @version 0.2.8
"""
@title Curve LiquidityGaugeV2 Ownerhip Proxy
@author Curve Finance
@license MIT
"""

interface LiquidityGauge:
    def set_rewards(_reward_contract: address, _sigs: bytes32, _reward_tokens: address[8]): nonpayable
    def set_killed(_is_killed: bool): nonpayable
    def commit_transfer_ownership(addr: address): nonpayable
    def accept_transfer_ownership(): nonpayable


event CommitAdmins:
    ownership_admin: address
    emergency_admin: address

event ApplyAdmins:
    ownership_admin: address
    emergency_admin: address


ownership_admin: public(address)
emergency_admin: public(address)

future_ownership_admin: public(address)
future_emergency_admin: public(address)


@external
def __init__(_ownership_admin: address, _emergency_admin: address):
    self.ownership_admin = _ownership_admin
    self.emergency_admin = _emergency_admin


@external
def commit_set_admins(_o_admin: address, _e_admin: address):
    """
    @notice Set ownership admin to `_o_admin` and emergency admin to `_e_admin`
    @param _o_admin Ownership admin
    @param _e_admin Emergency admin
    """
    assert msg.sender == self.ownership_admin, "Access denied"

    self.future_ownership_admin = _o_admin
    self.future_emergency_admin = _e_admin

    log CommitAdmins(_o_admin, _e_admin)


@external
def accept_set_admins():
    """
    @notice Apply the effects of `commit_set_admins`
    @dev Only callable by the new owner admin
    """
    assert msg.sender == self.future_ownership_admin, "Access denied"

    e_admin: address = self.future_emergency_admin
    self.ownership_admin = msg.sender
    self.emergency_admin = e_admin

    log ApplyAdmins(msg.sender, e_admin)


@external
@nonreentrant('lock')
def commit_transfer_ownership(_gauge: address, new_owner: address):
    """
    @notice Transfer ownership for liquidity gauge `_gauge` to `new_owner`
    @param _gauge Gauge which ownership is to be transferred
    @param new_owner New gauge owner address
    """
    assert msg.sender == self.ownership_admin, "Access denied"
    LiquidityGauge(_gauge).commit_transfer_ownership(new_owner)


@external
@nonreentrant('lock')
def accept_transfer_ownership(_gauge: address):
    """
    @notice Apply transferring ownership of `_gauge`
    @param _gauge Gauge address
    """
    LiquidityGauge(_gauge).accept_transfer_ownership()


@external
@nonreentrant('lock')
def set_killed(_gauge: address, _is_killed: bool):
    """
    @notice Set the killed status for `_gauge`
    @dev When killed, the gauge always yields a rate of 0 and so cannot mint CRV
    @param _gauge Gauge address
    @param _is_killed Killed status to set
    """
    assert msg.sender in [self.ownership_admin, self.emergency_admin], "Access denied"

    LiquidityGauge(_gauge).set_killed(_is_killed)


@external
@nonreentrant('lock')
def set_rewards(_gauge: address, _reward_contract: address, _sigs: bytes32, _reward_tokens: address[8]):
    """
    @notice Set the active reward contract for `_gauge`
    @param _gauge Gauge address
    @param _reward_contract Reward contract address. Set to ZERO_ADDRESS to
                            disable staking.
    @param _sigs Four byte selectors for staking, withdrawing and claiming,
                 right padded with zero bytes. If the reward contract can
                 be claimed from but does not require staking, the staking
                 and withdraw selectors should be set to 0x00
    @param _reward_tokens List of claimable tokens for this reward contract
    """
    assert msg.sender == self.ownership_admin, "Access denied"

    LiquidityGauge(_gauge).set_rewards(_reward_contract, _sigs, _reward_tokens)
