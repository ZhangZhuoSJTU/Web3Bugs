// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface IPeak {
    function portfolioValue() external view returns (uint);
}

interface IBadgerSettPeak is IPeak {
    function mint(uint poolId, uint inAmount, bytes32[] calldata merkleProof)
        external
        returns(uint outAmount);

    function calcMint(uint poolId, uint inAmount)
        external
        view
        returns(uint bBTC, uint fee);

    function redeem(uint poolId, uint inAmount)
        external
        returns (uint outAmount);

    function calcRedeem(uint poolId, uint bBtc)
        external
        view
        returns(uint sett, uint fee, uint max);
}

interface IByvWbtcPeak is IPeak {
    function mint(uint inAmount, bytes32[] calldata merkleProof)
        external
        returns(uint outAmount);

    function calcMint(uint inAmount)
        external
        view
        returns(uint bBTC, uint fee);

    function redeem(uint inAmount)
        external
        returns (uint outAmount);

    function calcRedeem(uint bBtc)
        external
        view
        returns(uint sett, uint fee, uint max);
}
