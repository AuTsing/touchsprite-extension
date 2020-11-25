/* eslint-disable eqeqeq */
import { LuaDebugRuntime } from './LuaDebugRuntime';
import { ICallbackArgs } from './LuaDebug';
import { Socket } from 'net';
import Ui from '../ui/Ui';

interface IOrder {
    callbackId?: number;
    callback?: (() => void) | ((args: ICallbackArgs) => void) | ((args: ICallbackArgs, info: any) => void);
    callbackArgs?: ICallbackArgs;
    timeOut?: number;
}

//网络收发消息，记录回调
export class DataProcessor {
    public runtime!: LuaDebugRuntime; //RunTime句柄
    public socket: Socket | undefined;
    public isNeedB64EncodeStr: boolean = true;
    private _orderList: IOrder[] = []; //记录随机数和它对应的回调
    private _recvMsgQueue: string[] = []; //记录粘包的多条指令
    private _cutoffString: string = '';
    private _getDataJsonCatch: string = ''; //解析缓存，防止用户信息中含有分隔符

    /**
     * 接收从Debugger发来的消息
     * @param orgData: 消息串
     */
    public processMsg(orgData: string) {
        let data = orgData.trim();
        if (this._cutoffString.length > 0) {
            data = this._cutoffString + data;
            this._cutoffString = '';
        }

        let pos = data.indexOf(this.runtime.tcpSplitChar);
        if (pos < 0) {
            //没有分隔符，做截断判断
            this.processCutoffMsg(data);
        } else {
            do {
                let data_save = data.substring(0, pos); //保存的命令
                data = data.substring(pos + this.runtime.tcpSplitChar.length, data.length);
                this._recvMsgQueue.push(data_save);
                pos = data.indexOf(this.runtime.tcpSplitChar);
                if (pos < 0) {
                    //没有分隔符时，剩下的字符串不为空
                    this.processCutoffMsg(data);
                }
            } while (pos > 0);

            while (this._recvMsgQueue.length > 0) {
                let dt1 = this._recvMsgQueue.shift(); //从头部取元素，保证是一个队列形式
                this.getData(String(dt1));
            }
        }

        //最后处理一下超时回调
        for (let index = 0; index < this._orderList.length; index++) {
            const element = this._orderList[index];
            if (element['timeOut'] && Date.now() > element['timeOut']) {
                // dataProcessor._runtime.showError(element["callbackId"] + " 请求超时! 详细请求信息可在 LuaPanda Adapter 中搜索此id查看");
                const cb = element.callback as (args: ICallbackArgs) => void;
                const cba = element.callbackArgs!;
                cb(cba);
                this._orderList.splice(index, 1);
            }
        }
    }

    /**
     * 切割消息
     * @param orgData: 消息串
     */
    private processCutoffMsg(orgData: string) {
        let data = orgData.trim();
        if (data.length > 0) {
            this._cutoffString = this._cutoffString + data; //被截断的部分
        }
    }

    /**
     * 处理单条消息。主要包括解析json，分析命令，做相应处理
     * @param data 消息json
     */
    private getData(data: string) {
        let cmdInfo;
        try {
            if (this._getDataJsonCatch != '') {
                data = this._getDataJsonCatch + data;
            }
            cmdInfo = JSON.parse(data);
            if (this.isNeedB64EncodeStr && cmdInfo.info !== undefined) {
                for (let i = 0, len = cmdInfo.info.length; i < len; i++) {
                    if (cmdInfo.info[i].type === 'string') {
                        cmdInfo.info[i].value = Buffer.from(cmdInfo.info[i].value, 'base64').toString();
                    }
                }
            }
            this._getDataJsonCatch = '';
        } catch (e) {
            if (this.isNeedB64EncodeStr) {
                this.runtime.showError(' JSON  解析失败! ' + data);
                Ui.logging('[Adapter Error]: JSON  解析失败! ' + data);
            } else {
                this._getDataJsonCatch = data + '|*|';
            }
            return;
        }

        if (this.runtime != undefined) {
            if (cmdInfo == undefined) {
                this.runtime.showError('JSON 解析失败! no cmdInfo:' + data);
                Ui.logging('[Adapter Error]:JSON解析失败  no cmdInfo:' + data);
                return;
            }
            if (cmdInfo['cmd'] == undefined) {
                this.runtime.showError('JSON 解析失败! no cmd:' + data);
                Ui.logging('[Adapter Warning]:JSON 解析失败 no cmd:' + data);
            }

            if (cmdInfo['callbackId'] != undefined && cmdInfo['callbackId'] != '0') {
                //进入回调（如增加断点）
                for (let index = 0; index < this._orderList.length; index++) {
                    const element = this._orderList[index];
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
                        this._orderList.splice(index, 1);
                        return;
                    }
                }
                Ui.logging('[Adapter Error]: 没有在列表中找到回调');
            } else {
                switch (cmdInfo['cmd']) {
                    case 'refreshLuaMemory':
                        this.runtime.refreshLuaMemoty(cmdInfo['info']['memInfo']);
                        break;
                    case 'tip':
                        this.runtime.showTip(cmdInfo['info']['logInfo']);
                        break;
                    case 'tipError':
                        this.runtime.showError(cmdInfo['info']['logInfo']);
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
    }

    /**
     *	向 Debugger 发消息
     * @param cmd: 发给Debugger的命令 'contunue'/'stepover'/'stepin'/'stepout'/'restart'/'stop'
     * @param sendObject: 消息参数，会被放置在协议的info中
     * @param callbackFunc: 回调函数
     * @param callbackArgs: 回调参数
     */
    public commandToDebugger(
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
                this._orderList.forEach(element => {
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
            this._orderList.push(dic);
            sendObj['callbackId'] = ranNum.toString();
        }

        sendObj['cmd'] = cmd;
        sendObj['info'] = sendObject;
        const str = JSON.stringify(sendObj) + ' ' + this.runtime.tcpSplitChar + '\n';
        //记录随机数和回调的对应关系
        if (this.socket != undefined) {
            Ui.logging('[Send Msg]:' + str);
            this.socket.write(str);
        } else {
            Ui.logging('[Send Msg but socket deleted]:' + str);
        }
    }
}
