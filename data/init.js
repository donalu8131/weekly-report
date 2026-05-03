/**
 * 数据初始化脚本
 * 运行: node data/init.js
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname);
const REPORTS_DIR = path.join(DATA_DIR, 'reports');
const ANALYSIS_DIR = path.join(DATA_DIR, 'analysis');
const EMPLOYEES_FILE = path.join(DATA_DIR, 'employees.json');

// 创建目录
[DATA_DIR, REPORTS_DIR, ANALYSIS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ 创建目录: ${dir}`);
  } else {
    console.log(`✓ 目录已存在: ${dir}`);
  }
});

// 初始化员工数据
if (!fs.existsSync(EMPLOYEES_FILE)) {
  fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify([], null, 2), 'utf8');
  console.log(`✅ 创建员工数据文件: ${EMPLOYEES_FILE}`);
} else {
  console.log(`✓ 员工数据文件已存在: ${EMPLOYEES_FILE}`);
}

console.log('');
console.log('========================================');
console.log('  数据初始化完成');
console.log('  数据目录: ' + DATA_DIR);
console.log('========================================');
console.log('');
console.log('启动服务器: npm start');
console.log('访问地址: http://localhost:3000');
