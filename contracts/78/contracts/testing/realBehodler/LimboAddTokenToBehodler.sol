// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "./CommonIERC20.sol";
import "../../facades/TokenProxyLike.sol";
import "../../TokenProxyRegistry.sol";

abstract contract AngbandLike {
    function executePower(address powerInvoker) public virtual;
}

contract AngbandLite is AngbandLike {
    function executePower(address powerInvoker) public override {
        IdempotentPowerInvoker(powerInvoker).invoke();
    }
}

abstract contract IdempotentPowerInvoker {
    AngbandLike public angband;

    constructor(address _angband) {
        angband = AngbandLike(_angband);
    }

    function orchestrate() internal virtual returns (bool);

    function invoke() public {
        require(msg.sender == address(angband), "MORGOTH: angband only");
        require(orchestrate(), "MORGOTH: Power invocation");
    }
}

abstract contract BehodlerLiteLike {
    function addLiquidity(address inputToken, uint256 amount)
        external
        payable
        virtual
        returns (uint256 deltaSCX);

    function setTokenBurnable(address token, bool burnable) public virtual;
}

contract LimboAddTokenToBehodler is IdempotentPowerInvoker {
    struct Parameters {
        address soul;
        bool burnable;
        address limbo;
        address tokenProxyRegistry;
    }

    Parameters public params;
    address behodler;

    constructor(
        address _angband,
        address limbo,
        address behodlerLite,
        address _proxyregistry
    ) IdempotentPowerInvoker(_angband) {
        params.limbo = limbo;
        behodler = behodlerLite;
        params.tokenProxyRegistry = _proxyregistry;
    }

    function parameterize(address soul, bool burnable) public {
        require(
            msg.sender == params.limbo,
            "MORGOTH: Only Limbo can migrate tokens from Limbo."
        );
        params.soul = soul;
        params.burnable = burnable;
    }

    function orchestrate() internal override returns (bool) {
        require(
            params.soul != address(0),
            "MORGOTH: PowerInvoker not parameterized."
        );

        uint256 balanceOfToken = CommonIERC20(params.soul).balanceOf(
            address(this)
        );
        require(balanceOfToken > 0, "MORGOTH: remember to seed contract");
        (address baseToken, bool migrate) = TokenProxyRegistry(
            params.tokenProxyRegistry
        ).tokenProxy(params.soul);

        address tokenToMigrate = params.soul;
        if (migrate && baseToken != address(0)) {
            tokenToMigrate = baseToken;
            TokenProxyLike(params.soul).redeem(address(this), balanceOfToken);
        }

        CommonIERC20(tokenToMigrate).approve(behodler, type(uint256).max);
        BehodlerLiteLike(behodler).setTokenBurnable(
            tokenToMigrate,
            params.burnable
        );
        BehodlerLiteLike(behodler).addLiquidity(tokenToMigrate, balanceOfToken);
        uint256 scxBal = CommonIERC20(behodler).balanceOf(address(this));
        CommonIERC20(behodler).transfer(params.limbo, scxBal);
        params.soul = address(0); // prevent non limbo from executing.
        return true;
    }
}
