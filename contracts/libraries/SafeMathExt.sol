// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.4;

import "@openzeppelin/contracts/math/SafeMath.sol";

library SafeMathExt {
    using SafeMath for uint256;

    function wmul(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x.mul(y) / 1e18;
    }

    function wdivFloor(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x.mul(1e18).div(y);
    }

    function wdivCeil(uint256 x, uint256 y) internal pure returns (uint256 z) {
        uint256 t = x.mul(1e18);
        z = t.div(y);
        if (x % y != 0) {
            z = z.add(1);
        }
    }
}
