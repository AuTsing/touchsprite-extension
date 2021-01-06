import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { IVscode } from './contexts/VscodeContext';
import './index.css';
import App from './App';

declare global {
    interface Window {
        acquireVsCodeApi: () => IVscode;
    }
}

const vscode = window.acquireVsCodeApi();

ReactDOM.render(<App vscode={vscode} />, document.getElementById('root'));
