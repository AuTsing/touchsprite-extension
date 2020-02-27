import * as http from 'http';

// 用于请求的选项
let options = {
    host: 'localhost',
    port: '8080',
    path: '/index.html'
};

// 处理响应的回调函数
let callback = function (response: any): void {
    // 不断更新数据
    var body = '';
    response.on('data', function (data: any) {
        body += data;
    });

    response.on('end', function () {
        // 数据接收完成
        console.log(body);
    });
}
// 向服务端发送请求
var req = http.request(options, callback);
req.end();