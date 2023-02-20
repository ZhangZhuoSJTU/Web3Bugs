// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IDue} from './interfaces/IDue.sol';
import {IERC721Receiver} from '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';
import {IConvenience} from './interfaces/IConvenience.sol';
import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ERC721Permit} from './base/ERC721Permit.sol';
import {SafeMetadata} from './libraries/SafeMetadata.sol';
import {Strings} from '@openzeppelin/contracts/utils/Strings.sol';
import {NFTTokenURIScaffold} from './libraries/NFTTokenURIScaffold.sol';

contract CollateralizedDebt is IDue, ERC721Permit {
    using Strings for uint256;
    using SafeMetadata for IERC20;

    IConvenience public immutable override convenience;
    IPair public immutable override pair;
    uint256 public immutable override maturity;

    function name() external view override returns (string memory) {
        string memory assetName = pair.asset().safeName();
        string memory collateralName = pair.collateral().safeName();
        return
            string(
                abi.encodePacked(
                    'Timeswap Collateralized Debt - ',
                    assetName,
                    ' - ',
                    collateralName,
                    ' - ',
                    maturity.toString()
                )
            );
    }

    function symbol() external view override returns (string memory) {
        string memory assetSymbol = pair.asset().safeSymbol();
        string memory collateralSymbol = pair.collateral().safeSymbol();
        return string(abi.encodePacked('TS-CDT-', assetSymbol, '-', collateralSymbol, '-', maturity.toString()));
    }

    function tokenURI(uint256 id) external view override returns (string memory) {
        require(_owners[id] != address(0), 'E404');
        return NFTTokenURIScaffold.tokenURI(id, pair, pair.dueOf(maturity, address(convenience), id), maturity);
    }

    function assetDecimals() external view override returns (uint8) {
        return pair.asset().safeDecimals();
    }

    function collateralDecimals() external view override returns (uint8) {
        return pair.collateral().safeDecimals();
    }

    function totalSupply() external view override returns (uint256) {
        return pair.totalDuesOf(maturity, address(convenience));
    }

    function tokenByIndex(uint256 id) external view override returns (uint256) {
        require(id < pair.totalDuesOf(maturity, address(convenience)), 'E614');
        return id;
    }

    function dueOf(uint256 id) external view override returns (IPair.Due memory) {
        return pair.dueOf(maturity, address(convenience), id);
    }

    constructor(
        IConvenience _convenience,
        IPair _pair,
        uint256 _maturity
    ) ERC721Permit('Timeswap Collateralized Debt') {
        convenience = _convenience;
        pair = _pair;
        maturity = _maturity;
    }

    modifier onlyConvenience() {
        require(msg.sender == address(convenience), 'E403');
        _;
    }

    function mint(address to, uint256 id) external override onlyConvenience {
        _safeMint(to, id);
    }
}
