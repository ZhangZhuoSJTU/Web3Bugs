// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

struct Struct1 {
    uint256[] aUIA;
    Struct2 bS2;
}

struct Struct2 {
    uint256 aUI;
    uint256[] bUIA;
    bool cB;
    address dA;
}

contract MockStruct4Test {
    address public owner;

    function setOwner(address _owner) external {
        owner = _owner;
    }

    function test1(Struct1 calldata s) external view returns (Struct1 memory result) {
        Struct1 memory s1;
        s1.aUIA = s.aUIA;
        s1.bS2.aUI = s.bS2.aUI;
        s1.bS2.bUIA = s.bS2.bUIA;
        s1.bS2.cB = s.bS2.cB;
        s1.bS2.dA = s.bS2.dA;
        return method1(s1);
    }

    function test2(Struct1 memory s) public view returns (Struct1 memory result) {
        return method1(s);
    }

    function method1(Struct1 memory s) private view returns (Struct1 memory r) {
        r.aUIA = new uint256[](s.aUIA.length);
        for (uint256 i = 0; i < s.aUIA.length; i++) {
            r.aUIA[i] = s.aUIA[i] + 1;
        }
        r.bS2.aUI = s.bS2.aUI * 2;
        r.bS2.bUIA = new uint256[](s.bS2.bUIA.length);
        for (uint256 i = 0; i < s.bS2.bUIA.length; i++) {
            r.bS2.bUIA[i] = s.bS2.bUIA[i] + 1;
        }
        r.bS2.cB = !s.bS2.cB;
        r.bS2.dA = owner;
    }
}
