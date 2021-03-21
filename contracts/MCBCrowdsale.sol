pragma solidity 0.7.4;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./libraries/SafeMathExt.sol";

import "hardhat/console.sol";

contract MCBCrowdsale is Ownable {
    using Math for uint256;
    using SafeMath for uint256;
    using SafeMathExt for uint256;
    using SafeERC20 for IERC20;

    address public constant MCB_TOKEN_ADDRESS = 0x0000000000000000000000000000000000000000;
    address public constant USDC_TOKEN_ADDRESS = 0x0000000000000000000000000000000000000000;
    address public constant MCDEX_MULTI_SIGN_WALLET_ADDRESS =
        0x0000000000000000000000000000000000000000;

    uint256 public constant MAX_SUPPLY = 100000 * 1e18;
    uint256 public constant USDC_DEPOSIT_RATE = 10 * 1e6;
    uint256 public constant MCB_DEPOSIT_RATE = 4 * 1e18;

    bool public isEmergency;
    uint256 public beginTime;
    uint256 public endTime;
    uint256 public unlockTime;

    uint256 internal _totalSubscription;
    mapping(address => uint256) internal _subscriptions;
    mapping(address => bool) internal _settlementFlags;

    event Purchase(uint256 amount, uint256 depositedMCB, uint256 depositUSDC);
    event Settle(address indexed account, uint256 settledAmount, uint256 refundUSDC);
    event ForwardFunds(uint256 claimableUSDCAmount);
    event SetEmergency();
    event EmergencySettle(address indexed account, uint256 mcbAmount, uint256 usdcAmount);
    event EmergencyForwardFunds(uint256 mcbAmount, uint256 usdcAmount);

    constructor(
        uint256 beginTime_,
        uint256 endTime_,
        uint256 lockPeriod_
    ) Ownable() {
        require(beginTime_ <= endTime_, "start time cannot be later than end time");
        require(lockPeriod_ <= 86400 * 7, "lock period too long");

        beginTime = beginTime_;
        endTime = endTime_;
        unlockTime = endTime_.add(lockPeriod_);
    }

    /**
     * @notice
     */
    function setEmergency() public onlyOwner {
        require(!isEmergency, "already in emergency state");
        isEmergency = true;
        emit SetEmergency();
    }

    function isPurchaseable() public view returns (bool) {
        uint256 currentTimestamp = _blockTimestamp();
        return currentTimestamp >= beginTime && currentTimestamp < endTime;
    }

    function isSettleable() public view returns (bool) {
        uint256 currentTimestamp = _blockTimestamp();
        return currentTimestamp >= unlockTime;
    }

    function isAccountSettled(address account) public view returns (bool) {
        return _settlementFlags[account];
    }

    function totalSubscription() public view returns (uint256) {
        return _totalSubscription;
    }

    function totalSoldSupply() public view returns (uint256) {
        return _totalSubscription.min(MAX_SUPPLY);
    }

    function subscriptionRate() public view returns (uint256) {
        return _totalSubscription <= MAX_SUPPLY ? 1e18 : _totalSubscription.wdivFloor(MAX_SUPPLY);
    }

    function shareOf(address account) public view returns (uint256) {
        return _subscriptions[account].wdivFloor(subscriptionRate());
    }

    /**
     * @notice  User is able to buy 1 token with 4x MCB and 10x USDC.
     *          The bought token, the deposited MCB and the refund USDC will be sent back to user
     *          after an unlock period.
     */
    function purchase(uint256 amount) public {
        require(!isEmergency, "purchase is not available in emergency state");
        require(isPurchaseable(), "purchase is not active now");
        require(amount > 0, "amount to buy cannot be zero");

        uint256 depositMCB = amount.wmul(MCB_DEPOSIT_RATE);
        uint256 depositUSDC = amount.wmul(USDC_DEPOSIT_RATE);
        // transfer
        _mcbToken().safeTransferFrom(msg.sender, address(this), depositMCB);
        _usdcToken().safeTransferFrom(msg.sender, address(this), depositUSDC);

        _subscriptions[msg.sender] = _subscriptions[msg.sender].add(amount);
        _totalSubscription = _totalSubscription.add(amount);

        emit Purchase(amount, depositMCB, depositUSDC);
    }

    /**
     * @notice  User is able to get usdc refund if the total subscriptions exceeds target supply.
     *
     * @param   account The address to settle, to which the refund and deposited MCB will be transferred.
     */
    function settle(address account) public {
        require(!isEmergency, "settle is not available in emergency state");
        require(isSettleable(), "settle is not active now");
        require(!isAccountSettled(account), "account has alreay settled");

        uint256 settledAmount = _subscriptions[account].wdivFloor(subscriptionRate());
        uint256 depositMCB = _subscriptions[account].wmul(MCB_DEPOSIT_RATE);
        uint256 depositUSDC = _subscriptions[account].wmul(USDC_DEPOSIT_RATE);
        uint256 costUSDC = depositUSDC.wdivCeil(subscriptionRate());
        uint256 refundUSDC = 0;
        // usdc refund
        if (depositUSDC > costUSDC) {
            refundUSDC = depositUSDC.sub(costUSDC);
            _usdcToken().safeTransfer(account, refundUSDC);
        }
        _mcbToken().safeTransfer(account, depositMCB);
        _settlementFlags[account] = true;

        emit Settle(account, settledAmount, refundUSDC);
    }

    /**
     * @notice  Forword funds up to sale target to a preset address.
     */
    function forwardFunds() public {
        require(!isEmergency, "forward is not available in emergency state");
        require(isSettleable(), "forward is not active now");
        require(!isAccountSettled(address(this)), "funds has alreay been forwarded");

        uint256 fundUSDC = totalSoldSupply().wmul(USDC_DEPOSIT_RATE);
        _usdcToken().safeTransfer(_mcdexMultiSignWallet(), fundUSDC);
        _settlementFlags[address(this)] = true;

        emit ForwardFunds(fundUSDC);
    }

    /**
     * @notice  In emergency state, user is able to withdraw all deposited assets back directly.
     *
     * @param   account The address to settle, to which the deposited assets will be transferred.
     */
    function emergencySettle(address account) public {
        require(isEmergency, "emergency settle is only available in emergency state");
        require(!isAccountSettled(account), "account has alreay settled");

        uint256 depositedMCB = _subscriptions[account].wmul(MCB_DEPOSIT_RATE);
        uint256 depositedUSDC = _subscriptions[account].wmul(USDC_DEPOSIT_RATE);

        _subscriptions[account] = 0;
        _mcbToken().safeTransfer(account, depositedMCB);
        _usdcToken().safeTransfer(account, depositedUSDC);
        _settlementFlags[account] = true;

        emit EmergencySettle(account, depositedMCB, depositedUSDC);
    }

    /**
     * @notice  In emergency state, all funds can be forward to target address to prevent further loss.
     */
    function emergencyForwardFunds() public {
        require(isEmergency, "emergency forward is only available in emergency state");

        uint256 totalDepositedMCB = _mcbToken().balanceOf(address(this));
        uint256 totalDepositedUSDC = _usdcToken().balanceOf(address(this));
        _mcbToken().safeTransfer(_mcdexMultiSignWallet(), totalDepositedMCB);
        _usdcToken().safeTransfer(_mcdexMultiSignWallet(), totalDepositedUSDC);

        emit EmergencyForwardFunds(totalDepositedMCB, totalDepositedUSDC);
    }

    function _mcbToken() internal view virtual returns (IERC20) {
        return IERC20(MCB_TOKEN_ADDRESS);
    }

    function _usdcToken() internal view virtual returns (IERC20) {
        return IERC20(USDC_TOKEN_ADDRESS);
    }

    function _mcdexMultiSignWallet() internal view virtual returns (address) {
        return MCDEX_MULTI_SIGN_WALLET_ADDRESS;
    }

    function _blockTimestamp() internal view virtual returns (uint256) {
        return block.timestamp;
    }
}
