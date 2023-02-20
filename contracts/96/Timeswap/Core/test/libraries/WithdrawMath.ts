import { State, Tokens, TotalClaims, totalClaimsDefault } from '../shared/PairInterface'
import { mulDiv } from './FullMath';

export function getTokensOut(state: State, claimsIn:TotalClaims): Tokens {
    let totalAsset = state.reserves.asset;
    let totalBondPrincipal = state.totalClaims.bondPrincipal;
    let totalBondInterest = state.totalClaims.bondInterest;
    let totalBond = totalBondPrincipal;
    totalBond += totalBondInterest;
    let tokensOut: Tokens = {
      asset: 0n,
      collateral: 0n
    };

    if (totalAsset >= totalBond) {
        tokensOut.asset = claimsIn.bondPrincipal;
        tokensOut.asset += claimsIn.bondInterest;
    } else {
        if (totalAsset >= totalBondPrincipal) {
            let remaining = totalAsset;
            remaining -= totalBondPrincipal; 
            let _assetOut = claimsIn.bondInterest;
            _assetOut *= remaining;
            _assetOut /= totalBondInterest;
            _assetOut += claimsIn.bondPrincipal;
            tokensOut.asset = _assetOut;
        } else {
            let _assetOut = claimsIn.bondPrincipal;
            _assetOut *= totalAsset;
            _assetOut /= totalBondPrincipal;
            tokensOut.asset = _assetOut;
        }
        
        let deficit = totalBond;
        deficit -= totalAsset; 

        let totalInsurancePrincipal = state.totalClaims.insurancePrincipal;
        totalInsurancePrincipal *= deficit;
        let totalInsuranceInterest = state.totalClaims.insuranceInterest;
        totalInsuranceInterest *= deficit;
        let totalInsurance = totalInsurancePrincipal;
        totalInsurance += totalInsuranceInterest;

        let totalCollateral = state.reserves.collateral;
        totalCollateral *= totalBond;

        if (totalCollateral >= totalInsurance) {
            let _collateralOut = claimsIn.insurancePrincipal;
            _collateralOut += claimsIn.insuranceInterest;
            _collateralOut *= deficit;
            _collateralOut /= totalBond;
            tokensOut.collateral = _collateralOut;
        } else if (totalCollateral >= totalInsurancePrincipal) {
            let remaining = totalCollateral;
            remaining -= totalInsurancePrincipal;
            let _collateralOut = claimsIn.insuranceInterest;
            _collateralOut *= deficit;
            let denominator = totalInsuranceInterest;
            denominator *= totalBond;
            _collateralOut = mulDiv(_collateralOut, remaining, denominator);
            let addend = claimsIn.insurancePrincipal;
            addend *= deficit;
            addend /= totalBond;
            _collateralOut += addend;
            tokensOut.collateral = _collateralOut;
        } else {
            let _collateralOut = claimsIn.insurancePrincipal;
            _collateralOut *= deficit;
            let denominator = totalInsurancePrincipal;
            denominator *= totalBond;
            _collateralOut = mulDiv(_collateralOut, totalCollateral, denominator);
            tokensOut.collateral = _collateralOut;
        }
    }

    return tokensOut;
}


// export function getAsset(state: State, bondPrincipalIn: bigint, bondInterestIn: bigint): bigint {
//   let totalAsset = state.asset;
//   let totalBond = state.totalClaims.bondPrincipal + state.totalClaims.bondInterest
//   let _assetOut;

//   if (totalAsset >= totalBond) {
//     _assetOut = bondPrincipalIn;
//     _assetOut += bondInterestIn;
//   } else {
//     if (totalAsset >= state.totalClaims.bondPrincipal) {
//       let remaining = totalAsset;
//       remaining -= state.totalClaims.bondPrincipal;
//       _assetOut = bondInterestIn;
//       _assetOut *= remaining;
//       _assetOut /= state.totalClaims.bondInterest;
//       _assetOut += bondPrincipalIn;
//     } else {
//       _assetOut = bondPrincipalIn;
//       _assetOut *= totalAsset;
//       _assetOut /= state.totalClaims.bondPrincipal;
//     }
//   }
//   return _assetOut
// }

// export function getCollateral(state: State, bondPrincipalIn: bigint, bondInterestIn: bigint, insurancePrincipalIn: bigint, insuranceInterestIn: bigint) {
//   let totalBond = state.totalClaims.bondPrincipal + state.totalClaims.bondInterest
//   let totalInsurance = state.totalClaims.insurancePrincipal + state.totalClaims.insuranceInterest
//   if (state.reserves.asset >= totalBond) return 0n
//   let deficit = totalBond
//   deficit -= state.reserves.asset
//   let insurancePrincipal = state.totalClaims.insurancePrincipal * deficit
//   let insuranceInterest = state.totalClaims.insuranceInterest * deficit
//   let _insurancePrincipalIn = insurancePrincipalIn * deficit
//   let totalCollateral = state.reserves.collateral * totalBond

//   if (totalCollateral >= insurancePrincipal) {
//     let _insuranceInterestIn = insuranceInterest * deficit
//     let remaining = totalCollateral - insurancePrincipal
//     if (remaining >= insuranceInterest) {
//       let _collateralOut = (_insuranceInterestIn + _insurancePrincipalIn) / totalBond
//       return _collateralOut
//     }
//     else {
//       let _collateralOut = (_insuranceInterestIn * remaining / (insuranceInterest * totalBond)) + (_insurancePrincipalIn / totalBond)
//       return _collateralOut
//     }
//   }
//   else {
//     let _collateralOut = _insurancePrincipalIn * totalCollateral / (insurancePrincipal * totalBond)
//     return _collateralOut
//   }
// }

export default {
  getTokensOut
}
