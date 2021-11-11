import * as React from 'react';
import { FC } from 'react';

import { IVscode } from './contexts/VscodeContext';
import VscodeContextProvider from './contexts/VscodeContext';
import CaptrueContextProvider from './contexts/CaptureContext';
import CoordinateContextProvider from './contexts/CoordinateContext';
import RecordContextProvider from './contexts/RecordContext';
import KeyboardContextProvider from './contexts/KeyboardContext';
import SettingContextProvider from './contexts/SettingContext';
import Navbar from './components/Navbar';
import Canvas from './components/Canvas';
import Zoom from './components/Zoom';
import CoordinateInfo from './components/CoordinateInfo';
import RecordList from './components/RecordList';

const App: FC<{ vscode: IVscode }> = ({ vscode }) => {
    return (
        <VscodeContextProvider vscode={vscode}>
        <SettingContextProvider>
        <KeyboardContextProvider>
        <CaptrueContextProvider>
        <CoordinateContextProvider>
        <RecordContextProvider>
            <div className='app'>
                <div className='header-and-content-container'>
                    <div className='header-container'>
                        <Navbar />
                    </div>
                    <div className='content-container'>
                        <Canvas />
                    </div>
                </div>
                <div className='sider-container'>
                    <Zoom />
                    <CoordinateInfo />
                    <RecordList />
                </div>
            </div>
        </RecordContextProvider>
        </CoordinateContextProvider>
        </CaptrueContextProvider>
        </KeyboardContextProvider>
        </SettingContextProvider>
        </VscodeContextProvider>
    );
};

export default App;
