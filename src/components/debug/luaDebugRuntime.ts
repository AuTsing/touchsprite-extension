import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { DataProcessor } from './dataProcessor';
import { DebugProtocol } from 'vscode-debugprotocol';
import Ui from '../ui/Ui';
import { PathManager } from './PathManager';

export interface LuaBreakpoint {
    id: number;
    line: number;
    verified: boolean;
}

export class LuaDebugRuntime extends EventEmitter {
    //当前读取的文件
    private _sourceFile!: string;
    public _dataProcessor!: DataProcessor;
    public _pathManager!: PathManager;
    public get sourceFile() {
        return this._sourceFile;
    }
    //TCP分隔符
    private _TCPSplitChar!: string;
    public get TCPSplitChar() {
        return this._TCPSplitChar;
    }
    public set TCPSplitChar(char) {
        this._TCPSplitChar = char;
    }

    // 生成断点id，id是累加的
    private _breakpointId = 1;
    public getBreakPointId() {
        return this._breakpointId++;
    }

    //保存断点处堆栈信息
    public breakStack = new Array();

    constructor() {
        super();
    }

    /**
     * 发送初始化请求
     * @param callback: 收到请求返回后的回调函数
     * @param callbackArgs：回调参数
     * @param sendArgs：发给debugger的参数
     */
    public start(callback: any, sendArgs: any) {
        const arrSend: { [key: string]: string } = {};
        for (let key in sendArgs) {
            arrSend[key] = String(sendArgs[key]);
        }
        this._dataProcessor.commandToDebugger('initSuccess', arrSend, callback);
    }

    /**
     * 通知Debugger继续执行
     * @param callback: 收到请求返回后的回调函数
     * @param callbackArgs：回调参数
     * @param event：事件名
     */
    public continue(callback: any, callbackArgs: any, event = 'continue') {
        Ui.logging('continue');
        const arrSend: { [key: string]: string } = {};
        this._dataProcessor.commandToDebugger(event, arrSend, callback, callbackArgs);
    }

    /**
     * 通知Debugger继续执行
     * @param callback: 收到请求返回后的回调函数
     * @param callbackArgs：回调参数
     * @param event：事件名
     */
    public continueWithFakeHitBk(callback: any, callbackArgs = undefined, event = 'continue') {
        Ui.logging('continue');
        const arrSend: { [key: string]: string } = {};
        arrSend['fakeBKPath'] = String(this.breakStack[0].oPath);
        arrSend['fakeBKLine'] = String(this.breakStack[0].line);
        arrSend['isFakeHit'] = String(true);
        this._dataProcessor.commandToDebugger(event, arrSend, callback, callbackArgs);
    }

    /**
     * 从 Debugger 获取监视变量的值
     * @param callback: 收到请求返回后的回调函数
     * @param callbackArgs：回调参数
     * @param varName：变量名
     * @param frameId：当前栈层（变量的值会随切换栈层而改变）
     * @param event：事件名
     */
    public getWatchedVariable(callback: any, callbackArgs: any, varName: any, frameId = 2, event = 'getWatchedVariable') {
        Ui.logging('getWatchedVariable');
        const arrSend: { [key: string]: string } = {};
        arrSend['varName'] = String(varName);
        arrSend['stackId'] = String(frameId);
        this._dataProcessor.commandToDebugger(event, arrSend, callback, callbackArgs);
    }

    /**
     * 通知 Debugger 执行代码段
     * @param callback: 收到请求返回后的回调函数
     * @param callbackArgs：回调参数
     * @param expression：被执行的代码段
     * @param frameId：当前栈层（变量的值会随切换栈层而改变）
     * @param event：事件名
     */
    public getREPLExpression(callback: any, callbackArgs: any, expression: any, frameId = 2, event = 'runREPLExpression') {
        Ui.logging('runREPLExpression');
        const arrSend: { [key: string]: string } = {};
        arrSend['Expression'] = String(expression);
        arrSend['stackId'] = String(frameId);
        this._dataProcessor.commandToDebugger(event, arrSend, callback, callbackArgs);
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
    public setVariable(callback: any, callbackArgs: any, name: any, newValue: any, variableRef = 0, frameId = 2, event = 'setVariable') {
        Ui.logging('setVariable');
        const arrSend: { [key: string]: string } = {};
        arrSend['varRef'] = String(variableRef);
        arrSend['stackId'] = String(frameId);
        arrSend['newValue'] = String(newValue);
        arrSend['varName'] = String(name);
        this._dataProcessor.commandToDebugger(event, arrSend, callback, callbackArgs);
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
    public getVariable(callback: any, callbackArgs: any, variableRef = 0, frameId = 2, event = 'getVariable') {
        Ui.logging('getVariable');
        const arrSend: { [key: string]: string } = {};
        arrSend['varRef'] = String(variableRef);
        arrSend['stackId'] = String(frameId);
        this._dataProcessor.commandToDebugger(event, arrSend, callback, callbackArgs, 3);
    }

    /**
     * 通知Debugger停止运行
     */
    public stopRun(callback: any, callbackArgs: any, event = 'stopRun') {
        const arrSend: { [key: string]: string } = {};
        this._dataProcessor.commandToDebugger(event, arrSend, callback, callbackArgs);
    }

    /**
     * 	通知Debugger单步运行
     */
    public step(callback: any, callbackArgs: any, event = 'stopOnStep') {
        Ui.logging('step:' + event);
        const arrSend: { [key: string]: string } = {};
        this._dataProcessor.commandToDebugger(event, arrSend, callback, callbackArgs);
    }

    /**
     * 	强制回收内存
     */
    public luaGarbageCollect(event = 'LuaGarbageCollect') {
        const arrSend: { [key: string]: string } = {};
        this._dataProcessor.commandToDebugger(event, arrSend);
    }

    /**
     * 通知 Debugger 设置断点
     * @param path：文件路径
     * @param bks：断点信息
     * @param callback：回调信息，用来确认断点
     * @param callbackArgs：回调参数
     */
    public setBreakPoint(path: string, bks: Array<DebugProtocol.Breakpoint>, callback: any, callbackArgs: any) {
        Ui.logging('setBreakPoint ' + ' path:' + path);
        const arrSend: { [key: string]: string | DebugProtocol.Breakpoint[] } = {};
        arrSend['path'] = path;
        arrSend['bks'] = bks;
        this._dataProcessor.commandToDebugger('setBreakPoint', arrSend, callback, callbackArgs);
    }

    /**
     * 向 luadebug.ts 返回保存的堆栈信息
     */
    public stack(startFrame: number, endFrame: number): any {
        return {
            frames: this.breakStack,
            count: this.breakStack.length, //栈深度
        };
    }

    /**
     * 	在Debugger日志中输出
     */
    public printLog(logStr: string) {
        Ui.logging('[Debugger Log]:' + logStr);
    }

    /**
     * 	刷新显示lua虚拟机内存信息
     */
    public refreshLuaMemoty(luaMemory: string) {
        // StatusBarManager.refreshLuaMemNum(parseInt(luaMemory));
    }

    /**
     * 	显示tip info
     */
    public showTip(tip: string) {
        vscode.window.showInformationMessage(tip);
    }

    /**
     * 	显示tip error
     */
    public showError(tip: string) {
        vscode.window.showErrorMessage(tip);
    }

    /**
     * 	在调试控制台中打印日志
     */
    public logInDebugConsole(message: string) {
        this.sendEvent('logInDebugConsole', message);
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
            element.file = this._pathManager.checkFullPath(getinfoPath, oPath);
        });
        //先保存堆栈信息，再发暂停请求
        this.breakStack = stack;
        this.sendEvent(reason);
    }

    private sendEvent(event: string, ...args: any[]) {
        setImmediate(_ => {
            this.emit(event, ...args);
        });
    }
}
