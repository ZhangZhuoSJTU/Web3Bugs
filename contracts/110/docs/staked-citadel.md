# Staked Citadel (xCTDL)

## xCitadel Vault
A staked CTDL position that increases in value automatically as emission rewards are distributed by the project.

The code is a fork of badger vaults 1.5 with no strategy which allows users to deposit CTDL token and receive xCTDL token.

Each xCTDL is worth a certain amount of CTDL using the pricePerShare() mechanic.
CTDL is "auto-compounded" into the vault to increase the value of each xCTDL token.

Withdrawing from the vault has a 21 day exit vesting period.

## Vested Exit
Upon withdraw from xCitadel vault CTDL tokens are sent to vesting contract wherein they are vested linearly for 21 days. Users are welcome to partially withdraw vested balances as desired.

Each user can only have one vested exit active at a time. A second withdrawal during that vesting timeframe resets the timer to 21 days.
