# Bullas游戏自动领取脚本

自动定期执行 Bullas 游戏的 claim 函数，领取游戏奖励。

## 功能特点

- 固定间隔自动领取奖励 (默认8小时)
- 直接与智能合约交互，无需浏览器模拟
- 简单轻量，稳定可靠
- 日志记录每次领取时间，自动判断是否需要立即执行

## 安装与使用

1. 安装依赖:
```bash
npm install ethers@5.7.2 dotenv
```

2. 配置`.env`文件:
```
RPC_URL=https://rpc.berachain.com
PRIVATE_KEY=your_private_key_here
# Bullas V2
GAME_CONTRACT_ADDRESS=your_game_CA
TOKEN_ID=your_token_id
CHECK_INTERVAL=28800  # 间隔时间（秒），默认8小时
```

3. 运行脚本:
```bash
node index.js
```

## 工作原理

1. 启动时读取上次执行记录，判断是立即执行还是等待
2. 初始化钱包和合约连接
3. 直接调用智能合约的claim函数领取奖励
4. 记录执行时间到日志文件
5. 按设定的时间间隔定期重复执行

## 日志文件

脚本会在`claim_log.txt`文件中记录每次成功执行的时间。格式为：
```
2023-10-25T08:00:00.123Z - Claim executed for TokenID: 1699
```

当脚本重新启动时，会读取此日志文件来决定是否需要立即执行claim操作：
- 如果日志文件不存在或为空，脚本会立即执行
- 如果上次执行时间+间隔时间 > 当前时间，则等待至应执行时间
- 如果上次执行时间+间隔时间 ≤ 当前时间，则立即执行

## 注意事项

- 请勿共享您的私钥
- 确保钱包中有足够的 BERA 支付 Gas 费用
- 日志文件(`claim_log.txt`)位于脚本同一目录下

## 开始使用

### 前提条件

- Node.js (版本 14 或更高)
- 一个Berachain网络钱包（包含私钥）
- 游戏合约地址

### 安装

1. 克隆此仓库或下载源代码
2. 进入项目目录并安装依赖：

```bash
cd auto_claim
npm install
```

3. 复制环境变量示例文件并配置您的环境变量：

```bash
cp .env.example .env
```

4. 编辑`.env`文件，填写以下信息：
   - `RPC_URL`: Berachain RPC URL
   - `PRIVATE_KEY`: 您的钱包私钥（注意保密！）
   - `GAME_CONTRACT_ADDRESS`: 游戏合约地址
   - `CHECK_INTERVAL`: 检查频率（秒）

### 使用方法

1. 确保您已正确配置`.env`文件
2. 运行脚本：

```bash
node index.js
```

脚本将开始监控您的账户容量状态，并在容量满时自动领取奖励。

## 常见问题

**Q: 游戏合约地址在哪里可以找到？**

A: .env.example中已经提供

**Q: 为什么脚本无法连接到网络？**

A: 检查您的RPC URL是否正确，Berachain网络是否正常运行。

**Q: 如何确认脚本正常工作？**

A: 脚本会输出日志信息，包括容量状态和交易哈希。您可以通过Berachain区块浏览器查看交易是否成功。

## 许可证

MIT

## 免责声明

本脚本仅供学习和研究使用。使用本脚本与游戏交互时，请确保符合游戏规则和条款。使用者应自行承担使用本脚本的风险。 