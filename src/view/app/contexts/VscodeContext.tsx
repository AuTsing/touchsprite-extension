import * as React from 'react';
import { createContext } from 'react';

export interface IPostdata {
    command: string;
    data?: any;
}

export interface IVscode {
    postMessage: (postdata: IPostdata) => void;
}

export const VscodeContext = createContext<IVscode>(undefined);

const VscodeContextProvider = (props: { children: React.ReactNode; vscode: IVscode }) => {
    const { vscode } = props;
    return <VscodeContext.Provider value={vscode}>{props.children}</VscodeContext.Provider>;
};

export default VscodeContextProvider;
