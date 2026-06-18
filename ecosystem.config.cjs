module.exports = {
  apps: [{
    name: 'wxbot',
    script: 'src/index.js',
    watch: false,
    restart_delay: 10000,     // 重启延迟10秒，等待微信连接完全释放
    max_restarts: 5,          // 最大重启次数
    min_uptime: '15s',        // 15秒内崩溃不算正常启动
    exp_backoff_restart_delay: 5000,  // 指数退避，从5秒开始
    kill_timeout: 5000,       // 给进程5秒时间优雅退出
    env: {
      NODE_ENV: 'production'
    }
  }]
};
