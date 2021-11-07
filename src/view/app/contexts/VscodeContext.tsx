import * as React from 'react';
import { createContext } from 'react';

export interface IVscodeMessageEventData {
    command: string;
    // DEVTEMP 新增colorinfo
    data: { message: string } | { imgs: string[] } | { templates: string } | { colorinfo: any };
}

export interface IPostdata {
    command: string;
    data?: any;
}

export interface IVscode {
    postMessage: (postdata: IPostdata) => void;
}

export const VscodeContextDefaultValue: IVscode = {
    postMessage: () => null,
};

export const VscodeContext = createContext<IVscode>(VscodeContextDefaultValue);

const VscodeContextProvider = (props: { children: React.ReactNode; vscode: IVscode }) => {
    const { vscode } = props;
    return <VscodeContext.Provider value={vscode}>{props.children}</VscodeContext.Provider>;
};

export default VscodeContextProvider;
