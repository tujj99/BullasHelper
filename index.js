require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// 环境变量配置
const RPC_URL = process.env.RPC_URL || 'https://rpc.berachain.com';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const GAME_CONTRACT_ADDRESS = process.env.GAME_CONTRACT_ADDRESS;
// 将单个 TOKEN_ID 更改为 TOKEN_IDS 列表
// const TOKEN_ID = parseInt(process.env.TOKEN_ID);
const TOKEN_IDS_STRING = process.env.TOKEN_IDS; // 例如 "1,2,3"
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
console.log('初始化提供者和钱包...');
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
// Game Contract 将在需要时实例化，因为我们可能需要针对不同的 tokenId 调用它（尽管地址相同）
// const gameContract = new ethers.Contract(GAME_CONTRACT_ADDRESS, gameABI, wallet);

console.log(`钱包地址: ${wallet.address}`);
console.log(`游戏合约地址: ${GAME_CONTRACT_ADDRESS}`);
// console.log(`Token ID: ${TOKEN_ID}`); // 移除单 ID 日志

// 解析 TOKEN_IDS
let TOKEN_IDS = [];
if (!TOKEN_IDS_STRING) {
  console.error("错误：未在 .env 文件中定义 TOKEN_IDS");
  process.exit(1);
} else {
  TOKEN_IDS = TOKEN_IDS_STRING.split(',')
                              .map(id => parseInt(id.trim()))
                              .filter(id => !isNaN(id)); // 过滤掉无效的数字
}

if (TOKEN_IDS.length === 0) {
  console.error("错误：TOKEN_IDS 环境变量为空或格式无效。请提供逗号分隔的数字列表。");
  process.exit(1);
}

console.log(`将处理的 Token IDs: ${TOKEN_IDS.join(', ')}`);
console.log(`自动领取间隔: ${CHECK_INTERVAL / 60} 分钟 (${CHECK_INTERVAL / 3600} 小时)`);

// 记录执行时间到日志文件 - 使用UTC时间记录
function logClaimTime(tokenId, txHash, message = 'Claim executed') {
  const now = new Date();
  const logEntry = `${now.toISOString()} - ${message} for TokenID: ${tokenId} - TX: ${txHash || 'unknown'}\n`;

  fs.appendFileSync(LOG_FILE, logEntry);
  console.log(`[TokenID: ${tokenId}] 已记录日志: ${message}`);
}

// 读取特定 TokenID 的上次执行时间 - 解析为UTC时间
function getLastClaimTime(tokenId) {
  if (!fs.existsSync(LOG_FILE)) {
    console.log(`[TokenID: ${tokenId}] 未找到日志文件，视为首次运行`);
    return null;
  }

  try {
    const logContent = fs.readFileSync(LOG_FILE, 'utf8');
    const logLines = logContent.trim().split('\n');

    // 从后往前查找该 tokenId 的最新成功执行记录
    for (let i = logLines.length - 1; i >= 0; i--) {
      const line = logLines[i];
      // 检查日志行是否包含正确的 tokenId 并且不是失败记录
      if (line.includes(`TokenID: ${tokenId}`) && line.includes('Claim executed')) {
        const isoTimeMatch = line.match(/^([\d\-T:\.Z]+)/);
        if (isoTimeMatch && isoTimeMatch[1]) {
          const lastClaimTime = new Date(isoTimeMatch[1]); // UTC 时间
          const nextExecutionTimeUTC = new Date(lastClaimTime.getTime() + CHECK_INTERVAL * 1000);

          // console.log(`[TokenID: ${tokenId}] 上次执行时间(UTC): ${lastClaimTime.toISOString()}`);
          console.log(`[TokenID: ${tokenId}] 上次执行时间(本地): ${lastClaimTime.toLocaleString('zh-CN', {hour12: false})}`);
          // console.log(`[TokenID: ${tokenId}] 下次执行时间(UTC): ${nextExecutionTimeUTC.toISOString()}`);
          console.log(`[TokenID: ${tokenId}] 下次执行时间(本地): ${nextExecutionTimeUTC.toLocaleString('zh-CN', {hour12: false})}`);

          return lastClaimTime; // 返回UTC时间对象
        }
      }
    }

    console.log(`[TokenID: ${tokenId}] 未在日志中找到该 TokenID 的成功执行记录`);
    return null; // 没有找到该 tokenId 的记录
  } catch (error) {
    console.error(`[TokenID: ${tokenId}] 读取日志文件失败:`, error.message);
    return null;
  }
}

// 调用合约claim函数
async function claim(tokenId) {
  try {
    console.log(`[TokenID: ${tokenId}] 开始执行 claim...`);
    const gameContract = new ethers.Contract(GAME_CONTRACT_ADDRESS, gameABI, wallet);

    // --- 可选：打印 MethodID 和交易数据 (仅调试时需要) ---
    // const contractInterface = new ethers.utils.Interface(gameABI);
    // const claimMethodId = contractInterface.getSighash("claim");
    // console.log(`[TokenID: ${tokenId}] Claim 函数的 MethodID: ${claimMethodId}`);
    // const callData = contractInterface.encodeFunctionData("claim", [tokenId]);
    // console.log(`[TokenID: ${tokenId}] 即将发送的交易数据: ${callData}`);
    // --- 结束可选打印 ---

    const tx = await gameContract.claim(tokenId, {
      // 可以考虑添加 gas 限制或价格（如果需要）
      // gasLimit: ethers.utils.hexlify(100000), // 示例
      // gasPrice: ethers.utils.parseUnits('10', 'gwei'), // 示例
    });
    console.log(`[TokenID: ${tokenId}] 交易已提交，交易哈希: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[TokenID: ${tokenId}] 交易已确认，区块号: ${receipt.blockNumber}`);
    console.log(`[TokenID: ${tokenId}] 成功领取奖励!`);

    // 记录本次执行时间和交易哈希
    logClaimTime(tokenId, tx.hash);

    return tx.hash;
  } catch (error) {
    console.error(`[TokenID: ${tokenId}] 领取失败:`, error.message);
    // 记录失败信息
    logClaimTime(tokenId, null, `领取失败: ${error.message}`);
    return false;
  }
}

// 主函数：为每个 Token ID 安排初始检查和执行
async function run() {
  console.log(`\n=== 程序启动 - 检查所有 Token IDs ===`);
  const nowUTC = new Date();
  console.log(`当前时间(本地): ${nowUTC.toLocaleString('zh-CN', {hour12: false})}`);
  console.log('===================================');

  // 使用 for...of 循环并配合 await 来顺序处理每个 token ID 的初始检查
  for (const tokenId of TOKEN_IDS) {
    console.log(`\n--- 检查 TokenID: ${tokenId} ---`);
    // 读取特定 TokenID 的上次执行时间 (UTC时间)
    const lastClaimTime = getLastClaimTime(tokenId);
    const currentTimeUTC = new Date(); // 获取当前 UTC 时间进行比较

    if (lastClaimTime) {
      // 计算下次应该执行的时间 (UTC)
      const nextExecutionTimeUTC = new Date(lastClaimTime.getTime() + CHECK_INTERVAL * 1000);

      if (nextExecutionTimeUTC > currentTimeUTC) {
        // 还没到执行时间，需要等待
        const waitTime = nextExecutionTimeUTC.getTime() - currentTimeUTC.getTime();
        const waitMinutes = Math.round(waitTime / 1000 / 60);
        const waitHours = Math.round(waitTime / 1000 / 3600 * 10) / 10;

        console.log(`[TokenID: ${tokenId}] 距离下次执行还有 ${waitMinutes} 分钟 (约 ${waitHours} 小时)`);
        console.log(`-----------------------------------`);

        // 设置定时器在适当的时间为这个 tokenId 执行
        // 注意：这里仍然使用 setTimeout 异步调度，不会阻塞循环
        setTimeout(() => executeAndScheduleNext(tokenId), waitTime);
      } else {
        // 已经超过了应该执行的时间，立即执行
        console.log(`[TokenID: ${tokenId}] 已超过计划执行时间，立即执行`);
        // 使用 await 等待立即执行的任务完成（或失败并安排重试），再检查下一个 token id
        await executeAndScheduleNext(tokenId);
      }
    } else {
      // 没有上次执行记录，立即执行
      console.log(`[TokenID: ${tokenId}] 没有找到上次成功执行记录，立即执行`);
      // 使用 await 等待立即执行的任务完成（或失败并安排重试），再检查下一个 token id
      await executeAndScheduleNext(tokenId);
    }
  }
  console.log(`\n=== 所有 Token ID 初始检查完成 ===`);
  // run 函数本身不再无限循环，而是为每个 token ID 启动一个独立的调度循环
}

// 执行特定 tokenId 的 claim 并安排下一次执行
async function executeAndScheduleNext(tokenId) {
  let txResult = false; // 初始化为 false
  try {
    // 执行claim
    txResult = await claim(tokenId);

    // 如果是失败的交易，安排稍后重试
    if (!txResult) {
      const retryDelay = 3600 * 1000; // 1小时后重试 (单位：毫秒)
      console.log(`[TokenID: ${tokenId}] 由于执行失败，将在 ${retryDelay / 1000 / 60} 分钟后重试`);
      setTimeout(() => executeAndScheduleNext(tokenId), retryDelay);
      return; // 失败后不再安排常规的下一次执行，等待重试
    }
  } catch (error) {
    // 捕获 claim 函数内部未处理的意外错误
    console.error(`[TokenID: ${tokenId}] 执行过程中发生意外错误:`, error);
    // 也可以安排重试
    const retryDelay = 3600 * 1000; // 1小时后重试
    console.log(`[TokenID: ${tokenId}] 由于意外错误，将在 ${retryDelay / 1000 / 60} 分钟后重试`);
    setTimeout(() => executeAndScheduleNext(tokenId), retryDelay);
    return;
  }

  // ---- 只有在 claim 成功后才执行这里的调度 ----
  // 获取当前时间 (UTC) 用于计算下一次执行时间
  const currentTime = new Date();
  // 计算下次执行时间 (UTC)
  const nextCheckUTC = new Date(currentTime.getTime() + CHECK_INTERVAL * 1000);

  console.log(`[TokenID: ${tokenId}] 本次领取成功。`);
  console.log(`[TokenID: ${tokenId}] 当前时间(本地): ${currentTime.toLocaleString('zh-CN', {hour12: false})}`);
  console.log(`[TokenID: ${tokenId}] 下次执行时间(本地): ${nextCheckUTC.toLocaleString('zh-CN', {hour12: false})}`);
  console.log(`-----------------------------------`);

  // 设置该 Token ID 的下次检查
  setTimeout(() => executeAndScheduleNext(tokenId), CHECK_INTERVAL * 1000);
}

// 启动程序
run();
// 不再需要最后的 run() 调用，因为它现在由 run 函数内部的循环和 setTimeout 管理
// run(); 