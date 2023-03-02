// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IBondNFT.sol";
import "./interfaces/IGovNFT.sol";

contract Lock is Ownable{

    uint public constant minPeriod = 7;
    uint public constant maxPeriod = 365;

    IBondNFT public immutable bondNFT;
    IGovNFT public immutable govNFT;

    mapping(address => bool) public allowedAssets;
    mapping(address => uint) public totalLocked;

    constructor(
        address _bondNFTAddress,
        address _govNFT
    ) {
        bondNFT = IBondNFT(_bondNFTAddress);
        govNFT = IGovNFT(_govNFT);
    }

    /**
     * @notice Claim pending rewards from a bond
     * @param _id Bond NFT id
     * @return address claimed tigAsset address
     */
    function claim(
        uint256 _id
    ) public returns (address) {
        claimGovFees();
        (uint _amount, address _tigAsset) = bondNFT.claim(_id, msg.sender);
        IERC20(_tigAsset).transfer(msg.sender, _amount);
        return _tigAsset;
    }

    /**
     * @notice Claim pending rewards left over from a bond transfer
     * @param _tigAsset token address being claimed
     */
    function claimDebt(
        address _tigAsset
    ) external {
        claimGovFees();
        uint amount = bondNFT.claimDebt(msg.sender, _tigAsset);
        IERC20(_tigAsset).transfer(msg.sender, amount);
    }

    /**
     * @notice Lock up tokens to create a bond
     * @param _asset tigAsset being locked
     * @param _amount tigAsset amount
     * @param _period number of days to be locked for
     */
    function lock(
        address _asset,
        uint _amount,
        uint _period
    ) public {
        require(_period <= maxPeriod, "MAX PERIOD");
        require(_period >= minPeriod, "MIN PERIOD");
        require(allowedAssets[_asset], "!asset");

        claimGovFees();

        IERC20(_asset).transferFrom(msg.sender, address(this), _amount);
        totalLocked[_asset] += _amount;
        
        bondNFT.createLock( _asset, _amount, _period, msg.sender);
    }

    /**
     * @notice Reset the lock time and extend the period and/or token amount
     * @param _id Bond id being extended
     * @param _amount tigAsset amount being added
     * @param _period number of days being added
     */
    function extendLock(
        uint _id,
        uint _amount,
        uint _period
    ) public {
        address _asset = claim(_id);
        IERC20(_asset).transferFrom(msg.sender, address(this), _amount);
        bondNFT.extendLock(_id, _asset, _amount, _period, msg.sender);
    }

    /**
     * @notice Release the bond once it's expired
     * @param _id Bond id being released
     */
    function release(
        uint _id
    ) public {
        claimGovFees();
        (uint amount, uint lockAmount, address asset, address _owner) = bondNFT.release(_id, msg.sender);
        totalLocked[asset] -= lockAmount;
        IERC20(asset).transfer(_owner, amount);
    }

    /**
     * @notice Claim rewards from gov nfts and distribute them to bonds
     */
    function claimGovFees() public {
        address[] memory assets = bondNFT.getAssets();

        for (uint i=0; i < assets.length; i++) {
            uint balanceBefore = IERC20(assets[i]).balanceOf(address(this));
            IGovNFT(govNFT).claim(assets[i]);
            uint balanceAfter = IERC20(assets[i]).balanceOf(address(this));
            IERC20(assets[i]).approve(address(bondNFT), type(uint256).max);
            bondNFT.distribute(assets[i], balanceAfter - balanceBefore);
        }
    }

    /**
     * @notice Whitelist an asset
     * @param _tigAsset tigAsset token address
     * @param _isAllowed set tigAsset as allowed
     */
    function editAsset(
        address _tigAsset,
        bool _isAllowed
    ) external onlyOwner() {
        allowedAssets[_tigAsset] = _isAllowed;
    }

    /**
     * @notice Owner can retreive Gov NFTs
     * @param _ids array of gov nft ids
     */
    function sendNFTs(
        uint[] memory _ids
    ) external onlyOwner() {
        govNFT.safeTransferMany(msg.sender, _ids);
    }
}
