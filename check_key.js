const { ethers } = require('ethers');
require('dotenv').config();

// 验证私钥格式的脚本
function validatePrivateKey() {
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    console.error('❌ 错误: 私钥为空，请在.env文件中设置PRIVATE_KEY');
    return false;
  }
  
  try {
    // 尝试创建钱包实例
    const wallet = new ethers.Wallet(privateKey);
    console.log('✅ 私钥格式正确!');
    console.log(`🔑 派生的钱包地址: ${wallet.address}`);
    return true;
  } catch (error) {
    console.error('❌ 私钥格式错误:', error.message);
    console.log('\n可能的原因:');
    console.log('1. 私钥长度不对 (应为64个十六进制字符，带0x前缀则为66字符)');
    console.log('2. 私钥包含非十六进制字符');
    console.log('3. 私钥周围有引号或额外的空格');
    console.log('\n正确格式示例:');
    console.log('PRIVATE_KEY=0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
    console.log('或');
    console.log('PRIVATE_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
    return false;
  }
}

// 运行验证
validatePrivateKey(); 