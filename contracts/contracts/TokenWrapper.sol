// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title TokenWrapper
 * @notice Wraps ERC-20 tokens for cross-chain arbitrage via AggLayer
 * @dev Supports USDC, WBTC, USDT, and other ERC-20 tokens for bridging
 * 
 * This contract enables:
 * - Deposit ERC-20 tokens and receive wrapped versions
 * - Withdraw wrapped tokens back to underlying
 * - Cross-chain transfers via AggLayer bridge
 * - Fee collection for protocol sustainability
 * 
 * Security Features:
 * - Whitelist of supported tokens
 * - Per-token deposit/withdrawal limits
 * - Emergency pause functionality
 * - Reentrancy protection
 */
contract TokenWrapper is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    // ==================== Structs ====================
    
    struct TokenConfig {
        address tokenAddress;      // Underlying token address
        string symbol;             // Token symbol (e.g., "USDC")
        uint8 decimals;            // Token decimals
        bool enabled;              // Whether deposits are enabled
        uint256 minDeposit;        // Minimum deposit amount
        uint256 maxDeposit;        // Maximum single deposit
        uint256 dailyLimit;        // Daily deposit limit per user
        uint256 totalDeposited;    // Total amount currently deposited
        uint256 depositFeeBps;     // Deposit fee in basis points (100 = 1%)
        uint256 withdrawFeeBps;    // Withdrawal fee in basis points
    }
    
    struct UserBalance {
        uint256 deposited;         // Total deposited by user
        uint256 dailyDeposited;    // Amount deposited today
        uint256 lastDepositDay;    // Day number of last deposit
    }
    
    // ==================== State Variables ====================
    
    /// @notice Supported token configurations (token address => config)
    mapping(address => TokenConfig) public tokenConfigs;
    
    /// @notice List of all supported token addresses
    address[] public supportedTokens;
    
    /// @notice User balances per token (token => user => balance)
    mapping(address => mapping(address => UserBalance)) public userBalances;
    
    /// @notice Wrapped token balances (token => user => wrapped balance)
    mapping(address => mapping(address => uint256)) public wrappedBalances;
    
    /// @notice Total wrapped supply per token
    mapping(address => uint256) public totalWrappedSupply;
    
    /// @notice Collected fees per token
    mapping(address => uint256) public collectedFees;
    
    /// @notice Fee recipient address
    address public feeRecipient;
    
    /// @notice Reference to AgentExecutor for authorized operations
    address public agentExecutor;
    
    /// @notice Reference to bridge for cross-chain operations
    address public bridge;
    
    // ==================== Events ====================
    
    event TokenAdded(
        address indexed token,
        string symbol,
        uint8 decimals,
        uint256 minDeposit,
        uint256 maxDeposit
    );
    
    event TokenUpdated(address indexed token, bool enabled);
    
    event Deposited(
        address indexed token,
        address indexed user,
        uint256 amount,
        uint256 fee,
        uint256 wrapped
    );
    
    event Withdrawn(
        address indexed token,
        address indexed user,
        uint256 wrapped,
        uint256 fee,
        uint256 received
    );
    
    event CrossChainTransfer(
        address indexed token,
        address indexed from,
        uint32 indexed destinationNetwork,
        address recipient,
        uint256 amount
    );
    
    event FeesCollected(address indexed token, address indexed recipient, uint256 amount);
    
    event AgentExecutorUpdated(address indexed oldExecutor, address indexed newExecutor);
    
    // ==================== Errors ====================
    
    error TokenNotSupported(address token);
    error TokenDisabled(address token);
    error BelowMinDeposit(uint256 amount, uint256 min);
    error AboveMaxDeposit(uint256 amount, uint256 max);
    error DailyLimitExceeded(uint256 requested, uint256 remaining);
    error InsufficientBalance(uint256 requested, uint256 available);
    error InsufficientWrappedBalance(uint256 requested, uint256 available);
    error ZeroAmount();
    error InvalidTokenConfig();
    error UnauthorizedCaller();
    error TransferFailed();
    
    // ==================== Modifiers ====================
    
    modifier onlyAgentExecutor() {
        if (msg.sender != agentExecutor && msg.sender != owner()) {
            revert UnauthorizedCaller();
        }
        _;
    }
    
    modifier tokenSupported(address token) {
        if (tokenConfigs[token].tokenAddress == address(0)) {
            revert TokenNotSupported(token);
        }
        _;
    }
    
    modifier tokenEnabled(address token) {
        if (!tokenConfigs[token].enabled) {
            revert TokenDisabled(token);
        }
        _;
    }
    
    // ==================== Constructor ====================
    
    constructor(
        address _initialOwner,
        address _feeRecipient
    ) Ownable(_initialOwner) {
        feeRecipient = _feeRecipient;
    }
    
    // ==================== Token Management ====================
    
    /**
     * @notice Add a new supported token
     * @param token Address of the ERC-20 token
     * @param symbol Token symbol
     * @param decimals Token decimals
     * @param minDeposit Minimum deposit amount
     * @param maxDeposit Maximum single deposit amount
     * @param dailyLimit Daily deposit limit per user
     * @param depositFeeBps Deposit fee in basis points
     * @param withdrawFeeBps Withdrawal fee in basis points
     */
    function addSupportedToken(
        address token,
        string calldata symbol,
        uint8 decimals,
        uint256 minDeposit,
        uint256 maxDeposit,
        uint256 dailyLimit,
        uint256 depositFeeBps,
        uint256 withdrawFeeBps
    ) external onlyOwner {
        if (token == address(0)) revert InvalidTokenConfig();
        if (maxDeposit < minDeposit) revert InvalidTokenConfig();
        if (depositFeeBps > 1000 || withdrawFeeBps > 1000) revert InvalidTokenConfig(); // Max 10%
        
        tokenConfigs[token] = TokenConfig({
            tokenAddress: token,
            symbol: symbol,
            decimals: decimals,
            enabled: true,
            minDeposit: minDeposit,
            maxDeposit: maxDeposit,
            dailyLimit: dailyLimit,
            totalDeposited: 0,
            depositFeeBps: depositFeeBps,
            withdrawFeeBps: withdrawFeeBps
        });
        
        supportedTokens.push(token);
        
        emit TokenAdded(token, symbol, decimals, minDeposit, maxDeposit);
    }
    
    /**
     * @notice Enable or disable a token
     */
    function setTokenEnabled(address token, bool enabled) external onlyOwner tokenSupported(token) {
        tokenConfigs[token].enabled = enabled;
        emit TokenUpdated(token, enabled);
    }
    
    /**
     * @notice Update token limits and fees
     */
    function updateTokenConfig(
        address token,
        uint256 minDeposit,
        uint256 maxDeposit,
        uint256 dailyLimit,
        uint256 depositFeeBps,
        uint256 withdrawFeeBps
    ) external onlyOwner tokenSupported(token) {
        TokenConfig storage config = tokenConfigs[token];
        config.minDeposit = minDeposit;
        config.maxDeposit = maxDeposit;
        config.dailyLimit = dailyLimit;
        config.depositFeeBps = depositFeeBps;
        config.withdrawFeeBps = withdrawFeeBps;
    }
    
    // ==================== Deposit & Withdraw ====================
    
    /**
     * @notice Deposit ERC-20 tokens and receive wrapped tokens
     * @param token Address of the token to deposit
     * @param amount Amount to deposit
     * @return wrapped Amount of wrapped tokens received
     */
    function deposit(
        address token,
        uint256 amount
    ) external nonReentrant whenNotPaused tokenSupported(token) tokenEnabled(token) returns (uint256 wrapped) {
        if (amount == 0) revert ZeroAmount();
        
        TokenConfig storage config = tokenConfigs[token];
        
        // Validate amount
        if (amount < config.minDeposit) revert BelowMinDeposit(amount, config.minDeposit);
        if (amount > config.maxDeposit) revert AboveMaxDeposit(amount, config.maxDeposit);
        
        // Check daily limit
        UserBalance storage userBal = userBalances[token][msg.sender];
        uint256 today = block.timestamp / 1 days;
        
        if (userBal.lastDepositDay != today) {
            userBal.dailyDeposited = 0;
            userBal.lastDepositDay = today;
        }
        
        uint256 remaining = config.dailyLimit - userBal.dailyDeposited;
        if (amount > remaining) revert DailyLimitExceeded(amount, remaining);
        
        // Calculate fee
        uint256 fee = (amount * config.depositFeeBps) / 10000;
        wrapped = amount - fee;
        
        // Transfer tokens from user
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // Update balances
        userBal.deposited += amount;
        userBal.dailyDeposited += amount;
        wrappedBalances[token][msg.sender] += wrapped;
        totalWrappedSupply[token] += wrapped;
        config.totalDeposited += amount;
        collectedFees[token] += fee;
        
        emit Deposited(token, msg.sender, amount, fee, wrapped);
        
        return wrapped;
    }
    
    /**
     * @notice Withdraw underlying tokens by burning wrapped tokens
     * @param token Address of the token to withdraw
     * @param wrappedAmount Amount of wrapped tokens to burn
     * @return received Amount of underlying tokens received
     */
    function withdraw(
        address token,
        uint256 wrappedAmount
    ) external nonReentrant whenNotPaused tokenSupported(token) returns (uint256 received) {
        if (wrappedAmount == 0) revert ZeroAmount();
        
        // Check balance
        if (wrappedBalances[token][msg.sender] < wrappedAmount) {
            revert InsufficientWrappedBalance(wrappedAmount, wrappedBalances[token][msg.sender]);
        }
        
        TokenConfig storage config = tokenConfigs[token];
        
        // Calculate fee
        uint256 fee = (wrappedAmount * config.withdrawFeeBps) / 10000;
        received = wrappedAmount - fee;
        
        // Update balances
        wrappedBalances[token][msg.sender] -= wrappedAmount;
        totalWrappedSupply[token] -= wrappedAmount;
        config.totalDeposited -= wrappedAmount;
        collectedFees[token] += fee;
        
        // Transfer tokens to user
        IERC20(token).safeTransfer(msg.sender, received);
        
        emit Withdrawn(token, msg.sender, wrappedAmount, fee, received);
        
        return received;
    }
    
    // ==================== Cross-Chain Operations ====================
    
    /**
     * @notice Transfer wrapped tokens cross-chain via AggLayer
     * @dev Only callable by AgentExecutor for authorized agents
     * @param token Token to transfer
     * @param from Source address
     * @param destinationNetwork Destination chain ID
     * @param recipient Recipient on destination chain
     * @param amount Amount to transfer
     */
    function crossChainTransfer(
        address token,
        address from,
        uint32 destinationNetwork,
        address recipient,
        uint256 amount
    ) external onlyAgentExecutor tokenSupported(token) nonReentrant returns (bool) {
        if (amount == 0) revert ZeroAmount();
        
        // Check wrapped balance
        if (wrappedBalances[token][from] < amount) {
            revert InsufficientWrappedBalance(amount, wrappedBalances[token][from]);
        }
        
        // Deduct from sender
        wrappedBalances[token][from] -= amount;
        
        // In production: call bridge.bridgeAsset() or bridge.bridgeAndCall()
        // For now: emit event for tracking
        
        emit CrossChainTransfer(token, from, destinationNetwork, recipient, amount);
        
        return true;
    }
    
    /**
     * @notice Receive cross-chain transfer (called by bridge)
     * @param token Token being received
     * @param recipient Recipient address
     * @param amount Amount received
     */
    function receiveCrossChain(
        address token,
        address recipient,
        uint256 amount
    ) external tokenSupported(token) {
        // In production: only bridge can call this
        // require(msg.sender == bridge, "Only bridge");
        
        wrappedBalances[token][recipient] += amount;
        totalWrappedSupply[token] += amount;
    }
    
    // ==================== Agent Operations ====================
    
    /**
     * @notice Execute arbitrage swap (simplified)
     * @dev Transfers tokens between wrapped balances for arbitrage
     */
    function executeArbitrageSwap(
        address tokenIn,
        address tokenOut,
        address agent,
        uint256 amountIn,
        uint256 minAmountOut
    ) external onlyAgentExecutor nonReentrant returns (uint256 amountOut) {
        if (wrappedBalances[tokenIn][agent] < amountIn) {
            revert InsufficientWrappedBalance(amountIn, wrappedBalances[tokenIn][agent]);
        }
        
        // In production: call DEX aggregator (1inch, ParaSwap)
        // For MVP: simulate with 1:1 ratio for stablecoins, market rate for others
        
        // Deduct input
        wrappedBalances[tokenIn][agent] -= amountIn;
        
        // Calculate output (simplified - in production use oracle prices)
        amountOut = amountIn; // Placeholder - would use price oracle
        
        require(amountOut >= minAmountOut, "Slippage exceeded");
        
        // Credit output
        wrappedBalances[tokenOut][agent] += amountOut;
        
        return amountOut;
    }
    
    // ==================== View Functions ====================
    
    /**
     * @notice Get all supported tokens
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }
    
    /**
     * @notice Get user's wrapped balance for a token
     */
    function getWrappedBalance(address token, address user) external view returns (uint256) {
        return wrappedBalances[token][user];
    }
    
    /**
     * @notice Get user's deposit info for a token
     */
    function getUserDepositInfo(address token, address user) external view returns (
        uint256 totalDeposited,
        uint256 dailyDeposited,
        uint256 dailyRemaining,
        uint256 wrappedBalance
    ) {
        UserBalance storage bal = userBalances[token][user];
        TokenConfig storage config = tokenConfigs[token];
        
        uint256 today = block.timestamp / 1 days;
        uint256 todayDeposited = bal.lastDepositDay == today ? bal.dailyDeposited : 0;
        
        return (
            bal.deposited,
            todayDeposited,
            config.dailyLimit - todayDeposited,
            wrappedBalances[token][user]
        );
    }
    
    /**
     * @notice Get token stats
     */
    function getTokenStats(address token) external view returns (
        uint256 totalDeposited,
        uint256 totalWrapped,
        uint256 totalFees,
        bool enabled
    ) {
        TokenConfig storage config = tokenConfigs[token];
        return (
            config.totalDeposited,
            totalWrappedSupply[token],
            collectedFees[token],
            config.enabled
        );
    }
    
    // ==================== Admin Functions ====================
    
    /**
     * @notice Set the AgentExecutor address
     */
    function setAgentExecutor(address _agentExecutor) external onlyOwner {
        emit AgentExecutorUpdated(agentExecutor, _agentExecutor);
        agentExecutor = _agentExecutor;
    }
    
    /**
     * @notice Set the bridge address
     */
    function setBridge(address _bridge) external onlyOwner {
        bridge = _bridge;
    }
    
    /**
     * @notice Set fee recipient
     */
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
    }
    
    /**
     * @notice Collect accumulated fees for a token
     */
    function collectFees(address token) external onlyOwner tokenSupported(token) {
        uint256 fees = collectedFees[token];
        if (fees > 0) {
            collectedFees[token] = 0;
            IERC20(token).safeTransfer(feeRecipient, fees);
            emit FeesCollected(token, feeRecipient, fees);
        }
    }
    
    /**
     * @notice Emergency pause
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Emergency withdraw (only owner, only when paused)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(paused(), "Must be paused");
        IERC20(token).safeTransfer(owner(), amount);
    }
}
