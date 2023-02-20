// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "./ERC677/ERC677.sol";
import "../contracts/DAO/Governable.sol";

///@author Justin Goro
///@title Flan
/**
 *@notice The reward token for Limbo. Flan can be minted without limit and is intended to converge on the price of DAI via various external incentives
 */
contract Flan is ERC677("Flan", "FLN"), Governable {
    event burnOnTransferFeeAdjusted(uint8 oldFee, uint8 newFee);
    mapping(address => uint256) public mintAllowance; //type(uint).max == whitelist

    uint8 public burnOnTransferFee = 0; //% between 1 and 100, recipient pays

    constructor(address dao) Governable(dao) {}

    /**
    * @param fee - % between 1 and 100, recipient pays
     */
    function setBurnOnTransferFee(uint8 fee) public onlySuccessfulProposal {
        _setBurnOnTransferFee(fee);
    }

    ///@notice flash governance technique for FOT change.
    function incrementBurnOnTransferFee(int8 change)
        public
        governanceApproved(false)
    {
        uint8 newFee = uint8(int8(burnOnTransferFee) + change);
        flashGoverner.enforceTolerance(newFee, burnOnTransferFee);
        _setBurnOnTransferFee(newFee);
    }

    function _setBurnOnTransferFee(uint8 fee) internal {
        uint8 priorFee = burnOnTransferFee;
        burnOnTransferFee = fee > 100 ? 100 : fee;
        emit burnOnTransferFeeAdjusted(priorFee, burnOnTransferFee);
    }

    ///@notice grants unlimited minting power to a contract
    ///@param minter contract to be given unlimited minting power
    ///@param enabled minting power enabled or disabled
    function whiteListMinting(address minter, bool enabled)
        public
        onlySuccessfulProposal
    {
        mintAllowance[minter] = enabled ? type(uint256).max : 0;
    }

    ///@notice metered minting power. Useful for once off minting
    function increaseMintAllowance(address minter, uint256 _allowance)
        public
        onlySuccessfulProposal
    {
        mintAllowance[minter] = mintAllowance[minter] + _allowance;
    }

    ///@notice minting of flan open to approved minters and LimboDAO
    ///@param recipient address to receive flan
    ///@param amount amount of flan to be minted 
    function mint(address recipient, uint256 amount) public returns (bool) {
        uint256 allowance = mintAllowance[_msgSender()];
        require(
            _msgSender() == owner() || allowance >= amount,
            "Flan: Mint allowance exceeded"
        );
        approvedMint(recipient, amount, _msgSender(), allowance);
        return true;
    }

    function approvedMint(
        address recipient,
        uint256 amount,
        address minter,
        uint256 allowance
    ) internal {
        _mint(recipient, amount);
        if (allowance < type(uint256).max && minter != owner()) {
            mintAllowance[minter] = mintAllowance[minter] - amount;
        }
    }

    function safeTransfer(address _to, uint256 _amount) external {
        uint256 flanBal = balanceOf(address(this));
        uint256 flanToTransfer = _amount > flanBal ? flanBal : _amount;
        _transfer(_msgSender(), _to, flanToTransfer);
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal override {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        uint256 fee = (burnOnTransferFee * amount) / 100;

        _totalSupply = _totalSupply - fee;
        uint256 senderBalance = _balances[sender];
        require(
            senderBalance >= amount,
            "ERC20: transfer amount exceeds balance"
        );
        _balances[sender] = senderBalance - amount;
        _balances[recipient] += amount - fee;

        emit Transfer(sender, recipient, amount);
    }
}
