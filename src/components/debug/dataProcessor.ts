/* eslint-disable eqeqeq */
import { ICallbackArgs } from './LuaDebug';
import { Socket } from 'net';
import Ui from '../ui/Ui';
import { LuaRuntime } from './LuaRuntime';

interface IOrder {
    callbackId?: number;
    callback?: (() => void) | ((args: ICallbackArgs) => void) | ((args: ICallbackArgs, info: any) => void);
    callbackArgs?: ICallbackArgs;
    timeOut?: number;
}

interface ICmdInfo {
    info: { logInfo?: string; memInfo?: string; [key: number]: { type: string; value: string } };
    cmd: string;
    callbackId: number;
}

//网络收发消息，记录回调
export class DataProcessor {
    private readonly runtime: LuaRuntime;
    private readonly separator: string;
    public socket: Socket | undefined;
    public isNeedB64EncodeStr: boolean = true;
    private orderList: IOrder[] = []; //记录随机数和它对应的回调

    private getDataJsonCatch: string = ''; //解析缓存，防止用户信息中含有分隔符
    private cutoffMsgCache: string = '';
    private reciveMsgQueue: string[] = []; //记录粘包的多条指令

    constructor(runtime: LuaRuntime) {
        this.runtime = runtime;
        this.separator = runtime.tcpSplitChar;
    }

    /**
     * 接收从Debugger发来的消息
     * @param originData: 消息串
     */
    public resolveMsg(originData: string) {
        let data = originData.trim();
        if (this.cutoffMsgCache.length > 0) {
            data = this.cutoffMsgCache + data;
            this.cutoffMsgCache = '';
        }

        let pos = data.indexOf(this.separator);
        if (pos < 0) {
            //没有分隔符，做截断判断
            this.cacheCutoffMsg(data);
        } else {
            this.reciveMsgQueue = data.split(this.separator);
            if (data.substring(data.length - this.separator.length, data.length) !== this.separator) {
                const lastMsg = this.reciveMsgQueue.pop();
                if (lastMsg) {
                    this.cacheCutoffMsg(lastMsg);
                }
            }
            while (this.reciveMsgQueue.length > 0) {
                const queue = this.reciveMsgQueue.shift(); //从头部取元素，保证是一个队列形式
                this.resolveSingleMsg(String(queue));
            }
        }

        //最后处理一下超时回调
        for (let index = 0; index < this.orderList.length; index++) {
            const element = this.orderList[index];
            if (element['timeOut'] && Date.now() > element['timeOut']) {
                Ui.outputDebug(element['callbackId'] + ' 请求超时! 详细请求信息可在 LuaPanda Adapter 中搜索此id查看');
                const cb = element.callback as (args: ICallbackArgs) => void;
                const cba = element.callbackArgs!;
                cb(cba);
                this.orderList.splice(index, 1);
            }
        }
    }

    /**
     * 切割消息
     * @param originData: 消息串
     */
    private cacheCutoffMsg(originData: string) {
        this.cutoffMsgCache = this.cutoffMsgCache + originData;
    }

    /**
     * 处理单条消息。主要包括解析json，分析命令，做相应处理
     * @param data 消息json
     */
    private resolveSingleMsg(data: string) {
        let cmdInfo: ICmdInfo;
        try {
            if (this.getDataJsonCatch) {
                data = this.getDataJsonCatch + data;
            }
            cmdInfo = JSON.parse(data);
            if (this.isNeedB64EncodeStr && cmdInfo['info'] !== undefined) {
                for (let i = 0, len = cmdInfo.info.length; i < len; i++) {
                    if (cmdInfo['info'][i].type === 'string') {
                        cmdInfo['info'][i].value = Buffer.from(cmdInfo.info[i].value, 'base64').toString();
                    }
                }
            }
            this.getDataJsonCatch = '';
        } catch (e) {
            if (this.isNeedB64EncodeStr) {
                const content = '[Adapter Error] JSON解析失败 ' + data;
                Ui.popError(content);
                Ui.outputError(content);
            } else {
                this.getDataJsonCatch = data + '|*|';
            }
            return;
        }

        if (cmdInfo === undefined) {
            const content = '[Adapter Error] JSON解析失败，缺失 cmdInfo ' + data;
            Ui.popError(content);
            Ui.outputError(content);
            return;
        }
        if (cmdInfo['cmd'] === undefined) {
            const content = '[Adapter Error] JSON解析失败，缺失 cmd ' + data;
            Ui.popError(content);
            Ui.outputError(content);
        }

        if (cmdInfo['callbackId'] && cmdInfo['callbackId'] !== '0') {
            //进入回调（如增加断点）
            for (let index = 0; index < this.orderList.length; index++) {
                const element = this.orderList[index];
                if (element['callbackId'] == cmdInfo['callbackId']) {
                    if (cmdInfo['info'] != undefined) {
                        const cb = element.callback as (args: ICallbackArgs, info: any) => void;
                        const cba = element.callbackArgs!;
                        cb(cba, cmdInfo['info']);
                    } else {
                        const cb = element.callback as (args: ICallbackArgs) => void;
                        const cba = element.callbackArgs!;
                        cb(cba);
                    }
                    this.orderList.splice(index, 1);
                    return;
                }
            }
            Ui.outputError('[Adapter Error] 没有在列表中找到回调');
        } else {
            switch (cmdInfo['cmd']) {
                case 'refreshLuaMemory':
                    this.runtime.refreshLuaMemoty(cmdInfo['info']['memInfo']);
                    break;
                case 'tip':
                    Ui.popMessage(cmdInfo['info']['logInfo']);
                    break;
                case 'tipError':
                    Ui.popError(cmdInfo['info']['logInfo']);
                    break;
                case 'stopOnCodeBreakpoint':
                case 'stopOnBreakpoint':
                case 'stopOnEntry':
                case 'stopOnStep':
                case 'stopOnStepIn':
                case 'stopOnStepOut':
                    let stackInfo = cmdInfo['stack'];
                    this.runtime.stop(stackInfo, cmdInfo['cmd']);
                    break;
                case 'output':
                    let outputLog = cmdInfo['info']['logInfo'];
                    if (outputLog != undefined) {
                        this.runtime.printLog(outputLog);
                    }
                    break;
                case 'debug_console':
                    let consoleLog = cmdInfo['info']['logInfo'];
                    if (consoleLog != undefined) {
                        this.runtime.logInDebugConsole(consoleLog);
                    }
                    break;
            }
        }
    }

    /**
     *	向 Debugger 发消息
     * @param cmd: 发给Debugger的命令 'contunue'/'stepover'/'stepin'/'stepout'/'restart'/'stop'
     * @param sendObject: 消息参数，会被放置在协议的info中
     * @param callbackFunc: 回调函数
     * @param callbackArgs: 回调参数
     */
    public send(
        cmd: string,
        sendObject: Object,
        callbackFunc?: (() => void) | ((args: ICallbackArgs) => void) | ((args: ICallbackArgs, info: any) => void),
        callbackArgs?: ICallbackArgs,
        timeOutSec = 0
    ) {
        //生成随机数
        let max = 999999999;
        let min = 10; //10以内是保留位
        let isSame = false;
        let ranNum = 0;
        let sendObj: { [key: string]: any } = {};

        //有回调时才计算随机数
        if (callbackFunc) {
            do {
                isSame = false;
                ranNum = Math.floor(Math.random() * (max - min + 1) + min);
                //检查随机数唯一性
                this.orderList.forEach(element => {
                    if (element['callbackId'] == ranNum) {
                        //若遍历后isSame依然是false，说明没有重合
                        isSame = true;
                    }
                });
            } while (isSame);

            const dic: { [key: string]: any } = {};
            dic['callbackId'] = ranNum;
            dic['callback'] = callbackFunc;
            if (timeOutSec > 0) {
                dic['timeOut'] = Date.now() + timeOutSec * 1000;
            }
            if (callbackArgs != undefined) {
                dic['callbackArgs'] = callbackArgs;
            }
            this.orderList.push(dic);
            sendObj['callbackId'] = ranNum.toString();
        }

        sendObj['cmd'] = cmd;
        sendObj['info'] = sendObject;
        const str = JSON.stringify(sendObj) + ' ' + this.separator + '\n';
        //记录随机数和回调的对应关系
        if (this.socket != undefined) {
            Ui.outputDebug('[Send Msg] ' + str);
            this.socket.write(str);
        } else {
            Ui.outputDebug('[Send Msg but socket deleted] ' + str);
        }
    }
}
