import * as React from 'react';
import { FC } from 'react';
import { IVscode } from './contexts/vscodeContext';
import VscodeContextProvider from './contexts/vscodeContext';
import CaptrueContextProvider from './contexts/CaptureContext';
import CoordinateContextProvider from './contexts/CoordinateContext';
import RecordContextProvider from './contexts/RecordContext';
import { Layout } from 'antd';
import Navbar from './components/Navbar';
import Canvas from './components/Canvas';
import Zoom from './components/Zoom';
import CoordinateInfo from './components/CoordinateInfo';
import RecordList from './components/RecordList';

const { Header, Sider, Content } = Layout;

const App: FC<{ vscode: IVscode }> = ({ vscode }) => {
    return (
        <div>
            <VscodeContextProvider vscode={vscode}>
                <CaptrueContextProvider>
                    <CoordinateContextProvider>
                        <RecordContextProvider>
                            <Layout>
                                <Layout>
                                    <Header className='header'>
                                        <Navbar />
                                    </Header>
                                    <Content className='content'>
                                        <Canvas />
                                    </Content>
                                </Layout>
                                <Sider className='sider' width={315}>
                                    <Zoom />
                                    <CoordinateInfo />
                                    <RecordList />
                                </Sider>
                            </Layout>
                        </RecordContextProvider>
                    </CoordinateContextProvider>
                </CaptrueContextProvider>
            </VscodeContextProvider>
        </div>
    );
};

export default App;
