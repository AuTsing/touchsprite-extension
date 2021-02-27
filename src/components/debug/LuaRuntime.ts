import { DebugProtocol } from 'vscode-debugprotocol';
import { EventEmitter } from 'events';
import { PathManager } from './PathManager';
import { ICallbackArgs } from './LuaDebug';
import Ui from '../ui/Ui';
import { DataProcessor } from './DataProcessor';

interface ISendInfo {
    [key: string]: string | DebugProtocol.Breakpoint[];
}

interface IBreakStack {
    file: string;
    oPath: string;
    line: number;
}

export interface ILuaBreakpoint {
    id: number;
    line: number;
    verified: boolean;
}

export class LuaRuntime extends EventEmitter {
    //保存断点处堆栈信息
    public readonly tcpSplitChar: string = '|*|';
    private readonly pathManager: PathManager;
    public breakStacks: IBreakStack[] = [];
    private breakpointId: number = 1;
    public dataProcessor: DataProcessor;

    constructor(pathManager: PathManager) {
        super();
        this.pathManager = pathManager;
        this.dataProcessor = new DataProcessor(this);
    }

    /**
     * 发送初始化请求
     * @param callback: 收到请求返回后的回调函数
     * @param callbackArgs：回调参数
     * @param sendArgs：发给debugger的参数
     */
    public start(callback: (args?: ICallbackArgs, info?: any) => void, sendArgs: { [key: string]: any }) {
        const sendInfo: ISendInfo = {};
        for (const key in sendArgs) {
            sendInfo[key] = String(sendArgs[key]);
        }
        this.dataProcessor.send('initSuccess', sendInfo, callback);
    }

    /**
     * 通知Debugger继续执行
     * @param callback: 收到请求返回后的回调函数
     * @param callbackArgs：回调参数
     * @param event：事件名
     */
    public continue(callback: (args?: ICallbackArgs, info?: any) => void, callbackArgs?: ICallbackArgs, event = 'continue') {
        Ui.outputDebug('continue');
        const sendInfo: ISendInfo = {};
        this.dataProcessor.send(event, sendInfo, callback, callbackArgs);
    }

    /**
     * 通知Debugger继续执行
     * @param callback: 收到请求返回后的回调函数
     * @param callbackArgs：回调参数
     * @param event：事件名
     */
    public continueWithFakeHitBk(callback: (args?: ICallbackArgs, info?: any) => void, callbackArgs?: ICallbackArgs, event = 'continue') {
        Ui.outputDebug('continue');
        const sendInfo = {
            fakeBKPath: String(this.breakStacks[0].oPath),
            fakeBKLine: String(this.breakStacks[0].line),
            isFakeHit: String(true),
        };
        this.dataProcessor.send(event, sendInfo, callback, callbackArgs);
    }

    /**
     * 从 Debugger 获取监视变量的值
     * @param callback: 收到请求返回后的回调函数
     * @param callbackArgs：回调参数
     * @param varName：变量名
     * @param frameId：当前栈层（变量的值会随切换栈层而改变）
     * @param event：事件名
     */
    public getWatchedVariable(
        callback: (args?: ICallbackArgs, info?: any) => void,
        callbackArgs: ICallbackArgs,
        varName: string,
        frameId = 2,
        event = 'getWatchedVariable'
    ) {
        Ui.outputDebug('getWatchedVariable');
        const sendInfo: ISendInfo = {
            varName: String(varName),
            stackId: String(frameId),
        };
        this.dataProcessor.send(event, sendInfo, callback, callbackArgs);
    }

    /**
     * 通知 Debugger 执行代码段
     * @param callback: 收到请求返回后的回调函数
     * @param callbackArgs：回调参数
     * @param expression：被执行的代码段
     * @param frameId：当前栈层（变量的值会随切换栈层而改变）
     * @param event：事件名
     */
    public getReplExpression(
        callback: (args?: ICallbackArgs, info?: any) => void,
        callbackArgs: ICallbackArgs,
        expression: string,
        frameId = 2,
        event = 'runREPLExpression'
    ) {
        Ui.outputDebug('runREPLExpression');
        const sendInfo: ISendInfo = {
            Expression: String(expression),
            stackId: String(frameId),
        };
        this.dataProcessor.send(event, sendInfo, callback, callbackArgs);
    }

    /**
     * 设置 某一变量的值
     * @param callback: 收到请求返回后的回调函数
     * @param callbackArgs：回调参数
     * @param name: 变量名
     * @param newValue: 用户设置的新值
     * @param variableRef：变量id。首次获取时id填0，之后展开table时，id填table id
     * @param frameId：当前栈层（变量的值会随切换栈层而改变）
     * @param event：事件名
     */
    public setVariable(
        callback: (args?: ICallbackArgs, info?: any) => void,
        callbackArgs: ICallbackArgs,
        name: string,
        newValue: string,
        variableRef = 0,
        frameId = 2,
        event = 'setVariable'
    ) {
        Ui.outputDebug('setVariable');
        const sendInfo: ISendInfo = {
            varRef: String(variableRef),
            stackId: String(frameId),
            newValue: String(newValue),
            varName: String(name),
        };
        this.dataProcessor.send(event, sendInfo, callback, callbackArgs);
    }

    /**
     * 从 Debugger 获取变量信息
     * @param callback: 收到请求返回后的回调函数
     * @param callbackArgs：回调参数
     * @param variableRef：变量id。首次获取时id填0，之后展开table时，id填table id
     * @param expression：被执行的代码段
     * @param frameId：当前栈层（变量的值会随切换栈层而改变）
     * @param event：事件名
     */
    public getVariable(callback: (args?: ICallbackArgs, info?: any) => void, callbackArgs: ICallbackArgs, variableRef = 0, frameId = 2, event = 'getVariable') {
        Ui.outputDebug('getVariable');
        const sendInfo: ISendInfo = {
            varRef: String(variableRef),
            stackId: String(frameId),
        };
        this.dataProcessor.send(event, sendInfo, callback, callbackArgs, 3);
    }

    /**
     * 通知Debugger停止运行
     */
    public stopRun(callback: (args?: ICallbackArgs, info?: any) => void, callbackArgs: ICallbackArgs, event = 'stopRun') {
        Ui.outputDebug('stopRun');
        const sendInfo: ISendInfo = {};
        this.dataProcessor.send(event, sendInfo, callback, callbackArgs);
    }

    /**
     * 	通知Debugger单步运行
     */
    public step(callback: (args?: ICallbackArgs, info?: any) => void, callbackArgs: ICallbackArgs, event = 'stopOnStep') {
        Ui.outputDebug('step:' + event);
        const sendInfo: ISendInfo = {};
        this.dataProcessor.send(event, sendInfo, callback, callbackArgs);
    }

    /**
     * 	强制回收内存
     */
    public luaGarbageCollect(event = 'LuaGarbageCollect') {
        const sendInfo: ISendInfo = {};
        this.dataProcessor.send(event, sendInfo);
    }

    /**
     * 通知 Debugger 设置断点
     * @param path：文件路径
     * @param bks：断点信息
     * @param callback：回调信息，用来确认断点
     * @param callbackArgs：回调参数
     */
    public setBreakPoint(path: string, bks: DebugProtocol.Breakpoint[], callback?: (args?: ICallbackArgs, info?: any) => void, callbackArgs?: ICallbackArgs) {
        Ui.outputDebug('setBreakPoint ' + ' path:' + path);
        const sendInfo: ISendInfo = {
            path: path,
            bks: bks,
        };
        this.dataProcessor.send('setBreakPoint', sendInfo, callback, callbackArgs);
    }

    /**
     * 向 luadebug.ts 返回保存的堆栈信息
     */
    public stack(startFrame: number, endFrame: number) {
        return {
            frames: this.breakStacks,
            count: this.breakStacks.length, //栈深度
        };
    }

    /**
     * 	在Debugger日志中输出
     */
    public printLog(logStr: string) {
        Ui.outputDebug('[Debugger Log] ' + logStr);
    }

    /**
     * 	刷新显示lua虚拟机内存信息
     */
    public refreshLuaMemoty(luaMemory: string) {
        // StatusBarManager.refreshLuaMemNum(parseInt(luaMemory));
    }

    /**
     * 	在调试控制台中打印日志
     */
    public logInDebugConsole(message: string) {
        this.sendEvent('logInDebugConsole', message);
    }

    private sendEvent(event: string, ...args: any[]) {
        setImmediate(_ => {
            this.emit(event, ...args);
        });
    }

    /**
     * 	命中断点
     */
    public stop(stack: any, reason: string) {
        stack.forEach((element: any) => {
            let linenum: string = element.line;
            element.line = parseInt(linenum); //转为VSCode行号(int)
            let getinfoPath: string = element.file;
            let oPath = element.oPath;
            element.file = this.pathManager.checkFullPath(getinfoPath, oPath);
        });
        //先保存堆栈信息，再发暂停请求
        this.breakStacks = stack;
        this.sendEvent(reason);
    }

    public getBreakPointId() {
        return this.breakpointId++;
    }
}
