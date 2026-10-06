// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract AtomicBatchDelegate {
    bytes32 internal constant BATCH_MODE = 0x0100000000000000000000000000000000000000000000000000000000000000;

    struct Call {
        address to;
        uint256 value;
        bytes data;
    }

    function supportsExecutionMode(bytes32 mode) external pure returns (bool) {
        return mode == BATCH_MODE;
    }

    function execute(bytes32 mode, bytes calldata executionData) external payable {
        require(mode == BATCH_MODE, "mode");
        require(msg.sender == address(this), "self only");
        Call[] memory calls = abi.decode(executionData, (Call[]));
        for (uint256 i = 0; i < calls.length; ++i) {
            (bool ok, bytes memory result) = calls[i].to.call{value: calls[i].value}(calls[i].data);
            if (!ok) assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }
}

contract AtomicBatchProbe {
    address public lastCaller;
    uint256 public received;
    uint256 public calls;

    function record() external payable {
        lastCaller = msg.sender;
        received += msg.value;
        calls += 1;
    }

    function checkAllowance(address token, address owner, uint256 expected) external view {
        require(AtomicBatchToken(token).allowance(owner, address(this)) == expected, "allowance not visible");
    }

    function fail() external pure {
        revert("expected failure");
    }
}

contract AtomicBatchToken {
    mapping(address => mapping(address => uint256)) public allowance;

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
}
