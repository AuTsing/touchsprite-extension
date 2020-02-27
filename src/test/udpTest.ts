import * as dgram from 'dgram';

const server = dgram.createSocket('udp4')

server
    .on('listening', () => {
        const info = server.address()
        console.log(`server running ${info.address}: ${info.port}`)
        server.setBroadcast(true)
        setInterval(() => {
            server.send('{ "ip": "192.168.6.100", "port": 14099 }', 14099, '255.255.255.255')
        }, 2000)
    })
    .on('message', (msg) => {
        console.log(`收到消息:${msg}`)
    })

server.bind(14099)