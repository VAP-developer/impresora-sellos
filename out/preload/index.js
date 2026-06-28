"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
}
