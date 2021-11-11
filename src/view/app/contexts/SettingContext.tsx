import React, { createContext, useState } from 'react';

export interface ISettingContext {
    showSamePixelInZoomValue: boolean;
    setShowSamePixelInZoomValue: (value: boolean) => void;
}

export const SettingContextDefaultValue: ISettingContext = {
    showSamePixelInZoomValue: false,
    setShowSamePixelInZoomValue: () => null,
};

export const SettingContext = createContext<ISettingContext>(SettingContextDefaultValue);

const SettingContextProvider = (props: { children: React.ReactNode }) => {
    const [showSamePixelInZoomValue, setShowSamePixelInZoomValue] = useState<boolean>(false);

    return (
        <SettingContext.Provider
            value={{
                showSamePixelInZoomValue,
                setShowSamePixelInZoomValue,
            }}
        >
            {props.children}
        </SettingContext.Provider>
    );
};

export default SettingContextProvider;
