module.exports = {
  apps: [
    {
      name: 'ecommerce',
      cwd: __dirname,
      script: 'npm',
      args: 'run test',
      interpreter: 'none'
    }
  ]
}