// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.4;

import "../MCBCrowdsale.sol";

contract TestMCBCrowdsale is MCBCrowdsale {
    address internal _mockMCBToken;
    address internal _mockUSDCToken;
    address internal _mockMultiSignWallet;
    uint256 internal _mockTimestamp;

    constructor(
        address mcbToken_,
        address usdcToken_,
        address multiSignWallet_,
        uint256 beginTime_,
        uint256 endTime_,
        uint256 lockPeriod_
    ) MCBCrowdsale(beginTime_, endTime_, lockPeriod_) {
        _mockMCBToken = mcbToken_;
        _mockUSDCToken = usdcToken_;
        _mockMultiSignWallet = multiSignWallet_;
    }

    function _mcbToken() internal view virtual override returns (IERC20) {
        return IERC20(_mockMCBToken);
    }

    function _usdcToken() internal view virtual override returns (IERC20) {
        return IERC20(_mockUSDCToken);
    }

    function _mcdexMultiSignWallet() internal view virtual override returns (address) {
        return _mockMultiSignWallet;
    }

    function setTimestamp(uint256 timestamp) public {
        _mockTimestamp = timestamp;
    }

    function _blockTimestamp() internal view virtual override returns (uint256) {
        return _mockTimestamp;
    }
}
