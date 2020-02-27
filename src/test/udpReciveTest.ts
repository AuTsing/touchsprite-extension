import * as dgram from 'dgram';

const client = dgram.createSocket('udp4')

// 当收到消息时触发
client.on('message', (msg, remoteInfo) => {
    console.log(`收到消息:【${msg}】 from ${remoteInfo.address}:${remoteInfo.port}`)
})

// 绑定端口号
client.bind(20001)