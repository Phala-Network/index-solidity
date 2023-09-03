// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/security/Pausable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';

contract Handler is ReentrancyGuard, Ownable, Pausable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address self;

    uint256 private constant WORKER_MAX_TASK_COUNT = 10;

    struct DepositInfo {
        // Sender address on source chain
        address sender;
        // Deposit token
        address token;
        // Deposit amount
        uint256 amount;
        // Recipient address on dest chain
        bytes recipient;
        // Encoded execution plan produced by Solver
        string task;
    }

    struct Call {
        // The call metadata
        address target;
        bytes callData;
        uint256 value;

        // The settlement metadata
        bool needSettle;
        uint256 updateOffset;
        uint256 updateLen;
        address spendAsset;
        uint256 spendAmount;
        address receiveAsset;
        // The call index that whose result will be the input of call
        uint256 inputCall;
        // Current call index
        uint256 callIndex;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    // taskId => DepositInfo
    mapping(bytes32 => DepositInfo) public _depositRecords;
    // workerAddress => taskId[]
    mapping(address => bytes32[]) public _activedTasks;
    // workerAddress => isWorker
    mapping(address => bool) public _workers;
    // Address to represent the native asset, default is address(0)
    address public nativeAsset = address(0);

    event Deposited(
        address indexed sender,
        address indexed token,
        uint256 amount,
        bytes recipient,
        string task
    );

    event Claimed(address indexed worker, bytes32 indexed taskId);
    event ClaimedAndExecuted(address indexed worker, bytes32 indexed taskId);
    event Dropped(address indexed worker, bytes32 indexed taskId);

    modifier onlyWorker() {
        require(_workers[_msgSender()], 'Not worker');
        _;
    }

    constructor() {
        self = address(this);
    }

    function setMultiWorkers(address[] memory workers) external onlyOwner {
        require(workers.length < 100, 'Too many workers');
        for (uint i = 0; i < workers.length; i++) {
            _workers[workers[i]] = true;
        }
    }

    function setWorker(address worker) external onlyOwner {
        _workers[worker] = true;
    }

    function removeWorker(address worker) external onlyOwner {
        _workers[worker] = false;
    }

    function setNative(address native) external onlyOwner {
        nativeAsset = native;
    }

    // Temporary transfer asset to contract and save the corresponding task data
    function deposit(
        address token,
        uint256 amount,
        bytes memory recipient,
        address worker,
        bytes32 taskId,
        string memory task
    ) external payable whenNotPaused nonReentrant {
        require(amount > 0, 'Zero transfer');
        require(recipient.length > 0, 'Illegal recipient data');
        require(worker != address(0), 'Illegal worker address');
        require(
            bytes(_depositRecords[taskId].task).length == 0,
            'Duplicate task'
        );
        require(bytes(task).length > 0, 'Illegal task data');
        require(
            _activedTasks[worker].length < WORKER_MAX_TASK_COUNT,
            'Too many tasks'
        );

        if (token == nativeAsset) {
            require(msg.value == amount, 'Mismatch in transfer amount');
        } else {
            uint256 preBalance = IERC20(token).balanceOf(self);
            // Transfer from sender to contract
            IERC20(token).safeTransferFrom(msg.sender, self, amount);
            uint256 postBalance = IERC20(token).balanceOf(self);
            require(postBalance.sub(preBalance) == amount, 'Transfer failed');
        }

        // Put task id to actived task list
        bytes32[] storage tasks = _activedTasks[worker];
        tasks.push(taskId);
        // Save task details
        _depositRecords[taskId] = DepositInfo({
            sender: msg.sender,
            token: token,
            amount: amount,
            recipient: recipient,
            task: task
        });
        emit Deposited(msg.sender, token, amount, recipient, task);
    }

    // Drop task data and trigger asset beeing transfered back to task depositor
    function drop(bytes32 taskId) external whenNotPaused onlyWorker nonReentrant {
        DepositInfo memory depositInfo = this.findActivedTask(msg.sender, taskId);
        // Check if task is exist
        require(depositInfo.sender != address(0), "Task does not exist");

        // Remove task
        removeTask(msg.sender, taskId);

        // Transfer asset back to task depositor account
        if (depositInfo.token == nativeAsset) {
            (bool sent, bytes memory _data) = depositInfo.sender.call{value: depositInfo.amount}("");
            require(sent, "Failed to send Ether");
        } else {
            require(
                IERC20(depositInfo.token).balanceOf(self) >=
                    depositInfo.amount,
                'Insufficient balance'
            );
            IERC20(depositInfo.token).safeTransfer(depositInfo.sender, depositInfo.amount);
        }

        emit Dropped(msg.sender, taskId);
    }

    // Worker claim last actived task that belong to this worker
    function claim(bytes32 taskId) external whenNotPaused onlyWorker nonReentrant {
        DepositInfo memory depositInfo = this.findActivedTask(msg.sender, taskId);
        // Check if task is exist
        require(depositInfo.sender != address(0), "Task does not exist");

        // Remove task
        removeTask(msg.sender, taskId);

        // Transfer asset to worker account
        if (depositInfo.token == nativeAsset) {
            (bool sent, bytes memory _data) = msg.sender.call{value: depositInfo.amount}("");
            require(sent, "Failed to send Ether");
        } else {
            require(
                IERC20(depositInfo.token).balanceOf(self) >=
                    depositInfo.amount,
                'Insufficient balance'
            );
            IERC20(depositInfo.token).safeTransfer(msg.sender, depositInfo.amount);
        }

        emit Claimed(msg.sender, taskId);
    }

    function claimAndBatchCall(bytes32 taskId, Call[] calldata calls) external whenNotPaused onlyWorker nonReentrant {
        DepositInfo memory depositInfo = this.findActivedTask(msg.sender, taskId);
        // Check if task is exist
        require(depositInfo.sender != address(0), "Task does not exist");
        require(calls.length > 1, 'Too few calls');

        // Check first call
        require(calls[0].spendAsset == address(depositInfo.token), "spendAsset mismatch");
        require(calls[0].spendAmount == depositInfo.amount, "spendAmount mismatch");

        _batchCall(calls);

        // Remove task
        removeTask(msg.sender, taskId);

        emit Claimed(msg.sender, taskId);
    }

    // Worker execute a bunch of calls, make sure handler already hodld enough spendAsset of first call
    function batchCall(Call[] calldata calls) external payable whenNotPaused onlyWorker nonReentrant {
        _batchCall(calls);
    }

    function _batchCall(Call[] calldata calls) internal returns (Result[] memory returnData) {
    
        uint256 length = calls.length;
        require(length > 1, 'Too few calls');

        // Check spendAsset
        require(
            IERC20(calls[0].spendAsset).balanceOf(self) >=
                calls[0].spendAmount,
            'Insufficient balance'
        );

        returnData = new Result[](length);
        uint256 [] memory settleAmounts = new uint256[](calls.length);
        uint256 totalNativeAsset = 0;

        for (uint256 i = 0; i < length;) {
            // console.log("===> Start execute call: ", i);
            Result memory result = returnData[i];
            Call memory calli = calls[i];

            // update calldata from second call
            if (i > 0) {
                Call memory inputCall = calls[calli.inputCall];

                if (inputCall.needSettle && calli.spendAsset == inputCall.receiveAsset) {
                    // Update settleAmount to calldata from offset
                    uint256 settleAmount = settleAmounts[inputCall.callIndex];
                    // console.log("===> Update settleAmount to calldata from offset: ", settleAmount);
                    require(settleAmount > 0, 'Settle amount must be greater than 0');
                    require(calli.updateLen == 32, 'Unsupported update length');
                    bytes memory settleAmountBytes = abi.encodePacked(settleAmount);

                    // console.log("===> Calldata before update: ");
                    // console.logBytes(calli.callData);
                    for(uint j = 0; j < calli.updateLen; j++) {
                        calli.callData[j + calli.updateOffset] = settleAmountBytes[j];
                    }
                    // console.log("===> Calldata after update: ");
                    // console.logBytes(calli.callData);
                }
            }

            uint256 preBalance;
            uint256 postBalance;
            // Read balance before execution
            if (calli.needSettle) {
                if (calli.receiveAsset == nativeAsset) {
                    preBalance = self.balance;
                } else {
                    preBalance = IERC20(calli.receiveAsset).balanceOf(self);
                }
            }

            // console.log("===> Ready to execute call");
            // Execute
            (result.success, result.returnData) = calli.target.call{value: calli.value}(calli.callData);
            // console.log("===> Execute result: ", result.success);
            // console.log("===> Return data:");
            // console.logBytes(result.returnData);
            require(result.success, string(abi.encodePacked(string("Call failed: "), string(result.returnData))));
            unchecked {
                ++i;
                totalNativeAsset += calli.value;
            }

            // Settle balance after execution
            if (calli.needSettle) {
                if (calli.receiveAsset == nativeAsset) {
                    postBalance = self.balance;
                } else {
                    postBalance = IERC20(calli.receiveAsset).balanceOf(self);
                }
                settleAmounts[calli.callIndex] = postBalance.sub(preBalance);
                // console.log("===> Call", calli.callIndex, "been settled: ", settleAmounts[calli.callIndex]);
            }
        }
        require(
            msg.value == totalNativeAsset,
            'msg.value not satisfy calls'
        );
    }

    function findActivedTask(address worker, bytes32 taskId) public view returns (DepositInfo memory depositInfo) {
        bytes32[] memory tasks = _activedTasks[worker];
        uint checkIndex = 0;
        for (; checkIndex < tasks.length; checkIndex++) {
            if (taskId == tasks[checkIndex]) return _depositRecords[taskId];
        }
        return depositInfo;
    }

    function getLastActivedTask(address worker)
        public
        view
        returns (bytes32)
    {
        bytes32[] memory tasks = _activedTasks[worker];
        if (tasks.length > 0) return tasks[tasks.length - 1];
        else return bytes32(0);
    }

    function getActivedTasks(address worker)
        public
        view
        returns (bytes32[] memory)
    {
        return _activedTasks[worker];
    }

    function getTaskData(bytes32 taskId)
        public
        view
        returns (DepositInfo memory)
    {
        return _depositRecords[taskId];
    }

    function removeTask(address worker, bytes32 taskId) internal {
        bytes32[] memory tasks = _activedTasks[worker];
        uint checkIndex = 0;
        for (; checkIndex < tasks.length; checkIndex++) {
            if (taskId == tasks[checkIndex]) break;
        }
        // Task not found
        if (checkIndex >= tasks.length) return;

        // If tasks has more than 1 item, we should keep remaining items
        if (tasks.length == 1) {
            _activedTasks[worker] = new bytes32[](0);
        } else {
            bytes32[] memory remainingTasks = new bytes32[](tasks.length - 1);
            for (uint i = 0; i < tasks.length; i++) {
                if (i < checkIndex) {
                    remainingTasks[i] = tasks[i];
                } else {
                    // Shift
                    remainingTasks[i - 1] = tasks[i];
                }
            }
            // Assign remain tasks to storage
            _activedTasks[worker] = remainingTasks;
        }
    }
}
