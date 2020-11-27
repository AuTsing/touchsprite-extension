import StatusBar, { StatusBarType } from './StatusBar';
import Output from './Output';
import Pop from './Pop';

class Ui {
    private static _statusBar: StatusBar = new StatusBar();
    private static _output: Output = new Output();
    private static _pop: Pop = new Pop();

    public static setStatusBar = (content: string | StatusBarType) => Ui._statusBar.setStatusBar(content);
    public static setStatusBarTemporary = (content: string | StatusBarType, timeout?: number) => Ui._statusBar.setStatusBarTemporary(content, timeout);
    public static resetStatusBar = () => Ui._statusBar.resetStatusBar();

    public static logging = (content: string) => Ui._output.logging(content);
    public static loggingShow = (content: string) => Ui._output.loggingShow(content);
    public static logError = (content: string) => Ui._output.logError(content);
    public static logWarning = (content: string) => Ui._output.logWarning(content);
    public static logDebug = (content: string) => Ui._output.logDebug(content);
    public static enableDebugChannel = () => Ui._output.enableDebugChannel();

    public static popMessage = (content: string) => Ui._pop.popMessage(content);
    public static popError = (content: string) => Ui._pop.popError(content);
    public static popWarning = (content: string) => Ui._pop.popMessage(content);
}

export default Ui;
