// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.4;

import "../MCBVesting.sol";

contract TestMCBVesting is MCBVesting {
    address internal _mockMCBToken;
    uint256 internal _mockTimestamp;

    constructor(
        address mcbToken_,
        uint256 beginTime_,
        address[] memory beneficiaries_,
        uint96[] memory amounts_
    ) MCBVesting(beginTime_, beneficiaries_, amounts_) {
        _mockMCBToken = mcbToken_;
    }

    function _mcbToken() internal view virtual override returns (IERC20) {
        return IERC20(_mockMCBToken);
    }

    function setTimestamp(uint256 timestamp) public {
        _mockTimestamp = timestamp;
    }

    function _blockTimestamp() internal view virtual override returns (uint256) {
        return _mockTimestamp;
    }
}
