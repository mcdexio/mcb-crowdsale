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
    uint256 public totalQuota;
    uint256 public lastMCBBalance;
    uint256 public cumulativeMCBBalance;

    mapping(address => uint256) public quotas;
    mapping(address => uint256) public claimed;

    event AddBeneficiaries(address[] beneficiaries, uint256[] quotas);
    event Claim(address indexed account, uint256 amount);

    constructor(uint256 beginTime_) {
        beginTime = beginTime_;
    }

    function addQuotas(address[] calldata beneficiaries_, uint256[] calldata quotas_) external {
        require(beneficiaries_.length == quotas_.length, "length of parameters are not match");
        for (uint256 i = 0; i < beneficiaries_.length; i++) {
            address beneficiary = beneficiaries_[i];
            uint256 quota = quotas_[i];
            require(beneficiary != address(0), "beneficiary cannot be zero address");
            require(quota != 0, "quota cannot be zero");
            quotas[beneficiary] = quota;
            totalQuota = totalQuota.add(quota);
        }
        emit AddBeneficiaries(beneficiaries_, quotas_);
    }

    function shareOf(address account) public view returns (uint256) {
        return quotas[account].wdivFloor(totalQuota);
    }

    function claimableMCBToken(address account) public view returns (uint256) {
        if (_blockTimestamp() < beginTime) {
            return 0;
        }
        uint256 incremental = IERC20(_mcbToken()).balanceOf(address(this)).sub(lastMCBBalance);
        if (cumulativeMCBBalance.add(incremental) <= claimed[account]) {
            return 0;
        }
        return cumulativeMCBBalance.add(incremental).sub(claimed[account]).wmul(shareOf(account));
    }

    function claimMCBToken(address account) public {
        require(_blockTimestamp() >= beginTime, "claim is not active now");

        IERC20 mcbToken = IERC20(_mcbToken());
        uint256 incremental = mcbToken.balanceOf(address(this)).sub(lastMCBBalance);
        cumulativeMCBBalance = cumulativeMCBBalance.add(incremental);

        require(cumulativeMCBBalance > claimed[account], "no token to claim");
        uint256 claimableAmount = cumulativeMCBBalance.sub(claimed[account]).wmul(shareOf(account));

        mcbToken.safeTransfer(account, claimableAmount);

        claimed[account] = cumulativeMCBBalance;
        lastMCBBalance = mcbToken.balanceOf(address(this));

        emit Claim(account, claimableAmount);
    }

    function _mcbToken() internal view virtual returns (address) {
        return MCB_TOKEN_ADDRESS;
    }

    function _blockTimestamp() internal view virtual returns (uint256) {
        return block.timestamp;
    }
}
