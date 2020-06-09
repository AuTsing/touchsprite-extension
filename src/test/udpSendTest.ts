import * as dgram from 'dgram';

const message = '{ "ip": "192.168.6.103", "port": 14088 }';
const server = dgram.createSocket('udp4');
const client = dgram.createSocket('udp4');

// server
//     .on('listening', () => {
//         const info = server.address();
//         console.log(`server running ${info.address}: ${info.port}`);
//         server.setBroadcast(true);
//         setInterval(() => {
//             server.send(message, 14099, '255.255.255.255');
//         }, 2000);
//     })
//     .on('message', msg => {
//         console.log(`收到消息:${msg}`);
//     });
// server.on('close', () => {
//     console.log('Client UDP socket closed : BYE!');
// });

// server.bind(14088);

client.bind(() => {
    client.setBroadcast(true);
    client.send(message, 14099, '255.255.255.255', err => {
        console.log('发生错误');
        console.log(err);
        client.close();
    });
});
