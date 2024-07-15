// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

contract ArbitrumArbitrage is Owanble {
    address immutable owner;
    address thisAddress;
    string public ERR_NO_PROFIT = "Trade Reverted, No Profit Made";

    constructor() {
        owner = payable(msg.sender);
        thisAddress = address(this);
    }

    modifier startOnlyOwner() {
        require(tx.origin == owner, "Origin is not owner");
        _;
    }

    modifier profitOny(address _token1) {
        uint startBalance = tokenBalance(_token1);
        _;
        uint endBalance = tokenBalance(_token1);
        require(endBalance > startBalance, ERR_NO_PROFIT);
    }

    function tokenBalance(
        address _tokenAddress
    ) private view returns (uint256) {
        return IERC20(_tokenAddress).balanceOf(thisAddress);
    }

    function getAmountOutMin(
        address router,
        address _tokenIn,
        address _tokenOut,
        uint256 _amount
    ) public view returns (uint256) {
        address[] memory path;
        path = new address[](2);
        path[0] = _tokenIn;
        path[1] = _tokenOut;
        uint256[] memory amountOutMins = IUniswapV2Router02(router)
            .getAmountsOut(_amount, path);

        return amountOutMins[path.length - 1];
    }

    function estimateDualDexTrade(
        address _router1,
        address _router2,
        address _token1,
        address _token2,
        uint256 _amount
    ) external view returns (uint256) {
        uint256 amtBack1 = getAmountOutMin(_router1, _token1, _token2, _amount);
        uint256 amtBack2 = getAmountOutMin(
            _router2,
            _token2,
            _token1,
            amtBack1
        );

        return amtBack2;
    }
    
    function _swap(address router, address _tokenIn, address _tokenOut, uint256 _amount) private {
        IERC20(_tokenIn).approve(router, _amount);
        address[] memory path;
        path = new address[](2);
        path[0] = _tokenIn;
        path[1] = _tokenOut;
        uint deadline = block.timestamp + 300;
        IUniswapV2Router02(router).swapExactTokensForTokens(_amount, 1, path, address(this), deadline);
    }

    function _dualDexTrade(
        address _router1,
        address _router2,
        address _token1,
        address _token2,
        uint256 _amount
    ) internal profitOnly(_token1) {
        uint token2InitialBalance = tokenBalance(_token2);
        swap(_router1, _token1, token2, _amount);
        uint token2Balance = IERC20(token2).balanceOf(thisAddress);
        uint tradeableAmount = token2Balance - token2InitialBalance;
        swap(router2, _token2, _token1, tradeableAmount);
    }

    function dualDexTrade(
        address _router1,
        address _router2,
        address _token1,
        address _token2,
        uint256 _amount
    ) external startOnlyOwner {
        _dualDexTrade(_router1, _router2, _token1, _token2, _amount);
    }
}
