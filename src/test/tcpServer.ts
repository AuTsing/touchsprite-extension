import * as net from 'net';

const server = net.createServer((socket: net.Socket) => {
    socket.on('data', (data) => {
        console.log(data.length);
        let dt = data.toString('utf8', 4, data.length - 2)
        console.log(dt);
        console.log(dt.length);
    });
    // socket.on('end', () => {
    //     server.close(() => console.log("日志服务器已关闭"));
    // })
});
server.on('error', (err: any) => {
    throw err;
});
server.listen(14088, () => console.log('日志服务器已启动'));
// let a = Buffer.from("a");
// console.log(a);