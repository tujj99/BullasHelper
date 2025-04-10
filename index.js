require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// 环境变量配置
const RPC_URL = process.env.RPC_URL || 'https://rpc.berachain.com';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const GAME_CONTRACT_ADDRESS = process.env.GAME_CONTRACT_ADDRESS;
const TOKEN_ID = parseInt(process.env.TOKEN_ID);
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL || '28800'); // 默认8小时检查一次

// 日志文件路径
const LOG_FILE = path.join(__dirname, 'claim_log.txt');

// 游戏ABI（简化版，只包含claim函数）
const gameABI = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "claim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// 初始化
console.log('初始化合约和钱包...');
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const gameContract = new ethers.Contract(GAME_CONTRACT_ADDRESS, gameABI, wallet);

console.log(`钱包地址: ${wallet.address}`);
console.log(`游戏合约地址: ${GAME_CONTRACT_ADDRESS}`);
console.log(`Token ID: ${TOKEN_ID}`);
console.log(`自动领取间隔: ${CHECK_INTERVAL / 60} 分钟 (${CHECK_INTERVAL / 3600} 小时)`);

// 记录执行时间到日志文件 - 使用UTC时间记录
function logClaimTime(txHash) {
  const now = new Date();
  const logEntry = `${now.toISOString()} - Claim executed for TokenID: ${TOKEN_ID} - TX: ${txHash || 'unknown'}\n`;
  
  fs.appendFileSync(LOG_FILE, logEntry);
  console.log(`已记录执行时间到日志文件: ${LOG_FILE}`);
}

// 读取上次执行时间 - 解析为UTC时间
function getLastClaimTime() {
  if (!fs.existsSync(LOG_FILE)) {
    console.log('未找到日志文件，这可能是首次运行');
    return null;
  }
  
  try {
    const logContent = fs.readFileSync(LOG_FILE, 'utf8');
    const logLines = logContent.trim().split('\n');
    
    if (logLines.length === 0) {
      console.log('日志文件为空，可能是首次运行');
      return null;
    }
    
    // 获取最后一行
    const lastLine = logLines[logLines.length - 1];
    // 从日志行中提取ISO时间字符串 (格式: "2023-04-15T12:34:56.789Z - Claim executed...")
    const isoTimeMatch = lastLine.match(/^([\d\-T:\.Z]+)/);
    
    if (isoTimeMatch && isoTimeMatch[1]) {
      // 将ISO字符串解析为UTC日期对象
      const lastClaimTime = new Date(isoTimeMatch[1]);
      
      // 计算下次执行时间 (UTC)
      const nextExecutionTimeUTC = new Date(lastClaimTime.getTime() + CHECK_INTERVAL * 1000);
      
      // 显示UTC和本地时间格式以便于理解
      // console.log(`上次执行时间(UTC): ${lastClaimTime.toISOString()}`);
      console.log(`上次执行时间(本地): ${lastClaimTime.toLocaleString('zh-CN', {hour12: false})}`);
      // console.log(`下次执行时间(UTC): ${nextExecutionTimeUTC.toISOString()}`);
      console.log(`下次执行时间(本地): ${nextExecutionTimeUTC.toLocaleString('zh-CN', {hour12: false})}`);
      
      return lastClaimTime; // 返回UTC时间对象
    }
    
    console.log('无法从日志中解析时间，将立即执行');
    return null;
  } catch (error) {
    console.error('读取日志文件失败:', error.message);
    return null;
  }
}

// 调用合约claim函数
async function claim() {
  try {
    console.log('开始执行claim...');
    
    // 计算并打印MethodID
    const contractInterface = new ethers.utils.Interface(gameABI);
    const claimMethodId = contractInterface.getSighash("claim");
    console.log(`Claim 函数的 MethodID: ${claimMethodId}`);
    
    // 打印将要发送的交易数据
    const callData = contractInterface.encodeFunctionData("claim", [TOKEN_ID]);
    console.log(`即将发送的交易数据: ${callData}`);
    
    // 调用claim函数，传入tokenId
    const tx = await gameContract.claim(TOKEN_ID);
    console.log(`交易已提交，交易哈希: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`交易已确认，区块号: ${receipt.blockNumber}`);
    console.log('成功领取奖励!');
    
    // 记录本次执行时间和交易哈希
    logClaimTime(tx.hash);
    
    return tx.hash;
  } catch (error) {
    console.error('领取失败:', error.message);
    // 记录失败信息
    logClaimTime(`领取失败: ${error.message}`);
    return false;
  }
}

// 监听与合约相关的所有交易 - 优化版
async function setupContractMonitor() {
  console.log(`开始监控合约 ${GAME_CONTRACT_ADDRESS} 的所有交易...`);
  
  try {
    // 使用区块监听替代pending交易监听，更可靠
    provider.on('block', async (blockNumber) => {
      try {
        // 获取最新区块
        const block = await provider.getBlock(blockNumber, true);
        
        if (block && block.transactions) {
          // 遍历区块中的所有交易
          for (const tx of block.transactions) {
            // 只关注发送到游戏合约的交易
            if (tx.to && tx.to.toLowerCase() === GAME_CONTRACT_ADDRESS.toLowerCase()) {
              console.log('\n===== 检测到游戏合约交易 =====');
              console.log(`区块号: ${blockNumber}`);
              console.log(`交易哈希: ${tx.hash}`);
              console.log(`发送地址: ${tx.from}`);
              console.log(`Gas价格: ${ethers.utils.formatUnits(tx.gasPrice || 0, 'gwei')} Gwei`);
              
              // 获取函数选择器（前4字节）
              const functionSelector = tx.data.substring(0, 10);
              console.log(`函数选择器: ${functionSelector}`);
              
              // 检查是否是claim函数
              const claimSelector = '0x379607f5';  // 从您的日志中获取的实际claim函数选择器
              if (functionSelector.toLowerCase() === claimSelector.toLowerCase()) {
                console.log('⭐ 检测到claim操作!');
                
                try {
                  // 解析tokenId参数
                  const tokenIdHex = '0x' + tx.data.substring(10).padStart(64, '0');
                  const tokenId = parseInt(tokenIdHex, 16);
                  console.log(`Token ID: ${tokenId}`);
                  
                  // 检查是否是我们关注的tokenId
                  if (tokenId === TOKEN_ID) {
                    console.log(`⚠️ 检测到Token ID ${TOKEN_ID}的claim操作！`);
                    
                    // 如果不是由我们自己发起的交易
                    if (tx.from.toLowerCase() !== wallet.address.toLowerCase()) {
                      console.log('检测到外部claim操作，重置计时器...');
                      // 记录此次外部claim
                      logClaimTime(`EXTERNAL_CLAIM: ${tx.hash}`);
                      // 重新设置下次执行时间（可选）
                      resetTimer();
                    } else {
                      console.log('这是由本脚本发起的claim操作');
                    }
                  }
                } catch (parseError) {
                  console.log(`解析交易参数出错: ${parseError.message}`);
                }
              }
              console.log('===========================\n');
            }
          }
        }
      } catch (blockError) {
        console.error(`处理区块 ${blockNumber} 时出错:`, blockError.message);
      }
    });
    
    // 添加重置计时器函数
    function resetTimer() {
      // 清除现有的定时任务
      if (global.nextExecutionTimer) {
        clearTimeout(global.nextExecutionTimer);
      }
      
      // 设置新的执行时间
      const now = new Date();
      const nextCheckTime = new Date(now.getTime() + CHECK_INTERVAL * 1000);
      
      console.log(`已重置计时器! 下次执行时间(本地): ${nextCheckTime.toLocaleString('zh-CN', {hour12: false})}`);
      
      // 设置新的定时器
      global.nextExecutionTimer = setTimeout(executeAndScheduleNext, CHECK_INTERVAL * 1000);
    }
    
    console.log('区块监控已启动，等待新区块...');
  } catch (error) {
    console.error('设置监控时出错:', error.message);
  }
}

// 主函数：根据上次执行时间决定何时调用claim函数
async function run() {
  // 使用UTC时间显示启动时间，也显示本地时间便于理解
  const nowUTC = new Date();
  console.log(`\n=== 程序启动 ===`);
  // console.log(`当前时间(UTC): ${nowUTC.toISOString()}`);
  console.log(`当前时间(本地): ${nowUTC.toLocaleString('zh-CN', {hour12: false})}`);
  
  // 读取上次执行时间 (UTC时间)
  const lastClaimTime = getLastClaimTime();
  
  if (lastClaimTime) {
    // 计算下次应该执行的时间 (UTC)
    const nextExecutionTimeUTC = new Date(lastClaimTime.getTime() + CHECK_INTERVAL * 1000);
    const nowUTC = new Date();
    
    if (nextExecutionTimeUTC > nowUTC) {
      // 还没到执行时间，需要等待
      const waitTime = nextExecutionTimeUTC.getTime() - nowUTC.getTime();
      const waitMinutes = Math.round(waitTime / 1000 / 60);
      const waitHours = Math.round(waitTime / 1000 / 3600 * 10) / 10;
      
      console.log(`距离下次执行还有 ${waitMinutes} 分钟 (约 ${waitHours} 小时)`);
      console.log(`===================================`);
      
      // 设置定时器在适当的时间执行
      setTimeout(executeAndScheduleNext, waitTime);
      return;
    } else {
      // 已经超过了应该执行的时间，立即执行
      console.log('已超过计划执行时间，立即执行');
    }
  } else {
    // 没有上次执行记录，立即执行
    console.log('没有找到上次执行记录，立即执行');
  }
  
  // 启动合约监控
  await setupContractMonitor();
  
  // 立即执行并安排下一次
  executeAndScheduleNext();
}

// 执行claim并安排下一次执行
async function executeAndScheduleNext() {
  try {
    // 执行claim
    const txResult = await claim();
    
    // 如果是失败的交易，可能需要更快地重试
    if (!txResult) {
      console.log('由于执行失败，将在1小时后重试');
      setTimeout(executeAndScheduleNext, 3600 * 1000); // 1小时后重试
      return;
    }
  } catch (error) {
    console.error('执行过程中出错:', error);
  }
  
  // 获取当前时间 (UTC)
  const currentTime = new Date();
  // 计算下次执行时间 (UTC)
  const nextCheckUTC = new Date(currentTime.getTime() + CHECK_INTERVAL * 1000);
  // console.log(`下次执行时间(UTC): ${nextCheckUTC.toISOString()}`);
  console.log(`当前时间(本地): ${currentTime.toLocaleString('zh-CN', {hour12: false})}`);
  console.log(`下次执行时间(本地): ${nextCheckUTC.toLocaleString('zh-CN', {hour12: false})}`);
  console.log('===================================');
  
  // 设置下次检查
  setTimeout(executeAndScheduleNext, CHECK_INTERVAL * 1000);
}

// 启动程序
run(); 