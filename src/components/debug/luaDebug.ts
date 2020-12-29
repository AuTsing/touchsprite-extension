// Tencent is pleased to support the open source community by making LuaPanda available.
// Copyright (C) 2019 THL A29 Limited, a Tencent company. All rights reserved.
// Licensed under the BSD 3-Clause License (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at
// https://opensource.org/licenses/BSD-3-Clause
// Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

/* eslint-disable eqeqeq */
import * as vscode from 'vscode';
import {
    LoggingDebugSession,
    InitializedEvent,
    TerminatedEvent,
    StoppedEvent,
    BreakpointEvent,
    OutputEvent,
    Thread,
    StackFrame,
    Scope,
    Source,
    Handles,
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { basename } from 'path';
import { LuaDebugRuntime } from './LuaDebugRuntime';
import * as Net from 'net';
import { DataProcessor } from './DataProcessor';
import { LineBreakpoint, ConditionBreakpoint, LogPoint } from './Breakpoint';
import Tools from './Tools';
import { ThreadManager } from './ThreadManager';
import { PathManager } from './PathManager';
import { Subject } from 'await-notify';
import Ui from '../ui/Ui';
import * as os from 'os';
import ProjectGenerator from '../ProjectGenerator';

interface IBreakpointRecord {
    bkPath: string;
    bksArray: DebugProtocol.Breakpoint[];
}

export interface ICallbackArgs {
    instance?: LuaDebugSession;
    response?: DebugProtocol.Response;
    restart?: boolean;
}

export interface ISendArguments {
    [key: string]: any;
}

export class LuaDebugSession extends LoggingDebugSession {
    public tcpPort!: number; //和客户端连接的端口号，通过VScode的设置赋值
    private _server?: Net.Server; // adapter 作为server
    private _breakpointsArray: IBreakpointRecord[] = []; //在socket连接前临时保存断点的数组
    private _autoReconnect: boolean = false;
    private _configurationDone = new Subject();
    private _variableHandles = new Handles<string>(50000); //Handle编号从50000开始
    private _replacePath?: string[]; //替换路径数组
    //luaDebugRuntime实例
    private _runtime: LuaDebugRuntime;
    private _dataProcessor: DataProcessor;
    private _threadManager: ThreadManager;
    private _pathManager: PathManager;
    private _useLoadstring: boolean = false;
    private _dbCheckBreakpoint = true;
    //保存所有活动的LuaDebugSession实例
    private static _debugSessionArray: Map<number, LuaDebugSession> = new Map<number, LuaDebugSession>();
    private connectionFlag = false; //连接成功的标志位

    public constructor() {
        super('lua-debug.txt');
        this.setDebuggerLinesStartAt1(true);
        this.setDebuggerColumnsStartAt1(true);
        this._threadManager = new ThreadManager(); // 线程实例 调用this._threadManager.CUR_THREAD_ID可以获得当前线程号
        this._pathManager = new PathManager(this, this.printLogInDebugConsole);
        this._runtime = new LuaDebugRuntime(); // _runtime and _dataProcessor 相互持有实例
        this._dataProcessor = new DataProcessor();
        this._dataProcessor.runtime = this._runtime;
        this._runtime.dataProcessor = this._dataProcessor;
        this._runtime.pathManager = this._pathManager;

        LuaDebugSession._debugSessionArray.set(this._threadManager.CUR_THREAD_ID, this);
        this._runtime.on('stopOnEntry', () => {
            this.sendEvent(new StoppedEvent('entry', this._threadManager.CUR_THREAD_ID));
        });
        this._runtime.on('stopOnStep', () => {
            this.sendEvent(new StoppedEvent('step', this._threadManager.CUR_THREAD_ID));
        });
        this._runtime.on('stopOnStepIn', () => {
            this.sendEvent(new StoppedEvent('step', this._threadManager.CUR_THREAD_ID));
        });
        this._runtime.on('stopOnStepOut', () => {
            this.sendEvent(new StoppedEvent('step', this._threadManager.CUR_THREAD_ID));
        });
        this._runtime.on('stopOnCodeBreakpoint', () => {
            // stopOnCodeBreakpoint 指的是遇到 LuaPanda.BP()，因为是代码中的硬断点，VScode中不会保存这个断点信息，故不做校验
            this.sendEvent(new StoppedEvent('breakpoint', this._threadManager.CUR_THREAD_ID));
        });
        this._runtime.on('stopOnBreakpoint', () => {
            // 因为lua端所做的断点命中可能出现同名文件错误匹配，这里要再次校验lua端命中的行列号是否在 breakpointsArray 中
            if (this.checkIsRealHitBreakpoint()) {
                this.sendEvent(new StoppedEvent('breakpoint', this._threadManager.CUR_THREAD_ID));
            } else {
                // go on running
                this._runtime.continueWithFakeHitBk(() => {
                    Ui.logDebug('命中同名文件中的断点, 确认继续运行');
                });
            }
        });
        this._runtime.on('stopOnException', () => {
            this.sendEvent(new StoppedEvent('exception', this._threadManager.CUR_THREAD_ID));
        });
        this._runtime.on('stopOnPause', () => {
            this.sendEvent(new StoppedEvent('exception', this._threadManager.CUR_THREAD_ID));
        });
        this._runtime.on('breakpointValidated', (bp: DebugProtocol.Breakpoint) => {
            this.sendEvent(new BreakpointEvent('changed', <DebugProtocol.Breakpoint>{ verified: bp.verified, id: bp.id }));
        });
        this._runtime.on('logInDebugConsole', message => {
            this.printLogInDebugConsole(message);
        });
    }

    // 在有同名文件的情况下，需要再次进行命中判断。
    private checkIsRealHitBreakpoint() {
        if (!this._dbCheckBreakpoint) {
            // 用户关闭了二次断点校验，直接返回成功
            return true;
        }

        let steak = this._runtime.breakStackArr;
        let steakPath = steak[0].file;
        let steakLine = steak[0].line;
        if (this._breakpointsArray) {
            for (let bkMap of this._breakpointsArray) {
                if (bkMap.bkPath === steakPath) {
                    for (const node of bkMap.bksArray) {
                        if (node.line == steakLine) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    // 在调试控制台打印日志. 从非luaDebug.ts文件调用这个函数时，要传instance实例
    public printLogInDebugConsole(content: string, instance = this) {
        const contentWithTimestamp = `[${new Date().toLocaleString('chinese', { hour12: false })}] ` + content;
        instance.sendEvent(new OutputEvent(contentWithTimestamp + '\n', 'console'));
    }

    /**
     * VScode前端的首个请求，询问debug adapter所能提供的特性
     * 这个方法是VSCode调过来的，adapter拿到其中的参数进行填充. 再回给VSCode,VSCode根据这些设置做不同的显示
     */
    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
        Ui.logDebug('initializeRequest!');
        //设置Debug能力
        response.body = response.body || {};
        response.body.supportsConfigurationDoneRequest = true;
        //后面可以支持Hovers显示值
        response.body.supportsEvaluateForHovers = true; //悬停请求变量的值
        response.body.supportsStepBack = false; //back按钮
        response.body.supportsSetVariable = true; //修改变量的值
        response.body.supportsFunctionBreakpoints = false;
        response.body.supportsConditionalBreakpoints = true;
        response.body.supportsHitConditionalBreakpoints = true;
        response.body.supportsLogPoints = true;
        // response.body.supportsRestartRequest = false;
        // response.body.supportsRestartFrame = false;
        this.sendResponse(response);
    }

    /**
     * configurationDone后通知launchRequest
     */
    protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
        super.configurationDoneRequest(response, args);
        this._configurationDone.notify();
    }

    /**
     * Attach 模式初始化代码
     */
    protected async attachRequest(response: DebugProtocol.AttachResponse, args: DebugProtocol.AttachRequestArguments) {
        await this._configurationDone.wait(1000);
        this.initProcess(response, args);
        this.sendResponse(response);
    }

    /**
     * Launch 模式初始化代码
     */
    protected async launchRequest(response: DebugProtocol.LaunchResponse, args: DebugProtocol.LaunchRequestArguments) {
        await this._configurationDone.wait(1000);
        this.initProcess(response, args);
        this.sendResponse(response);
    }

    private initProcess(response: any, args: any) {
        const pjg = new ProjectGenerator('maintest.lua');
        pjg.generate();

        if (!pjg.focusing) {
            Ui.logError('未指定工程，请聚焦在工程文件再运行');
            return;
        }

        if (!pjg.projectRoot) {
            Ui.logError(`所选工程不包含引导文件 maintest.lua`);
            return;
        }

        //1. 配置初始化信息
        this.tcpPort = args.connectionPort;
        this._pathManager.CWD = pjg.projectRoot;
        this._pathManager.rootFolder = pjg.projectRoot;
        this._pathManager.useAutoPathMode = !!args.autoPathMode;
        this._pathManager.pathCaseSensitivity = !!args.pathCaseSensitivity;
        this._dbCheckBreakpoint = !!args.dbCheckBreakpoint;

        if (this._pathManager.useAutoPathMode === true) {
            Tools.rebuildAcceptExtMap(args.luaFileExtension);
            this._pathManager.rebuildWorkspaceNamePathMap(pjg.projectRoot);
            this._pathManager.checkSameNameFile(!!args.distinguishSameNameFile);
        }

        if (args.logLevel <= 0) {
            Ui.enableDebugChannel();
        }

        const sendArgs = {
            stopOnEntry: !!args.stopOnEntry,
            luaFileExtension: args.luaFileExtension,
            cwd: pjg.projectRoot,
            isNeedB64EncodeStr: !!args.isNeedB64EncodeStr,
            TempFilePath: args.TempFilePath,
            logLevel: args.logLevel,
            pathCaseSensitivity: args.pathCaseSensitivity,
            OSType: os.type(),
            clibPath: Tools.getClibPathInExtension(),
            useCHook: args.useCHook,
            adapterVersion: String(Tools.adapterVersion),
            autoPathMode: this._pathManager.useAutoPathMode,
            distinguishSameNameFile: !!args.distinguishSameNameFile,
            truncatedOPath: String(args.truncatedOPath),
            DevelopmentMode: String(args.DevelopmentMode),
        };
        Tools.developmentMode = args.DevelopmentMode;

        if (args.docPathReplace instanceof Array && args.docPathReplace.length === 2) {
            this._replacePath = [Tools.genUnifiedPath(String(args.docPathReplace[0])), Tools.genUnifiedPath(String(args.docPathReplace[1]))];
        } else {
            this._replacePath = undefined;
        }

        this._autoReconnect = args.autoReconnect;

        //2. 初始化内存分析状态栏

        this.printLogInDebugConsole('[Listening] 调试器 VSCode Server 已启动，正在等待连接。  TargetName:' + args.name + ' Port:' + args.connectionPort);
        this.startServer(sendArgs);

        this._breakpointsArray = [];
        this.sendEvent(new InitializedEvent()); //收到返回后，执行setbreakpoint
    }

    private startServer(sendArgs: any) {
        this.connectionFlag = false;
        //3. 启动Adapter的socket   |   VSCode = Server ; Debugger = Client
        this._server = Net.createServer(socket => {
            //--connect--
            this._dataProcessor.socket = socket;
            //向debugger发送含配置项的初始化协议
            this._runtime.start((_: any, info: any) => {
                //之所以使用 connectionFlag 连接成功标志位， 是因为代码进入 Net.createServer 的回调后，仍然可能被client超时断开连接。所以标志位被放入了
                //_runtime.start 初始化消息发送成功之后。
                this.connectionFlag = true;
                this._server?.close(); //_server 已建立连接，不再接受新的连接
                const connectMessage = '[Connected] VSCode Server 已建立连接! Remote device info  ' + socket.remoteAddress + ':' + socket.remotePort;
                this.printLogInDebugConsole(connectMessage);
                this.printLogInDebugConsole('[Tips] 当停止在断点处时，可在调试控制台输入要观察变量或执行表达式');

                if (info.UseLoadstring === '1') {
                    this._useLoadstring = true;
                } else {
                    this._useLoadstring = false;
                }
                if (info.isNeedB64EncodeStr === 'true') {
                    this._dataProcessor.isNeedB64EncodeStr = true;
                } else {
                    this._dataProcessor.isNeedB64EncodeStr = false;
                }
                if (info.UseHookLib === '1') {
                }
                //已建立连接，并完成初始化
                //发送断点信息
                for (let bkMap of this._breakpointsArray) {
                    this._runtime.setBreakPoint(bkMap.bkPath, bkMap.bksArray, undefined, undefined);
                }
            }, sendArgs);
            //--connect end--
            socket.on('end', () => {
                Ui.logDebug('Socket end');
            });
            socket.on('close', () => {
                if (this.connectionFlag) {
                    this.connectionFlag = false;
                    Ui.logDebug('Socket close');
                    vscode.window.showInformationMessage('[LuaPanda] 调试器已断开连接');
                    // this._dataProcessor._socket 是在建立连接后赋值，所以在断开连接时删除
                    delete this._dataProcessor.socket;
                    this.sendEvent(new TerminatedEvent(this._autoReconnect));
                }
            });
            socket.on('data', data => {
                Ui.logDebug('[Get Msg] ' + data);
                this._dataProcessor.processMsg(data.toString());
            });
        }).listen(this.tcpPort, 0, () => {
            Ui.logDebug('Listening...');
        });
    }

    /**
     * VSCode -> Adapter 设置(删除)断点
     */
    protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
        Ui.logDebug('setBreakPointsRequest');
        let path = <string>args.source.path;
        path = Tools.genUnifiedPath(path);

        if (this._replacePath && this._replacePath.length === 2) {
            path = path.replace(this._replacePath[1], this._replacePath[0]);
        }

        const vscodeBreakpoints: DebugProtocol.Breakpoint[] = []; //VScode UI识别的断点（起始行号1）

        args.breakpoints!.map(bp => {
            const id = this._runtime.getBreakPointId();
            let breakpoint: DebugProtocol.Breakpoint; // 取出args中的断点并判断类型。
            if (bp.condition) {
                breakpoint = new ConditionBreakpoint(true, bp.line, bp.condition, id);
            } else if (bp.logMessage) {
                breakpoint = new LogPoint(true, bp.line, bp.logMessage, id);
            } else {
                breakpoint = new LineBreakpoint(true, bp.line, id);
            }
            vscodeBreakpoints.push(breakpoint);
        });

        response.body = {
            breakpoints: vscodeBreakpoints,
        };

        // 更新记录数据中的断点
        if (this._breakpointsArray === undefined) {
            this._breakpointsArray = [];
        }

        let isbkPathExist = false; //断点路径已经存在于断点列表中
        for (let bkMap of this._breakpointsArray) {
            if (bkMap.bkPath === path) {
                bkMap['bksArray'] = vscodeBreakpoints;
                isbkPathExist = true;
            }
        }

        if (!isbkPathExist) {
            const bk = {
                bkPath: path,
                bksArray: vscodeBreakpoints,
            };
            this._breakpointsArray.push(bk);
        }

        if (this._dataProcessor.socket) {
            //已建立连接
            const callbackArgs: ICallbackArgs = {
                instance: this,
                response: response,
            };
            this._runtime.setBreakPoint(
                path,
                vscodeBreakpoints,
                (arr: ICallbackArgs) => {
                    Ui.logDebug('确认断点');
                    const instance = arr.instance!;
                    const response = arr.response!;
                    instance.sendResponse(response); //在收到debugger的返回后，通知VSCode, VSCode界面的断点会变成已验证
                },
                callbackArgs
            );
        } else {
            //未连接，直接返回
            this.sendResponse(response);
        }
    }

    /**
     * 断点的堆栈追踪
     */
    protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
        const startFrame = typeof args.startFrame === 'number' ? args.startFrame : 0;
        const maxLevels = typeof args.levels === 'number' ? args.levels : 1000;
        const endFrame = startFrame + maxLevels;
        const stk = this._runtime.stack(startFrame, endFrame);
        const stkf = stk.frames.map((f: any) => {
            let source = f.file;
            if (this._replacePath && this._replacePath.length === 2) {
                source = source.replace(this._replacePath[0], this._replacePath[1]);
            }
            return new StackFrame(f.index, f.name, this.createSource(source), f.line);
        });
        response.body = {
            stackFrames: stkf,
            totalFrames: stk.count,
        };
        this.sendResponse(response);
    }

    /**
     * 监控的变量
     */
    protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
        const callbackArgs: ICallbackArgs = {
            instance: this,
            response: response,
        };
        //watch -- 监视窗口
        if (args.context === 'watch' || args.context === 'hover') {
            //把B["A"] ['A'] => B.A形式
            if (this._useLoadstring == false) {
                let watchString = args.expression;
                watchString = watchString.replace(/\[/g, '.');
                watchString = watchString.replace(/\"/g, '');
                watchString = watchString.replace(/\'/g, '');
                watchString = watchString.replace(/]/g, '');
                args.expression = watchString;
            }

            this._runtime.getWatchedVariable(
                (arr: ICallbackArgs, info: any) => {
                    const instance = arr.instance!;
                    const response = arr.response!;
                    if (info.length === 0) {
                        //没有查到
                        response.body = {
                            result: '未能查到变量的值',
                            type: 'string',
                            variablesReference: 0,
                        };
                    } else {
                        response.body = {
                            result: info[0].value,
                            type: info[0].type,
                            variablesReference: parseInt(info[0].variablesReference),
                        };
                    }
                    instance.sendResponse(response);
                },
                callbackArgs,
                args.expression,
                args.frameId
            );
        } else if (args.context === 'repl') {
            //repl -- 调试控制台
            this._runtime.getReplExpression(
                (arr: ICallbackArgs, info: any) => {
                    const instance = arr.instance!;
                    const response = arr.response!;
                    if (info.length === 0) {
                        //没有查到
                        response.body = {
                            result: 'nil',
                            variablesReference: 0,
                        };
                    } else {
                        response.body = {
                            result: info[0].value,
                            type: info[0].type,
                            variablesReference: parseInt(info[0].variablesReference),
                        };
                    }
                    instance.sendResponse(response);
                },
                callbackArgs,
                args.expression,
                args.frameId
            );
        } else {
            this.sendResponse(response);
        }
    }

    /**
     * 在变量大栏目中列举出的种类
     */
    protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
        const frameReference = args.frameId;
        const scopes = new Array<Scope>();
        //local 10000,  global 20000, upvalue 30000
        scopes.push(new Scope('Local', this._variableHandles.create('10000_' + frameReference), false));
        scopes.push(new Scope('Global', this._variableHandles.create('20000_' + frameReference), true));
        scopes.push(new Scope('UpValue', this._variableHandles.create('30000_' + frameReference), false));
        response.body = {
            scopes: scopes,
        };
        this.sendResponse(response);
    }

    /**
     * 设置变量的值
     */
    protected setVariableRequest(response: DebugProtocol.SetVariableResponse, args: DebugProtocol.SetVariableArguments): void {
        const callbackArgs: ICallbackArgs = {
            instance: this,
            response: response,
        };
        let referenceString = this._variableHandles.get(args.variablesReference);
        let referenceArray: string[] = [];
        if (referenceString != null) {
            referenceArray = referenceString.split('_');
            if (referenceArray.length < 2) {
                Ui.logError('[variablesRequest Error] #referenceArray < 2 , #referenceArray = ' + referenceArray.length);
                this.sendResponse(response);
                return;
            }
        } else {
            //_variableHandles 取不到的情况下 referenceString 即为真正的变量 ref
            referenceArray[0] = String(args.variablesReference);
        }

        this._runtime.setVariable(
            (arr: ICallbackArgs, info: any) => {
                const instance = arr.instance!;
                const response = arr.response!;
                if (info.success === 'true') {
                    response.body = {
                        value: String(info.value),
                        type: String(info.type),
                        variablesReference: parseInt(info.variablesReference),
                    };
                    Ui.logDebug(info.tip);
                } else {
                    Ui.logError('变量赋值失败 [' + info.tip + ']');
                }
                instance.sendResponse(response);
            },
            callbackArgs,
            args.name,
            args.value,
            parseInt(referenceArray[0]),
            parseInt(referenceArray[1])
        );
    }

    /**
     * 变量信息   断点的信息应该完全用一条协议单独发，因为点开Object，切换堆栈都需要单独请求断点信息
     */
    protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void {
        const callbackArgs: ICallbackArgs = {
            instance: this,
            response: response,
        };
        let referenceString = this._variableHandles.get(args.variablesReference);
        let referenceArray: string[] = [];
        if (referenceString != null) {
            referenceArray = referenceString.split('_');
            if (referenceArray.length < 2) {
                Ui.logError('[variablesRequest Error] #referenceArray < 2 , #referenceArray = ' + referenceArray.length);
                this.sendResponse(response);
                return;
            }
        } else {
            //_variableHandles 取不到的情况下 referenceString 即为真正的变量ref
            referenceArray[0] = String(args.variablesReference);
        }
        this._runtime.getVariable(
            (arr: ICallbackArgs, info: any) => {
                const instance = arr.instance!;
                const response = arr.response!;
                info = info === undefined ? [] : info;
                const variables: DebugProtocol.Variable[] = [];
                info.forEach((element: any) => {
                    variables.push({
                        name: element.name,
                        type: element.type,
                        value: element.value,
                        variablesReference: parseInt(element.variablesReference),
                    });
                });
                response.body = {
                    variables: variables,
                };
                instance.sendResponse(response);
            },
            callbackArgs,
            parseInt(referenceArray[0]),
            parseInt(referenceArray[1])
        );
    }

    /**
     * continue 执行
     */
    protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
        const callbackArgs: ICallbackArgs = {
            instance: this,
            response: response,
        };
        this._runtime.continue((arr: ICallbackArgs) => {
            Ui.logDebug('确认继续运行');
            const instance = arr.instance!;
            const response = arr.response!;
            instance.sendResponse(response);
        }, callbackArgs);
    }

    /**
     * step 单步执行
     */
    protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
        const callbackArgs: ICallbackArgs = {
            instance: this,
            response: response,
        };
        this._runtime.step((arr: ICallbackArgs) => {
            Ui.logDebug('确认单步');
            const instance = arr.instance!;
            const response = arr.response!;
            instance.sendResponse(response);
        }, callbackArgs);
    }

    /**
     * step in
     */
    protected stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): void {
        const callbackArgs: ICallbackArgs = {
            instance: this,
            response: response,
        };
        this._runtime.step(
            (arr: ICallbackArgs) => {
                Ui.logDebug('确认StepIn');
                const instance = arr.instance!;
                const response = arr.response!;
                instance.sendResponse(response);
            },
            callbackArgs,
            'stopOnStepIn'
        );
    }

    /**
     * step out
     */
    protected stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments): void {
        const callbackArgs: ICallbackArgs = {
            instance: this,
            response: response,
        };
        this._runtime.step(
            (arr: ICallbackArgs) => {
                Ui.logDebug('确认StepOut');
                const instance = arr.instance!;
                const response = arr.response!;
                instance.sendResponse(response);
            },
            callbackArgs,
            'stopOnStepOut'
        );
    }

    /**
     * pause 暂不支持
     */
    protected pauseRequest(response: DebugProtocol.PauseResponse, args: DebugProtocol.PauseArguments): void {
        vscode.window.showInformationMessage('pauseRequest!');
    }

    /**
     * 断开和lua的连接
     * 关闭连接的调用顺序 停止连接时的公共方法要放入 disconnectRequest.
     * 未建立连接 : disconnectRequest
     * 当VScode主动停止连接 : disconnectRequest - > socket end -> socket close
     * 当lua进程主动停止连接 : socket end -> socket close -> disconnectRequest
     */
    protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments): void {
        let disconnectMessage = '[Disconnect Request] 调试器已断开连接.';
        Ui.logging(disconnectMessage);
        this.printLogInDebugConsole(disconnectMessage);

        const restart = args.restart;
        // 给lua发消息，让lua client停止运行
        const callbackArgs: ICallbackArgs = {
            restart: restart,
        };
        this._runtime.stopRun(
            (arr: ICallbackArgs) => {
                //客户端主动断开连接，这里仅做确认
                Ui.logDebug('确认stop');
            },
            callbackArgs,
            'stopRun'
        );
        this._server?.close(); // 关闭 server, 停止 listen. 放在这里的原因是即使未建立连接，也可以停止listen.

        // 删除自身的线程id, 并从LuaDebugSession实例列表中删除自身
        this._threadManager.destructor();
        LuaDebugSession._debugSessionArray.delete(this._threadManager.CUR_THREAD_ID);
        this.sendResponse(response);
    }

    protected restartRequest(response: DebugProtocol.RestartResponse, args: DebugProtocol.RestartArguments): void {
        Ui.logDebug('restartRequest');
    }

    protected restartFrameRequest(response: DebugProtocol.RestartFrameResponse, args: DebugProtocol.RestartFrameArguments): void {
        Ui.logDebug('restartFrameRequest');
    }

    private createSource(filePath: string): Source {
        return new Source(basename(filePath), this.convertDebuggerPathToClient(filePath), undefined, undefined, undefined);
    }

    protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
        response.body = {
            threads: [new Thread(this._threadManager.CUR_THREAD_ID, 'thread ' + this._threadManager.CUR_THREAD_ID)],
        };
        this.sendResponse(response);
    }

    public LuaGarbageCollect() {
        this._runtime.luaGarbageCollect();
    }
}
