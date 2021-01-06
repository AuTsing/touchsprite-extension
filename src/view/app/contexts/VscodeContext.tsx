import * as React from 'react';
import { createContext } from 'react';

export interface IVscodeMessageEventData {
    command: string;
    data: { message: string } | { imgs: string[] } | { templates: string };
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
