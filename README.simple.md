# Bullas游戏自动领取脚本 (精简版)

自动监控Bullas游戏容量状态，在容量满时自动调用claim函数领取奖励。

## 安装与使用

1. 安装依赖:
```bash
npm install ethers@5.7.2 dotenv
```

2. 配置`.env`文件:
```
RPC_URL=https://rpc.berachain.com
PRIVATE_KEY=your_private_key_here
GAME_CONTRACT_ADDRESS=游戏合约地址
TOKEN_ID=6  # 根据实际情况调整
CHECK_INTERVAL=60
```

3. 运行脚本:
```bash
node simplified.js
```

## 注意事项

- 请勿共享您的私钥
- 确保钱包中有足够的BERA支付Gas费用
- 根据游戏合约的实际接口，可能需要调整ABI中的函数名 