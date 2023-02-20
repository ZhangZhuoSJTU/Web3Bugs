// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./IFYToken.sol";
import "./IOracle.sol";
import "./DataTypes.sol";


interface ICauldronGov {
    function assets(bytes6) external view returns (address);
    function series(bytes6) external view returns (DataTypes.Series memory);
    function rateOracles(bytes6) external view returns (IOracle);
    function addAsset(bytes6, address) external;
    function addSeries(bytes6, bytes6, IFYToken) external;
    function addIlks(bytes6, bytes6[] memory) external;
    function setRateOracle(bytes6, IOracle) external;
    function setSpotOracle(bytes6, bytes6, IOracle, uint32) external;
    function setDebtLimits(bytes6, bytes6, uint96, uint24, uint8) external;
}