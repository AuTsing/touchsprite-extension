import StatusBar from './StatusBar';
import { StatusBarType } from './StatusBar';
import Output from './Output';

class Ui {
    private static _statusBar: StatusBar = new StatusBar();
    private static _output: Output = new Output();

    public static setStatusBar = (content: string | StatusBarType) => Ui._statusBar.setStatusBar(content);
    public static setStatusBarTemporary = (content: string | StatusBarType, timeout?: number) => Ui._statusBar.setStatusBarTemporary(content, timeout);
    public static resetStatusBar = () => Ui._statusBar.resetStatusBar();

    public static logging = (content: string) => Ui._output.logging(content);
}

export default Ui;
