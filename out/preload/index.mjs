import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
//#region src/preload/index.ts
if (process.contextIsolated) try {
	contextBridge.exposeInMainWorld("electron", electronAPI);
} catch (error) {
	console.error(error);
}
else window.electron = electronAPI;
//#endregion
export {};
