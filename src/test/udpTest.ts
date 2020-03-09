import * as dgram from 'dgram';

const message = '{ "ip": "192.168.6.1100111", "port": 14088 }'
const server = dgram.createSocket('udp4')
const client = dgram.createSocket('udp4');

// server
//     .on('listening', () => {
//         const info = server.address()
//         console.log(`server running ${info.address}: ${info.port}`)
//         server.setBroadcast(true)
//         setInterval(() => {
//             server.send(, 14099, '255.255.255.255')
//         }, 2000)
//     })
// .on('message', (msg) => {
//     console.log(`收到消息:${msg}`)
// })

// server.bind(14099)

// client.bind(() => { client.setBroadcast(true) });
client.send(message, 14088, '192.168.6.100', err => {
    console.log(err)
    client.close()
});