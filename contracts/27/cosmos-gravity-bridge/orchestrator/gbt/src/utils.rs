use clarity::Uint256;
use std::time::Duration;

pub const TIMEOUT: Duration = Duration::from_secs(60);

pub fn one_eth() -> f64 {
    1000000000000000000f64
}

pub fn one_atom() -> f64 {
    1000000f64
}

/// TODO revisit this for higher precision while
/// still representing the number to the user as a float
/// this takes a number like 0.37 eth and turns it into wei
/// or any erc20 with arbitrary decimals
pub fn fraction_to_exponent(num: f64, exponent: u8) -> Uint256 {
    let mut res = num;
    // in order to avoid floating point rounding issues we
    // multiply only by 10 each time. this reduces the rounding
    // errors enough to be ignored
    for _ in 0..exponent {
        res *= 10f64
    }
    (res as u128).into()
}

pub fn print_eth(input: Uint256) -> String {
    let float: f64 = input.to_string().parse().unwrap();
    let res = float / one_eth();
    format!("{}", res)
}

pub fn print_atom(input: Uint256) -> String {
    let float: f64 = input.to_string().parse().unwrap();
    let res = float / one_atom();
    format!("{}", res)
}

#[test]
fn even_f32_rounding() {
    let one_eth: Uint256 = 1000000000000000000u128.into();
    let one_point_five_eth: Uint256 = 1500000000000000000u128.into();
    let one_point_one_five_eth: Uint256 = 1150000000000000000u128.into();
    let a_high_precision_number: Uint256 = 1150100000000000000u128.into();
    let res = fraction_to_exponent(1f64, 18);
    assert_eq!(one_eth, res);
    let res = fraction_to_exponent(1.5f64, 18);
    assert_eq!(one_point_five_eth, res);
    let res = fraction_to_exponent(1.15f64, 18);
    assert_eq!(one_point_one_five_eth, res);
    let res = fraction_to_exponent(1.1501f64, 18);
    assert_eq!(a_high_precision_number, res);
}
