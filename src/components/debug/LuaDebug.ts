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
import { LuaRuntime, ILuaBreakpoint } from './LuaRuntime';
import * as Net from 'net';
import { LineBreakpoint, ConditionBreakpoint, LogPoint } from './Breakpoint';
import { ThreadManager } from './ThreadManager';
import { PathManager } from './PathManager';
import Ui from '../ui/Ui';
import * as os from 'os';
import ProjectGenerator from '../ProjectGenerator';
import TsDebugger from '../TsDebugger';

const { Subject } = require('await-notify');

interface IBreakpoint {
    bkPath: string;
    bksArray: DebugProtocol.Breakpoint[];
}

interface ILaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
    logLevel?: number;
    docPathReplace?: string[];
}

export interface ICallbackArgs {
    instance?: LuaDebugSession;
    response?: DebugProtocol.Response;
    restart?: boolean;
}

export class LuaDebugSession extends LoggingDebugSession {
    private tcpPort: number = 8818; //和客户端连接的端口号，通过VScode的设置赋值
    private replacePath: string[] = []; //替换路径数组
    private dbCheckBreakpoint: boolean = true; //二次确认同文件断点
    private autoReconnect: boolean = false; //客户端断开连接时是否等待重新连接
    private logLevel: number = 1;
    private isConnected = false; //连接成功的标志位
    private server: Net.Server | undefined; // adapter 作为server
    private useLoadstring: boolean = false;

    private readonly tsDebugger: TsDebugger;
    private readonly pathManager: PathManager;
    private readonly threadManager: ThreadManager;
    private readonly runtime: LuaRuntime; //luaDebugRuntime实例
    private readonly variableHandles = new Handles<string>(50000);
    private readonly configurationDone = new Subject();
    private breakpoints: IBreakpoint[] = []; //在socket连接前临时保存断点的数组

    public constructor(tsDebugger: TsDebugger) {
        super('ts-lua-debug.txt');
        this.setDebuggerLinesStartAt1(true);
        this.setDebuggerColumnsStartAt1(true);

        this.tsDebugger = tsDebugger;
        this.threadManager = new ThreadManager();
        this.pathManager = new PathManager();
        this.runtime = new LuaRuntime(this.pathManager);

        this.runtime.on('stopOnEntry', () => {
            this.sendEvent(new StoppedEvent('entry', this.threadManager.CUR_THREAD_ID));
        });
        this.runtime.on('stopOnStep', () => {
            this.sendEvent(new StoppedEvent('step', this.threadManager.CUR_THREAD_ID));
        });
        this.runtime.on('stopOnStepIn', () => {
            this.sendEvent(new StoppedEvent('step', this.threadManager.CUR_THREAD_ID));
        });
        this.runtime.on('stopOnStepOut', () => {
            this.sendEvent(new StoppedEvent('step', this.threadManager.CUR_THREAD_ID));
        });
        this.runtime.on('stopOnCodeBreakpoint', () => {
            // stopOnCodeBreakpoint 指的是遇到 LuaPanda.BP()，因为是代码中的硬断点，VScode中不会保存这个断点信息，故不做校验
            this.sendEvent(new StoppedEvent('breakpoint', this.threadManager.CUR_THREAD_ID));
        });
        this.runtime.on('stopOnBreakpoint', () => {
            // 因为lua端所做的断点命中可能出现同名文件错误匹配，这里要再次校验lua端命中的行列号是否在 breakpointsArray 中
            if (this.checkIsRealHitBreakpoint()) {
                this.sendEvent(new StoppedEvent('breakpoint', this.threadManager.CUR_THREAD_ID));
            } else {
                // go on running
                this.runtime.continueWithFakeHitBk(() => {
                    Ui.outputDebug('命中同名文件中的断点, 确认继续运行');
                });
            }
        });
        this.runtime.on('stopOnException', () => {
            this.sendEvent(new StoppedEvent('exception', this.threadManager.CUR_THREAD_ID));
        });
        this.runtime.on('stopOnPause', () => {
            this.sendEvent(new StoppedEvent('exception', this.threadManager.CUR_THREAD_ID));
        });
        this.runtime.on('breakpointValidated', (bp: ILuaBreakpoint) => {
            this.sendEvent(new BreakpointEvent('changed', <DebugProtocol.Breakpoint>{ verified: bp.verified, id: bp.id }));
        });
        this.runtime.on('logInDebugConsole', (message: string) => {
            this.printLogInDebugConsole(message);
        });
        this.runtime.on('end', () => {
            this.sendEvent(new TerminatedEvent());
        });
    }

    // 在有同名文件的情况下，需要再次进行命中判断。
    private checkIsRealHitBreakpoint() {
        if (!this.dbCheckBreakpoint) {
            // 用户关闭了二次断点校验，直接返回成功
            return true;
        }

        const steak = this.runtime.breakStacks;
        const steakPath = steak[0].file;
        const steakLine = steak[0].line;
        if (this.breakpoints) {
            for (const bkMap of this.breakpoints) {
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
        Ui.outputDebug('initializeRequest!');
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
        // this.sendEvent(new InitializedEvent());
    }

    /**
     * configurationDone后通知launchRequest
     */
    protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
        super.configurationDoneRequest(response, args);
        this.configurationDone.notify();
    }

    /**
     * Launch 模式初始化代码
     */
    protected async launchRequest(response: DebugProtocol.LaunchResponse, args: ILaunchRequestArguments) {
        await this.configurationDone.wait(1000);

        this.logLevel = args.logLevel !== undefined ? args.logLevel : 0;
        if (this.logLevel <= 0) {
            Ui.enableDebugChannel();
        }
        if (args.docPathReplace instanceof Array && args.docPathReplace.length === 2) {
            this.replacePath = [
                this.pathManager.genUnifiedPath(String(args.docPathReplace[0])),
                this.pathManager.genUnifiedPath(String(args.docPathReplace[1])),
            ];
        }

        const pjg = new ProjectGenerator('maintest.lua');
        await pjg.generate();
        const root = await pjg.getRoot();

        this.pathManager.rebuildWorkspaceNamePathMap(root);
        this.pathManager.checkSameNameFile(false);

        const sendInfo = {
            stopOnEntry: false,
            luaFileExtension: '',
            cwd: root,
            isNeedB64EncodeStr: true,
            TempFilePath: root,
            logLevel: this.logLevel,
            pathCaseSensitivity: true,
            OSType: os.type(),
            clibPath: '',
            useCHook: false,
            adapterVersion: '3.2.0',
            autoPathMode: true,
            distinguishSameNameFile: false,
            truncatedOPath: '',
            DevelopmentMode: false,
        };
        this.startServer(sendInfo);
        const ret = await this.tsDebugger.startClient();
        if (!ret) {
            this.sendEvent(new TerminatedEvent(this.autoReconnect));
            return;
        }

        this.breakpoints = [];
        this.sendEvent(new InitializedEvent()); //收到返回后，执行setbreakpoint
        this.sendResponse(response);
    }

    private startServer(sendInfo: any) {
        this.isConnected = false;
        this.server = Net.createServer(socket => {
            this.runtime.dataProcessor.socket = socket;
            this.runtime.start((_, info) => {
                this.isConnected = true;
                this.server?.close();
                this.printLogInDebugConsole('[Connected] 已连接 >> ' + socket.remoteAddress + ':' + socket.remotePort);
                if (info.UseLoadstring === '1') {
                    this.useLoadstring = true;
                } else {
                    this.useLoadstring = false;
                }
                if (info.isNeedB64EncodeStr === 'true') {
                    this.runtime.dataProcessor.isNeedB64EncodeStr = true;
                } else {
                    this.runtime.dataProcessor.isNeedB64EncodeStr = false;
                }
                for (const bkMap of this.breakpoints) {
                    this.runtime.setBreakPoint(bkMap.bkPath, bkMap.bksArray);
                }
            }, sendInfo);
            socket.on('end', () => {
                Ui.outputDebug('[Socket End]');
            });
            socket.on('close', () => {
                if (this.isConnected) {
                    this.isConnected = false;
                    Ui.outputDebug('[Socket Close]');
                    vscode.window.showInformationMessage('[Disconnect] 连接已断开');
                    this.runtime.dataProcessor.socket = undefined;
                    this.sendEvent(new TerminatedEvent(this.autoReconnect));
                }
            });
            socket.on('data', data => {
                Ui.outputDebug('[Socket Got Data] ' + data);
                this.runtime.dataProcessor.resolveMsg(data.toString());
            });
        }).listen(this.tcpPort, 0, () => {
            Ui.outputDebug('[Socket Listening]');
            this.printLogInDebugConsole('[Listening] 等待设备连接中...');
        });
    }

    /**
     * VSCode -> Adapter 设置(删除)断点
     */
    protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
        Ui.outputDebug('setBreakPointsRequest');
        let path = <string>args.source.path;
        path = this.pathManager.genUnifiedPath(path);

        if (this.replacePath && this.replacePath.length === 2) {
            path = path.replace(this.replacePath[1], this.replacePath[0]);
        }

        const vscodeBreakpoints: DebugProtocol.Breakpoint[] = []; //VScode UI识别的断点（起始行号1）

        args.breakpoints?.map(bp => {
            const id = this.runtime.getBreakPointId();
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
        if (this.breakpoints === undefined) {
            this.breakpoints = [];
        }

        let isbkPathExist = false; //断点路径已经存在于断点列表中
        for (let bkMap of this.breakpoints) {
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
            this.breakpoints.push(bk);
        }

        if (this.runtime.dataProcessor.socket) {
            //已建立连接
            const callbackArgs: ICallbackArgs = {
                instance: this,
                response: response,
            };
            this.runtime.setBreakPoint(
                path,
                vscodeBreakpoints,
                args => {
                    Ui.outputDebug('确认断点');
                    const { instance, response } = args as ICallbackArgs;
                    if (instance && response) {
                        instance.sendResponse(response); //在收到debugger的返回后，通知VSCode, VSCode界面的断点会变成已验证
                    }
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
        const stk = this.runtime.stack(startFrame, endFrame);
        const stkf = stk.frames.map((f: any) => {
            let source = f.file;
            if (this.replacePath && this.replacePath.length === 2) {
                source = source.replace(this.replacePath[0], this.replacePath[1]);
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
            if (this.useLoadstring == false) {
                let watchString = args.expression;
                watchString = watchString.replace(/\[/g, '.');
                watchString = watchString.replace(/\"/g, '');
                watchString = watchString.replace(/\'/g, '');
                watchString = watchString.replace(/]/g, '');
                args.expression = watchString;
            }

            this.runtime.getWatchedVariable(
                (args, info) => {
                    const { instance, response } = args as ICallbackArgs;
                    if (instance && response) {
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
                    }
                },
                callbackArgs,
                args.expression,
                args.frameId
            );
        } else if (args.context === 'repl') {
            //repl -- 调试控制台
            this.runtime.getReplExpression(
                (args, info) => {
                    const { instance, response } = args as ICallbackArgs;
                    if (instance && response) {
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
                    }
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
        scopes.push(new Scope('Local', this.variableHandles.create('10000_' + frameReference), false));
        scopes.push(new Scope('Global', this.variableHandles.create('20000_' + frameReference), true));
        scopes.push(new Scope('UpValue', this.variableHandles.create('30000_' + frameReference), false));
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
        let referenceString = this.variableHandles.get(args.variablesReference);
        let referenceArray: string[] = [];
        if (referenceString != null) {
            referenceArray = referenceString.split('_');
            if (referenceArray.length < 2) {
                Ui.outputError('[variablesRequest Error] #referenceArray < 2 , #referenceArray = ' + referenceArray.length);
                this.sendResponse(response);
                return;
            }
        } else {
            //_variableHandles 取不到的情况下 referenceString 即为真正的变量 ref
            referenceArray[0] = String(args.variablesReference);
        }

        this.runtime.setVariable(
            (args, info) => {
                const { instance, response } = args as ICallbackArgs;
                if (instance && response) {
                    if (info.success === 'true') {
                        response.body = {
                            value: String(info.value),
                            type: String(info.type),
                            variablesReference: parseInt(info.variablesReference),
                        };
                        Ui.outputDebug(info.tip);
                    } else {
                        Ui.outputError('变量赋值失败 [' + info.tip + ']');
                    }
                    instance.sendResponse(response);
                }
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
        let referenceString = this.variableHandles.get(args.variablesReference);
        let referenceArray: string[] = [];
        if (referenceString != null) {
            referenceArray = referenceString.split('_');
            if (referenceArray.length < 2) {
                Ui.outputError('[variablesRequest Error] #referenceArray < 2 , #referenceArray = ' + referenceArray.length);
                this.sendResponse(response);
                return;
            }
        } else {
            //_variableHandles 取不到的情况下 referenceString 即为真正的变量ref
            referenceArray[0] = String(args.variablesReference);
        }

        this.runtime.getVariable(
            (args, info) => {
                const { instance, response } = args as ICallbackArgs;
                if (instance && response) {
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
                    this.sendResponse(response);
                }
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
        this.runtime.continue(args => {
            Ui.outputDebug('确认继续运行');
            const { instance, response } = args as ICallbackArgs;
            if (instance && response) {
                instance.sendResponse(response);
            }
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
        this.runtime.step(args => {
            Ui.outputDebug('确认单步');
            const { instance, response } = args as ICallbackArgs;
            if (instance && response) {
                instance.sendResponse(response);
            }
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
        this.runtime.step(
            args => {
                Ui.outputDebug('确认StepIn');
                const { instance, response } = args as ICallbackArgs;
                if (instance && response) {
                    instance.sendResponse(response);
                }
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
        this.runtime.step(
            args => {
                Ui.outputDebug('确认StepOut');
                const { instance, response } = args as ICallbackArgs;
                if (instance && response) {
                    instance.sendResponse(response);
                }
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
        this.printLogInDebugConsole('[Disconnect Request] 已断开连接');

        const restart = args.restart;
        // 给lua发消息，让lua client停止运行
        const callbackArgs: ICallbackArgs = {
            restart: restart,
        };
        this.runtime.stopRun(
            args => {
                //客户端主动断开连接，这里仅做确认
                Ui.outputDebug('确认stop');
            },
            callbackArgs,
            'stopRun'
        );
        this.server?.close(); // 关闭 server, 停止 listen. 放在这里的原因是即使未建立连接，也可以停止listen.

        // 删除自身的线程id, 并从LuaDebugSession实例列表中删除自身
        this.threadManager.destructor();
        this.sendResponse(response);
    }

    protected restartRequest(response: DebugProtocol.RestartResponse, args: DebugProtocol.RestartArguments): void {
        Ui.outputDebug('restartRequest');
    }

    protected restartFrameRequest(response: DebugProtocol.RestartFrameResponse, args: DebugProtocol.RestartFrameArguments): void {
        Ui.outputDebug('restartFrameRequest');
    }

    private createSource(filePath: string): Source {
        return new Source(basename(filePath), this.convertDebuggerPathToClient(filePath), undefined, undefined, undefined);
    }

    protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
        response.body = {
            threads: [new Thread(this.threadManager.CUR_THREAD_ID, 'thread ' + this.threadManager.CUR_THREAD_ID)],
        };
        this.sendResponse(response);
    }

    public LuaGarbageCollect() {
        this.runtime.luaGarbageCollect();
    }
}
