module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-leading-blank': [2, 'always'],        // body 开始于空白行
    'footer-leading-blank': [1, 'always'],
    'header-max-length': [2, 'always', 108],    // header 字符最大长度为 108
    'subject-empty': [2, 'never'],              // subject 不为空
    'type-empty': [2, 'never'],                 // type 不为空
    'subject-case': [0],
    'type-enum': [
      2,
      'always',
      [
        'feat',       // 增加新功能
        'fix',        // 修复问题/BUG
        'perf',       // 优化/性能提升
        'style',      // 代码风格相关无影响运行结果的
        'docs',       // 文档/注释
        'test',       // 测试相关
        'refactor',   // 重构
        'build',      // 对构建系统或者外部依赖项进行了修改
        'ci',         // 对 CI 配置文件或脚本进行了修改
        'chore',      // 依赖更新/脚手架配置修改等
        'revert',     // 撤销修改
        'wip',        // 开发中
        'workflow',   // 工作流改进
        'types',      // 类型修改
        'release',
      ],
    ],
  },
}
