import * as vscode from 'vscode';
import * as Net from 'net';
import {
    BreakpointEvent,
    Handles,
    InitializedEvent,
    LoggingDebugSession,
    OutputEvent,
    Scope,
    Source,
    StackFrame,
    StoppedEvent,
    Thread,
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import ThreadManager from './ThreadManager';
import LuaRuntime from './LuaRuntime';
import { ConditionBreakpoint, LineBreakpoint, LogPoint } from './BreakPoint';
import Ui from '../ui/Ui';
import { Subject } from 'await-notify';
import * as path from 'path';
import { DataProcessor } from './DataProcessor';
import { PathManager } from './PathManager';
import Tools from '../lib/Tools';
import * as os from 'os';

interface ILaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
    /** An absolute path to the "program" to debug. */
    program: string;
    /** Automatically stop target after launch. If not specified, target does not stop. */
    stopOnEntry?: boolean;
    /** enable logging the Debug Adapter Protocol */
    trace?: boolean;
    /** run without debugging */
    noDebug?: boolean;
    name: string;
    connectionPort: number;
    luaFileExtension: string;
    cwd: string;
    isNeedB64EncodeStr: boolean;
    TempFilePath: string;
    logLevel: number;
    pathCaseSensitivity: boolean;
    useCHook: boolean;
    distinguishSameNameFile: boolean;
    truncatedOPath: string;
    DevelopmentMode: boolean;
}

export interface ISendArguments {
    [key: string]: any;
    stopOnEntry: boolean;
    luaFileExtension: string;
    cwd: string;
    isNeedB64EncodeStr: boolean;
    tempFilePath: string;
    logLevel: number;
    pathCaseSensitivity: boolean;
    useCHook: boolean;
    distinguishSameNameFile: boolean;
    truncatedOPath: string;
    developmentMode: boolean;

    osType: string;
    clibPath: string;
    adapterVersion: string;
    autoPathMode: boolean;
}

interface IBreakpointRecord {
    bkPath: string;
    bksArray: DebugProtocol.Breakpoint[];
}

export interface ICallbackArgs {
    instance?: LuaDebugSession;
    response?: DebugProtocol.Response;
    restart?: boolean;
}

export class LuaDebugSession extends LoggingDebugSession {
    private _threadManager: ThreadManager;
    private _runtime: LuaRuntime;
    private _dataProcessor: DataProcessor;
    private _pathManager: PathManager;

    private _dbCheckBreakpoint = true;
    private _breakpointsArray: IBreakpointRecord[] = [];
    private _configurationDone = new Subject();
    private _connectionFlag = false; //连接成功的标志位
    private _server: Net.Server | undefined; //调试服务器
    private _useLoadString: boolean = false;
    private _variableHandles = new Handles<string>(50000); //Handle编号从50000开始

    //save all active LuaDebugSession instance
    private static _debugSessionArray: Map<number, LuaDebugSession> = new Map<number, LuaDebugSession>();

    constructor() {
        super('lua-debug.txt');
        this.setDebuggerLinesStartAt1(true);
        this.setDebuggerColumnsStartAt1(true);

        this._threadManager = new ThreadManager();
        this._runtime = new LuaRuntime();
        this._dataProcessor = new DataProcessor();
        this._pathManager = new PathManager();
        this._runtime.dataProcessor = this._dataProcessor;
        this._runtime.pathManager = this._pathManager;
        this._dataProcessor.runtime = this._runtime;

        // setup event handlers
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
                    Ui.logging('命中同名文件中的断点, 确认继续运行');
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

    private printLogInDebugConsole(message: any) {
        this.sendEvent(new OutputEvent(message + '\n', 'console'));
    }

    /**
     * VScode前端的首个请求，询问debug adapter所能提供的特性
     * 这个方法是VSCode调过来的，adapter拿到其中的参数进行填充. 再回给VSCode,VSCode根据这些设置做不同的显示
     */
    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
        Ui.logging('initializeRequest');

        // build and return the capabilities of this debug adapter:
        response.body = response.body || {};

        // the adapter implements the configurationDoneRequest.
        response.body.supportsConfigurationDoneRequest = true;

        // make VS Code to use 'evaluate' when hovering over source
        response.body.supportsEvaluateForHovers = true;

        // make VS Code to show a 'step back' button
        response.body.supportsStepBack = true;

        // make VS Code to support data breakpoints
        // response.body.supportsDataBreakpoints = true;

        // make VS Code to support completion in REPL
        // response.body.supportsCompletionsRequest = true;
        // response.body.completionTriggerCharacters = [ ".", "[" ];

        // make VS Code to send cancelRequests
        // response.body.supportsCancelRequest = true;

        // make VS Code send the breakpointLocations request
        // response.body.supportsBreakpointLocationsRequest = true;

        // make VS Code provide "Step in Target" functionality
        // response.body.supportsStepInTargetsRequest = true;

        response.body.supportsSetVariable = true; //修改变量的值
        response.body.supportsFunctionBreakpoints = false;
        response.body.supportsConditionalBreakpoints = true;
        response.body.supportsHitConditionalBreakpoints = true;
        response.body.supportsLogPoints = true;
        // response.body.supportsRestartRequest = false;
        // response.body.supportsRestartFrame = false;

        this.sendResponse(response);

        // since this debug adapter can accept configuration requests like 'setBreakpoint' at any time,
        // we request them early by sending an 'initializeRequest' to the frontend.
        // The frontend will end the configuration sequence by calling 'configurationDone' request.
        this.sendEvent(new InitializedEvent());
    }

    /**
     * configurationDone后通知launchRequest
     */
    protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
        Ui.logging('configurationDoneRequest');
        super.configurationDoneRequest(response, args);

        // notify the launchRequest that configuration has finished
        this._configurationDone.notify();
    }

    /**
     * Launch 模式初始化代码
     */
    protected async launchRequest(response: DebugProtocol.LaunchResponse, args: ILaunchRequestArguments) {
        Ui.logging('launchRequest');

        await this._configurationDone.wait(1000);

        const sendArgs: ISendArguments = {
            stopOnEntry: !!args.stopOnEntry,
            luaFileExtension: args.luaFileExtension,
            cwd: args.cwd,
            isNeedB64EncodeStr: !!args.isNeedB64EncodeStr,
            tempFilePath: args.TempFilePath,
            logLevel: args.logLevel,
            pathCaseSensitivity: args.pathCaseSensitivity,
            useCHook: args.useCHook,
            distinguishSameNameFile: !!args.distinguishSameNameFile,
            truncatedOPath: args.truncatedOPath,
            developmentMode: args.DevelopmentMode,

            osType: os.type(),
            clibPath: this._pathManager.getClibPathInExtension(),
            adapterVersion: Tools.adapterVersion,
            autoPathMode: this._pathManager.useAutoPathMode,
        };
        this.printLogInDebugConsole('[Listening] 调试器 VSCode Server 已启动，正在等待连接。  TargetName:' + args.name + ' Port:' + args.connectionPort);
        this.startServer(sendArgs);

        this._breakpointsArray = [];

        this.sendResponse(response);
    }

    private startServer(args: ISendArguments) {
        this._connectionFlag = false;
        this._server = Net.createServer(socket => {
            //--connect--
            this._dataProcessor.socket = socket;
            //向debugger发送含配置项的初始化协议
            this._runtime.start((_, info) => {
                //之所以使用 connectionFlag 连接成功标志位， 是因为代码进入 Net.createServer 的回调后，仍然可能被client超时断开连接。所以标志位被放入了
                //_runtime.start 初始化消息发送成功之后。
                this._connectionFlag = true;
                this._server?.close(); //_server 已建立连接，不再接受新的连接
                const connectMessage = '[Connected] VSCode Server 已建立连接! Remote device info  ' + socket.remoteAddress + ':' + socket.remotePort;
                Ui.logging(connectMessage);
                this.printLogInDebugConsole(connectMessage);
                this.printLogInDebugConsole('[Tips] 当停止在断点处时，可在调试控制台输入要观察变量或执行表达式. ');
                if (info.UseLoadstring === '1') {
                    this._useLoadString = true;
                } else {
                    this._useLoadString = false;
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
            }, args);
            //--connect end--
            socket.on('end', () => {
                Ui.logging('Socket end');
            });
            socket.on('close', () => {
                if (this._connectionFlag) {
                    this._connectionFlag = false;
                    Ui.logging('Socket close!');
                    vscode.window.showInformationMessage('[LuaPanda] 调试器已断开连接');
                    // this._dataProcessor._socket 是在建立连接后赋值，所以在断开连接时删除
                    delete this._dataProcessor.socket;
                }
            });
            socket.on('data', data => {
                Ui.logging('[Get Msg]:' + data);
                this._dataProcessor.processMsg(data.toString());
            });
        }).listen(args.connectionPort, 0, function () {
            Ui.logging('listening...');
        });
    }

    /**
     * VSCode -> Adapter 设置(删除)断点
     */
    protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
        Ui.logging('setBreakPointsRequest');

        let path = args.source.path as string;
        path = this._pathManager.genUnifiedPath(path);

        const vscodeBreakpoints: DebugProtocol.Breakpoint[] = []; //VScode UI识别的断点（起始行号1）

        args.breakpoints!.map(bp => {
            const id = this._runtime.getBreakPointId();
            let breakpoint; // 取出args中的断点并判断类型。
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
        if (this._breakpointsArray == undefined) {
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
                (args: ICallbackArgs) => {
                    Ui.logging('确认断点');
                    const ins = args.instance!;
                    const resp = args.response!;
                    ins.sendResponse(resp); //在收到debugger的返回后，通知VSCode, VSCode界面的断点会变成已验证
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
            const source = f.file;
            return new StackFrame(f.index, f.name, this.createSource(source), f.line);
        });
        response.body = {
            stackFrames: stkf,
            totalFrames: stk.count,
        };
        this.sendResponse(response);
    }

    private createSource(filePath: string): Source {
        return new Source(path.basename(filePath), this.convertDebuggerPathToClient(filePath), undefined, undefined, undefined);
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
        if (args.context == 'watch' || args.context == 'hover') {
            //把B["A"] ['A'] => B.A形式
            if (this._useLoadString == false) {
                let watchString = args.expression;
                watchString = watchString.replace(/\[/g, '.');
                watchString = watchString.replace(/\"/g, '');
                watchString = watchString.replace(/\'/g, '');
                watchString = watchString.replace(/]/g, '');
                args.expression = watchString;
            }
            this._runtime.getWatchedVariable(
                (args: ICallbackArgs, info: any) => {
                    const ins = args.instance!;
                    const resp = args.response!;
                    if (info.length === 0) {
                        //没有查到
                        resp.body = {
                            result: '未能查到变量的值',
                            type: 'string',
                            variablesReference: 0,
                        };
                    } else {
                        resp.body = {
                            result: info[0].value,
                            type: info[0].type,
                            variablesReference: parseInt(info[0].variablesReference),
                        };
                    }
                    ins.sendResponse(resp); //第二个参数是response
                },
                callbackArgs,
                args.expression,
                args.frameId
            );
        }
        //repl -- 调试控制台
        else if (args.context == 'repl') {
            this._runtime.getReplExpression(
                (args: ICallbackArgs, info: any) => {
                    const ins = args.instance!;
                    const resp = args.response!;
                    if (info.length === 0) {
                        //没有查到
                        resp.body = {
                            result: 'nil',
                            variablesReference: 0,
                        };
                    } else {
                        resp.body = {
                            result: info[0].value,
                            type: info[0].type,
                            variablesReference: parseInt(info[0].variablesReference),
                        };
                    }
                    ins.sendResponse(resp);
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
        const scopes: Scope[] = [];
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
    protected setVariableRequest(response: DebugProtocol.SetVariableResponse, args: DebugProtocol.SetVariableArguments) {
        const callbackArgs: ICallbackArgs = {
            instance: this,
            response: response,
        };
        const referenceString = this._variableHandles.get(args.variablesReference);
        let referenceArray: string[] = [];

        if (referenceString != null) {
            referenceArray = referenceString.split('_');
            if (referenceArray.length < 2) {
                Ui.logging('[variablesRequest Error] #referenceArray < 2 , #referenceArray = ' + referenceArray.length);
                this.sendResponse(response);
                return;
            }
        } else {
            //_variableHandles 取不到的情况下 referenceString 即为真正的变量 ref
            referenceArray[0] = String(args.variablesReference);
        }
        this._runtime.setVariable(
            (args: ICallbackArgs, info: any) => {
                const ins = args.instance!;
                const resp = args.response!;
                if (info.success === 'true') {
                    resp.body = {
                        value: String(info.value),
                        type: String(info.type),
                        variablesReference: parseInt(info.variablesReference),
                    };
                    Ui.logging(info.tip);
                } else {
                    Ui.logging('变量赋值失败 [' + info.tip + ']');
                }
                ins.sendResponse(resp);
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
        const referenceString = this._variableHandles.get(args.variablesReference);
        let referenceArray: string[] = [];

        if (referenceString != null) {
            referenceArray = referenceString.split('_');
            if (referenceArray.length < 2) {
                Ui.logging('[variablesRequest Error] #referenceArray < 2 , #referenceArray = ' + referenceArray.length);
                this.sendResponse(response);
                return;
            }
        } else {
            //_variableHandles 取不到的情况下 referenceString 即为真正的变量ref
            referenceArray[0] = String(args.variablesReference);
        }

        this._runtime.getVariable(
            (args: ICallbackArgs, info: any) => {
                if (info == undefined) {
                    info = [];
                }
                const ins = args.instance!;
                const resp = args.response!;
                const variables: DebugProtocol.Variable[] = [];
                info.forEach((element: any) => {
                    variables.push({
                        name: element.name,
                        type: element.type,
                        value: element.value,
                        variablesReference: parseInt(element.variablesReference),
                    });
                });
                resp.body = {
                    variables: variables,
                };
                ins.sendResponse(resp);
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
        this._runtime.continue((args: ICallbackArgs) => {
            Ui.logging('确认继续运行');
            const ins = args.instance!;
            const resp = args.response!;
            ins.sendResponse(resp);
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
        this._runtime.step((args: ICallbackArgs) => {
            Ui.logging('确认单步');
            const ins = args.instance!;
            const resp = args.response!;
            ins.sendResponse(resp);
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
            (args: ICallbackArgs) => {
                const ins = args.instance!;
                const resp = args.response!;
                ins.sendResponse(resp);
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
            (args: ICallbackArgs) => {
                Ui.logging('确认StepOut');
                const ins = args.instance!;
                const resp = args.response!;
                ins.sendResponse(resp);
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
        const disconnectMessage = '[Disconnect Request] 调试器已断开连接.';
        Ui.logging(disconnectMessage);
        this.printLogInDebugConsole(disconnectMessage);

        const callbackArgs: ICallbackArgs = {
            restart: args.restart,
        };
        this._runtime.stopRun(
            (args: ICallbackArgs) => {
                //客户端主动断开连接，这里仅做确认
                Ui.logging('确认stop');
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
        Ui.logging('restartRequest');
    }

    protected restartFrameRequest(response: DebugProtocol.RestartFrameResponse, args: DebugProtocol.RestartFrameArguments): void {
        Ui.logging('restartFrameRequest');
    }

    protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
        response.body = {
            threads: [new Thread(this._threadManager.CUR_THREAD_ID, 'thread ' + this._threadManager.CUR_THREAD_ID)],
        };
        this.sendResponse(response);
    }
}
