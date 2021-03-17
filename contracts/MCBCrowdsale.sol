pragma solidity 0.7.4;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./libraries/SafeMathExt.sol";

// 1. 每质押（1MCB+2.5USDC）可以申购0.25MCB
// 2. 申购期结束时，如果申购总量小于等于10万MCB，则依照申购数分配额度。如果申购总量超过10万MCB，则按申购总数成比例减少每个人的申购量：
//   个人分配数 = MIN(10万 / 总申购量, 1) * 个人申购数
// 3. 申购期结束后，MCB和多余的USDC将被质押2周后解锁； 申购使用的USDC将被发送到基金会多签
// 4. admin 接口

contract MCBCrowdsale is Ownable {
    using Math for uint256;
    using SafeMath for uint256;
    using SafeMathExt for uint256;
    using SafeERC20 for IERC20;

    address public constant MCB_TOKEN_ADDRESS = 0x0000000000000000000000000000000000000000;
    address public constant USDC_TOKEN_ADDRESS = 0x0000000000000000000000000000000000000000;
    address public constant MCDEX_MULTI_SIGN_ADDRESS = 0x0000000000000000000000000000000000000000;

    uint256 public constant MAX_SUPPLY = 100000 * 1e18;
    uint256 public constant USDC_RATE = 10 * 1e6;
    uint256 public constant MCB_RATE = 4 * 1e18;

    bool public isEmergency;
    uint256 public beginTime;
    uint256 public endTime;
    uint256 public unlockTime;

    uint256 internal _totalExpectedQuota;
    mapping(address => uint256) internal _expectedQuotas;
    mapping(address => bool) internal _settlements;

    event Purchase(uint256 quotaAmount, uint256 mcbAmount, uint256 usdcAmount);
    event Settle(address indexed account, uint256 quotaAmount, uint256 refundUSDCAmount);
    event ForwardFunds(uint256 claimableUSDCAmount);
    event SetEmergency();
    event EmergencySettle(address indexed account, uint256 mcbAmount, uint256 usdcAmount);

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

    function setEmergency() public onlyOwner {
        require(!isEmergency, "already in emergency state");
        isEmergency = true;
        emit SetEmergency();
    }

    function isPurchaseable() public view returns (bool) {
        uint256 currentTimestamp = _blockTimestamp();
        return currentTimestamp >= beginTime && currentTimestamp <= endTime;
    }

    function isSettleable() public view returns (bool) {
        uint256 currentTimestamp = _blockTimestamp();
        return currentTimestamp > unlockTime;
    }

    function isAccountSettled(address account) public view returns (bool) {
        return _settlements[account];
    }

    function totalExpectedQuota() public view returns (uint256) {
        return _totalExpectedQuota;
    }

    function totalSoldQuota() public view returns (uint256) {
        return _totalExpectedQuota.max(MAX_SUPPLY);
    }

    function quotaRate() public view returns (uint256) {
        return _totalExpectedQuota <= MAX_SUPPLY ? 1e18 : _totalExpectedQuota / MAX_SUPPLY;
    }

    function quotaOf(address account) public view returns (uint256) {
        return _expectedQuotas[account].wdivFloor(quotaRate());
    }

    /**
     * @notice  Purchaser is able to buy 1 token with 4x MCB and 10x USDC.
     *          The bought token, the deposited MCB and the refund USDC will be sent back to purchaser
     *          after an unlock period.
     */
    function purchase(uint256 expectedQuota) public {
        require(!isEmergency, "purchase is not available in emergency state");
        require(isPurchaseable(), "purchase is not active now");
        require(expectedQuota > 0, "quota to buy cannot be zero");

        uint256 mcbAmount = expectedQuota.wmul(MCB_RATE);
        uint256 usdcAmount = expectedQuota.wmul(USDC_RATE);
        // transfer
        IERC20(MCB_TOKEN_ADDRESS).safeTransferFrom(msg.sender, address(this), mcbAmount);
        IERC20(USDC_TOKEN_ADDRESS).safeTransferFrom(msg.sender, address(this), usdcAmount);

        _expectedQuotas[msg.sender] = _expectedQuotas[msg.sender].add(expectedQuota);
        _totalExpectedQuota = _totalExpectedQuota.add(expectedQuota);

        emit Purchase(expectedQuota, mcbAmount, usdcAmount);
    }

    function settle(address account) public {
        require(!isEmergency, "settle is not available in emergency state");
        require(isSettleable(), "settle is not active now");
        require(!isAccountSettled(account), "account has alreay settled");

        uint256 quotaAmount = _expectedQuotas[account].wdivFloor(quotaRate());
        uint256 mcbAmount = _expectedQuotas[account].wmul(MCB_RATE);
        uint256 usdcAmount = _expectedQuotas[account].wmul(USDC_RATE);
        uint256 usdcCostAmount = usdcAmount.wdivCeil(quotaRate());
        // usdc refund
        if (usdcAmount > usdcCostAmount) {
            IERC20(USDC_TOKEN_ADDRESS).safeTransfer(account, usdcAmount.sub(usdcCostAmount));
        }

        IERC20(MCB_TOKEN_ADDRESS).safeTransfer(account, mcbAmount);
        _settlements[account] = true;

        emit Settle(account, quotaAmount, usdcAmount.sub(usdcCostAmount));
    }

    function emergencySettle(address account) public {
        require(isEmergency, "emergency settle is only available in emergency state");
        uint256 mcbAmount = _expectedQuotas[account].wmul(MCB_RATE);
        uint256 usdcAmount = _expectedQuotas[account].wmul(USDC_RATE);

        _expectedQuotas[account] = 0;
        IERC20(MCB_TOKEN_ADDRESS).safeTransfer(account, mcbAmount);
        IERC20(USDC_TOKEN_ADDRESS).safeTransfer(account, usdcAmount);

        emit EmergencySettle(account, mcbAmount, usdcAmount);
    }

    function forwardFunds() public {
        require(!isEmergency, "settle is not available in emergency state");
        require(isSettleable(), "settle is not active now");
        require(!isAccountSettled(address(this)), "account has alreay settled");
        // all usdc, back to MCDEX_MULTI_SIGN_ADDRESS
        uint256 claimableUSDCAmount = totalSoldQuota().wmul(USDC_RATE);
        IERC20(USDC_TOKEN_ADDRESS).safeTransfer(MCDEX_MULTI_SIGN_ADDRESS, claimableUSDCAmount);
        _settlements[address(this)] = true;

        emit ForwardFunds(claimableUSDCAmount);
    }

    function _blockTimestamp() internal view returns (uint256) {
        return block.timestamp;
    }
}
