npx solidity-docgen -i contracts/ -o docs/doc --solc-module solc-0.7 -t docs/docgen

cat \
    docs/doc/interfaces/IPoolBase.md \
    docs/doc/interfaces/IPoolStake.md \
    docs/doc/interfaces/IGov.md \
    docs/doc/interfaces/IGovDev.md \
    docs/doc/interfaces/ILock.md \
    docs/doc/interfaces/IManager.md \
    docs/doc/interfaces/IPayout.md \
    docs/doc/interfaces/IRemove.md \
    docs/doc/interfaces/ISherX.md \
    docs/doc/interfaces/ISherXERC20.md \
> docs/contract-reference.md

echo -e "# Contract Reference\n\n$(cat docs/contract-reference.md)" > docs/contract-reference.md