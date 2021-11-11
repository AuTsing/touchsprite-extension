import React, { createContext, useCallback } from 'react';

export interface IKeyboardContext {
    listen: (type: string, listener: (...args: any) => void) => void;
    leave: (type: string, listener: (...args: any) => void) => void;
    pause: () => void;
    resume: () => void;
    stop: () => void;
}

export const KeyboardContextDefaultValue: IKeyboardContext = {
    listen: () => null,
    leave: () => null,
    pause: () => null,
    resume: () => null,
    stop: () => null,
};

export const KeyboardContext = createContext<IKeyboardContext>(KeyboardContextDefaultValue);

let listeners: { type: string; listener: () => void }[] = [];
let pauseList: { type: string; listener: () => void }[] = [];

const KeyboardContextProvider = (props: { children: React.ReactNode }) => {
    const listen = useCallback((type: string, listener: (...args: any) => void) => {
        window.addEventListener(type, listener);
        listeners.push({ type, listener });
    }, []);

    const leave = useCallback((type: string, listener: (...args: any) => void) => {
        window.removeEventListener(type, listener);
        listeners = listeners.filter(lsn => lsn.listener !== listener);
    }, []);

    const pause = useCallback(() => {
        listeners.forEach(listener => {
            window.removeEventListener(listener.type, listener.listener);
            pauseList.push(listener);
        });
    }, []);

    const resume = useCallback(() => {
        pauseList.forEach(({ type, listener }) => {
            window.addEventListener(type, listener);
            pauseList = [];
        });
    }, []);

    const stop = useCallback(() => {
        listeners.forEach(({ type, listener }) => {
            window.removeEventListener(type, listener);
            pauseList = [];
        });
    }, []);

    return (
        <KeyboardContext.Provider
            value={{
                listen,
                leave,
                pause,
                resume,
                stop,
            }}
        >
            {props.children}
        </KeyboardContext.Provider>
    );
};

export default KeyboardContextProvider;
