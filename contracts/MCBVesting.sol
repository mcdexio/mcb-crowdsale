// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.4;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./libraries/SafeMathExt.sol";
import "hardhat/console.sol";

contract MCBVesting {
    using SafeMath for uint256;
    using SafeMathExt for uint256;
    using SafeERC20 for IERC20;

    address public constant MCB_TOKEN_ADDRESS = 0x0000000000000000000000000000000000000000;

    uint256 public beginTime;
    uint256 public totalSubscription;
    uint256 public lastMarkedBalance;
    uint256 public cumulativeBalance;

    mapping(address => uint256) public subscriptions;
    mapping(address => uint256) public claimedCumulativeBalances;

    event AddBeneficiaries(address[] beneficiaries, uint256[] amounts);
    event Claim(address indexed account, uint256 amount);

    constructor(
        uint256 beginTime_,
        address[] memory beneficiaries_,
        uint256[] memory amounts_
    ) {
        require(beneficiaries_.length == amounts_.length, "length of parameters are not match");
        beginTime = beginTime_;
        for (uint256 i = 0; i < beneficiaries_.length; i++) {
            address beneficiary = beneficiaries_[i];
            uint256 amount = amounts_[i];
            require(beneficiary != address(0), "beneficiary cannot be zero address");
            require(amount != 0, "amount cannot be zero");
            subscriptions[beneficiary] = amount;
            totalSubscription = totalSubscription.add(amount);
        }
        emit AddBeneficiaries(beneficiaries_, amounts_);
    }

    function shareOf(address account) public view returns (uint256) {
        return subscriptions[account].wdivFloor(totalSubscription);
    }

    function claimableToken(address account) public view returns (uint256) {
        if (_blockTimestamp() < beginTime) {
            return 0;
        }
        uint256 incremental = _mcbToken().balanceOf(address(this)).sub(lastMarkedBalance);
        uint256 currentCumulativeBalance = cumulativeBalance.add(incremental);
        if (currentCumulativeBalance <= claimedCumulativeBalances[account]) {
            return 0;
        }
        uint256 unclaimedBalance = currentCumulativeBalance.sub(claimedCumulativeBalances[account]);
        return unclaimedBalance.wmul(shareOf(account));
    }

    function claim(address account) public {
        require(_blockTimestamp() >= beginTime, "claim is not active now");

        IERC20 mcbToken = _mcbToken();
        uint256 incremental = mcbToken.balanceOf(address(this)).sub(lastMarkedBalance);
        cumulativeBalance = cumulativeBalance.add(incremental);

        require(cumulativeBalance > claimedCumulativeBalances[account], "no token to claim");
        uint256 claimableAmount =
            cumulativeBalance.sub(claimedCumulativeBalances[account]).wmul(shareOf(account));
        mcbToken.safeTransfer(account, claimableAmount);

        claimedCumulativeBalances[account] = cumulativeBalance;
        lastMarkedBalance = mcbToken.balanceOf(address(this));

        emit Claim(account, claimableAmount);
    }

    function _mcbToken() internal view virtual returns (IERC20) {
        return IERC20(MCB_TOKEN_ADDRESS);
    }

    function _blockTimestamp() internal view virtual returns (uint256) {
        return block.timestamp;
    }
}
